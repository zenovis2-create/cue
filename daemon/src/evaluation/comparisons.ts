import { createHash } from 'node:crypto';
import { types } from 'node:util';
import type { Ledger } from '../ledger.js';
import { createEvaluationStudy, type ComparisonConstraints, type EvaluationSplit } from './comparison.js';
import { createEvaluationEnrollmentStore } from './enrollment.js';
import { createEvaluationTrialProjectionStore, type EvaluationTrialProjection } from './trials.js';

const MAX_BYTES = 1048576, MAX_PROJECTIONS = 4096;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const INPUT_KEYS = ['snapshotId','baselineProjectionIds','candidateProjectionIds','constraints'] as const;
const CONSTRAINT_KEYS = ['mode','baselinePolicyDigest','candidatePolicyDigest','maxPriceAgeMs','minPairsPerSplit','qualityFloor','minSuccessRate','maxUnknownRate','costLimitUnits','costBasisUnits','timeBasisMs','minImprovement'] as const;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const fail = (code: string): never => { throw Error(`evaluation_comparison_${code}`); };
function exact(value: unknown, keys: readonly string[]) {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) fail('input');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length !== keys.length || keys.some(key => !descriptors[key]?.enumerable || !Object.hasOwn(descriptors[key], 'value'))) fail('input');
  return Object.fromEntries(keys.map(key => [key, descriptors[key]!.value]));
}
function id(value: unknown): string { if (typeof value !== 'string' || !ID.test(value)) fail('identity'); return value as string; }
function integer(value: unknown): number { if (!Number.isSafeInteger(value) || (value as number) < 0) fail('integer'); return value as number; }
function ids(value: unknown): readonly string[] {
  if (!Array.isArray(value) || types.isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length < 1 || value.length > MAX_PROJECTIONS || Reflect.ownKeys(value).length !== value.length + 1) fail('projection_ids');
  const result: string[] = [];
  const source = value as unknown[];
  for (let index = 0; index < source.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(source, String(index));
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) fail('projection_ids');
    result.push(id(descriptor!.value));
  }
  if (new Set(result).size !== result.length) fail('duplicate_projection');
  return Object.freeze(result);
}
function freeze<T>(value: T): T { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
type StoredConstraints = Omit<ComparisonConstraints,'nowMs'>;
type MembershipRef = Readonly<{ projectionId: string; projectionDigest: string; observationId: string; observationDigest: string; enrollmentId: string; enrollmentDigest: string; runId: string; caseId: string; split: EvaluationSplit; arm: EvaluationTrialProjection['arm'] }>;
type OutcomeCounts = Readonly<{ success: number; fail: number; cancelled: number; unknown: number; unavailable: number }>;
type ArmAvailability = Readonly<{ projectionCount: number; trialCount: number; missingProjectionCount: number; missingTrialCount: number; outcomeDenominator: number; outcomes: OutcomeCounts }>;
export type EvaluationComparisonSnapshot = Readonly<{
  version: 'cue-evaluation-comparison-snapshot-v1'; authority: 'immutable-projection-membership-descriptive-only'; snapshotId: string; recordedAtMs: number;
  dataset: Readonly<{ id: string; revision: string; digest: string }>;
  membership: Readonly<{ baseline: readonly MembershipRef[]; candidate: readonly MembershipRef[] }>;
  cutoff: Readonly<{ recordedAtMs: number; observations: readonly Readonly<{ observationId: string; observationDigest: string }>[] }>;
  constraints: StoredConstraints; comparison: ReturnType<ReturnType<typeof createEvaluationStudy>['compare']>;
  availability: Readonly<{ splits: readonly Readonly<{ split: EvaluationSplit; expectedCaseCount: number; baseline: ArmAvailability; candidate: ArmAvailability }>[]; nonConvertibleReasonCounts: Readonly<Record<string,number>>; comparisonReasonCounts: Readonly<Record<string,number>> }>;
  datasetDigest: string; membershipDigest: string; constraintsDigest: string; resultDigest: string; promotionEligible: false; digest: string;
}>;

function constraints(value: unknown): StoredConstraints {
  const fields = exact(value, CONSTRAINT_KEYS);
  return freeze(fields as unknown as StoredConstraints);
}
function outcomes(items: readonly EvaluationTrialProjection[]): OutcomeCounts {
  const counts = { success: 0, fail: 0, cancelled: 0, unknown: 0, unavailable: 0 };
  for (const item of items) counts[item.outcome ?? 'unavailable']++;
  return freeze(counts);
}
function counts(values: readonly string[]) { const result: Record<string,number> = {}; for (const value of values) result[value] = (result[value] ?? 0) + 1; return freeze(result); }

export function createEvaluationComparisonStore(db: Ledger) {
  const projections = createEvaluationTrialProjectionStore(db), enrollments = createEvaluationEnrollmentStore(db);
  function row(snapshotId: string) {
    return db.prepare(`SELECT snapshot_id,recorded_at_ms,dataset_digest,membership_digest,constraints_digest,result_digest,request_digest,payload_digest,
      length(CAST(payload AS BLOB)) bytes,substr(payload,1,?) bounded_payload FROM evaluation_comparison_snapshot INDEXED BY sqlite_autoindex_evaluation_comparison_snapshot_1 WHERE snapshot_id=?`)
      .get(MAX_BYTES + 1, snapshotId) as any;
  }
  function build(snapshotId: string, baselineIds: readonly string[], candidateIds: readonly string[], storedConstraints: StoredConstraints, recordedAtMs: number) {
    const baseline = baselineIds.map(projectionId => projections.read(projectionId) ?? fail('projection_missing'));
    const candidate = candidateIds.map(projectionId => projections.read(projectionId) ?? fail('projection_missing'));
    if (new Set([...baselineIds,...candidateIds]).size !== baselineIds.length + candidateIds.length) fail('duplicate_projection');
    const all = [...baseline,...candidate];
    const firstEnrollment = enrollments.read(all[0].enrollmentId) ?? fail('enrollment_missing');
    for (const projection of all) {
      const enrollment = enrollments.read(projection.enrollmentId) ?? fail('enrollment_missing');
      if (enrollment.digest !== projection.enrollmentDigest || enrollment.dataset.digest !== firstEnrollment.dataset.digest) fail('dataset_mismatch');
      if (projection.observedAtMs > recordedAtMs) fail('future_projection');
    }
    if (baseline.some(item => item.arm !== 'manual-baseline' || item.policy.digest !== storedConstraints.baselinePolicyDigest)) fail('baseline_binding');
    if (candidate.some(item => item.arm !== storedConstraints.mode || item.policy.digest !== storedConstraints.candidatePolicyDigest)) fail('candidate_binding');
    const slots = all.map(item => JSON.stringify([item.caseId,item.arm])); if (new Set(slots).size !== slots.length) fail('duplicate_case_arm');
    const study = createEvaluationStudy(firstEnrollment.dataset);
    for (const projection of all) {
      if (projection.trial) {
        if (projection.trial.caseId !== projection.caseId || projection.trial.arm !== projection.arm || projection.trial.policyDigest !== projection.policy.digest) fail('trial_binding');
        study.record(projection.trial);
      }
    }
    const comparison = study.compare({ ...storedConstraints, nowMs: recordedAtMs });
    const ref = (projection: EvaluationTrialProjection): MembershipRef => freeze({ projectionId: projection.projectionId, projectionDigest: projection.digest, observationId: projection.observationId, observationDigest: projection.observationDigest, enrollmentId: projection.enrollmentId, enrollmentDigest: projection.enrollmentDigest, runId: projection.runId, caseId: projection.caseId, split: projection.split, arm: projection.arm });
    const membership = freeze({ baseline: baseline.map(ref), candidate: candidate.map(ref) });
    const splitAvailability = (['evaluation','holdout'] as const).map(split => {
      const expectedCaseCount = firstEnrollment.dataset.cases.filter(item => item.split === split).length;
      const arm = (items: readonly EvaluationTrialProjection[]): ArmAvailability => { const selected = items.filter(item => item.split === split); return freeze({ projectionCount: selected.length, trialCount: selected.filter(item => item.trial !== null).length, missingProjectionCount: expectedCaseCount - selected.length, missingTrialCount: selected.filter(item => item.trial === null).length, outcomeDenominator: selected.length, outcomes: outcomes(selected) }); };
      return freeze({ split, expectedCaseCount, baseline: arm(baseline), candidate: arm(candidate) });
    });
    const nonConvertibleReasonCounts = counts(all.flatMap(item => item.trial === null ? [...item.nonConvertibleReasons] : []));
    const comparisonReasonCounts = counts(comparison.splits.flatMap(item => [...item.reasons]));
    const observations = all.map(item => freeze({ observationId: item.observationId, observationDigest: item.observationDigest }));
    const dataset = freeze({ id: firstEnrollment.dataset.id, revision: firstEnrollment.dataset.revision, digest: firstEnrollment.dataset.digest });
    const membershipDigest = hash(JSON.stringify(membership)), constraintsDigest = hash(JSON.stringify(storedConstraints));
    const comparisonWithAvailability = { comparison, availability: { splits: splitAvailability, nonConvertibleReasonCounts, comparisonReasonCounts } };
    const resultDigest = hash(JSON.stringify(comparisonWithAvailability));
    return freeze({ version: 'cue-evaluation-comparison-snapshot-v1' as const, authority: 'immutable-projection-membership-descriptive-only' as const, snapshotId, recordedAtMs, dataset, membership, cutoff: { recordedAtMs, observations }, constraints: storedConstraints, ...comparisonWithAvailability, datasetDigest: dataset.digest, membershipDigest, constraintsDigest, resultDigest, promotionEligible: false as const });
  }
  function decode(saved: any): EvaluationComparisonSnapshot {
    if (!saved || !Number.isSafeInteger(saved.bytes) || saved.bytes < 0 || saved.bytes > MAX_BYTES) fail('payload');
    let parsed: any; try { parsed = JSON.parse(saved.bounded_payload); } catch { fail('integrity'); }
    const baselineIds = parsed?.membership?.baseline?.map((item: any) => item.projectionId), candidateIds = parsed?.membership?.candidate?.map((item: any) => item.projectionId);
    const expected = build(id(saved.snapshot_id), ids(baselineIds), ids(candidateIds), constraints(parsed?.constraints), integer(saved.recorded_at_ms));
    const payload = JSON.stringify(expected);
    const requestDigest = hash(JSON.stringify({ snapshotId: expected.snapshotId, baselineProjectionIds: baselineIds, candidateProjectionIds: candidateIds, constraints: expected.constraints }));
    if (saved.bounded_payload !== payload || saved.payload_digest !== hash(payload) || saved.request_digest !== requestDigest || saved.dataset_digest !== expected.datasetDigest || saved.membership_digest !== expected.membershipDigest || saved.constraints_digest !== expected.constraintsDigest || saved.result_digest !== expected.resultDigest) fail('integrity');
    return freeze({ ...expected, digest: saved.payload_digest });
  }
  return Object.freeze({
    read(snapshotId: string): EvaluationComparisonSnapshot | null { if (!db.open || db.inTransaction) fail('outer_transaction'); const saved = row(id(snapshotId)); return saved ? decode(saved) : null; },
    create(input: unknown, recordedAtMs: number): EvaluationComparisonSnapshot {
      if (!db.open || db.inTransaction) fail('outer_transaction');
      const fields = exact(input, INPUT_KEYS), snapshotId = id(fields.snapshotId), baselineIds = ids(fields.baselineProjectionIds), candidateIds = ids(fields.candidateProjectionIds), storedConstraints = constraints(fields.constraints), at = integer(recordedAtMs);
      const requestDigest = hash(JSON.stringify({ snapshotId, baselineProjectionIds: baselineIds, candidateProjectionIds: candidateIds, constraints: storedConstraints }));
      const existing = row(snapshotId); if (existing) { if (existing.request_digest !== requestDigest) fail('replay_conflict'); return decode(existing); }
      const value = build(snapshotId, baselineIds, candidateIds, storedConstraints, at), payload = JSON.stringify(value); if (Buffer.byteLength(payload) > MAX_BYTES) fail('payload'); const payloadDigest = hash(payload);
      db.transaction(() => {
        const replay = row(snapshotId); if (replay) { if (replay.request_digest !== requestDigest) fail('replay_conflict'); return; }
        try { db.prepare(`INSERT INTO evaluation_comparison_snapshot(snapshot_id,recorded_at_ms,dataset_digest,membership_digest,constraints_digest,result_digest,request_digest,payload_digest,payload) VALUES(?,?,?,?,?,?,?,?,?)`).run(snapshotId,at,value.datasetDigest,value.membershipDigest,value.constraintsDigest,value.resultDigest,requestDigest,payloadDigest,payload); }
        catch (error) { if (String(error).includes('UNIQUE') || String(error).includes('immutable')) fail('conflict'); throw error; }
      })();
      return freeze({ ...value, digest: payloadDigest });
    },
  });
}
