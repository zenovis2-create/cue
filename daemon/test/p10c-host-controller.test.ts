import { PassThrough } from 'node:stream';
import { createInterface } from 'node:readline';
import { describe, expect, it, vi } from 'vitest';
import { CLEAN_CONFIG } from '../src/tool-home.js';
import {
  buildHostThreadStartParams,
  HostCodexRpcSession,
  parseCueWorkspaceCall,
  workspaceToolResponse,
} from '../src/host-codex-controller.js';

describe('Phase 10-C host control/model plane contract', () => {
  it('removes every host execution environment and exposes only the Cue AppContainer tool', () => {
    const params = buildHostThreadStartParams('C:/worktree', '구현하고 테스트해줘', 'gpt-5.6-sol');

    expect(params).toMatchObject({
      cwd: 'C:/worktree',
      model: 'gpt-5.6-sol',
      ephemeral: true,
      sandbox: 'read-only',
      environments: [],
      approvalsReviewer: 'user',
      approvalPolicy: {
        granular: {
          mcp_elicitations: false,
          request_permissions: false,
          rules: false,
          sandbox_approval: false,
          skill_approval: false,
        },
      },
    });
    expect(params.dynamicTools).toEqual([
      expect.objectContaining({
        type: 'function',
        name: 'cue_workspace',
        deferLoading: false,
        inputSchema: expect.objectContaining({
          additionalProperties: false,
          required: ['program', 'args'],
        }),
      }),
    ]);
    expect(params.developerInstructions).toContain('cue_workspace');
    expect(JSON.stringify(params)).not.toMatch(/danger-full-access|workspace-write|exec_command|apply_patch/iu);
  });

  it('disables Codex built-in shell tools in the isolated host controller home', () => {
    expect(CLEAN_CONFIG).toMatch(/(?:^|\n)shell_tool = false(?:\n|$)/u);
    expect(CLEAN_CONFIG).toMatch(/(?:^|\n)request_permissions_tool = false(?:\n|$)/u);
  });

  it('pins dynamic tool execution to the approved worktree and rejects client-controlled cwd', () => {
    expect(parseCueWorkspaceCall({
      namespace: null,
      tool: 'cue_workspace',
      arguments: { program: 'git.exe', args: ['status', '--short'], timeoutMs: 30_000 },
    }, 'C:/approved')).toEqual({
      executable: 'git.exe',
      args: ['status', '--short'],
      cwd: 'C:/approved',
      timeoutMs: 30_000,
    });

    expect(() => parseCueWorkspaceCall({
      namespace: null,
      tool: 'cue_workspace',
      arguments: { program: 'cmd.exe', args: ['/c', 'echo escape'], cwd: 'C:/outside' },
    }, 'C:/approved')).toThrow('unexpected dynamic tool argument: cwd');
  });

  it('fails closed on any other dynamic tool identity or malformed argv', () => {
    expect(() => parseCueWorkspaceCall({
      namespace: null,
      tool: 'other_tool',
      arguments: { program: 'cmd.exe', args: [] },
    }, 'C:/approved')).toThrow('unapproved dynamic tool');
    expect(() => parseCueWorkspaceCall({
      namespace: null,
      tool: 'cue_workspace',
      arguments: { program: 'cmd.exe', args: ['/c', 7] },
    }, 'C:/approved')).toThrow('args must contain only strings');
    expect(() => parseCueWorkspaceCall({
      namespace: null,
      tool: 'cue_workspace',
      arguments: { program: 'cmd.exe', args: [], timeoutMs: 999_999 },
    }, 'C:/approved')).toThrow('timeoutMs out of range');
    expect(() => parseCueWorkspaceCall({
      namespace: null, tool: 'cue_workspace', arguments: { program: 'cmd.exe', args: ['x'.repeat(32_769)] },
    }, 'C:/approved')).toThrow(/argument byte limit/u);
    expect(() => parseCueWorkspaceCall({
      namespace: null, tool: 'cue_workspace', arguments: { program: 'cmd.exe', args: Array.from({ length: 5 }, () => 'x'.repeat(30_000)) },
    }, 'C:/approved')).toThrow(/aggregate argument byte limit/u);
  });

  it('returns bounded, explicit AppContainer evidence to the model', () => {
    const response = workspaceToolResponse({
      exitCode: 0,
      stdout: `ok-${'x'.repeat(20_000)}`,
      stderr: '',
      appContainerPid: 4242,
      enforcement: 'appcontainer-capability-zero',
    });
    expect(response.success).toBe(true);
    expect(response.contentItems).toHaveLength(1);
    const text = response.contentItems[0]?.text ?? '';
    expect(text).toContain('"appContainerPid":4242');
    expect(text).toContain('"enforcement":"appcontainer-capability-zero"');
    expect(text.length).toBeLessThan(17_000);
  });

  it('drives app-server and returns dynamic-tool output from the AppContainer runner', async () => {
    const toClient = new PassThrough();
    const fromClient = new PassThrough();
    const received: Array<Record<string, any>> = [];
    const runner = vi.fn(async () => ({
      exitCode: 0,
      stdout: 'worker-ok',
      stderr: '',
      appContainerPid: 5151,
      enforcement: 'appcontainer-capability-zero',
    }));
    const lines = createInterface({ input: fromClient });
    lines.on('line', line => {
      const message = JSON.parse(line) as Record<string, any>;
      received.push(message);
      if (message.method === 'initialize') {
        toClient.write(`${JSON.stringify({ id: message.id, result: { codexHome: 'C:/isolated' } })}\n`);
      } else if (message.method === 'thread/start') {
        toClient.write(`${JSON.stringify({ id: message.id, result: { thread: { id: 'thread-1' } } })}\n`);
      } else if (message.method === 'turn/start') {
        toClient.write(`${JSON.stringify({ id: message.id, result: { turn: { id: 'turn-1' } } })}\n`);
        toClient.write(`${JSON.stringify({ method: 'item/tool/call', id: 90, params: {
          threadId: 'thread-1', turnId: 'turn-1', callId: 'call-1', namespace: null,
          tool: 'cue_workspace', arguments: { program: 'git.exe', args: ['status', '--short'] },
        } })}\n`);
      } else if (message.id === 90 && message.result) {
        toClient.write(`${JSON.stringify({ method: 'item/completed', params: {
          threadId: 'thread-1', turnId: 'turn-1', item: { type: 'agentMessage', text: '검증 완료' },
        } })}\n`);
        toClient.write(`${JSON.stringify({ method: 'turn/completed', params: {
          threadId: 'thread-1', turn: { id: 'turn-1', status: 'completed' },
        } })}\n`);
      }
    });

    const session = new HostCodexRpcSession({ readable: toClient, writable: fromClient }, runner, { requestTimeoutMs: 1_000 });
    const result = await session.run({ cwd: 'C:/controller-home', workspaceCwd: 'C:/approved', goal: '상태를 확인해줘', model: 'gpt-5.6-sol' });
    lines.close();

    expect(result).toEqual({ threadId: 'thread-1', turnId: 'turn-1', status: 'completed', finalMessage: '검증 완료' });
    expect(runner).toHaveBeenCalledWith({
      executable: 'git.exe', args: ['status', '--short'], cwd: 'C:/approved', timeoutMs: 120_000,
    }, expect.objectContaining({ threadId: 'thread-1', turnId: 'turn-1', callId: 'call-1', signal: expect.any(AbortSignal) }));
    const start = received.find(message => message.method === 'thread/start')!;
    expect(start.params.cwd).toBe('C:/controller-home');
    expect(start.params.environments).toEqual([]);
    expect(start.params.dynamicTools).toHaveLength(1);
    const response = received.find(message => message.id === 90 && message.result)!;
    expect(response.result.success).toBe(true);
    expect(response.result.contentItems[0].text).toContain('"appContainerPid":5151');
  });

  it('declines any host-side command or file execution request without invoking the worker runner', async () => {
    const toClient = new PassThrough();
    const fromClient = new PassThrough();
    const received: Array<Record<string, any>> = [];
    const runner = vi.fn();
    const lines = createInterface({ input: fromClient });
    lines.on('line', line => {
      const message = JSON.parse(line) as Record<string, any>;
      received.push(message);
      if (message.method === 'initialize') {
        toClient.write(`${JSON.stringify({ id: message.id, result: {} })}\n`);
      } else if (message.method === 'thread/start') {
        toClient.write(`${JSON.stringify({ id: message.id, result: { thread: { id: 'thread-2' } } })}\n`);
      } else if (message.method === 'turn/start') {
        toClient.write(`${JSON.stringify({ id: message.id, result: { turn: { id: 'turn-2' } } })}\n`);
        toClient.write(`${JSON.stringify({ method: 'item/commandExecution/requestApproval', id: 91, params: {} })}\n`);
      } else if (message.id === 91) {
        toClient.write(`${JSON.stringify({ method: 'turn/completed', params: {
          threadId: 'thread-2', turn: { id: 'turn-2', status: 'failed' },
        } })}\n`);
      }
    });

    const session = new HostCodexRpcSession({ readable: toClient, writable: fromClient }, runner, { requestTimeoutMs: 1_000 });
    const result = await session.run({ cwd: 'C:/approved', goal: '금지 요청 검증' });
    lines.close();

    expect(result.status).toBe('failed');
    expect(runner).not.toHaveBeenCalled();
    expect(received.find(message => message.id === 91)?.result).toEqual({ decision: 'decline' });
  });

  it('rejects wrong-thread and duplicate dynamic calls and ignores a mismatched terminal notification', async () => {
    const toClient = new PassThrough(); const fromClient = new PassThrough();
    const received: Array<Record<string, any>> = [];
    const runner = vi.fn(async () => ({ exitCode: 0, stdout: 'ok', stderr: '', appContainerPid: 99, enforcement: 'appcontainer-capability-zero' }));
    const lines = createInterface({ input: fromClient });
    lines.on('line', line => {
      const message = JSON.parse(line) as Record<string, any>; received.push(message);
      if (message.method === 'initialize') toClient.write(`${JSON.stringify({ id: message.id, result: {} })}\n`);
      else if (message.method === 'thread/start') toClient.write(`${JSON.stringify({ id: message.id, result: { thread: { id: 'thread-safe' } } })}\n`);
      else if (message.method === 'turn/start') {
        toClient.write(`${JSON.stringify({ id: message.id, result: { turn: { id: 'turn-safe' } } })}\n`);
        toClient.write(`${JSON.stringify({ method: 'item/tool/call', id: 100, params: { threadId: 'thread-wrong', turnId: 'turn-safe', callId: 'wrong', namespace: null, tool: 'cue_workspace', arguments: { program: 'cmd.exe', args: [] } } })}\n`);
      } else if (message.id === 100) {
        toClient.write(`${JSON.stringify({ method: 'item/tool/call', id: 101, params: { threadId: 'thread-safe', turnId: 'turn-safe', callId: 'call-once', namespace: null, tool: 'cue_workspace', arguments: { program: 'cmd.exe', args: [] } } })}\n`);
      } else if (message.id === 101) {
        toClient.write(`${JSON.stringify({ method: 'item/tool/call', id: 102, params: { threadId: 'thread-safe', turnId: 'turn-safe', callId: 'call-once', namespace: null, tool: 'cue_workspace', arguments: { program: 'cmd.exe', args: [] } } })}\n`);
      } else if (message.id === 102) {
        toClient.write(`${JSON.stringify({ method: 'turn/completed', params: { threadId: 'thread-wrong', turn: { id: 'turn-safe', status: 'completed' } } })}\n`);
        setTimeout(() => toClient.write(`${JSON.stringify({ method: 'turn/completed', params: { threadId: 'thread-safe', turn: { id: 'turn-safe', status: 'completed' } } })}\n`), 10);
      }
    });
    const session = new HostCodexRpcSession({ readable: toClient, writable: fromClient }, runner, { requestTimeoutMs: 1_000 });
    const result = await session.run({ cwd: 'C:/controller', workspaceCwd: 'C:/approved', goal: 'correlation' });
    session.close(); lines.close();
    expect(result).toMatchObject({ threadId: 'thread-safe', turnId: 'turn-safe', status: 'completed' });
    expect(runner).toHaveBeenCalledTimes(1);
    expect(received.find(message => message.id === 100)?.result.success).toBe(false);
    expect(received.find(message => message.id === 102)?.result.success).toBe(false);
  });

  it('does not create an orphan terminal rejection when turn/start itself fails', async () => {
    const toClient = new PassThrough(); const fromClient = new PassThrough();
    const lines = createInterface({ input: fromClient });
    lines.on('line', line => {
      const message = JSON.parse(line) as Record<string, any>;
      if (message.method === 'initialize') toClient.write(`${JSON.stringify({ id: message.id, result: {} })}\n`);
      else if (message.method === 'thread/start') toClient.write(`${JSON.stringify({ id: message.id, result: { thread: { id: 'thread-fail' } } })}\n`);
      else if (message.method === 'turn/start') toClient.write(`${JSON.stringify({ id: message.id, error: { message: 'turn rejected' } })}\n`);
    });
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    const session = new HostCodexRpcSession({ readable: toClient, writable: fromClient }, vi.fn(), { requestTimeoutMs: 1_000 });
    await expect(session.run({ cwd: 'C:/controller', goal: 'reject turn' })).rejects.toThrow('turn rejected');
    session.close(); lines.close();
    await new Promise(resolve => setImmediate(resolve));
    process.off('unhandledRejection', onUnhandled);
    expect(unhandled).toEqual([]);
  });

  it('allows only one in-flight dynamic tool call at a time', async () => {
    const toClient = new PassThrough(); const fromClient = new PassThrough();
    let releaseFirst!: (value: any) => void;
    const first = new Promise<any>(resolve => { releaseFirst = resolve; });
    const workerResult = { exitCode: 0, stdout: 'ok', stderr: '', appContainerPid: 77, enforcement: 'appcontainer-capability-zero' };
    const runner = vi.fn((_command, context) => context.callId === 'first' ? first : Promise.resolve(workerResult));
    const lines = createInterface({ input: fromClient });
    lines.on('line', line => {
      const message = JSON.parse(line) as Record<string, any>;
      if (message.method === 'initialize') toClient.write(`${JSON.stringify({ id: message.id, result: {} })}\n`);
      else if (message.method === 'thread/start') toClient.write(`${JSON.stringify({ id: message.id, result: { thread: { id: 'thread-concurrency' } } })}\n`);
      else if (message.method === 'turn/start') {
        toClient.write(`${JSON.stringify({ id: message.id, result: { turn: { id: 'turn-concurrency' } } })}\n`);
        for (const [id, callId] of [[201, 'first'], [202, 'second']] as const) {
          toClient.write(`${JSON.stringify({ method: 'item/tool/call', id, params: { threadId: 'thread-concurrency', turnId: 'turn-concurrency', callId, namespace: null, tool: 'cue_workspace', arguments: { program: 'cmd.exe', args: [] } } })}\n`);
        }
      } else if (message.id === 202) releaseFirst(workerResult);
      else if (message.id === 201) toClient.write(`${JSON.stringify({ method: 'turn/completed', params: { threadId: 'thread-concurrency', turn: { id: 'turn-concurrency', status: 'completed' } } })}\n`);
    });
    const session = new HostCodexRpcSession({ readable: toClient, writable: fromClient }, runner, { requestTimeoutMs: 1_000 });
    await session.run({ cwd: 'C:/controller', goal: 'one at a time' });
    session.close(); lines.close();
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it('rejects a dynamic tool call received after the correlated turn completed', async () => {
    const toClient = new PassThrough(); const fromClient = new PassThrough();
    const received: Array<Record<string, any>> = [];
    const runner = vi.fn(async () => ({ exitCode: 0, stdout: 'late', stderr: '', appContainerPid: 88, enforcement: 'appcontainer-capability-zero' }));
    const lines = createInterface({ input: fromClient });
    lines.on('line', line => {
      const message = JSON.parse(line) as Record<string, any>; received.push(message);
      if (message.method === 'initialize') toClient.write(`${JSON.stringify({ id: message.id, result: {} })}\n`);
      else if (message.method === 'thread/start') toClient.write(`${JSON.stringify({ id: message.id, result: { thread: { id: 'thread-terminal' } } })}\n`);
      else if (message.method === 'turn/start') {
        toClient.write(`${JSON.stringify({ id: message.id, result: { turn: { id: 'turn-terminal' } } })}\n`);
        toClient.write(`${JSON.stringify({ method: 'turn/completed', params: { threadId: 'thread-terminal', turn: { id: 'turn-terminal', status: 'completed' } } })}\n`);
        toClient.write(`${JSON.stringify({ method: 'item/tool/call', id: 301, params: { threadId: 'thread-terminal', turnId: 'turn-terminal', callId: 'late-call', namespace: null, tool: 'cue_workspace', arguments: { program: 'cmd.exe', args: [] } } })}\n`);
      }
    });
    const session = new HostCodexRpcSession({ readable: toClient, writable: fromClient }, runner, { requestTimeoutMs: 1_000 });
    const result = await session.run({ cwd: 'C:/controller', goal: 'terminal is final' });
    await new Promise(resolve => setImmediate(resolve));
    session.close(); lines.close();
    expect(result.status).toBe('completed');
    expect(runner).not.toHaveBeenCalled();
    expect(received.find(message => message.id === 301)?.result?.success).toBe(false);
  });
});
