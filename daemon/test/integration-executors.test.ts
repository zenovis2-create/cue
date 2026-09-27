import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { createCodexExecutor, createDefaultCodexCandidate, createLocalModelExecutor, type ExecutorEvent } from '../src/adapters/integration-executors.js';
import type { RuntimeContext } from '../src/integration-runtime.js';
import type { HostCodexRuntimeResult, RunningHostCodexRun } from '../src/host-codex-runtime.js';
import type { Ledger } from '../src/ledger.js';

const servers: Server[] = [];
afterEach(async () => { for (const server of servers.splice(0)) { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); } });
const context = (controller = new AbortController(), role: RuntimeContext['role'] = 'implementation'): RuntimeContext => ({ runId: 'attempt', candidateId: 'candidate', role, subjectDigest: 'a'.repeat(64), signal: controller.signal });
const bound = () => ({ owner: { run_id: 'attempt', task_id: 'step', cwd: 'C:/fixture' }, envelope: { run_id: 'attempt', worktree_realpath: 'C:/fixture',
  egress: [], expires_at: '2026-09-12T00:00:00.000Z', autonomy_level: 'bounded' as const, allowed_actions: ['write'] } });
const result = (): HostCodexRuntimeResult => ({ threadId: 'thread', turnId: 'turn', status: 'completed', finalMessage: 'done', controllerPid: 1, workerPids: [2], successfulToolCalls: 1,
  controllerStderr: 'private backend diagnostics', goalVerification: { passed: true, reason: 'workspace_changed', changedPaths: ['file'] } });
