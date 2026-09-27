import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { openLedger, type Ledger } from '../src/ledger.js';
import { createNativeExecutionIdentityStore, type NativeExecutionIdentity } from '../src/native-execution-identity-store.js';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) {
  if (dirname(resolve(root)) !== resolve(tmpdir()) || !root.includes('cue-native-identity-test-')) throw Error('fixture_cleanup_scope');
  rmSync(root, { recursive: true, force: true });
} });
function fixture(db: Ledger): NativeExecutionIdentity {
  db.exec("INSERT INTO task VALUES('task','running',NULL,'now'); INSERT INTO envelope VALUES('envelope','fixture','[]','now'); INSERT INTO run VALUES('run','task','envelope',0,'now')");
  const session = { handle: 'session', pid: 101, start_time: 'host-clock-not-filetime', cwd: 'C:\\fixture', task_id: 'task', run_id: 'run' };
  db.prepare('INSERT INTO session_handle(handle,pid,start_time,cwd,task_id,run_id) VALUES(?,?,?,?,?,?)').run(...Object.values(session));
  const profile = 'Cue.Model.' + 'a'.repeat(32), sha = 'a'.repeat(64);
  return { version: 'cue-native-execution-identity-v1', runId: 'run', candidateId: 'cue.local.qwen38-27b-unc', role: 'model', subjectDigest: sha, session,
    processes: { launcher: { pid: 101, createdFileTime: '1' }, client: { pid: 102, createdFileTime: '134335000000000000' }, guardian: { pid: 103, createdFileTime: '18446744073709551615' } },
    boundary: { profile, sid: 'S-1-15-2-123-456', taskRoot: 'C:\\Temp\\' + profile, profilePath: 'C:\\Packages\\' + profile.toLowerCase() + '\\AC', clientKind: 'model', controlBundleSha256: sha, launcherSha256: sha, clientSha256: sha, guardianSha256: sha }, observedAt: '2026-09-11T00:00:00.000Z' };
}
describe('native identity recorded structure only (no OS measurements or authority)', () => {
  it('records the pinned goal checker kind and rejects unknown boundary kinds', () => {
    const db = openLedger(); try {
      const value = fixture(db), store = createNativeExecutionIdentityStore(db);
      const goal = { ...value, boundary: { ...value.boundary, clientKind: 'goal-proposal-checker' as const } };
      const ref = store.record(goal);
      expect(store.read(ref)).toEqual(goal);
      expect(() => store.record({ ...value, boundary: { ...value.boundary, clientKind: 'unregistered' as any } })).toThrow('native_identity_boundary');
    } finally { db.close(); }
  });
  it('commits, replays canonical bytes, freezes copies and reopens without orchestration attempts', () => {
    const root = mkdtempSync(join(tmpdir(), 'cue-native-identity-test-')); roots.push(root);
    const file = join(root, 'ledger.sqlite'); let db = openLedger(file);
    try {
      const value = fixture(db), store = createNativeExecutionIdentityStore(db), ref = store.record(value);
      expect(ref).toMatch(/^cue-native-identity:[a-f0-9]{64}$/);
      expect(store.record(Object.fromEntries(Object.entries(value).reverse()) as unknown as NativeExecutionIdentity)).toBe(ref);
      const read = store.read(ref)!; expect(read).toEqual(value); expect(Object.isFrozen(read.boundary)).toBe(true);
      expect(read.boundary.profilePath).toContain('cue.model.');
      (value.processes.client as { pid: number }).pid = 999;
      expect(store.read(ref)!.processes.client.pid).toBe(102);
      expect('verifyCleanup' in store).toBe(false);
      db.close(); db = openLedger(file); expect(createNativeExecutionIdentityStore(db).read(ref)).toEqual(read);
    } finally { db.close(); }
  });
  it('rejects conflicting session identity and every mutation form', () => {
    const db = openLedger(); try {
      const value = fixture(db), store = createNativeExecutionIdentityStore(db); store.record(value);
      for (const patch of [{ candidateId: 'cue.local.json-checker' }, { observedAt: '2026-09-12T00:00:00.000Z' }, { subjectDigest: 'b'.repeat(64) }]) expect(() => store.record({ ...value, ...patch })).toThrow('immutable_conflict');
      for (const sql of ['UPDATE native_execution_identity SET candidate_id=\'other\'', 'DELETE FROM native_execution_identity', 'INSERT OR REPLACE INTO native_execution_identity SELECT * FROM native_execution_identity', 'INSERT OR IGNORE INTO native_execution_identity SELECT * FROM native_execution_identity']) expect(() => db.exec(sql)).toThrow('immutable_native_identity');
    } finally { db.close(); }
  });
  it('requires exact persisted run/session linkage and rejects stale linked reads', () => {
    const db = openLedger(); try {
      const value = fixture(db), store = createNativeExecutionIdentityStore(db);
      for (const patch of [{ handle: 'missing' }, { start_time: 'other' }, { cwd: 'D:\\other' }, { task_id: 'other' }]) expect(() => store.record({ ...value, session: { ...value.session, ...patch } })).toThrow('session_linkage');
      expect(() => store.record({ ...value, runId: 'missing', session: { ...value.session, run_id: 'missing' } })).toThrow('session_linkage');
      const ref = store.record(value); db.exec("UPDATE session_handle SET start_time='changed'"); expect(store.read(ref)).toBeNull();
    } finally { db.close(); }
  });
  it('never returns a durable reference from external transactions or failed commit work', () => {
    const db = openLedger(); try {
      const value = fixture(db), store = createNativeExecutionIdentityStore(db);
      expect(() => db.transaction(() => store.record(value))()).toThrow('outer_transaction');
      db.exec("CREATE TRIGGER fixture_abort AFTER INSERT ON native_execution_identity BEGIN SELECT RAISE(ABORT,'fixture_rollback'); END");
      expect(() => store.record(value)).toThrow('fixture_rollback'); expect(db.inTransaction).toBe(false);
      expect(db.prepare('SELECT COUNT(*) n FROM native_execution_identity').get()).toEqual({ n: 0 });
      db.exec('DROP TRIGGER fixture_abort'); expect(store.read(store.record(value))).toEqual(value);
    } finally { db.close(); }
  });
  it('rejects tampered bytes, indexed metadata and malformed references', () => {
    const db = openLedger(); try {
      const value = fixture(db), store = createNativeExecutionIdentityStore(db), ref = store.record(value);
      db.exec('DROP TRIGGER native_identity_no_update');
      db.exec("UPDATE native_execution_identity SET candidate_id='other'"); expect(store.read(ref)).toBeNull();
      db.prepare('UPDATE native_execution_identity SET candidate_id=?,payload=?').run(value.candidateId, Buffer.from('{}')); expect(store.read(ref)).toBeNull();
      expect(store.read('C:\\file')).toBeNull(); expect(store.read('cue-native-identity:' + 'f'.repeat(64))).toBeNull();
    } finally { db.close(); }
  });
  it('bounds primitive input and rejects getters/proxies/coercion without executing them', () => {
    const db = openLedger(); try {
      const value = fixture(db), store = createNativeExecutionIdentityStore(db); let touches = 0;
      const bad = (v: unknown) => expect(() => store.record(v as NativeExecutionIdentity)).toThrow();
      bad(new Proxy(value, { ownKeys() { touches++; return []; } }));
      bad(Object.defineProperty({ ...value }, 'session', { enumerable: true, get() { touches++; return value.session; } }));
      bad({ ...value, boundary: { ...value.boundary, clientKind: { toString() { touches++; return 'model'; } } } });
      for (const candidateId of ['', '.bad', 'x'.repeat(201), 'a b']) bad({ ...value, candidateId });
      bad({ ...value, runId: 'run.dot' }); bad({ ...value, extra: true });
      for (const createdFileTime of ['0', '01', '-1', '18446744073709551616', '1'.repeat(100)]) bad({ ...value, processes: { ...value.processes, client: { pid: 102, createdFileTime } } });
      bad({ ...value, processes: { ...value.processes, client: value.processes.launcher } });
      for (const cwd of ['\\root-relative', 'C:relative', '\\\\?\\C:\\device', '\\\\.\\pipe\\x', 'C:\\a\\..\\b', 'C:\\' + 'x'.repeat(2048)]) bad({ ...value, session: { ...value.session, cwd } });
      expect(touches).toBe(0); expect(db.prepare('SELECT COUNT(*) n FROM native_execution_identity').get()).toEqual({ n: 0 });
    } finally { db.close(); }
  });
});
