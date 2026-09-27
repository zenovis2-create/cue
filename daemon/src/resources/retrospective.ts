import { createHash } from 'node:crypto';
import { types } from 'node:util';
import type { Ledger } from '../ledger.js';

const MAX_ROWS = 1024, MAX_BYTES = 1048576;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function fail(): never { throw Error('retrospective_invalid'); }
function fields(v: unknown, keys: string[]): Record<string, any> {
  if (!v || typeof v !== 'object' || types.isProxy(v) || Object.getPrototypeOf(v) !== Object.prototype) fail();
  const d = Object.getOwnPropertyDescriptors(v);
  if (Reflect.ownKeys(d).length !== keys.length || keys.some(k => !d[k]?.enumerable || !Object.hasOwn(d[k], 'value'))) fail();
  return Object.fromEntries(keys.map(k => [k, d[k]!.value]));
}
function id(v: unknown): string { if (typeof v !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(v)) fail(); return v; }
function digest(v: unknown): string { if (typeof v !== 'string' || !/^[a-f0-9]{64}$/.test(v)) fail(); return v; }
function integer(v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number { if (!Number.isSafeInteger(v) || (v as number) < min || (v as number) > max) fail(); return v as number; }
function state(v: unknown, states: readonly string[]): string { if (typeof v !== 'string' || !states.includes(v)) fail(); return v; }
function frozen<T>(v: T): T { if (v && typeof v === 'object') { for (const child of Object.values(v)) frozen(child); Object.freeze(v); } return v; }
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
function rows(v: unknown): any[] { if (!Array.isArray(v) || v.length > MAX_ROWS) fail(); return v; }
function snapshot(value: unknown) {
  const f = fields(value, ['run', 'task', 'attempts', 'recoveries']);
  const r = fields(f.run, ['id', 'taskId', 'envelopeHash', 'writeInProgress']);
  const run = { id: id(r.id), taskId: id(r.taskId), envelopeHash: digest(r.envelopeHash), writeInProgress: integer(r.writeInProgress, 0, 1) };
  const t = fields(f.task, ['id', 'state']);
  const task = { id: id(t.id), state: state(t.state, ['queued', 'running', 'awaiting_approval', 'blocked', 'completed', 'failed']) };
  if (run.taskId !== task.id) fail();
  const attempts = rows(f.attempts).map(v => {
    const a = fields(v, ['id', 'taskId', 'state', 'cleanupVerified']);
    return { id: id(a.id), taskId: id(a.taskId), state: state(a.state, ['running', 'completed', 'failed', 'blocked']), cleanupVerified: integer(a.cleanupVerified, 0, 1) };
  });
  const recoveries = rows(f.recoveries).map(v => { const a = fields(v, ['id', 'ordinal', 'rung']); return { id: integer(a.id, 1), ordinal: integer(a.ordinal, 1), rung: integer(a.rung, 1, 4) }; });
  if (attempts.some((a, n) => n > 0 && compare(attempts[n - 1]!.id, a.id) >= 0)
    || recoveries.some((a, n) => n > 0 && recoveries[n - 1]!.id >= a.id)) fail();
  return { run, task, attempts, recoveries };
}
function body(draftId: string, value: unknown) {
  const s = snapshot(value);
  const source = (table: string, sourceId: string, projection: unknown) => ({ table, id: sourceId, projectionSha256: hash(projection), projection });
  const sources = [source('run', s.run.id, s.run), source('task', s.task.id, s.task),
    ...s.attempts.map(a => source('orchestration_attempt', a.id, a)), ...s.recoveries.map(a => source('recovery_attempt_v2', String(a.id), a))];
  const unresolvedAttempts = s.attempts.filter(a => a.cleanupVerified === 0).length;
  return { version: 'cue-retrospective-v1' as const, draftId, runId: s.run.id, status: 'draft' as const,
    scope: 'local-only' as const, authority: 'reference-only' as const, sourceHashScope: 'safe-column-projection' as const,
    snapshot: s, sources, sourcesDigest: hash(sources), summary: {
      observedTaskState: s.task.state, totalAttempts: s.attempts.length, completedAttempts: s.attempts.filter(a => a.state === 'completed').length,
      failedAttempts: s.attempts.filter(a => a.state === 'failed').length, blockedAttempts: s.attempts.filter(a => a.state === 'blocked').length,
      unresolvedAttempts, recoveryRecords: s.recoveries.length, acceptance: 'not-assessed' as const,
      nextActions: [...(unresolvedAttempts || s.run.writeInProgress ? ['inspect-owned-cleanup'] : []),
        ...(s.attempts.some(a => a.state === 'failed' || a.state === 'blocked') ? ['review-recorded-failures'] : []), 'independent-verification-required'],
    } };
}
export type RetrospectiveDraft = Readonly<ReturnType<typeof body> & { digest: string }>;

/** Deterministic historical reference only. Never reads raw artifact/conversation,
 * free-form error, recovery hypothesis, auth/environment or verification evidence.
 * Safe projection hashes are not original full-row hashes or acceptance proofs. */
export function createRetrospectiveStore(db: Ledger) {
  function read(draftId: string): RetrospectiveDraft | null {
    id(draftId);
    const row = db.prepare('SELECT run_id,digest,length(CAST(payload AS BLOB)) bytes,substr(payload,1,?) payload FROM retrospective_draft WHERE draft_id=?')
      .get(MAX_BYTES + 1, draftId) as { run_id: string; digest: string; bytes: number; payload: string } | undefined;
    if (!row) return null;
    if (row.bytes > MAX_BYTES) fail();
    const parsed = JSON.parse(row.payload), expected = body(draftId, parsed.snapshot);
    if (row.run_id !== expected.runId || JSON.stringify(expected) !== row.payload || hash(expected) !== digest(row.digest)) fail();
    const run = db.prepare('SELECT task_id,envelope_hash FROM run WHERE id=?').get(row.run_id) as { task_id: string; envelope_hash: string } | undefined;
    if (!run || run.task_id !== expected.snapshot.run.taskId || run.envelope_hash !== expected.snapshot.run.envelopeHash) fail();
    return frozen({ ...expected, digest: row.digest });
  }
  return Object.freeze({
    read(draftId: string) { return db.transaction(() => read(draftId))(); },
    create(input: { draftId: string; runId: string }): RetrospectiveDraft {
      const f = fields(input, ['draftId', 'runId']), draftId = id(f.draftId), runId = id(f.runId);
      return db.transaction(() => {
        const existing = read(draftId);
        if (existing) { if (existing.runId !== runId) throw Error('retrospective_conflict'); return existing; }
        const run = db.prepare('SELECT id,task_id taskId,envelope_hash envelopeHash,write_in_progress writeInProgress FROM run WHERE id=?').get(runId) as any;
        if (!run) throw Error('retrospective_run_missing');
        const task = db.prepare('SELECT id,state FROM task WHERE id=?').get(run.taskId);
        const attempts = db.prepare('SELECT attempt_id id,task_id taskId,state,cleanup_verified cleanupVerified FROM orchestration_attempt WHERE run_id=? ORDER BY attempt_id COLLATE BINARY LIMIT ?').all(runId, MAX_ROWS + 1);
        const recoveries = db.prepare('SELECT id,ordinal,rung FROM recovery_attempt_v2 WHERE run_id=? ORDER BY id LIMIT ?').all(runId, MAX_ROWS + 1);
        const value = body(draftId, { run, task, attempts, recoveries }), payload = JSON.stringify(value);
        if (Buffer.byteLength(payload) > MAX_BYTES) throw Error('retrospective_limit');
        const result = frozen({ ...value, digest: hash(value) });
        db.prepare('INSERT INTO retrospective_draft VALUES(?,?,?,?)').run(draftId, runId, result.digest, payload);
        return result;
      }).immediate();
    },
  });
}
