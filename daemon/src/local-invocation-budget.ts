import { createHash } from 'node:crypto';
import { types } from 'node:util';
import type { Ledger } from './ledger.js';
import { validateTaskPlan, type ValidatedPlan } from './orchestration/plan.js';

export interface LocalInvocationPolicy {
  runId: string; limit: number; policyRevision: string; source: string; observedAtMs: number;
}
export interface LocalInvocationReservation {
  runId: string; requestId: string; attemptId: string; taskId: string; candidateId: string;
  kind: 'producer' | 'checker'; observedAtMs: number;
}
export interface LocalInvocationSummary extends Readonly<LocalInvocationPolicy> {
  readonly version: 'cue-local-invocation-v1'; readonly digest: string;
  readonly committed: number; readonly remaining: number;
}
const policyKeys = ['runId', 'limit', 'policyRevision', 'source', 'observedAtMs'];
const reservationKeys = ['runId', 'requestId', 'attemptId', 'taskId', 'candidateId', 'kind', 'observedAtMs'];
function fail(why: string): never { throw Error('local_invocation_' + why); }
function shape(value: unknown, keys: string[]): void {
  if (!value || typeof value !== 'object' || types.isProxy(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('input');
  const names = Reflect.ownKeys(value);
  if (names.length !== keys.length || names.some(k => typeof k !== 'string' || !keys.includes(k)
    || !('value' in Object.getOwnPropertyDescriptor(value, k)!))) fail('input');
}
function text(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 256 || /[\u0000-\u001f\u007f]/u.test(value)) fail('text');
}
function integer(value: number): void { if (!Number.isSafeInteger(value) || value < 0) fail('integer'); }
function policy(value: LocalInvocationPolicy): Readonly<LocalInvocationPolicy> {
  shape(value, policyKeys); text(value.runId); text(value.policyRevision); text(value.source);
  integer(value.limit); integer(value.observedAtMs); if (value.limit < 1 || value.limit > 100000) fail('limit');
  return Object.freeze({ runId: value.runId, limit: value.limit, policyRevision: value.policyRevision, source: value.source, observedAtMs: value.observedAtMs });
}
function reservation(value: LocalInvocationReservation): Readonly<LocalInvocationReservation> {
  shape(value, reservationKeys);
  for (const item of [value.runId, value.requestId, value.attemptId, value.taskId, value.candidateId]) text(item);
  integer(value.observedAtMs); if (value.kind !== 'producer' && value.kind !== 'checker') fail('kind');
  return Object.freeze({ runId: value.runId, requestId: value.requestId, attemptId: value.attemptId, taskId: value.taskId,
    candidateId: value.candidateId, kind: value.kind, observedAtMs: value.observedAtMs });
}
const encode = (value: object) => JSON.stringify(value);
const digest = (value: string) => createHash('sha256').update('cue-local-invocation-v1\n' + value).digest('hex');
type PolicyRow = { run_id: string; limit_count: number; payload: string; digest: string };
type ReservationRow = { request_id: string; attempt_id: string; run_id: string; task_id: string; candidate_id: string; kind: string; payload: string; digest: string };

/** Host-only committed dispatch-intent count. Reserve inside the actual claim
 * transaction before launch. A crash or failed launch consumes its committed row.
 * No provider-request, cleanup, acceptance, pricing or refund truth is inferred. */
export function createLocalInvocationBudget(db: Ledger) {
  function noMoney(runId: string): void {
    if (db.prepare('SELECT 1 FROM integration_budget WHERE run_id=?').get(runId)) fail('incompatible_budget');
  }
  function readPolicy(runId: string) {
    text(runId); noMoney(runId);
    const row = db.prepare('SELECT * FROM local_invocation_budget WHERE run_id=?').get(runId) as PolicyRow | undefined;
    if (!row) fail('missing');
    if (typeof row.payload !== 'string' || row.payload.length > 4096) fail('corrupt_policy');
    const value = policy(JSON.parse(row.payload));
    if (value.runId !== runId || value.limit !== row.limit_count || encode(value) !== row.payload || digest(row.payload) !== row.digest
      || !db.prepare('SELECT 1 FROM run WHERE id=?').get(runId)) fail('corrupt_policy');
    return { value, digest: row.digest };
  }
  function lineage(value: Readonly<LocalInvocationReservation>, requireRunning: boolean): void {
    const row = db.prepare('SELECT a.*,p.payload AS plan_payload,p.digest AS plan_digest,p.envelope_hash AS plan_envelope,r.envelope_hash AS run_envelope FROM orchestration_attempt a JOIN orchestration_plan p ON p.run_id=a.run_id JOIN run r ON r.id=a.run_id WHERE a.attempt_id=?').get(value.attemptId) as Record<string, unknown> | undefined;
    if (!row || row.run_id !== value.runId || row.task_id !== value.taskId || row.candidate_id !== value.candidateId
      || (requireRunning && row.state !== 'running') || row.plan_envelope !== row.run_envelope
      || typeof row.plan_payload !== 'string' || row.plan_payload.length > 1_048_576) fail('attempt_mismatch');
    const saved = JSON.parse(row.plan_payload) as ValidatedPlan;
    const plan = validateTaskPlan(saved.approval, { revision: saved.revision, policyRevision: saved.approval.policyRevision,
      policyDigest: saved.approval.policyDigest, tasks: saved.tasks });
    if (encode(plan) !== row.plan_payload || plan.digest !== row.plan_digest) fail('plan_corrupt');
    const task = plan.tasks.find(t => t.id === value.taskId);
    if (!task || task.role !== (value.kind === 'producer' ? 'model-producer' : 'verifier') || !task.candidateIds.includes(value.candidateId)) fail('kind_mismatch');
    if (readPolicy(value.runId).value.policyRevision !== plan.approval.policyRevision) fail('policy_mismatch');
  }
  function decode(row: ReservationRow): Readonly<LocalInvocationReservation> {
    if (typeof row.payload !== 'string' || row.payload.length > 4096) fail('corrupt_reservation');
    const value = reservation(JSON.parse(row.payload));
    if (encode(value) !== row.payload || digest(row.payload) !== row.digest || value.runId !== row.run_id || value.requestId !== row.request_id
      || value.attemptId !== row.attempt_id || value.taskId !== row.task_id || value.candidateId !== row.candidate_id || value.kind !== row.kind) fail('corrupt_reservation');
    lineage(value, false); return value;
  }
  function summary(runId: string): Readonly<LocalInvocationSummary> {
    const p = readPolicy(runId);
    const rows = db.prepare('SELECT * FROM local_invocation_reservation WHERE run_id=?').all(runId) as ReservationRow[];
    if (rows.length > p.value.limit) fail('over_limit');
    for (const row of rows) decode(row);
    return Object.freeze({ version: 'cue-local-invocation-v1', ...p.value, digest: p.digest, committed: rows.length, remaining: p.value.limit - rows.length });
  }
  return Object.freeze({
    initialize(input: LocalInvocationPolicy): Readonly<LocalInvocationSummary> {
      const value = policy(input), payload = encode(value);
      return db.transaction(() => {
        noMoney(value.runId);
        if (!db.prepare('SELECT 1 FROM run WHERE id=?').get(value.runId)) fail('run_missing');
        const existing = db.prepare('SELECT payload FROM local_invocation_budget WHERE run_id=?').get(value.runId) as { payload: string } | undefined;
        if (existing) { if (existing.payload !== payload) fail('policy_mismatch'); }
        else db.prepare('INSERT INTO local_invocation_budget VALUES(?,?,?,?)').run(value.runId, value.limit, payload, digest(payload));
        return summary(value.runId);
      }).immediate();
    },
    reserve(input: LocalInvocationReservation): Readonly<LocalInvocationSummary> {
      const value = reservation(input), payload = encode(value);
      if (!db.inTransaction) fail('claim_transaction_required');
      return db.transaction(() => {
        const p = readPolicy(value.runId);
        const existing = db.prepare('SELECT * FROM local_invocation_reservation WHERE request_id=? OR attempt_id=?').all(value.requestId, value.attemptId) as ReservationRow[];
        if (existing.length) {
          if (existing.length !== 1 || encode(decode(existing[0]!)) !== payload) fail('request_mismatch');
          return summary(value.runId);
        }
        lineage(value, true);
        if (value.observedAtMs < p.value.observedAtMs) fail('time_regression');
        if (summary(value.runId).remaining < 1) fail('limit_exceeded');
        db.prepare('INSERT INTO local_invocation_reservation VALUES(?,?,?,?,?,?,?,?)').run(value.requestId, value.attemptId, value.runId, value.taskId, value.candidateId, value.kind, payload, digest(payload));
        return summary(value.runId);
      })();
    },
    summary(runId: string): Readonly<LocalInvocationSummary> { return db.transaction(() => summary(runId))(); },
  });
}
