import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { createIsolatedLocalModelExecutor } from '../src/adapters/isolated-local-model.js';
import { streamLocalModel } from '../src/adapters/local-model.js';
import { openLedger, type Ledger } from '../src/ledger.js';
import type { ModelControlBundle } from '../src/model-control-bundle.js';

const state = vi.hoisted(() => ({ child: null as any }));
vi.mock('../src/process-launch.js', () => ({ spawnOwnedPiped(db: Ledger, owner: any) {
  const child = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill: vi.fn(), writes: [] as string[] });
  child.stdin.on('data', value => child.writes.push(value.toString()));
  const session = { handle: 'session', pid: 101, start_time: 'host-clock', cwd: owner.cwd, task_id: owner.task_id, run_id: owner.run_id };
  db.prepare('INSERT INTO session_handle(handle,pid,start_time,cwd,task_id,run_id) VALUES(?,?,?,?,?,?)').run(...Object.values(session));
  state.child = child;
  return { child, session };
} }));

const dbs: Ledger[] = [];
afterEach(() => {
  state.child?.emit('close', 1);
  state.child = null;
  for (const db of dbs.splice(0)) db.close();
  vi.useRealTimers();
});

function fixture(timeoutMs = 30000, transport: any = async function* () {
  yield { type: 'terminal', status: 'completed', reason: 'stop', providerStopped: 'unknown' };
}) {
  const db = openLedger();
  dbs.push(db);
  db.exec("INSERT INTO task VALUES('task','running',NULL,'now'); INSERT INTO envelope VALUES('env','C:\\work','[]','now'); INSERT INTO run VALUES('run','task','env',0,'now')");
  const pin = { version: 'cue-model-control-v1' as const, clientKind: 'model' as const, nodeSha256: 'a'.repeat(64), launcherSha256: 'b'.repeat(64), guardianSha256: 'c'.repeat(64), clientSha256: 'd'.repeat(64), checkerCoreSha256: null };
  const controlBundle: ModelControlBundle = { ...pin, sha256: createHash('sha256').update(JSON.stringify(Object.values(pin))).digest('hex') };
  const controller = new AbortController();
  const context = { runId: 'run', candidateId: 'cue.local.model', role: 'model' as const, subjectDigest: 'a'.repeat(64), signal: controller.signal };
  const profile = 'Cue.Model.' + 'a'.repeat(32);
  const host = { db, controlBundle, nodeExecutable: 'C:\\node.exe', nodeSha256: pin.nodeSha256, taskRootBase: 'C:\\tasks', profileRootBase: 'C:\\profiles', timeoutMs, transport,
    resolveBinding: () => ({ owner: { cwd: 'C:\\work', task_id: 'task', run_id: 'run' }, envelope: { run_id: 'run', worktree_realpath: 'C:\\work' } as any, prompt: 'fixture' }) };
  const frames: Record<string, unknown> = {
    CUE_MODEL_GUARDIAN_PID: '103',
    CUE_MODEL_HOST_IDENTITY: { launcher: { pid: 101, createdFileTime: '134000000000000000' }, guardian: { pid: 103, createdFileTime: '134000000000000001' } },
    CUE_MODEL_BOUNDARY: { controlStatus: 'pinned', controlBundleSha256: controlBundle.sha256, clientKind: 'model', clientSha256: pin.clientSha256, checkerCoreSha256: null, guardianSha256: pin.guardianSha256, preserveDependencySymlinks: false, profile, taskRoot: 'C:\\tasks\\' + profile, profilePath: 'C:\\profiles\\' + profile.toLowerCase() + '\\AC', sid: 'S-1-15-2-1-2' },
    CUE_MODEL_OBSERVATION: { status: 'observed', phase: 'suspended-before-resume', appContainer: true, appContainerSid: 'S-1-15-2-1-2', pid: 102, createdFileTime: '134000000000000002' },
    CUE_MODEL_PID: '102'
  };
  return { host, context, controller, frames };
}

function writeLine(value: string) { state.child.stdout.write(value + '\n'); }
function emitRequest(frames: Record<string, unknown>) {
  const request = JSON.parse(Buffer.from(state.child.writes[0].trim(), 'base64').toString());
  for (const [key, value] of Object.entries(frames)) writeLine(key + '=' + (typeof value === 'string' ? value : JSON.stringify(value)));
  writeLine('CUE_MODEL_FRAME=' + Buffer.from(JSON.stringify({ ...request, type: 'model_request' })).toString('base64'));
}
async function finishSuccess() {
  await vi.waitFor(() => expect(state.child.writes).toHaveLength(2));
  const response = JSON.parse(Buffer.from(state.child.writes[1].trim(), 'base64').toString());
  writeLine('CUE_MODEL_FRAME=' + Buffer.from(JSON.stringify({ ...response, type: 'model_result' })).toString('base64'));
  writeLine('CUE_MODEL_CLEANUP=' + JSON.stringify({ taskRootAbsent: true, profileAbsent: true }));
  writeLine('CUE_MODEL_EXIT=0');
}

