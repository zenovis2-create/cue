import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openLedger, type Ledger } from '../src/ledger.js';
import { bindRunLocalSelectionPolicy, readLatestLocalSelectionPolicy, readLocalSelectionPolicy, readRunLocalSelectionPolicy, saveLocalSelectionPolicy, selectLocalCandidate, type LocalSelectionPolicy } from '../src/selection/local-policy-store.js';
import { bindRunSelectionPolicy, saveSelectionPolicy } from '../src/selection/policy-store.js';
const handles: Ledger[] = [], dirs: string[] = [];
afterEach(() => { for (const db of handles.splice(0)) if (db.open) db.close(); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const now = '2026-09-11T00:00:00.000Z';
const policy = (mode: LocalSelectionPolicy['mode'] = 'efficiency'): LocalSelectionPolicy => ({ version: 'cue-local-selection-v1', mode, producerCandidateId: 'model', checkerCandidateId: 'checker', limitAttempts: 2, timeoutMs: 10000 });
const save = (db: Ledger, expectedRevision: number | null = null, value = policy()) => saveLocalSelectionPolicy(db, { policyId: 'local', expectedRevision, policy: value, createdAt: now, sourceVersion: 'fixture' });
function fixture(path?: string) { const db = openLedger(path); handles.push(db); db.exec(readFileSync(new URL('../migrations/022_local_selection_policy.sql', import.meta.url), 'utf8')); return db; }
function run(db: Ledger, id = 'run') {
  db.prepare('INSERT INTO task VALUES(?,?,?,?)').run(id, 'running', null, now);
  db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(id, 'fixture', '[]', now);
  db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run(id, id, id, 0, now);
}
const bind = (db: Ledger, snapshot: ReturnType<typeof save>, runId = 'run') => bindRunLocalSelectionPolicy(db, { runId, policyId: snapshot.policyId, revision: snapshot.revision, digest: snapshot.digest, boundAt: now });
test('local policies persist canonically, CAS increments and reopen retains exact immutable snapshots', () => {
  const root = mkdtempSync(join(tmpdir(), 'cue-local-policy-')); dirs.push(root); const path = join(root, 'db.sqlite');
  const db = fixture(path), first = save(db); expect(Object.isFrozen(first.policy)).toBe(true);
  const second = save(db, 1, policy('speed')); expect(second.revision).toBe(2); expect(second.digest).not.toBe(first.digest);
  expect(() => save(db, 1)).toThrow('revision-conflict'); db.close();
  const reopened = fixture(path); expect(readLocalSelectionPolicy(reopened, 'local', 1)).toEqual(first); expect(readLatestLocalSelectionPolicy(reopened, 'local')).toEqual(second);
  expect(JSON.stringify(second)).not.toMatch(/currency|quality|latency|price/);
});
test('SQL UPDATE DELETE REPLACE cannot mutate local policy or binding', () => {
  const db = fixture(), stored = save(db); run(db); bind(db, stored);
  for (const table of ['local_selection_policy_snapshot', 'local_selection_run_policy']) {
    expect(() => db.exec(`UPDATE ${table} SET digest='${'f'.repeat(64)}'`)).toThrow('immutable');
    expect(() => db.exec(`DELETE FROM ${table}`)).toThrow('immutable');
    expect(() => db.exec(`INSERT OR REPLACE INTO ${table} SELECT * FROM ${table}`)).toThrow();
  }
  expect(readRunLocalSelectionPolicy(db, 'run')!.snapshot).toEqual(stored);
});
test('binding is exact replay only and enclosing transaction rollback removes first binding', () => {
  const db = fixture(), first = save(db); run(db);
  expect(() => db.transaction(() => { bind(db, first); throw Error('rollback'); })()).toThrow('rollback');
  expect(readRunLocalSelectionPolicy(db, 'run')).toBeNull(); const bound = bind(db, first); expect(bind(db, first)).toEqual(bound);
  expect(() => bind(db, save(db, 1))).toThrow('rebind'); expect(() => bind(db, first, 'unknown')).toThrow();
  run(db, 'other'); expect(() => bind(db, { ...first, digest: 'f'.repeat(64) }, 'other')).toThrow('binding-digest');
  expect(readRunLocalSelectionPolicy(db, 'other')).toBeNull();
});
test('monetary and local run bindings exclude each other in both insert directions without rewriting legacy JSON', () => {
  const db = fixture(), local = save(db);
  const monetary = saveSelectionPolicy(db, { policyId: 'money', expectedRevision: null, createdAt: now, sourceVersion: 'fixture', policy: {
    version: 'cue-selection-v1', mode: 'value', qualityMinimum: 0, costBasis: 1, timeBasisMs: 1000, currency: 'USD', costLimit: null, remainingTimeMs: null,
    maxEstimateAgeMs: 1000, allowedCandidateIds: ['model'], pinnedCandidateId: null } });
  const serialized = db.prepare('SELECT policy_json FROM selection_policy_snapshot').get();
  const bindMoney = (runId: string) => bindRunSelectionPolicy(db, { runId, policyId: monetary.policyId, revision: monetary.revision, digest: monetary.digest, boundAt: now });
  run(db); bind(db, local); expect(() => bindMoney('run')).toThrow('binding_denied');
  run(db, 'money'); bindMoney('money'); expect(() => bind(db, local, 'money')).toThrow('binding_denied');
  expect(db.prepare('SELECT policy_json FROM selection_policy_snapshot').get()).toEqual(serialized);
});
test('first binding after approval or an execution attempt refuses', () => {
  const db = fixture(), stored = save(db); run(db, 'approved'); run(db, 'attempted');
  db.prepare('INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,approval_id,request_ordinal,decision,created_at) VALUES(?,?,?,?,?,?,?,?)').run('approved', 'approved', 'thread', 'item', 'approval', 1, 'accept', now);
  db.prepare('INSERT INTO orchestration_plan VALUES(?,?,?,?)').run('attempted', 'attempted', 'a'.repeat(64), '{}');
  db.prepare('INSERT INTO orchestration_step VALUES(?,?,?)').run('attempted', 'step', 'running');
  db.prepare('INSERT INTO orchestration_attempt VALUES(?,?,?,?,?,?,?,?,?)').run('attempt', 'attempted', 'step', 'model', 'running', '{}', 'fixture', null, 0);
  expect(() => bind(db, stored, 'approved')).toThrow('binding_denied'); expect(() => bind(db, stored, 'attempted')).toThrow('binding_denied');
});
const good = { candidateId: 'model', eligible: true, authenticated: true, compatible: true, dataAllowed: true, resourceAvailable: true, quotaAvailable: true };
test('legacy active writer, session or execution prevents first binding, while an existing exact binding remains readable', () => {
  const db = fixture(), stored = save(db);
  for (const runId of ['writer', 'session', 'execution', 'existing']) run(db, runId);
  const previous = bind(db, stored, 'existing');
  db.prepare("UPDATE run SET write_in_progress=1 WHERE id IN ('writer','existing')").run();
  db.prepare('INSERT INTO session_handle VALUES(?,?,?,?,?,?)').run('session-handle', 123, now, 'fixture', 'session', 'session');
  db.prepare('INSERT INTO execution_event(run_id,thread_id,item_id,approval_id,execution_id,execution_ordinal,created_at) VALUES(?,?,?,?,?,?,?)').run('execution', 'thread', null, null, 'execution-id', 0, now);
  for (const runId of ['writer', 'session', 'execution']) {
    expect(() => bind(db, stored, runId)).toThrow('binding_denied');
    expect(() => db.prepare('INSERT INTO local_selection_run_policy VALUES(?,?,?,?,?)').run(runId, stored.policyId, stored.revision, stored.digest, now)).toThrow('binding_denied');
    expect(readRunLocalSelectionPolicy(db, runId)).toBeNull();
  }
  expect(bind(db, stored, 'existing')).toEqual(previous);
});
test('all four modes retain the fixed pair without estimates or ranking and fail each missing host guarantee', () => {
  for (const mode of ['efficiency', 'performance', 'value', 'speed'] as const) {
    expect(selectLocalCandidate(policy(mode), 'model-producer', good)).toMatchObject({ selected: true, candidateId: 'model', authority: 'none', ranking: 'not-performed' });
    expect(selectLocalCandidate(policy(mode), 'verifier', { ...good, candidateId: 'checker' }).candidateId).toBe('checker');
  }
  for (const key of ['eligible', 'authenticated', 'compatible', 'dataAllowed', 'resourceAvailable', 'quotaAvailable']) {
    expect(selectLocalCandidate(policy(), 'model-producer', { ...good, [key]: false })).toMatchObject({ selected: false, candidateId: null, reasons: [key] });
  }
  expect(selectLocalCandidate(policy(), 'implementation', good).selected).toBe(false);
  expect(selectLocalCandidate(policy(), 'verifier', good).reasons).toEqual(['candidate-mismatch']);
});
test('policy and host data reject accessors, extra monetary fields, same IDs and invalid bounds', () => {
  const db = fixture(); let reads = 0;
  for (const change of [{ checkerCandidateId: 'model' }, { limitAttempts: 0 }, { limitAttempts: 1001 }, { timeoutMs: 999 }, { timeoutMs: 3600001 }, { currency: 'USD' }]) expect(() => save(db, null, { ...policy(), ...change })).toThrow();
  expect(() => save(db, null, Object.defineProperty(policy(), 'mode', { get() { reads++; return 'value'; } }))).toThrow();
  expect(selectLocalCandidate(policy(), 'model-producer', Object.defineProperty({ ...good }, 'eligible', { get() { reads++; return true; } })).selected).toBe(false);
  expect(selectLocalCandidate(policy(), 'model-producer', new Proxy(good, {})).selected).toBe(false);
  expect(selectLocalCandidate(policy(), 'model-producer', { ...good, eligible: 'true' }).selected).toBe(false);
  expect(reads).toBe(0);
});
