import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type * as vscode from 'vscode';
import type { PowerShellContextSettings } from '../configurationModel';
import {
  DEFAULT_INLINE_OUTPUT_MAX_LENGTH,
  DEFAULT_OUTPUT_CHANNEL_AUTO_OPEN,
  DEFAULT_POWER_SHELL_EXECUTABLE_PREFERENCE,
  DEFAULT_PREVIEW_DEPTH,
  DEFAULT_PREVIEW_ITEM_LIMIT,
  DEFAULT_PREVIEW_PANEL_AUTO_OPEN,
  EXECUTION_END_MARKER,
  EXECUTION_ERROR_MARKER,
  EXECUTION_METADATA_MARKER,
  EXECUTION_START_MARKER,
  POWERSHELL_BOOT_TIMEOUT_MS,
  OUTPUT_STRING_WIDTH
} from '../constants';
import type { SessionExecutionResult, SessionOutputMetadata } from '../types';
import { buildEvaluationRequest } from './powerShellScriptBuilder';

interface PendingRequest {
  requestId: string;
  code: string;
  startedAt: number;
  lines: string[];
  metadata?: SessionOutputMetadata;
  isCapturing: boolean;
  isError: boolean;
  resolve: (result: SessionExecutionResult) => void;
  reject: (error: Error) => void;
}

export interface PowerShellSessionState {
  activeExecutable: string | undefined;
  preferredExecutable: PowerShellContextSettings['powerShellExecutablePreference'];
  hasActiveProcess: boolean;
}

type SessionStateListener = (state: PowerShellSessionState) => void;

export interface PowerShellSessionLike extends vscode.Disposable {
  execute(code: string): Promise<SessionExecutionResult>;
  getState(): PowerShellSessionState;
  restart(reason?: string): void;
  onDidChangeState(listener: SessionStateListener): vscode.Disposable;
}

export class PowerShellSession implements PowerShellSessionLike {
  private readonly stateListeners = new Set<SessionStateListener>();
  private process: ChildProcessWithoutNullStreams | undefined;
  private startPromise: Promise<void> | undefined;
  private readonly queuedRequests: PendingRequest[] = [];
  private activeRequest: PendingRequest | undefined;
  private stdoutBuffer = '';
  private stderrBuffer = '';
  private activeExecutable: string | undefined;
  private isStoppingProcess = false;

  constructor(
    private readonly outputChannel: vscode.OutputChannel,
    private readonly getSettings: () => PowerShellContextSettings = getDefaultSettings,
    private readonly spawnProcess: typeof spawn = spawn,
    private readonly bootTimeoutMs = POWERSHELL_BOOT_TIMEOUT_MS,
    private readonly runnerScriptPath = path.resolve(__dirname, '../../../powershell/PowerShellContextRunner.ps1'),
    private readonly requestDirectoryPath = fs.mkdtempSync(path.join(os.tmpdir(), 'powershell-context-'))
  ) {}

  public readonly onDidChangeState = (listener: SessionStateListener): vscode.Disposable => {
    this.stateListeners.add(listener);

    return {
      dispose: () => {
        this.stateListeners.delete(listener);
      }
    };
  };

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

  public getState(): PowerShellSessionState {
    const settings = this.getSettings();

    return {
      activeExecutable: this.activeExecutable,
      preferredExecutable: settings.powerShellExecutablePreference,
      hasActiveProcess: this.process !== undefined
    };
  }

  public restart(reason = 'PowerShell session restarted.'): void {
    const restartError = new Error(reason);

    this.rejectAllRequests(restartError);
    this.outputChannel.appendLine(reason);
    this.stopProcess();
    this.emitState();
  }

  public dispose(): void {
    this.rejectAllRequests(new Error('PowerShell session disposed.'));
    this.stopProcess();
    this.stateListeners.clear();
    fs.rmSync(this.requestDirectoryPath, { recursive: true, force: true });
  }

  private async runNextRequest(): Promise<void> {
    if (this.activeRequest || this.queuedRequests.length === 0) {
      return;
    }

    try {
      await this.ensureStarted();
    } catch (error) {
      this.rejectQueuedRequests(toError(error));
      return;
    }

    if (this.activeRequest || this.queuedRequests.length === 0) {
      return;
    }

    const nextRequest = this.queuedRequests.shift();

    if (!nextRequest || !this.process) {
      return;
    }

    this.activeRequest = nextRequest;
    const settings = this.getSettings();
    const requestPayload = buildEvaluationRequest(
      nextRequest.code,
      nextRequest.requestId,
      OUTPUT_STRING_WIDTH,
      settings.previewItemLimit,
      settings.previewDepth
    );
    fs.writeFileSync(path.join(this.requestDirectoryPath, `${nextRequest.requestId}.request`), requestPayload, 'utf8');
  }