describe('isolated model adapter diagnostics (mock launcher, real SQLite; no native/model/network calls)', () => {
  it('distinguishes cancellation from deadline expiry with fake timers', async () => {
    vi.useFakeTimers();
    const cancelled = fixture(1000), cancelledExecution = await createIsolatedLocalModelExecutor(cancelled.host)(cancelled.context);
    cancelled.controller.abort(); state.child.emit('close', 1);
    expect((await cancelledExecution.result).diagnosticCode).toBe('cancelled');

    const expired = fixture(100), expiredExecution = await createIsolatedLocalModelExecutor(expired.host)(expired.context);
    await vi.advanceTimersByTimeAsync(100); state.child.emit('close', 1);
    expect((await expiredExecution.result).diagnosticCode).toBe('deadline-exceeded');
  });

  it('retains the first failure when later child errors arrive', async () => {
    const f = fixture(), execution = await createIsolatedLocalModelExecutor(f.host)(f.context);
    f.controller.abort(); state.child.stderr.write('later native failure'); state.child.emit('error', Error('latest failure')); state.child.emit('close', 1);
    expect((await execution.result).diagnosticCode).toBe('cancelled');
  });

  it('sanitizes unknown transport errors to a fixed diagnostic code', async () => {
    const secret = 'provider-api-key-sk-secret-value';
    const f = fixture(30000, async function* () { throw Error(secret); }), execution = await createIsolatedLocalModelExecutor(f.host)(f.context);
    emitRequest(f.frames); await vi.waitFor(() => expect(state.child.kill).toHaveBeenCalled()); state.child.emit('close', 1);
    const result = await execution.result;
    expect(result.diagnosticCode).toBe('transport-failed');
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it('preserves privately issued local HTTP rejection classes', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => new Response('provider-secret-body', { status: 429, statusText: 'provider-secret-status' })) as typeof fetch;
    try {
      const f = fixture(30000, streamLocalModel), execution = await createIsolatedLocalModelExecutor(f.host)(f.context);
      emitRequest(f.frames); await vi.waitFor(() => expect(state.child.kill).toHaveBeenCalled()); state.child.emit('close', 1);
      const result = await execution.result;
      expect(result.diagnosticCode).toBe('local-http-429');
      expect(JSON.stringify(result)).not.toContain('provider-secret');
    } finally { globalThis.fetch = originalFetch; }
  });

  it('does not accept a forged HTTP diagnostic from an arbitrary transport error', async () => {
    const forged = Object.assign(Error('local model HTTP 403'), { diagnosticCode: 'local-http-403' });
    const f = fixture(30000, async function* () { throw forged; }), execution = await createIsolatedLocalModelExecutor(f.host)(f.context);
    emitRequest(f.frames); await vi.waitFor(() => expect(state.child.kill).toHaveBeenCalled()); state.child.emit('close', 1);
    expect((await execution.result).diagnosticCode).toBe('transport-failed');
  });

  it('classifies malformed broker frames as protocol invalid', async () => {
    const f = fixture(), execution = await createIsolatedLocalModelExecutor(f.host)(f.context);
    writeLine('CUE_MODEL_FRAME=%%%provider-secret%%%'); state.child.emit('close', 1);
    expect((await execution.result).diagnosticCode).toBe('protocol-invalid');
  });

  it('requires the native final close predicate after a valid model result', async () => {
    const f = fixture(), execution = await createIsolatedLocalModelExecutor(f.host)(f.context);
    emitRequest(f.frames); await finishSuccess(); state.child.emit('close', 7);
    expect((await execution.result).diagnosticCode).toBe('native-exit-failed');
  });

  it('omits diagnostics after a complete successful native close', async () => {
    const f = fixture(), execution = await createIsolatedLocalModelExecutor(f.host)(f.context);
    emitRequest(f.frames); await finishSuccess(); state.child.emit('close', 0);
    const result = await execution.result;
    expect(result.outcome).toBe('succeeded');
    expect(result).not.toHaveProperty('diagnosticCode');
  });
});
