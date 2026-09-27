import { createHash } from 'node:crypto';
import { types } from 'node:util';
import type { Ledger } from '../ledger.js';
import { validateTaskPlan } from '../orchestration/plan.js';
import { readRunPolicyIdentity } from './run-policy-identity.js';
import { snapshotSelectionDecision, type SelectionDecision } from './policy.js';
import { snapshotLocalSelectionDecision, type LocalSelectionDecision } from './local-policy-store.js';
import { createLocalInvocationBudget } from '../local-invocation-budget.js';
const MAX_BYTES = 1048576;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
function fail(code: string): never { throw Error('attempt_selection_' + code); }
function id(v: unknown): string { if (typeof v !== 'string' || !v || v.length > 256 || /[\u0000-\u001f\u007f]/u.test(v)) fail('id'); return v; }
function parse(v: unknown, limit = MAX_BYTES): any { if (typeof v !== 'string' || Buffer.byteLength(v) > limit) fail('payload'); return JSON.parse(v); }
function fields(v: unknown, keys: string[]): Record<string, unknown> {
  if (!v || typeof v !== 'object' || types.isProxy(v) || Object.getPrototypeOf(v) !== Object.prototype) fail('input');
  const d = Object.getOwnPropertyDescriptors(v);
  if (Reflect.ownKeys(d).length !== keys.length || keys.some(k => !d[k]?.enumerable || !Object.hasOwn(d[k], 'value'))) fail('input');
  return Object.fromEntries(keys.map(k => [k, d[k]!.value]));
}
function freeze<T>(v: T): T { if (v && typeof v === 'object') { for (const child of Object.values(v)) freeze(child); Object.freeze(v); } return v; }
export interface AttemptDecisionSnapshot {
  readonly version: 'cue-attempt-selection-v1'; readonly authority: 'historical-explanation-only';
  readonly attemptId: string; readonly runId: string; readonly taskId: string; readonly requestId: string; readonly candidateId: string;
  readonly planDigest: string; readonly envelopeHash: string; readonly requestDigest: string; readonly reservationDigest: string;
  readonly policy: Readonly<{ kind: 'monetary' | 'local-invocation'; policyId: string; revision: number; digest: string }>;
  readonly selectedAtMs: number; readonly decision: SelectionDecision | LocalSelectionDecision; readonly digest: string;
}
export type AttemptDecisionRead = Readonly<{ availability: 'recorded'; snapshot: AttemptDecisionSnapshot } | { availability: 'legacy-not-recorded'; snapshot: null }>;

/** Immutable historical selection output, never current admission or a reconstruction
 * of unrecorded private host estimates. Only the engine's claim transaction writes. */
