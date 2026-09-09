import { createInterface } from 'node:readline';
import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { HostCodexRpcSession } from '../src/host-codex-controller.js';

const nextTick = (): Promise<void> => new Promise(resolve => setImmediate(resolve));

describe('P12 immediate enforcement sealing', () => {
  it('aborts the turn and refuses every later tool call after a filesystem violation', async () => {
    const toClient = new PassThrough();
    const fromClient = new PassThrough();
    const received: Array<Record<string, any>> = [];
    let violatingSignal: AbortSignal | undefined;
    const runner = vi.fn(async (_command, context) => {
      if (context.callId === 'violating-call') {
        violatingSignal = context.signal;
        return {
          exitCode: 1,
          stdout: '',
          stderr: 'outside-worktree access denied',
          appContainerPid: 4101,
          enforcement: 'appcontainer-capability-zero',
          violation: 'filesystem',
        };
      }
      return {
        exitCode: 0,
        stdout: 'must-not-run',
        stderr: '',
        appContainerPid: 4102,
        enforcement: 'appcontainer-capability-zero',
      };
    });
    const lines = createInterface({ input: fromClient });
    lines.on('line', line => {
      const message = JSON.parse(line) as Record<string, any>;
      received.push(message);
      if (message.method === 'initialize') {
        toClient.write(`${JSON.stringify({ id: message.id, result: {} })}\n`);
      } else if (message.method === 'thread/start') {
        toClient.write(`${JSON.stringify({ id: message.id, result: { thread: { id: 'thread-seal' } } })}\n`);
      } else if (message.method === 'turn/start') {
        toClient.write(`${JSON.stringify({ id: message.id, result: { turn: { id: 'turn-seal' } } })}\n`);
        toClient.write(`${JSON.stringify({ method: 'item/tool/call', id: 401, params: {
          threadId: 'thread-seal', turnId: 'turn-seal', callId: 'violating-call', namespace: null,
          tool: 'cue_workspace', arguments: { program: 'powershell.exe', args: [] },
        } })}\n`);
      } else if (message.id === 401 && message.result) {
        toClient.write(`${JSON.stringify({ method: 'item/tool/call', id: 402, params: {
          threadId: 'thread-seal', turnId: 'turn-seal', callId: 'late-after-violation', namespace: null,
          tool: 'cue_workspace', arguments: { program: 'powershell.exe', args: [] },
        } })}\n`);
      } else if (message.id === 402 && message.result) {
        toClient.write(`${JSON.stringify({ method: 'turn/completed', params: {
          threadId: 'thread-seal', turn: { id: 'turn-seal', status: 'completed' },
        } })}\n`);
      }
    });

    const session = new HostCodexRpcSession(
      { readable: toClient, writable: fromClient },
      runner,
      { requestTimeoutMs: 1_000, runTimeoutMs: 2_000 },
    );

    await expect(session.run({ cwd: 'C:/controller', workspaceCwd: 'C:/approved', goal: 'seal on violation' }))
      .rejects.toThrow(/CUE_ENFORCEMENT_VIOLATION.*filesystem/u);
    await nextTick();

    expect(runner).toHaveBeenCalledTimes(1);
    expect(violatingSignal?.aborted).toBe(true);
    expect(received.find(message => message.id === 401)?.result?.success).toBe(false);
    expect(received.find(message => message.id === 402)?.result?.success).toBe(false);
    expect(received.some(message => message.method === 'turn/interrupt')).toBe(true);

    session.close();
    lines.close();
  });

  it('also seals when worker preflight throws a typed boundary violation before spawn', async () => {
    const toClient = new PassThrough();
    const fromClient = new PassThrough();
    const received: Array<Record<string, any>> = [];
    const runner = vi.fn(async (_command, context) => {
      if (context.callId === 'preflight-violation') {
        throw Object.assign(new Error('filesystem action is outside the approved worktree'), {
          code: 'CUE_WORKER_ENFORCEMENT_VIOLATION',
          violation: 'filesystem',
        });
      }
      return {
        exitCode: 0,
        stdout: 'must-not-run',
        stderr: '',
        appContainerPid: 4202,
        enforcement: 'appcontainer-capability-zero',
      };
    });
    const lines = createInterface({ input: fromClient });
    lines.on('line', line => {
      const message = JSON.parse(line) as Record<string, any>;
      received.push(message);
      if (message.method === 'initialize') {
        toClient.write(`${JSON.stringify({ id: message.id, result: {} })}\n`);
      } else if (message.method === 'thread/start') {
        toClient.write(`${JSON.stringify({ id: message.id, result: { thread: { id: 'thread-preflight' } } })}\n`);
      } else if (message.method === 'turn/start') {
        toClient.write(`${JSON.stringify({ id: message.id, result: { turn: { id: 'turn-preflight' } } })}\n`);
        toClient.write(`${JSON.stringify({ method: 'item/tool/call', id: 411, params: {
          threadId: 'thread-preflight', turnId: 'turn-preflight', callId: 'preflight-violation', namespace: null,
          tool: 'cue_workspace', arguments: { program: 'powershell.exe', args: [] },
        } })}\n`);
      } else if (message.id === 411 && message.result) {
        toClient.write(`${JSON.stringify({ method: 'item/tool/call', id: 412, params: {
          threadId: 'thread-preflight', turnId: 'turn-preflight', callId: 'late-after-preflight', namespace: null,
          tool: 'cue_workspace', arguments: { program: 'powershell.exe', args: [] },
        } })}\n`);
      } else if (message.id === 412 && message.result) {
        toClient.write(`${JSON.stringify({ method: 'turn/completed', params: {
          threadId: 'thread-preflight', turn: { id: 'turn-preflight', status: 'completed' },
        } })}\n`);
      }
    });

    const session = new HostCodexRpcSession(
      { readable: toClient, writable: fromClient },
      runner,
      { requestTimeoutMs: 1_000, runTimeoutMs: 2_000 },
    );

    await expect(session.run({ cwd: 'C:/controller', workspaceCwd: 'C:/approved', goal: 'seal preflight' }))
      .rejects.toThrow(/CUE_ENFORCEMENT_VIOLATION.*filesystem/u);
    await nextTick();

    expect(runner).toHaveBeenCalledTimes(1);
    expect(received.find(message => message.id === 411)?.result?.success).toBe(false);
    expect(received.find(message => message.id === 412)?.result?.success).toBe(false);
    expect(received.some(message => message.method === 'turn/interrupt')).toBe(true);

    session.close();
    lines.close();
  });
});
