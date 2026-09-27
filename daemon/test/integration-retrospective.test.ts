import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { openLedger, type Ledger } from '../src/ledger.js';
import { createRetrospectiveStore } from '../src/resources/retrospective.js';
const dbs: Ledger[] = [], roots: string[] = [];
afterEach(() => { for (const db of dbs.splice(0)) if (db.open) db.close(); for (const root of roots.splice(0)) {
  expect(dirname(root)).toBe(resolve(tmpdir())); expect(basename(root).startsWith('cue-retrospective-')).toBe(true); rmSync(root, { recursive: true, force: true });
} });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'cue-retrospective-')); roots.push(root);
  const path = join(root, 'ledger.sqlite'), db = openLedger(path); dbs.push(db);
  db.prepare("INSERT INTO task VALUES('task','blocked',?,?)").run('PRIVATE_ERROR_SECRET', '2026-09-11T00:00:00.000Z');
  db.prepare("INSERT INTO run VALUES('run','task',?,0,?)").run('a'.repeat(64), '2026-09-11T00:00:00.000Z');
  db.prepare("INSERT INTO orchestration_plan VALUES('run',?,?,?)").run('a'.repeat(64), 'b'.repeat(64), '{}');
  db.prepare("INSERT INTO orchestration_step VALUES('run','maker','blocked')").run();
  db.prepare("INSERT INTO orchestration_attempt VALUES('attempt','run','maker','candidate','failed',?,? ,NULL,0)").run('PRIVATE_PROMPT', root);
  db.prepare("INSERT INTO recovery_attempt_v2 VALUES(1,'run',NULL,1,1,?,'PRIVATE_OUTCOME',?)").run('PRIVATE_HYPOTHESIS', '2026-09-11T00:00:00.000Z');
  for (const kind of ['auth', 'environment', 'conversation', 'agent_result']) db.prepare("INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES('task','run',?,?,?)").run(kind, 'PRIVATE_SECRET_TOKEN', '2026-09-11T00:00:00.000Z');
  db.prepare("INSERT INTO verification(run_id,check_name,verdict,evidence,created_at) VALUES('run','private','pass','PRIVATE_VERIFICATION','2026-09-11T00:00:00.000Z')").run();
  return { db, path, store: createRetrospectiveStore(db) };
}
test('deterministic safe source projections contain no raw secrets and grant no verification authority', () => {
  const { db, store } = fixture();
  const protectedBefore = ['artifact', 'verification', 'capability_evidence', 'acceptance_final', 'session_handle'].map(t => db.prepare(`SELECT count(*) n FROM ${t}`).get());
  const draft = store.create({ draftId: 'draft1', runId: 'run' });
  expect(draft).toMatchObject({ status: 'draft', scope: 'local-only', authority: 'reference-only', sourceHashScope: 'safe-column-projection',
    summary: { observedTaskState: 'blocked', failedAttempts: 1, unresolvedAttempts: 1, recoveryRecords: 1, acceptance: 'not-assessed' } });
  expect(draft.sources.map(s => s.table)).toEqual(['run', 'task', 'orchestration_attempt', 'recovery_attempt_v2']);
  expect(draft.sources.every(s => /^[a-f0-9]{64}$/.test(s.projectionSha256))).toBe(true);
  expect(JSON.stringify(draft)).not.toContain('PRIVATE'); expect(Object.isFrozen(draft.summary.nextActions)).toBe(true);
  const changes = db.prepare('SELECT total_changes() n').get();
  expect(store.create({ draftId: 'draft1', runId: 'run' })).toEqual(draft); expect(store.read('draft1')).toEqual(draft);
  expect(db.prepare('SELECT total_changes() n').get()).toEqual(changes);
  expect(['artifact', 'verification', 'capability_evidence', 'acceptance_final', 'session_handle'].map(t => db.prepare(`SELECT count(*) n FROM ${t}`).get())).toEqual(protectedBefore);
});
test('historical drafts survive current state changes and actual reopen; a new draft captures new safe state', () => {
  const f = fixture(), original = f.store.create({ draftId: 'history', runId: 'run' });
  f.db.prepare("UPDATE task SET state='completed' WHERE id='task'").run();
  f.db.prepare("UPDATE orchestration_attempt SET cleanup_verified=1 WHERE attempt_id='attempt'").run();
  expect(f.store.read('history')).toEqual(original);
  const next = f.store.create({ draftId: 'next', runId: 'run' }); expect(next.summary.observedTaskState).toBe('completed'); expect(next.summary.acceptance).toBe('not-assessed');
  expect(next.sourcesDigest).not.toBe(original.sourcesDigest); f.db.close();
  const reopened = openLedger(f.path); dbs.push(reopened);
  expect(createRetrospectiveStore(reopened).read('history')).toEqual(original); expect(createRetrospectiveStore(reopened).read('next')).toEqual(next);
});
test('conflict, strict input, and enclosing rollback leave no new draft', () => {
  const { db, store } = fixture(); store.create({ draftId: 'bound', runId: 'run' });
  expect(() => store.create({ draftId: 'bound', runId: 'foreign' })).toThrow('retrospective_conflict');
  let invoked = 0;
  for (const value of [null, { draftId: 'new', runId: 'run', command: 'no' }, Object.defineProperty({ runId: 'run' }, 'draftId', { enumerable: true, get() { invoked++; return 'new'; } })]) expect(() => store.create(value as any)).toThrow();
  expect(invoked).toBe(0);
  expect(() => db.transaction(() => { store.create({ draftId: 'rollback', runId: 'run' }); throw Error('outer-failure'); })()).toThrow('outer-failure');
  expect(store.read('rollback')).toBeNull(); expect(() => store.create({ draftId: 'missing', runId: 'missing' })).toThrow('retrospective_run_missing');
  expect(db.prepare('SELECT count(*) n FROM retrospective_draft').get()).toEqual({ n: 1 });
});
test('immutable SQL guards refuse update/delete/replace and tampered safe projection fails read', () => {
  const { db, store } = fixture(); store.create({ draftId: 'immutable', runId: 'run' });
  for (const sql of ["UPDATE retrospective_draft SET digest=digest", 'DELETE FROM retrospective_draft', 'INSERT OR REPLACE INTO retrospective_draft SELECT * FROM retrospective_draft']) expect(() => db.exec(sql)).toThrow('retrospective immutable');
  db.exec('DROP TRIGGER retrospective_no_update');
  const row = db.prepare('SELECT payload FROM retrospective_draft').get() as { payload: string };
  const tampered = JSON.parse(row.payload); tampered.snapshot.task.state = 'completed';
  db.prepare('UPDATE retrospective_draft SET payload=?').run(JSON.stringify(tampered));
  expect(() => store.read('immutable')).toThrow('retrospective_invalid');
});
test('source row limits fail closed without writing partial draft', () => {
  const { db, store } = fixture();
  db.transaction(() => { const insert = db.prepare("INSERT INTO orchestration_attempt VALUES(?,'run','maker','candidate','failed','{}','fixture',NULL,1)");
    for (let n = 0; n < 1024; n++) insert.run('more-' + n);
  })();
  expect(() => store.create({ draftId: 'oversized', runId: 'run' })).toThrow('retrospective_invalid');
  expect(store.read('oversized')).toBeNull();
});

