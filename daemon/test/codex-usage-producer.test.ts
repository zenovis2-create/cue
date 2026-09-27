import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { HostCodexRpcSession, type HostCodexEvent } from '../src/host-codex-controller.js';
import { createCodexExecutor } from '../src/adapters/integration-executors.js';
import { openLedger, type Ledger } from '../src/ledger.js';
import { createHandoffActivityStore } from '../src/orchestration/handoff-activity.js';
import type { HostCodexRuntimeOptions, RunningHostCodexRun } from '../src/host-codex-runtime.js';

const databases: Ledger[] = [];
afterEach(() => { for (const db of databases.splice(0)) if (db.open) db.close(); });
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const breakdown = (totalTokens: number) => ({ totalTokens, inputTokens: totalTokens - 2, cachedInputTokens: 1, cacheWriteInputTokens: 0, outputTokens: 2, reasoningOutputTokens: 1 });
const notification = (threadId: string, turnId: string, totalTokens: number) => ({ method: 'thread/tokenUsage/updated', params: { threadId, turnId, tokenUsage: { total: breakdown(totalTokens), last: breakdown(totalTokens), modelContextWindow: 200_000 } } });

describe('Codex observed usage producer', () => {
  it('accepts only correlated increasing cumulative snapshots before terminal', async () => {
    const fromServer = new PassThrough(), toServer = new PassThrough(), events: HostCodexEvent[] = [];
    const rpc = new HostCodexRpcSession({ readable: fromServer, writable: toServer }, async () => ({ exitCode: 0, stdout: '', stderr: '', enforcement: 'appcontainer' }), { onEvent: event => events.push(event) });
    const lines = createInterface({ input: toServer });
    lines.on('line', line => {
      const message = JSON.parse(line);
      if (message.method === 'initialize') fromServer.write(`${JSON.stringify({ id: message.id, result: {} })}\n`);
      else if (message.method === 'thread/start') fromServer.write(`${JSON.stringify({ id: message.id, result: { thread: { id: 'thread' } } })}\n`);
      else if (message.method === 'turn/start') {
        fromServer.write(`${JSON.stringify({ id: message.id, result: { turn: { id: 'turn' } } })}\n`);
        const equalChanged = notification('thread', 'turn', 5); equalChanged.params.tokenUsage.total.cachedInputTokens = 0;
        for (const event of [notification('foreign', 'turn', 5), notification('thread', 'foreign', 5), notification('thread', 'turn', 5), notification('thread', 'turn', 5), equalChanged, notification('thread', 'turn', 4), notification('thread', 'turn', 8)]) fromServer.write(`${JSON.stringify(event)}\n`);
        fromServer.write(`${JSON.stringify({ method: 'thread/tokenUsage/updated', params: { threadId: 'thread', turnId: 'turn', tokenUsage: { total: { ...breakdown(9), totalTokens: '9' }, last: breakdown(9), modelContextWindow: 200_000 } } })}\n`);
        fromServer.write(`${JSON.stringify({ method: 'turn/completed', params: { threadId: 'thread', turn: { id: 'turn', status: 'completed' } } })}\n`);
        fromServer.write(`${JSON.stringify(notification('thread', 'turn', 10))}\n`);
      }
    });
    await rpc.run({ cwd: 'C:/work', goal: 'test' });
    expect(events.filter(event => event.kind === 'usage')).toEqual([
      { kind: 'usage', source: 'thread/tokenUsage/updated', scope: 'ephemeral-thread-cumulative', ...breakdown(5) },
      { kind: 'usage', source: 'thread/tokenUsage/updated', scope: 'ephemeral-thread-cumulative', ...breakdown(8) },
    ]);
    expect(events.at(-1)).toEqual({ kind: 'terminal', status: 'completed' });
    rpc.close(); lines.close();
  });

  it('persists cumulative advances as exact deltas whose durable sum is the attempt total', async () => {
    const db = openLedger(); databases.push(db);
    const parent = hash('parent'), stage = hash('stage'), plan = hash('plan'), policy = hash('policy'), selection = hash('selection');
    db.prepare("INSERT INTO task VALUES('root','running',NULL,'now')").run();
    db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(parent, 'C:\\work', '[]', 'now');
    db.prepare("INSERT INTO run VALUES('run','root',?,0,'now')").run(parent);
    db.prepare('INSERT INTO orchestration_plan VALUES(?,?,?,?)').run('run', parent, plan, '{}');
    db.prepare("INSERT INTO orchestration_step VALUES('run','stage','running')").run();
    db.prepare("INSERT INTO orchestration_attempt VALUES('attempt','run','stage','candidate','running','{}','C:\\work',NULL,0)").run();
    const store = createHandoffActivityStore(db, { authorizeArtifact: () => false, resolveArtifact: () => null });
    let ordinal = 0;
    const context = { runId: 'attempt', candidateId: 'candidate', role: 'implementation' as const, subjectDigest: hash('subject'), signal: new AbortController().signal,
      emitActivity: (kind: any, data: Readonly<Record<string, unknown>>) => store.activity({ runId: 'run', taskId: 'stage', attemptId: 'attempt', eventId: `event-${++ordinal}`, ordinal, kind, observedAtMs: ordinal, data }) };
    const result = { threadId: 'thread', turnId: 'turn', status: 'completed', finalMessage: 'done', controllerPid: 1, workerPids: [], successfulToolCalls: 0, controllerStderr: '', goalVerification: { passed: true, reason: 'workspace_changed', changedPaths: ['result.txt'] } };
    const execution = await createCodexExecutor({ db, binary: 'C:/codex.exe', model: 'model', tool: { id: 'codex', revision: 'v1' },
      resolveBinding: () => ({ owner: { run_id: 'attempt', task_id: 'stage', cwd: 'C:\\work' }, envelope: { run_id: 'attempt', worktree_realpath: 'C:\\work', egress: [], expires_at: 'soon', autonomy_level: 'bounded', allowed_actions: [] }, options: { codexHome: 'C:/isolated', goal: 'goal' } }),
      launch: (_db, _owner, _envelope, options) => {
        for (const total of [5, 8]) (options as HostCodexRuntimeOptions).onEvent?.({ kind: 'usage', source: 'thread/tokenUsage/updated', scope: 'ephemeral-thread-cumulative', ...breakdown(total) });
        return { session: { handle: 'session-attempt' }, done: Promise.resolve(result), stop() {} } as unknown as RunningHostCodexRun;
      } })(context);
    expect(await execution.completion).toBe('succeeded');
    const rows = db.prepare("SELECT payload FROM orchestration_activity WHERE attempt_id='attempt' ORDER BY ordinal").all() as Array<{ payload: string }>;
    const payloads = rows.map(row => JSON.parse(row.payload));
    expect(payloads.map(row => row.kind)).toEqual(['usage', 'usage', 'heartbeat']);
    const usage = payloads.filter(row => row.kind === 'usage');
    expect(usage.map(row => row.data.quantity)).toEqual([5, 3]);
    expect(usage.reduce((sum, row) => sum + row.data.quantity, 0)).toBe(8);
    expect(usage[1]).toMatchObject({ runId: 'run', taskId: 'stage', attemptId: 'attempt', data: { unit: 'token', status: 'observed' } });
  });

  it('resets delta state per retry attempt and drops usage delivered after cancellation', async () => {
    const recorded: Array<{ attemptId: string; kind: string; quantity?: unknown; status?: unknown }> = [];
    const pending = new Map<string, { options: HostCodexRuntimeOptions; resolve(value: any): void }>();
    const execute = createCodexExecutor({ db: {} as Ledger, binary: 'C:/codex.exe', model: 'model', tool: { id: 'codex', revision: 'v1' },
      resolveBinding: context => ({ owner: { run_id: context.runId, task_id: `task-${context.runId}`, cwd: 'C:\\work' }, envelope: { run_id: context.runId, worktree_realpath: 'C:\\work', egress: [], expires_at: 'soon', autonomy_level: 'bounded', allowed_actions: [] }, options: { codexHome: 'C:/isolated', goal: 'goal' } }),
      launch: (_db, owner, _envelope, options) => {
        let resolve!: (value: any) => void; const done = new Promise<any>(accept => { resolve = accept; }); pending.set(owner.run_id, { options, resolve });
        return { session: { handle: `session-${owner.run_id}` }, done, stop() {} } as unknown as RunningHostCodexRun;
      } });
    const makeContext = (attemptId: string) => ({ runId: attemptId, candidateId: 'candidate', role: 'implementation' as const, subjectDigest: hash(attemptId), signal: new AbortController().signal,
      emitActivity: (kind: any, data: Readonly<Record<string, unknown>>) => { recorded.push({ attemptId, kind, quantity: data.quantity, status: data.status }); } });
    const first = await execute(makeContext('attempt-1')); pending.get('attempt-1')!.options.onEvent?.({ kind: 'usage', source: 'thread/tokenUsage/updated', scope: 'ephemeral-thread-cumulative', ...breakdown(5) }); pending.get('attempt-1')!.resolve({ threadId:'t1',turnId:'u1',status:'completed',goalVerification:{passed:true} });
    expect(await first.completion).toBe('succeeded');
    const retry = await execute(makeContext('attempt-2')); pending.get('attempt-2')!.options.onEvent?.({ kind: 'usage', source: 'thread/tokenUsage/updated', scope: 'ephemeral-thread-cumulative', ...breakdown(4) }); await retry.cancel(); pending.get('attempt-2')!.options.onEvent?.({ kind: 'usage', source: 'thread/tokenUsage/updated', scope: 'ephemeral-thread-cumulative', ...breakdown(9) }); pending.get('attempt-2')!.resolve({ threadId:'t2',turnId:'u2',status:'interrupted',goalVerification:{passed:false} });
    expect(await retry.completion).toBe('failed');
    expect(recorded.filter(row => row.kind === 'usage')).toEqual([
      expect.objectContaining({ attemptId: 'attempt-1', quantity: 5, status: 'observed' }),
      expect.objectContaining({ attemptId: 'attempt-2', quantity: 4, status: 'observed' }),
    ]);
  });
});
