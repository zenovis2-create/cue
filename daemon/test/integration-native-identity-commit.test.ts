import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { createHash } from 'node:crypto';
import { openLedger, type Ledger } from '../src/ledger.js';
import { createIsolatedLocalModelExecutor } from '../src/adapters/isolated-local-model.js';
import { createIsolatedJsonCheckerExecutor } from '../src/adapters/isolated-json-checker.js';
import { createIsolatedModelCleanup } from '../src/adapters/isolated-model-cleanup.js';
import { snapshotNativeHostIdentity } from '../src/adapters/native-identity-commit.js';
import type { ModelControlBundle } from '../src/model-control-bundle.js';

const state = vi.hoisted(() => ({ child: null as any }));
vi.mock('../src/process-launch.js', () => ({ spawnOwnedPiped(db: Ledger, owner: any) {
  const child = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill: vi.fn(), writes: [] as string[] });
  child.stdin.on('data', b => child.writes.push(b.toString()));
  const session = { handle: 'session', pid: 101, start_time: 'host-clock', cwd: owner.cwd, task_id: owner.task_id, run_id: owner.run_id };
  db.prepare('INSERT INTO session_handle(handle,pid,start_time,cwd,task_id,run_id) VALUES(?,?,?,?,?,?)').run(...Object.values(session));
  state.child = child; return { child, session };
} }));
const dbs: Ledger[] = [];
afterEach(() => { state.child?.emit('close', 1); for (const db of dbs.splice(0)) db.close(); vi.useRealTimers(); });
function fixture(kind: 'model' | 'json-checker' = 'model') {
  const db = openLedger(); dbs.push(db); db.exec("INSERT INTO task VALUES('task','running',NULL,'now'); INSERT INTO envelope VALUES('env','C:\\work','[]','now'); INSERT INTO run VALUES('run','task','env',0,'now')");
  const pin = { version: 'cue-model-control-v1' as const, clientKind: kind, nodeSha256: 'a'.repeat(64), launcherSha256: 'b'.repeat(64), guardianSha256: 'c'.repeat(64), clientSha256: 'd'.repeat(64), checkerCoreSha256: kind === 'model' ? null : 'e'.repeat(64) };
  const controlBundle: ModelControlBundle = { ...pin, sha256: createHash('sha256').update(JSON.stringify(Object.values(pin))).digest('hex') };
  const controller = new AbortController(), context = { runId: 'run', candidateId: 'cue.local.' + kind, role: 'model' as const, subjectDigest: 'a'.repeat(64), signal: controller.signal };
  const host = { db, controlBundle, nodeExecutable: 'C:\\node.exe', nodeSha256: pin.nodeSha256, taskRootBase: 'C:\\tasks', profileRootBase: 'C:\\profiles', timeoutMs: 30000,
    resolveBinding: () => ({ owner: { cwd: 'C:\\work', task_id: 'task', run_id: 'run' }, envelope: { run_id: 'run', worktree_realpath: 'C:\\work' } as any, prompt: 'fixture', inputBytes: Buffer.from('{}'), outputBytes: Buffer.from('{}') }) };
  const profile = 'Cue.Model.' + 'a'.repeat(32);
  const frames: Record<string, unknown> = { CUE_MODEL_GUARDIAN_PID: '103', CUE_MODEL_HOST_IDENTITY: { launcher: { pid: 101, createdFileTime: '134000000000000000' }, guardian: { pid: 103, createdFileTime: '134000000000000001' } },
    CUE_MODEL_BOUNDARY: { controlStatus: 'pinned', controlBundleSha256: controlBundle.sha256, clientKind: kind, clientSha256: pin.clientSha256, checkerCoreSha256: pin.checkerCoreSha256, guardianSha256: pin.guardianSha256, preserveDependencySymlinks: kind === 'json-checker', profile, taskRoot: 'C:\\tasks\\' + profile, profilePath: 'C:\\profiles\\' + profile.toLowerCase() + '\\AC', sid: 'S-1-15-2-1-2' },
    CUE_MODEL_OBSERVATION: { status: 'observed', phase: 'suspended-before-resume', appContainer: true, appContainerSid: 'S-1-15-2-1-2', pid: 102, createdFileTime: '134000000000000002' }, CUE_MODEL_PID: '102' };
  function emit(requestOnly = false) {
    const child = state.child, request = JSON.parse(Buffer.from(child.writes[0].trim(), 'base64').toString());
    if (!requestOnly) for (const [key, value] of Object.entries(frames)) child.stdout.write(key + '=' + (typeof value === 'string' ? value : JSON.stringify(value)) + '\n');
    const frame = kind === 'model' ? { ...request, type: 'model_request' } : { protocol: request.protocol, type: 'checker_request', contract: request.contract, requestId: request.requestId, attemptId: request.attemptId, inputSha256: createHash('sha256').update('{}').digest('hex'), outputSha256: createHash('sha256').update('{}').digest('hex') };
    child.stdout.write('CUE_MODEL_FRAME=' + Buffer.from(JSON.stringify(frame)).toString('base64') + '\n');
  }
  return { db, host, context, controller, frames, emit };
}
describe('offline native identity commit ordering (mock launcher, real SQLite; no native/model calls)', () => {
  it('commits before any model transport invocation and returns host-owned reference', async () => {
    const f = fixture(); let calls = 0;
    const execution = await createIsolatedLocalModelExecutor({ ...f.host, transport: async function* () {
      calls++; expect(f.db.inTransaction).toBe(false); expect(f.db.prepare('SELECT COUNT(*) n FROM native_execution_identity').get()).toEqual({ n: 1 });
      yield { type: 'terminal', status: 'completed', reason: 'stop', providerStopped: 'unknown' };
    } })(f.context);
    f.emit(); await Promise.resolve(); expect(calls).toBe(1); state.child.emit('close', 1);
    expect((await execution.result).identityRef).toMatch(/^cue-native-identity:/);
  });
  it('commits checker identity before writing authorize_check', async () => {
    const f = fixture('json-checker'), execution = await createIsolatedJsonCheckerExecutor(f.host)(f.context);
    state.child.stdin.on('data', () => expect(f.db.prepare('SELECT COUNT(*) n FROM native_execution_identity').get()).toEqual({ n: 1 }));
    f.emit(); expect(state.child.writes).toHaveLength(2);
    expect(JSON.parse(Buffer.from(state.child.writes[1].trim(), 'base64').toString()).type).toBe('authorize_check');
    state.child.emit('close', 1); expect((await execution.result).identityRef).toMatch(/^cue-native-identity:/);
  });
  it('rejects outer transactions before binding, launcher or session creation in both lanes', async () => {
    for (const kind of ['model', 'json-checker'] as const) {
      const f = fixture(kind); let bound = 0; state.child = null;
      const host = { ...f.host, resolveBinding: () => { bound++; return f.host.resolveBinding(); } };
      const launch = kind === 'model' ? createIsolatedLocalModelExecutor(host) : createIsolatedJsonCheckerExecutor(host);
      f.db.exec('BEGIN');
      try { await expect(launch(f.context)).rejects.toThrow('outer_transaction'); }
      finally { f.db.exec('ROLLBACK'); }
      expect(bound).toBe(0); expect(state.child).toBeNull(); expect(f.db.prepare('SELECT COUNT(*) n FROM session_handle').get()).toEqual({ n: 0 });
    }
  });
  it('write failure blocks both service lanes and retains exact launcher session', async () => {
    for (const kind of ['model', 'json-checker'] as const) {
      const f = fixture(kind); let calls = 0;
      f.db.exec("CREATE TRIGGER fixture_abort BEFORE INSERT ON native_execution_identity BEGIN SELECT RAISE(ABORT,'fixture_write_failed'); END");
      const execution = await (kind === 'model' ? createIsolatedLocalModelExecutor({ ...f.host, transport: async function* () { calls++; } }) : createIsolatedJsonCheckerExecutor(f.host))(f.context);
      f.emit(); expect(calls).toBe(0); expect(state.child.writes).toHaveLength(1); expect(state.child.kill).toHaveBeenCalled();
      expect(f.db.prepare('SELECT COUNT(*) n FROM native_execution_identity').get()).toEqual({ n: 0 });
      expect(execution.session.pid).toBe(101); state.child.emit('close', 1); expect((await execution.result).cleanup).toBe('unknown');
    }
  });
  it('missing frames, wrong host bases and already-aborted work never authorize', async () => {
    for (const scenario of ['missing', 'path', 'abort']) {
      const f = fixture(); let calls = 0;
      const execution = await createIsolatedLocalModelExecutor({ ...f.host, transport: async function* () { calls++; } })(f.context);
      if (scenario === 'path') (f.frames.CUE_MODEL_BOUNDARY as any).taskRoot = 'D:\\wrong\\' + (f.frames.CUE_MODEL_BOUNDARY as any).profile;
      if (scenario === 'abort') f.controller.abort();
      f.emit(scenario === 'missing'); expect(calls).toBe(0); expect(f.db.prepare('SELECT COUNT(*) n FROM native_execution_identity').get()).toEqual({ n: 0 });
      state.child.emit('close', 1); await execution.result;
    }
    const f = fixture(); expect(() => createIsolatedLocalModelExecutor({ ...f.host, taskRootBase: undefined as any })).toThrow('host_bases');
  });
  it('abort during durable commit keeps identity but prevents service invocation', async () => {
    const f = fixture(); let calls = 0;
    f.db.function('fixture_abort_signal', () => { f.controller.abort(); return 1; });
    f.db.exec('CREATE TRIGGER fixture_signal AFTER INSERT ON native_execution_identity BEGIN SELECT fixture_abort_signal(); END');
    const execution = await createIsolatedLocalModelExecutor({ ...f.host, transport: async function* () { calls++; } })(f.context);
    f.emit(); expect(calls).toBe(0); expect(f.db.prepare('SELECT COUNT(*) n FROM native_execution_identity').get()).toEqual({ n: 1 });
    state.child.emit('close', 1); expect((await execution.result).outcome).toBe('failed');
  });
  it('cancel deadline rejects without settling native result; later real close still completes', async () => {
    vi.useFakeTimers(); const f = fixture(), execution = await createIsolatedLocalModelExecutor(f.host)(f.context);
    let complete = false; void execution.completion.then(() => { complete = true; });
    const cancel = expect(execution.cancel()).rejects.toThrow('native_completion_unresolved'); await vi.advanceTimersByTimeAsync(5000); await cancel;
    expect(complete).toBe(false); expect(execution.session.handle).toBe('session'); state.child.emit('close', 1);
    expect(await execution.completion).toBe('failed'); expect((await execution.result).cleanup).toBe('unknown');
  });
  it('cleanup observer wait is bounded unknown while native completion remains pending', async () => {
    vi.useFakeTimers(); const f = fixture(), observations: any[] = [];
    const observer = createIsolatedModelCleanup({ db: f.db, taskRootBase: f.host.taskRootBase, profileRootBase: f.host.profileRootBase,
      launch: createIsolatedLocalModelExecutor(f.host), persistObservation: async v => { observations.push(v); return 'fixture:observation'; } });
    const execution = await observer.launch(f.context); const checking = observer.verifyCleanup(f.context, execution);
    let observed = false; void checking.then(() => { observed = true; });
    await vi.advanceTimersByTimeAsync(4999); expect(observed).toBe(false);
    await vi.advanceTimersByTimeAsync(1); expect((await checking).result).toBe('unknown'); expect(observations[0].result).toBe('unknown');
    state.child.emit('close', 1); expect(await execution.completion).toBe('failed');
  });
  it('strict host identity parser rejects malformed and getter frames without execution', () => {
    let touched = 0; const f = fixture(); expect(snapshotNativeHostIdentity(f.frames.CUE_MODEL_HOST_IDENTITY).launcher.pid).toBe(101);
    for (const input of [{ launcher: { pid: 101, createdFileTime: '0' }, guardian: { pid: 103, createdFileTime: '1' } }, new Proxy({}, { ownKeys() { touched++; return []; } }), Object.defineProperty({}, 'launcher', { get() { touched++; return {}; } })]) expect(() => snapshotNativeHostIdentity(input)).toThrow();
    expect(touched).toBe(0);
  });
});