  private async ensureStarted(): Promise<void> {
    const settings = this.getSettings();

    if (this.process && this.activeExecutable && !getPowerShellExecutables(settings).includes(this.activeExecutable)) {
      this.stopProcess();
    }

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
    const settings = this.getSettings();

    for (const executable of getPowerShellExecutables(settings)) {
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
      const child = this.spawnProcess(
        executable,
        ['-NoLogo', '-NoProfile', '-File', this.runnerScriptPath, '-RequestDirectory', this.requestDirectoryPath],
        {
          stdio: 'pipe',
          windowsHide: true
        }
      );
      const timeoutHandle = setTimeout(() => {
        child.off('spawn', handleSpawn);
        child.off('error', handleError);
        child.kill();
        reject(new Error(`Timed out while starting ${executable}.`));
      }, this.bootTimeoutMs);

      const handleSpawn = (): void => {
        clearTimeout(timeoutHandle);
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        this.activeExecutable = executable;
        this.attachProcess(child);
        child.off('error', handleError);
        this.emitState();
        resolve();
      };

      const handleError = (error: Error): void => {
        clearTimeout(timeoutHandle);
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

    const metadataPrefix = `${EXECUTION_METADATA_MARKER}${request.requestId}:`;

    if (line.startsWith(metadataPrefix)) {
      request.metadata = parseOutputMetadata(line.slice(metadataPrefix.length));
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
      durationMs: Date.now() - request.startedAt,
      metadata: request.metadata
    });
    void this.runNextRequest();
  }

  private handleProcessExit(code: number | null, signal: NodeJS.Signals | null): void {
    if (this.isStoppingProcess) {
      this.process = undefined;
      this.startPromise = undefined;
      this.activeExecutable = undefined;
      this.isStoppingProcess = false;
      this.stdoutBuffer = '';
      this.stderrBuffer = '';
      this.emitState();
      return;
    }

    const error = new Error(`PowerShell session exited unexpectedly (code: ${code ?? 'null'}, signal: ${signal ?? 'none'}).`);

    this.flushPendingBuffers();
    this.process = undefined;
    this.startPromise = undefined;
    this.activeExecutable = undefined;
    this.outputChannel.appendLine(error.message);
    this.emitState();

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

  private rejectQueuedRequests(error: Error): void {
    this.outputChannel.appendLine(error.message);

    while (this.queuedRequests.length > 0) {
      const queuedRequest = this.queuedRequests.shift();
      queuedRequest?.reject(error);
    }
  }

  private flushPendingBuffers(): void {
    if (!this.activeRequest) {
      this.stdoutBuffer = '';
      this.stderrBuffer = '';
      return;
    }

    for (const line of splitBufferedLines(this.stdoutBuffer)) {
      this.handleOutputLine(line);
    }

    for (const line of splitBufferedLines(this.stderrBuffer)) {
      this.handleErrorLine(line);
    }

    this.stdoutBuffer = '';
    this.stderrBuffer = '';
  }

  private rejectAllRequests(error: Error): void {
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

  private stopProcess(): void {
    if (!this.process) {
      this.activeExecutable = undefined;
      this.emitState();
      return;
    }

    this.isStoppingProcess = true;
    this.process.stdin.end();
    this.process.kill();
    this.process = undefined;
    this.startPromise = undefined;
    this.activeExecutable = undefined;
    this.emitState();
  }

  private emitState(): void {
    const state = this.getState();

    for (const listener of this.stateListeners) {
      listener(state);
    }
  }
}

function trimTrailingWhitespace(text: string): string {
  return text.replace(/[\s\r\n]+$/u, '');
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function splitBufferedLines(buffer: string): string[] {
  if (buffer.length === 0) {
    return [];
  }

  return buffer
    .split(/\r?\n/)
    .map(line => line.trimEnd())
    .filter(line => line.length > 0);
}

function parseOutputMetadata(encodedMetadata: string): SessionOutputMetadata | undefined {
  try {
    const parsed = JSON.parse(Buffer.from(encodedMetadata, 'base64').toString('utf8')) as Partial<SessionOutputMetadata>;

    if (!isSessionOutputKind(parsed.kind)) {
      return undefined;
    }

    if (typeof parsed.preview !== 'string' || typeof parsed.itemCount !== 'number') {
      return undefined;
    }

    return {
      kind: parsed.kind,
      preview: parsed.preview,
      itemCount: parsed.itemCount
    };
  } catch {
    return undefined;
  }
}

function isSessionOutputKind(value: unknown): value is SessionOutputMetadata['kind'] {
  return value === 'empty' || value === 'scalar' || value === 'dictionary' || value === 'object' || value === 'collection';
}

function getPowerShellExecutables(settings: PowerShellContextSettings): string[] {
  if (settings.powerShellExecutablePreference === 'pwsh') {
    return ['pwsh'];
  }

  if (settings.powerShellExecutablePreference === 'powershell') {
    return ['powershell'];
  }

  return ['pwsh', 'powershell'];
}

function getDefaultSettings(): PowerShellContextSettings {
  return {
    inlineOutputMaxLength: DEFAULT_INLINE_OUTPUT_MAX_LENGTH,
    previewItemLimit: DEFAULT_PREVIEW_ITEM_LIMIT,
    previewDepth: DEFAULT_PREVIEW_DEPTH,
    outputChannelAutoOpen: DEFAULT_OUTPUT_CHANNEL_AUTO_OPEN,
    previewPanelAutoOpen: DEFAULT_PREVIEW_PANEL_AUTO_OPEN,
    powerShellExecutablePreference: DEFAULT_POWER_SHELL_EXECUTABLE_PREFERENCE
  };
}