async function endpoint(mode: 'stop' | 'length' | 'hang' = 'stop') {
  let received: Record<string, unknown> | undefined;
  const server = createServer((request, response) => { let body = ''; request.on('data', chunk => { body += chunk; }); request.on('end', () => {
    received = JSON.parse(body); response.writeHead(200, { 'Content-Type': 'text/event-stream' });
    const event = (choices: unknown[], usage?: object) => response.write(`data: ${JSON.stringify({ model: 'fixture-model', choices, ...(usage ? { usage } : {}) })}\n\n`);
    event([{ index: 0, delta: { content: 'hello' }, finish_reason: null }]);
    if (mode === 'hang') return;
    event([{ index: 0, delta: {}, finish_reason: mode }], { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 });
    response.end('data: [DONE]\n\n');
  }); });
  servers.push(server); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); if (!address || typeof address === 'string') throw Error('no address');
  return { endpoint: `http://127.0.0.1:${address.port}/v1`, received: () => received };
}
describe('S1 concrete integration executors', () => {
  it('default production Codex candidate composes the controller sink and durable session capability', async()=>{
    const answer=result(), candidate=createDefaultCodexCandidate({db:{} as Ledger,binary:'C:/vendor/codex.exe',model:'host-model',tool:{id:'codex',revision:'host-v1'},availability:'ready',
      buildCurrentSubject:()=>({} as any),evidenceReferences:()=>({}),resolveBinding:()=>({...bound(),options:{codexHome:'C:/isolated',goal:'goal'}}),
      launch:()=>({session:{handle:'session-attempt'},done:Promise.resolve(answer),stop(){}} as RunningHostCodexRun)});
    expect(candidate).toMatchObject({kind:'agent',usage:'supported',typedActivitySource:'host-codex-controller-v1',durableExecutionRef:'session-handle-v1'});
    expect((await candidate.launch(context())).durableRef).toBe('session:session-attempt');
  });
  it('Codex delegates unchanged owner/envelope/options, preserves backend result and verified outcome', async () => {
    let args: unknown[] = []; const answer = result();
    const backend = { session:{handle:'session-attempt'},done: Promise.resolve(answer), stop() {} } as RunningHostCodexRun;
    const execute = createCodexExecutor({ db: {} as Ledger, binary: 'C:/vendor/codex.exe', model: 'host-model', tool:{id:'codex',revision:'host-v1'},
      resolveBinding: () => ({ ...bound(), options: { codexHome: 'C:/isolated', goal: 'goal', runTimeoutMs: 3000 } }),
      launch: (...values) => { args = values; return backend; } });
    const execution = await execute(context());
    expect(args[1]).toEqual(bound().owner); expect(args[2]).toEqual(bound().envelope);
    expect(args[3]).toEqual({ binary: 'C:/vendor/codex.exe', model: 'host-model', codexHome: 'C:/isolated', goal: 'goal', runTimeoutMs: 3000, runtimeRole:'implementation' });
    expect(execution.backend).toBe(backend); expect(await execution.result).toBe(answer); expect(await execution.completion).toBe('succeeded');
  });
  it('Codex ongoing signal and explicit cancel stop once; late backend failure is non-success', async () => {
    const controller = new AbortController(); let stops = 0; let fail!: (error: Error) => void;
    const backend = { session:{handle:'session-attempt'},done: new Promise<HostCodexRuntimeResult>((_, reject) => { fail = reject; }), stop() { stops++; } } as RunningHostCodexRun;
    const execute = createCodexExecutor({ db: {} as Ledger, binary: 'C:/vendor/codex.exe', model: 'host-model', tool:{id:'codex',revision:'host-v1'},
      resolveBinding: () => ({ ...bound(), options: { codexHome: 'C:/isolated', goal: 'goal' } }), launch: () => backend });
    const execution = await execute(context(controller)); controller.abort(); await execution.cancel();
    expect(stops).toBe(1); fail(Error('late failure secret')); expect(await execution.completion).toBe('failed');
    await expect(execution.result).rejects.toThrow('late failure');
  });
  it('Codex start errors propagate and incomplete verification or cleanup failures cannot succeed', async () => {
    const host = { db: {} as Ledger, binary: 'C:/vendor/codex.exe', model: 'host-model', tool:{id:'codex',revision:'host-v1'},resolveBinding: () => ({ ...bound(), options: { codexHome: 'C:/isolated', goal: 'goal' } }) };
    await expect(createCodexExecutor({ ...host, launch: () => { throw Error('partial start'); } })(context())).rejects.toThrow('partial start');
    for (const answer of [{ ...result(), failureKind: 'cleanup' as const }, { ...result(), goalVerification: { ...result().goalVerification, passed: false } }]) {
      const execution = await createCodexExecutor({ ...host, launch: () => ({ session:{handle:'session-attempt'},done: Promise.resolve(answer), stop() {} } as RunningHostCodexRun) })(context());
      expect(await execution.completion).toBe('failed');
    }
  });
  it('rejects pre-abort and mismatched per-attempt ownership before backend launch', async () => {
    let launched = false; const controller = new AbortController(); controller.abort();
    const execute = createCodexExecutor({ db: {} as Ledger, binary: 'C:/vendor/codex.exe', model: 'host-model', tool:{id:'codex',revision:'host-v1'},
      resolveBinding: () => ({ ...bound(), options: { codexHome: 'C:/isolated', goal: 'goal' } }), launch: () => { launched = true; throw Error('must not launch'); } });
    await expect(execute(context(controller))).rejects.toThrow();
    await expect(execute({ ...context(), runId: 'wrong' })).rejects.toThrow(/binding_mismatch/); expect(launched).toBe(false);
  });
  it('snapshots approved target arrays without invoking indexed accessors or proxy traps',async()=>{
    for(const kind of ['accessor','proxy'] as const){let traps=0,launched=false;const base=[{relativePath:'target.txt',maxBytes:1}] as any[];let targets:any;
      if(kind==='accessor'){targets=[];Object.defineProperty(targets,'0',{enumerable:true,get(){traps++;return base[0];}});targets.length=1;}else targets=new Proxy(base,{get(){traps++;throw Error('trap');}});
      const execute=createCodexExecutor({db:{} as Ledger,binary:'C:/vendor/codex.exe',model:'host-model',tool:{id:'codex',revision:'host-v1'},resolveBinding:()=>({owner:bound().owner,envelope:{...bound().envelope,allowed_actions:['file_change']},options:{codexHome:'C:/isolated',goal:'goal',verificationMode:'approved-existing-file-change' as const,approvedExistingTargets:targets}}),launch:()=>{launched=true;throw Error('must not launch');}});
      await expect(execute(context())).rejects.toThrow();expect({traps,launched}).toEqual({traps:0,launched:false});
    }
  });
  it('real local HTTP stream pins model, forwards lineage text/usage, preserves provider-stop unknown', async () => {
    const local = await endpoint(); const events: ExecutorEvent[] = [];
    const execution = await createLocalModelExecutor({ request: { endpoint: local.endpoint, model: 'fixture-model', timeoutMs: 1000 },
      resolveBinding: () => ({ ...bound(), prompt: 'supplied prompt' }), onEvent: event => { events.push(event); } })(context(new AbortController(), 'model'));
    expect(await execution.completion).toBe('succeeded'); expect(local.received()?.model).toBe('fixture-model');
    expect(events.map(event => event.ordinal)).toEqual([1, 2, 3]);
    expect(events[0]).toMatchObject({ attemptId: 'attempt', taskId: 'step', model: 'fixture-model', event: { type: 'text', text: 'hello' } });
    expect(events[1].event).toMatchObject({ type: 'usage', totalTokens: 3 });
    expect(events[2].event).toMatchObject({ type: 'terminal', providerStopped: 'unknown' });
  });
  it('local length truncation, callback throws and callback timeout are failed with transport cleanup', async () => {
    for (const mode of ['length', 'throw', 'timeout'] as const) {
      const local = await endpoint(mode === 'length' ? 'length' : 'hang');
      const execution = await createLocalModelExecutor({ request: { endpoint: local.endpoint, model: 'fixture-model', timeoutMs: 1000 },
        resolveBinding: () => ({ ...bound(), prompt: 'prompt' }), callbackTimeoutMs: 10,
        onEvent: () => { if (mode === 'throw') throw Error('private callback error'); if (mode === 'timeout') return new Promise<void>(() => {}); } })(context(new AbortController(), 'model'));
      expect(await execution.completion).toBe('failed');
    }
  });
  it('local cancellation aborts active HTTP work and cannot report success', async () => {
    const local = await endpoint('hang'); const controller = new AbortController();
    const execution = await createLocalModelExecutor({ request: { endpoint: local.endpoint, model: 'fixture-model', timeoutMs: 1000 },
      resolveBinding: () => ({ ...bound(), prompt: 'prompt' }), onEvent: () => controller.abort() })(context(controller, 'model'));
    expect(await execution.completion).toBe('failed'); await execution.cancel();
  });
});
