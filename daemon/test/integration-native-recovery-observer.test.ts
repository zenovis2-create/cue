import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openLedger, type Ledger } from '../src/ledger.js';
import { createNativeExecutionIdentityStore, type NativeExecutionIdentity } from '../src/native-execution-identity-store.js';
import { createNativeRecoveryObserver, type NativeQuery } from '../src/native-recovery-observer.js';
const mocks = vi.hoisted(() => ({ process: vi.fn(), stat: vi.fn() }));
// All OS operations below are doubles. Even default-wire/native-label tests do
// not execute the actual helper or constitute native observation evidence.
vi.mock('../src/process-launch.js', () => ({ runProcessSync: mocks.process }));
vi.mock('node:fs/promises', () => ({ lstat: mocks.stat }));
const dbs: Ledger[] = [];
afterEach(() => { for (const db of dbs.splice(0)) db.close(); vi.useRealTimers(); });
beforeEach(() => { mocks.process.mockReset(); mocks.stat.mockReset().mockResolvedValue({ isSymbolicLink: () => false, isDirectory: () => true }); });
function fixture() {
  const db = openLedger(); dbs.push(db);
  db.exec("INSERT INTO task VALUES('task','running',NULL,'now'); INSERT INTO run VALUES('run','task','envelope',0,'now')");
  const session = { handle: 'session', pid: 101, start_time: 'not-native-filetime', cwd: 'C:\\removed-work', task_id: 'task', run_id: 'run' };
  db.prepare('INSERT INTO session_handle VALUES(?,?,?,?,?,?)').run(...Object.values(session));
  const profile = 'Cue.Model.' + 'a'.repeat(32), sha = 'a'.repeat(64);
  const value: NativeExecutionIdentity = { version: 'cue-native-execution-identity-v1', runId: 'run', candidateId: 'candidate', role: 'model', subjectDigest: sha, session,
    processes: { launcher: { pid: 101, createdFileTime: '134335000000000001' }, client: { pid: 102, createdFileTime: '134335000000000002' }, guardian: { pid: 103, createdFileTime: '18446744073709551615' } },
    boundary: { profile, sid: 'S-1-15-2-123-456', taskRoot: 'C:\\Temp\\' + profile, profilePath: 'C:\\Local\\Packages\\' + profile + '\\AC', clientKind: 'model', controlBundleSha256: sha, launcherSha256: sha, clientSha256: sha, guardianSha256: sha }, observedAt: '2026-09-11T00:00:00.000Z' };
  const store = createNativeExecutionIdentityStore(db), identityRef = store.record(value);
  const request = { identityRef, runId: value.runId, candidateId: value.candidateId, subjectDigest: value.subjectDigest };
  const response = (q: NativeQuery) => ({ version: q.version, nonce: q.nonce, temp: 'C:\\Temp', localAppData: 'C:\\Local',
    processes: Object.values(value.processes).map(p => ({ pid: p.pid, createdFileTime: p.createdFileTime, liveness: 'alive' })) });
  const query = vi.fn(async (q: NativeQuery) => response(q)), stat = vi.fn(async () => 'directory' as const), guard = vi.fn(() => true as const);
  const host = { db, assertInstallationCurrent: guard, fixture: { query, stat } };
  return { db, value, store, request, response, query, stat, guard, host };
}
test('same persisted lineage and exact FileTime produce frozen fixture observations with zero DB changes', async () => {
  const f = fixture(), before = f.db.prepare('SELECT total_changes() n').get(), original = f.store.read(f.request.identityRef);
  const result = await createNativeRecoveryObserver(f.host).observe(f.request);
  expect(result).toMatchObject({ sourceKind: 'fixture', authority: 'observation-only', pathProvenance: 'matched', paths: { taskRoot: 'present', profileRoot: 'present', profilePath: 'present' } });
  expect(Object.values(result.processes).map(p => p.state)).toEqual(['matching-alive', 'matching-alive', 'matching-alive']);
  expect(Object.isFrozen(result.processes.client.expected)).toBe(true);
  expect(f.db.prepare('SELECT total_changes() n').get()).toEqual(before); expect(f.store.read(f.request.identityRef)).toEqual(original);
  expect('verifyCleanup' in createNativeRecoveryObserver(f.host)).toBe(false); expect('result' in result).toBe(false); expect(mocks.process).not.toHaveBeenCalled();
});
test('distinguishes reuse, matching exited and explicit absence without rounding FileTime', async () => {
  const f = fixture(); f.query.mockImplementation(async q => ({ ...f.response(q), processes: [
    { pid: 101, createdFileTime: '134335000000000002', liveness: 'alive' },
    { pid: 102, createdFileTime: f.value.processes.client.createdFileTime, liveness: 'exited' },
    { pid: 103, createdFileTime: null, liveness: 'absent' },
  ] } as any));
  expect(Object.values((await createNativeRecoveryObserver(f.host).observe(f.request)).processes).map(p => p.state)).toEqual(['pid-reused', 'matching-exited', 'absent']);
});
test('rejects foreign lineage, malformed/accessor/proxy inputs before queries', async () => {
  const f = fixture(), observer = createNativeRecoveryObserver(f.host); let touched = 0;
  for (const input of [{ ...f.request, runId: 'other' }, { ...f.request, candidateId: 'other' }, { ...f.request, subjectDigest: 'b'.repeat(64) }, { ...f.request, identityRef: 'missing' }, { ...f.request, executable: 'x' },
    Object.defineProperty({ ...f.request }, 'runId', { enumerable: true, get() { touched++; return 'run'; } }), new Proxy(f.request, { getOwnPropertyDescriptor() { touched++; throw Error('proxy'); } })]) {
    await expect(observer.observe(input as any)).rejects.toThrow();
  }
  expect(touched).toBe(0); expect(f.query).not.toHaveBeenCalled();
});
test.each(['nonce', 'partial', 'error', 'access'])('unusable %s query remains unknown, never absence', async variant => {
  const f = fixture(); f.query.mockImplementation(async q => {
    if (variant === 'error') throw Error('access denied');
    const r = f.response(q); if (variant === 'nonce') r.nonce = 'wrong';
    if (variant === 'partial') r.processes.pop();
    if (variant === 'access') r.processes = r.processes.map(p => ({ ...p, createdFileTime: null, liveness: 'unknown' })) as any;
    return r;
  });
  const result = await createNativeRecoveryObserver(f.host).observe(f.request);
  expect(Object.values(result.processes).every(p => p.state === 'unknown')).toBe(true);
});
test('unknown/reparse ancestry and wrong known folders never establish matching path provenance', async () => {
  for (const kind of ['unknown', 'reparse'] as const) {
    const f = fixture(); f.stat.mockResolvedValue(kind as any);
    const result = await createNativeRecoveryObserver(f.host).observe(f.request);
    expect(result.pathProvenance).toBe('unknown'); expect(Object.values(result.paths)).toEqual(['unknown', 'unknown', 'unknown']);
  }
  const f = fixture(); f.query.mockImplementation(async q => ({ ...f.response(q), temp: 'D:\\ChangedAccount' }));
  expect((await createNativeRecoveryObserver(f.host).observe(f.request)).pathProvenance).toBe('unknown'); expect(f.stat).not.toHaveBeenCalled();
});
test('guard drift, changed session and caller abort discard responses without later observation', async () => {
  for (const change of ['guard', 'session', 'abort'] as const) {
    const f = fixture(), controller = new AbortController();
    f.query.mockImplementation(async q => {
      if (change === 'guard') f.guard.mockImplementation(() => { throw Error('source drift'); });
      if (change === 'session') f.db.exec("UPDATE session_handle SET start_time='changed'");
      if (change === 'abort') controller.abort();
      return f.response(q);
    });
    await expect(createNativeRecoveryObserver(f.host).observe({ ...f.request, signal: controller.signal })).rejects.toThrow();
    if (change !== 'guard') expect(f.stat).not.toHaveBeenCalled();
  }
});
test('full generation checks run twice independent of ancestor count; their time is outside OS deadline', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  const f = fixture(); f.guard.mockImplementation(() => { vi.advanceTimersByTime(8000); return true; });
  const result = await createNativeRecoveryObserver(f.host).observe(f.request);
  expect(f.guard.mock.calls).toEqual([['before-observation'], ['before-publish']]); expect(f.stat.mock.calls.length).toBeGreaterThan(6);
  expect(result.timing).toMatchObject({ initialGuardMs: 8000, finalGuardMs: 8000, observationLimitMs: 5000, totalResponseBounded: false });
});
test('OS deadline remains five seconds and initial guard failure starts no query', async () => {
  vi.useFakeTimers(); const f = fixture(); f.query.mockImplementation(() => new Promise(() => {}));
  const pending = expect(createNativeRecoveryObserver(f.host).observe(f.request)).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(5000); await pending; expect(f.guard).toHaveBeenCalledTimes(1);
  f.guard.mockImplementation(() => { throw Error('drift'); }); f.query.mockClear();
  await expect(createNativeRecoveryObserver(f.host).observe(f.request)).rejects.toThrow('drift'); expect(f.query).not.toHaveBeenCalled();
});
test('abort abandons a pending fixture query and consumes late rejection', async () => {
  const f = fixture(), controller = new AbortController(); let reject!: (error: Error) => void;
  f.query.mockImplementation(() => new Promise((_resolve, r) => { reject = r; }));
  const pending = createNativeRecoveryObserver(f.host).observe({ ...f.request, signal: controller.signal });
  await Promise.resolve(); controller.abort(); await expect(pending).rejects.toThrow(); reject(Error('late')); await Promise.resolve(); expect(f.stat).not.toHaveBeenCalled();
});
test('default wiring has fixed helper, exactly three PIDs, bounded sealed invocation, no historical cwd; only ENOENT means absent', async () => {
  const f = fixture(); mocks.process.mockImplementation((_exe, args) => {
    const q = JSON.parse(Buffer.from(args.at(-1), 'base64').toString()); expect(q.processes.map((p: any) => p.pid)).toEqual([101, 102, 103]);
    return { status: 0, stdout: JSON.stringify(f.response(q)), stderr: '' };
  });
  const observer = createNativeRecoveryObserver({ db: f.db, assertInstallationCurrent: f.guard });
  for (const code of ['ENOENT', 'EACCES', 'EPERM']) {
    mocks.stat.mockRejectedValue(Object.assign(Error(code), { code }));
    const result = await observer.observe(f.request);
    expect(Object.values(result.paths)).toEqual(Array(3).fill(code === 'ENOENT' ? 'absent' : 'unknown'));
  }
  const [executable, args, options] = mocks.process.mock.calls[0]!;
  expect(executable).toBe('powershell.exe'); expect(args).toContain('-File'); expect(args.some((v: string) => v.endsWith('native-process-observation.ps1'))).toBe(true);
  expect(options).toMatchObject({ maxBuffer: 16384, windowsHide: true }); expect(options.timeout).toBeLessThanOrEqual(5000); expect(options.cwd).toBeUndefined();
});
test('helper source has only read-only process APIs and same-handle liveness; no mutation functions', () => {
  const ps = readFileSync(resolve('src/native-process-observation.ps1'), 'utf8');
  for (const token of ['Process.GetProcessById(pid)', 'GetProcessTimes(handle', 'WaitForSingleObject(handle,0)', 'finally { CloseHandle(handle); }']) expect(ps).toContain(token);
  for (const token of ['TerminateProcess', 'TerminateJobObject', 'DeleteAppContainerProfile', 'Remove-Item', 'taskkill', 'Get-CimInstance']) expect(ps).not.toContain(token);
});
