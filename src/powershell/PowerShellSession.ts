import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import * as os from 'node:os';
import * as vscode from 'vscode';
import {
  EXECUTION_END_MARKER,
  EXECUTION_ERROR_MARKER,
  EXECUTION_START_MARKER,
  OUTPUT_STRING_WIDTH
} from '../constants';
import type { SessionExecutionResult } from '../types';
import { buildBootstrapScript, buildEvaluationScript } from './powerShellScriptBuilder';

interface PendingRequest {
  requestId: string;
  code: string;
  startedAt: number;
  lines: string[];
  isCapturing: boolean;
  isError: boolean;
  resolve: (result: SessionExecutionResult) => void;
  reject: (error: Error) => void;
}

const POWERSHELL_EXECUTABLES = ['pwsh', 'powershell'];

export class PowerShellSession implements vscode.Disposable {
  private process: ChildProcessWithoutNullStreams | undefined;
  private startPromise: Promise<void> | undefined;
  private readonly queuedRequests: PendingRequest[] = [];
  private activeRequest: PendingRequest | undefined;
  private stdoutBuffer = '';
  private stderrBuffer = '';

  constructor(
    private readonly outputChannel: vscode.OutputChannel,
    private readonly spawnProcess: typeof spawn = spawn
  ) {}

  public async execute(code: string): Promise<SessionExecutionResult> {
    return new Promise<SessionExecutionResult>((resolve, reject) => {
      this.queuedRequests.push({
        requestId: randomUUID(),
        code,
        startedAt: Date.now(),
        lines: [],
        isCapturing: false,
        isError: false,
        resolve,
        reject
      });
      void this.runNextRequest();
    });
  }

  public dispose(): void {
    if (this.process) {
      this.process.stdin.end();
      this.process.kill();
      this.process = undefined;
    }
  }

  private async runNextRequest(): Promise<void> {
    if (this.activeRequest || this.queuedRequests.length === 0) {
      return;
    }

    await this.ensureStarted();

    const nextRequest = this.queuedRequests.shift();

    if (!nextRequest || !this.process) {
      return;
    }

    this.activeRequest = nextRequest;
    const script = buildEvaluationScript(nextRequest.code, nextRequest.requestId, OUTPUT_STRING_WIDTH);
    this.process.stdin.write(`${script}${os.EOL}`, 'utf8');
  }

  private async ensureStarted(): Promise<void> {
    if (this.process) {
      return;
    }

    if (!this.startPromise) {
      this.startPromise = this.startSession();
    }

    await this.startPromise;
  }

  private async startSession(): Promise<void> {
    let lastError: Error | undefined;

    for (const executable of POWERSHELL_EXECUTABLES) {
      try {
        await this.startWithExecutable(executable);
        this.outputChannel.appendLine(`Started PowerShell session with ${executable}.`);
        return;
      } catch (error) {
        lastError = toError(error);
      }
    }

    this.startPromise = undefined;
    throw lastError ?? new Error('Unable to start PowerShell.');
  }

  private async startWithExecutable(executable: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const child = this.spawnProcess(executable, ['-NoLogo', '-NoProfile', '-NoExit', '-Command', '-'], {
        stdio: 'pipe',
        windowsHide: true
      });

      const handleSpawn = (): void => {
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        this.attachProcess(child);
        child.stdin.write(`${buildBootstrapScript()}${os.EOL}`, 'utf8');
        child.off('error', handleError);
        resolve();
      };

      const handleError = (error: Error): void => {
        child.off('spawn', handleSpawn);
        reject(error);
      };

      child.once('spawn', handleSpawn);
      child.once('error', handleError);
    });
  }

  private attachProcess(child: ChildProcessWithoutNullStreams): void {
    this.process = child;
    child.stdout.on('data', chunk => {
      this.stdoutBuffer += chunk.toString();
      this.flushBuffer('stdout');
    });
    child.stderr.on('data', chunk => {
      this.stderrBuffer += chunk.toString();
      this.flushBuffer('stderr');
    });
    child.on('exit', (code, signal) => {
      this.handleProcessExit(code, signal);
    });
  }

  private flushBuffer(source: 'stdout' | 'stderr'): void {
    const buffer = source === 'stdout' ? this.stdoutBuffer : this.stderrBuffer;
    const lines = buffer.split(/\r?\n/);
    const incompleteLine = lines.pop() ?? '';

    if (source === 'stdout') {
      this.stdoutBuffer = incompleteLine;
    } else {
      this.stderrBuffer = incompleteLine;
    }

    for (const line of lines) {
      if (source === 'stdout') {
        this.handleOutputLine(line);
      } else {
        this.handleErrorLine(line);
      }
    }
  }

  private handleOutputLine(line: string): void {
    const request = this.activeRequest;

    if (!request) {
      return;
    }

    if (line === `${EXECUTION_START_MARKER}${request.requestId}`) {
      request.isCapturing = true;
      return;
    }

    if (!request.isCapturing) {
      return;
    }

    if (line === `${EXECUTION_ERROR_MARKER}${request.requestId}`) {
      request.isError = true;
      return;
    }

    if (line === `${EXECUTION_END_MARKER}${request.requestId}`) {
      this.completeActiveRequest();
      return;
    }

    request.lines.push(line);
  }

  private handleErrorLine(line: string): void {
    if (!this.activeRequest) {
      return;
    }

    if (line.trim().length > 0) {
      this.activeRequest.isError = true;
      this.activeRequest.lines.push(line);
    }
  }

  private completeActiveRequest(): void {
    const request = this.activeRequest;

    if (!request) {
      return;
    }

    this.activeRequest = undefined;
    request.resolve({
      code: request.code,
      output: trimTrailingWhitespace(request.lines.join(os.EOL)),
      isError: request.isError,
      durationMs: Date.now() - request.startedAt
    });
    void this.runNextRequest();
  }

  private handleProcessExit(code: number | null, signal: NodeJS.Signals | null): void {
    const error = new Error(`PowerShell session exited unexpectedly (code: ${code ?? 'null'}, signal: ${signal ?? 'none'}).`);

    this.process = undefined;
    this.startPromise = undefined;

    if (this.activeRequest) {
      const activeRequest = this.activeRequest;
      this.activeRequest = undefined;
      activeRequest.reject(error);
    }

    while (this.queuedRequests.length > 0) {
      const queuedRequest = this.queuedRequests.shift();
      queuedRequest?.reject(error);
    }
  }
}

function trimTrailingWhitespace(text: string): string {
  return text.replace(/[\s\r\n]+$/u, '');
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
