import * as assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import * as vscode from 'vscode';
import type { PowerShellContextSettings } from '../../src/configuration';
import { EXECUTION_METADATA_MARKER } from '../../src/constants';
import { PowerShellSession } from '../../src/powershell/PowerShellSession';

class FakeChildProcess extends EventEmitter {
  public readonly stdin = new PassThrough();
  public readonly stdout = new PassThrough();
  public readonly stderr = new PassThrough();
  public readonly writes: string[] = [];
  public killed = false;

  constructor() {
    super();
    this.stdin.setEncoding('utf8');
    this.stdout.setEncoding('utf8');
    this.stderr.setEncoding('utf8');
    this.stdin.on('data', chunk => {
      this.writes.push(chunk.toString());
    });
  }

  public kill(): boolean {
    this.killed = true;
    this.emit('exit', null, 'SIGTERM');
    return true;
  }
}

describe('PowerShellSession', () => {
  it('rejects queued requests when PowerShell startup fails', async () => {
    const spawnCalls: string[] = [];
    const outputChannel = createOutputChannel();
    const spawnProcess = ((file: string) => {
      spawnCalls.push(file);
      const child = new FakeChildProcess();
      queueMicrotask(() => {
        child.emit('error', new Error(`${file} failed to start`));
      });
      return child as unknown as ChildProcessWithoutNullStreams;
    }) as typeof import('node:child_process').spawn;
    const session = new PowerShellSession(outputChannel.channel, createSettings, spawnProcess, 50);

    await assert.rejects(session.execute('Get-Date'), /failed to start/);
    assert.deepEqual(spawnCalls, ['pwsh', 'powershell']);
    assert.match(outputChannel.text(), /failed to start/);
  });

  it('processes queued requests sequentially', async () => {
    const child = new FakeChildProcess();
    const session = new PowerShellSession(createOutputChannel().channel, createSettings, createSuccessfulSpawn(child), 50);
    const firstExecution = session.execute("Write-Output 'one'");
    const secondExecution = session.execute("Write-Output 'two'");

    await waitForQueue();
    assert.equal(child.writes.length, 2);
    assert.match(child.writes[1], /V3JpdGUtT3V0cHV0ICdvbmUn/);

    const firstRequestId = extractRequestId(child.writes[1]);
    child.stdout.write(`__PSCTX_START__${firstRequestId}\none\n__PSCTX_END__${firstRequestId}\n`);

    const firstResult = await firstExecution;
    await waitForQueue();

    assert.equal(firstResult.output, 'one');
    assert.equal(firstResult.isError, false);
    assert.equal(child.writes.length, 3);
    assert.match(child.writes[2], /V3JpdGUtT3V0cHV0ICd0d28n/);

    const secondRequestId = extractRequestId(child.writes[2]);
    child.stdout.write(`__PSCTX_START__${secondRequestId}\ntwo\n__PSCTX_END__${secondRequestId}\n`);

    const secondResult = await secondExecution;
    assert.equal(secondResult.output, 'two');
    assert.equal(secondResult.isError, false);
    session.dispose();
  });

  it('marks stderr output as an execution error', async () => {
    const child = new FakeChildProcess();
    const session = new PowerShellSession(createOutputChannel().channel, createSettings, createSuccessfulSpawn(child), 50);
    const execution = session.execute('Get-Date');

    await waitForQueue();
    const requestId = extractRequestId(child.writes[1]);

    child.stderr.write('stderr failure\n');
    child.stdout.write(`__PSCTX_START__${requestId}\n__PSCTX_END__${requestId}\n`);

    const result = await execution;
    assert.equal(result.isError, true);
    assert.match(result.output, /stderr failure/);
    session.dispose();
  });

  it('parses structured output metadata from the PowerShell stream', async () => {
    const child = new FakeChildProcess();
    const session = new PowerShellSession(createOutputChannel().channel, createSettings, createSuccessfulSpawn(child), 50);
    const execution = session.execute('Get-Process | Select-Object -First 1');

    await waitForQueue();
    const requestId = extractRequestId(child.writes[1]);
    const metadata = Buffer.from(
      JSON.stringify({
        kind: 'object',
        preview: '{ Name: pwsh, Id: 1234 }',
        itemCount: 1
      }),
      'utf8'
    ).toString('base64');

    child.stdout.write(
      `__PSCTX_START__${requestId}\nprocess text\n${EXECUTION_METADATA_MARKER}${requestId}:${metadata}\n__PSCTX_END__${requestId}\n`
    );

    const result = await execution;
    assert.equal(result.output, 'process text');
    assert.deepEqual(result.metadata, {
      kind: 'object',
      preview: '{ Name: pwsh, Id: 1234 }',
      itemCount: 1
    });
    session.dispose();
  });

  it('uses the configured powershell executable preference', async () => {
    const spawnCalls: string[] = [];
    const outputChannel = createOutputChannel();
    const spawnProcess = ((file: string) => {
      spawnCalls.push(file);
      const child = new FakeChildProcess();
      queueMicrotask(() => {
        child.emit('error', new Error(`${file} failed to start`));
      });
      return child as unknown as ChildProcessWithoutNullStreams;
    }) as typeof import('node:child_process').spawn;
    const session = new PowerShellSession(
      outputChannel.channel,
      () => createSettings({ powerShellExecutablePreference: 'powershell' }),
      spawnProcess,
      50
    );

    await assert.rejects(session.execute('Get-Date'), /failed to start/);
    assert.deepEqual(spawnCalls, ['powershell']);
  });
});

function createSettings(overrides: Partial<PowerShellContextSettings> = {}): PowerShellContextSettings {
  return {
    inlineOutputMaxLength: 72,
    previewItemLimit: 3,
    previewDepth: 1,
    outputChannelAutoOpen: 'errors',
    previewPanelAutoOpen: 'structured',
    powerShellExecutablePreference: 'auto',
    ...overrides
  };
}

function createSuccessfulSpawn(child: FakeChildProcess): typeof import('node:child_process').spawn {
  return ((file: string) => {
    void file;
    queueMicrotask(() => {
      child.emit('spawn');
    });
    return child as unknown as ChildProcessWithoutNullStreams;
  }) as typeof import('node:child_process').spawn;
}

function createOutputChannel(): { channel: vscode.OutputChannel; text: () => string } {
  const writes: string[] = [];

  const channel = {
    name: 'PowerShell Context Test',
    append: (value: string) => {
      writes.push(value);
    },
    appendLine: (value: string) => {
      writes.push(`${value}\n`);
    },
    clear: () => {
      writes.length = 0;
    },
    dispose: () => {
      writes.length = 0;
    },
    hide: () => {},
    replace: (value: string) => {
      writes.length = 0;
      writes.push(value);
    },
    show: () => {}
  } as unknown as vscode.OutputChannel;

  return {
    channel,
    text: () => writes.join('')
  };
}

function extractRequestId(script: string): string {
  const match = script.match(/__PSCTX_START__(.+?)'/);

  assert.ok(match);
  return match[1];
}

async function waitForQueue(): Promise<void> {
  await new Promise<void>(resolve => {
    setImmediate(resolve);
  });
}
