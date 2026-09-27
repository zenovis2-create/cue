import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openLedger, type Ledger } from '../src/ledger.js';
import { createCleanupObservationStore } from '../src/cleanup-observation-store.js';
import { LOCAL_JSON_PRODUCER_CANDIDATE_ID, LOCAL_JSON_CHECKER_CANDIDATE_ID } from '../src/selection/local-host-settings.js';

function fixture(db: Ledger) {
  db.prepare("INSERT INTO task VALUES('task','running',NULL,'now')").run();
  db.prepare("INSERT INTO envelope VALUES('envelope','fixture-workspace','[]','now')").run();
  db.prepare("INSERT INTO run VALUES('run','task','envelope',0,'now')").run();
  const session = { handle: 'fixture-session', pid: 1234, start_time: 'fixture-start', cwd: 'fixture-workspace', task_id: 'task', run_id: 'run' };
  db.prepare('INSERT INTO session_handle(handle,pid,start_time,cwd,task_id,run_id) VALUES(?,?,?,?,?,?)').run(session.handle, session.pid, session.start_time, session.cwd, session.task_id, session.run_id);
  return { runId: 'run', candidateId: 'fixture-model', role: 'model', subjectDigest: 'a'.repeat(64), measuredAt: '2026-09-11T00:00:00.000Z', result: 'unknown', reason: 'fixture-observation', providerStopped: 'unknown', billing: 'unknown', session };
}
describe('host cleanup observation persistence (synthetic observations, no OS qualification)', () => {
  it('persists actual canonical candidate IDs without widening run or session IDs', () => {
    const db = openLedger();
    try {
      const observation = fixture(db), store = createCleanupObservationStore(db);
      for (const candidateId of [LOCAL_JSON_PRODUCER_CANDIDATE_ID, LOCAL_JSON_CHECKER_CANDIDATE_ID, 'catalog/name:v1.2', 'x'.repeat(200)]) {
        const value = { ...observation, candidateId }, ref = store.persist(value);
        expect(store.persist(value)).toBe(ref);
        expect(JSON.parse(Buffer.from(createCleanupObservationStore(db).read(ref)!).toString()).candidateId).toBe(candidateId);
      }
      for (const candidateId of ['', '.prefix', 'has space', 'x'.repeat(201)]) expect(() => store.persist({ ...observation, candidateId })).toThrow('identity');
      expect(() => store.persist({ ...observation, runId: 'run.with.dot' })).toThrow('identity');
      expect(() => store.persist({ ...observation, session: { ...observation.session, handle: 'session.with.dot' } })).toThrow('session');
    } finally { db.close(); }
  });
  it('commits stable canonical references, reopens and returns isolated byte copies', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'cue-cleanup-store-')), 'ledger.sqlite');
    let db = openLedger(path);
    try {
      const observation = fixture(db), store = createCleanupObservationStore(db);
      const ref = store.persist(observation);
      expect(ref).toMatch(/^cue-cleanup:[a-f0-9]{64}$/);
      expect(store.persist(Object.fromEntries(Object.entries(observation).reverse()))).toBe(ref);
      expect(store.persist({ ...observation, reason: 'changed bytes' })).not.toBe(ref);
      expect((db.prepare('SELECT COUNT(*) n FROM cleanup_observation').get() as { n: number }).n).toBe(2);
      const original = Buffer.from(store.read(ref)!); store.read(ref)!.fill(0);
      expect(Buffer.from(store.read(ref)!)).toEqual(original);
      db.close(); db = openLedger(path);
      expect(Buffer.from(createCleanupObservationStore(db).read(ref)!)).toEqual(original);
      // Missing identity remains storable unknown observation; storage does not
      // synthesize a session or grant receipt/qualification authority.
      const { session: _, ...missing } = observation;
      expect(createCleanupObservationStore(db).read(createCleanupObservationStore(db).persist(missing))).toBeDefined();
      expect('verifyCleanup' in store).toBe(false);
    } finally { db.close(); }
  });
  it('requires actual run and exact supplied session identities', () => {
    const db = openLedger();
    try {
      const observation = fixture(db), store = createCleanupObservationStore(db);
      expect(() => store.persist({ ...observation, runId: 'other', session: { ...observation.session, run_id: 'other' } })).toThrow('missing_run');
      for (const patch of [{ pid: 9876 }, { task_id: 'other' }, { cwd: 'other' }, { start_time: 'other' }, { handle: 'missing' }]) {
        expect(() => store.persist({ ...observation, session: { ...observation.session, ...patch } })).toThrow('session_mismatch');
      }
      expect(() => store.persist({ ...observation, session: { ...observation.session, run_id: 'other' } })).toThrow('session');
      expect((db.prepare('SELECT COUNT(*) n FROM cleanup_observation').get() as { n: number }).n).toBe(0);
    } finally { db.close(); }
  });
  it('denies update/delete/replace and verifies hashes plus indexed identity after offline tamper', () => {
    const db = openLedger();
    try {
      const observation = fixture(db), store = createCleanupObservationStore(db), ref = store.persist(observation);
      for (const sql of ["UPDATE cleanup_observation SET subject_digest='b'", 'DELETE FROM cleanup_observation', 'INSERT OR REPLACE INTO cleanup_observation SELECT * FROM cleanup_observation', 'INSERT OR IGNORE INTO cleanup_observation SELECT * FROM cleanup_observation']) expect(() => db.exec(sql)).toThrow('immutable_cleanup_observation');
      db.exec('DROP TRIGGER cleanup_observation_no_update');
      db.prepare('UPDATE cleanup_observation SET subject_digest=?').run('b'.repeat(64));
      expect(store.read(ref)).toBeUndefined(); expect(() => store.persist(observation)).toThrow('collision');
      db.prepare('UPDATE cleanup_observation SET subject_digest=?,payload=?').run('a'.repeat(64), Buffer.from('{}'));
      expect(store.read(ref)).toBeUndefined();
      expect(store.read('C:\\arbitrary\\file')).toBeUndefined();
    } finally { db.close(); }
  });
  it('rejects unsafe serialization without evaluating accessors or proxies, and bounds input', () => {
    const db = openLedger();
    try {
      const observation = fixture(db), store = createCleanupObservationStore(db);
      let touched = false;
      const getter = Object.defineProperty({}, 'secret', { enumerable: true, get() { touched = true; return 1; } });
      const proxy = new Proxy({}, { ownKeys() { touched = true; return []; } });
      const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic;
      const tooDeep = { x: { x: { x: { x: { x: { x: { x: { x: { x: 1 } } } } } } } } };
      class ExoticArray extends Array {}
      for (const value of [getter, proxy, cyclic, tooDeep, { toJSON() { touched = true; return {}; } }, new Date(), undefined, NaN, Infinity, -0, BigInt(1), new Array(2), new ExoticArray(), Array(257).fill(0), 'x'.repeat(65536)]) {
        expect(() => store.persist({ ...observation, value })).toThrow();
      }
      expect(() => store.persist({ ...observation, role: ['model'] })).toThrow('identity');
      expect(() => store.persist({ ...observation, result: ['unknown'] })).toThrow('identity');
      expect(touched).toBe(false);
      expect((db.prepare('SELECT COUNT(*) n FROM cleanup_observation').get() as { n: number }).n).toBe(0);
    } finally { db.close(); }
  });
  it('never issues a reference inside an outer transaction or after an insert rollback', () => {
    const db = openLedger();
    try {
      const observation = fixture(db), store = createCleanupObservationStore(db);
      expect(() => db.transaction(() => store.persist(observation))()).toThrow('outer_transaction');
      db.exec("CREATE TRIGGER fixture_abort AFTER INSERT ON cleanup_observation BEGIN SELECT RAISE(ABORT,'fixture_rollback'); END");
      expect(() => store.persist(observation)).toThrow('fixture_rollback');
      expect(db.inTransaction).toBe(false);
      expect((db.prepare('SELECT COUNT(*) n FROM cleanup_observation').get() as { n: number }).n).toBe(0);
      db.exec('DROP TRIGGER fixture_abort');
      expect(store.read(store.persist(observation))).toBeDefined();
    } finally { db.close(); }
  });
});