export function createAttemptDecisionStore(db: Ledger) {
  function context(attemptId: string) {
    const a = db.prepare('SELECT a.*,r.envelope_hash,p.digest plan_digest,p.payload plan_payload,p.envelope_hash plan_envelope FROM orchestration_attempt a JOIN run r ON r.id=a.run_id JOIN orchestration_plan p ON p.run_id=a.run_id WHERE a.attempt_id=?').get(attemptId) as any;
    if (!a || a.envelope_hash !== a.plan_envelope) fail('lineage');
    const saved = parse(a.plan_payload), plan = validateTaskPlan(saved.approval, { revision: saved.revision, policyRevision: saved.approval.policyRevision, policyDigest: saved.approval.policyDigest, tasks: saved.tasks });
    if (plan.digest !== a.plan_digest || JSON.stringify(plan) !== a.plan_payload) fail('plan');
    const policy = readRunPolicyIdentity(db, a.run_id);
    if (!policy || policy.digest !== plan.approval.policyDigest || `${policy.policyId}:${policy.revision}` !== plan.approval.policyRevision) fail('policy');
    const task = plan.tasks.find(t => t.id === a.task_id);
    if (!task || !task.candidateIds.includes(a.candidate_id) || !plan.approval.allowedCandidateIds.includes(a.candidate_id)) fail('candidate');
    const journal = db.prepare('SELECT payload FROM orchestration_activity WHERE event_id=? AND attempt_id=? AND ordinal=1').get(`engine-request-${attemptId}`, attemptId) as { payload: string } | undefined;
    if (!journal) fail('request');
    const activity = parse(journal.payload, 8192), claim = parse(a.claim_payload, 4096);
    if (!activity || typeof activity !== 'object' || Array.isArray(activity)
      || Object.keys(activity).sort().join(',') !== 'attemptId,data,eventId,kind,observedAtMs,ordinal,runId,taskId'
      || !activity.data || typeof activity.data !== 'object' || Array.isArray(activity.data)
      || Object.keys(activity.data).sort().join(',') !== 'progress,summary'
      || activity.runId !== a.run_id || activity.taskId !== a.task_id || activity.attemptId !== attemptId
      || activity.eventId !== `engine-request-${attemptId}` || activity.ordinal !== 1 || activity.kind !== 'progress'
      || activity.data.progress !== 0 || typeof activity.data.summary !== 'string' || !/^[0-9a-f]{64}$/.test(activity.data.summary)
      || claim.runId !== a.run_id || claim.taskId !== a.task_id || claim.attemptId !== attemptId || claim.candidateId !== a.candidate_id
      || claim.observedAtMs !== activity.observedAtMs) fail('request');
    const table = policy.kind === 'monetary' ? 'integration_budget_reservation' : 'local_invocation_reservation';
    const reservations = db.prepare(`SELECT request_id,payload FROM ${table} WHERE run_id=? AND attempt_id=?`).all(a.run_id, attemptId) as { request_id: string; payload: string }[];
    if (reservations.length !== 1) fail('reservation');
    const reservation = reservations[0]!;
    const requestId = id(reservation.request_id);
    const terms = parse(reservation.payload, 8192);
    if (terms.runId !== a.run_id || terms.requestId !== requestId || terms.attemptId !== attemptId || terms.observedAtMs !== claim.observedAtMs) fail('reservation');
    if (policy.kind === 'local-invocation') {
      createLocalInvocationBudget(db).summary(a.run_id);
      if (terms.taskId !== a.task_id || terms.candidateId !== a.candidate_id || terms.observedAtMs !== claim.observedAtMs) fail('reservation');
    }
    return { a, policy, task, observedAtMs: claim.observedAtMs as number, binding: { attemptId, runId: a.run_id as string, taskId: a.task_id as string, requestId, candidateId: a.candidate_id as string,
      planDigest: plan.digest, envelopeHash: a.envelope_hash as string, requestDigest: activity.data.summary, reservationDigest: hash(reservation.payload),
      policy: { kind: policy.kind, policyId: policy.policyId, revision: policy.revision, digest: policy.digest } } };
  }
  function value(attemptId: string, selectedAtMs: unknown, decision: unknown) {
    const c = context(attemptId);
    if (!Number.isSafeInteger(selectedAtMs) || (selectedAtMs as number) < c.observedAtMs) fail('time');
    const d = c.policy.kind === 'monetary' ? snapshotSelectionDecision(decision) : snapshotLocalSelectionDecision(decision);
    if (c.policy.kind === 'monetary') {
      const choice = d as SelectionDecision, p = c.policy.snapshot.policy;
      if (choice.selectedId === null || choice.selectedId !== c.a.candidate_id || choice.mode !== p.mode || !p.allowedCandidateIds.includes(choice.selectedId)) fail('decision');
      if (p.pinnedCandidateId !== null ? choice.reason !== 'pinned' || choice.selectedId !== p.pinnedCandidateId : choice.reason !== 'ranked') fail('pin');
    } else {
      const choice = d as LocalSelectionDecision, p = c.policy.snapshot.policy;
      const expected = c.task.role === 'model-producer' ? p.producerCandidateId : c.task.role === 'verifier' ? p.checkerCandidateId : null;
      if (!choice.selected || choice.candidateId !== c.a.candidate_id || choice.candidateId !== expected) fail('decision');
    }
    return { version: 'cue-attempt-selection-v1' as const, authority: 'historical-explanation-only' as const, ...c.binding, selectedAtMs: selectedAtMs as number, decision: d };
  }
  function read(attemptId: string): AttemptDecisionRead {
    id(attemptId);
    const row = db.prepare('SELECT run_id,request_id,kind,digest,length(CAST(payload AS BLOB)) bytes,substr(payload,1,?) payload FROM attempt_selection WHERE attempt_id=?').get(MAX_BYTES + 1, attemptId) as any;
    if (!row) {
      if (!db.prepare('SELECT 1 FROM orchestration_attempt WHERE attempt_id=?').get(attemptId)) fail('attempt-missing');
      if (db.prepare('SELECT 1 FROM attempt_selection_legacy WHERE attempt_id=?').get(attemptId)) return Object.freeze({ availability: 'legacy-not-recorded', snapshot: null });
      fail('snapshot-missing');
    }
    const typedJournal = db.prepare('SELECT 1 FROM orchestration_activity WHERE event_id=? AND attempt_id=? AND ordinal=1').get(`engine-request-${attemptId}`, attemptId);
    if (!typedJournal) return Object.freeze({ availability: 'legacy-not-recorded', snapshot: null });
    if (row.bytes > MAX_BYTES) fail('payload');
    const parsed = parse(row.payload), expected = value(attemptId, parsed.selectedAtMs, parsed.decision), payload = JSON.stringify(expected);
    if (row.payload !== payload || row.digest !== hash(payload) || row.run_id !== expected.runId || row.request_id !== expected.requestId || row.kind !== expected.policy.kind) fail('integrity');
    return Object.freeze({ availability: 'recorded', snapshot: freeze({ ...expected, digest: row.digest }) });
  }
  return Object.freeze({
    read(attemptId: string): AttemptDecisionRead { return db.transaction(() => read(attemptId))(); },
    record(input: { attemptId: string; selectedAtMs: number; decision: SelectionDecision | LocalSelectionDecision }): AttemptDecisionSnapshot {
      if (!db.inTransaction) fail('claim-transaction-required');
      const f = fields(input, ['attemptId','selectedAtMs','decision']), attemptId = id(f.attemptId);
      if (db.prepare('SELECT 1 FROM attempt_selection_legacy WHERE attempt_id=?').get(attemptId)) fail('legacy-write');
      const expected = value(attemptId, f.selectedAtMs, f.decision), payload = JSON.stringify(expected);
      if (Buffer.byteLength(payload) > MAX_BYTES) fail('limit');
      const digest = hash(payload), existing = db.prepare('SELECT digest FROM attempt_selection WHERE attempt_id=?').get(attemptId) as { digest: string } | undefined;
      if (existing) { if (existing.digest !== digest) fail('conflict'); return read(attemptId).snapshot!; }
      db.prepare('INSERT INTO attempt_selection VALUES(?,?,?,?,?,?)').run(attemptId, expected.runId, expected.requestId, expected.policy.kind, digest, payload);
      return freeze({ ...expected, digest });
    },
  });
}
