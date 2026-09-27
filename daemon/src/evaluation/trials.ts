import { createHash } from 'node:crypto';
import { types } from 'node:util';
import type { Ledger } from '../ledger.js';
import { createEvaluationEnrollmentStore, type EvaluationEnrollment } from './enrollment.js';
import { createEvaluationObservationStore, type EvaluationObservation } from './observations.js';
import type { EvaluationTrial } from './comparison.js';
import { validateBaselineCandidateBinding } from './baseline-plan.js';
import { validateManualBaselineEnrollment } from './baseline.js';
import { BASELINE_MAX_BYTES, BASELINE_ROW_COLUMNS, validateStoredManualBaseline } from './baseline-contract.js';
import { readRunPolicyIdentity } from '../selection/run-policy-identity.js';

const MAX_BYTES = 1048576;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const SHA = /^[a-f0-9]{64}$/;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
function fail(code: string): never { throw Error(`evaluation_trial_projection_${code}`); }
function exact(value: unknown, keys: readonly string[]) {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) fail('input');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length !== keys.length || keys.some(key => !descriptors[key]?.enumerable || !Object.hasOwn(descriptors[key], 'value'))) fail('input');
  return Object.fromEntries(keys.map(key => [key, descriptors[key]!.value]));
}
function id(value: unknown): string { if (typeof value !== 'string' || !ID.test(value)) fail('identity'); return value as string; }
function sha(value: unknown): string { if (typeof value !== 'string' || !SHA.test(value)) fail('digest'); return value as string; }
function freeze<T>(value: T): T { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }

const PERMANENT_REASONS = Object.freeze([
  'tool-revision-unavailable',
  'model-revision-unavailable',
  'quality-unavailable',
  'elapsed-unavailable',
  'price-observed-at-unavailable',
  'price-source-unavailable',
  'base-cost-unavailable',
  'retry-cost-unavailable',
  'handoff-cost-unavailable',
  'verification-cost-unavailable',
] as const);

type Outcome = 'success' | 'fail' | 'cancelled' | 'unknown';
type StoredRef = Readonly<{ id: string; revision: string; digest: string }>;
type StoredPolicyRef = EvaluationEnrollment['policy'];
export type EvaluationTrialProjection = Readonly<{
  version: 'cue-evaluation-trial-projection-v1';
  authority: 'stored-enrollment-observation-outcome-only';
  projectionId: string;
  enrollmentId: string;
  enrollmentDigest: string;
  observationId: string;
  observationDigest: string;
  runId: string;
  dataset: Readonly<{ id: string; revision: string; digest: string }>;
  caseId: string;
  inputDigest: string;
  split: EvaluationEnrollment['split'];
  arm: EvaluationEnrollment['arm'];
  policy: StoredPolicyRef;
  metric: StoredRef;
  environment: StoredRef;
  accountLimits: StoredRef;
  observedAtMs: number;
  outcome: Outcome | null;
  outcomeAvailability: 'recorded' | 'unavailable';
  nonConvertibleReasons: readonly string[];
  trial: EvaluationTrial | null;
  limitation: 'current-outcome-contract-does-not-store-required-trial-measurements';
  digest: string;
}>;

function assess(db:Ledger, projectionId: string, enrollment: EvaluationEnrollment, observation: EvaluationObservation) {
  if (observation.enrollmentId !== enrollment.enrollmentId || observation.enrollmentDigest !== enrollment.digest || observation.runId !== enrollment.runId) fail('lineage');
  const recorded = observation.outcome?.status === 'recorded' ? observation.outcome : null;
  let expectedMode:string=enrollment.arm;
  if(enrollment.arm==='manual-baseline'){
    // The comparison arm is not an execution mode. Require its explicit saved
    // declaration and pinned historical policy instead of skipping the check.
    const row=db.prepare(`SELECT ${BASELINE_ROW_COLUMNS} FROM evaluation_baseline_declaration WHERE enrollment_id=?`).get(BASELINE_MAX_BYTES+1,BASELINE_MAX_BYTES+1,enrollment.enrollmentId);
    if(!row)fail('baseline');
    const {request:baseline}=validateStoredManualBaseline(row),actual=readRunPolicyIdentity(db,enrollment.runId);
    validateManualBaselineEnrollment(baseline,enrollment);
    validateBaselineCandidateBinding(db,baseline);
    if(!actual||actual.kind!==enrollment.policy.kind
      ||actual.policyId!==enrollment.policy.policyId||actual.revision!==enrollment.policy.revision||actual.digest!==enrollment.policy.digest)fail('baseline');
    expectedMode=actual.snapshot.policy.mode;
    if(recorded&&(recorded.policy.idDigest!==hash(JSON.stringify(actual.policyId))||(recorded.policy.id!==null&&recorded.policy.id!==actual.policyId)))fail('policy');
  }
  if (recorded && (recorded.policy.kind !== enrollment.policy.kind || recorded.policy.revision !== enrollment.policy.revision || recorded.policy.digest !== enrollment.policy.digest || recorded.policy.mode !== expectedMode)) fail('policy');
  const reasons: string[] = [...PERMANENT_REASONS];
  if (!recorded) reasons.push('outcome-unavailable');
  if (!recorded || recorded.accounting.kind !== 'monetary') reasons.push('currency-unit-unavailable');
  return {
    version: 'cue-evaluation-trial-projection-v1' as const,
    authority: 'stored-enrollment-observation-outcome-only' as const,
    projectionId,
    enrollmentId: enrollment.enrollmentId,
    enrollmentDigest: enrollment.digest,
    observationId: observation.observationId,
    observationDigest: observation.digest,
    runId: enrollment.runId,
    dataset: { id: enrollment.dataset.id, revision: enrollment.dataset.revision, digest: enrollment.dataset.digest },
    caseId: enrollment.caseId,
    inputDigest: enrollment.inputDigest,
    split: enrollment.split,
    arm: enrollment.arm,
    policy: enrollment.policy,
    metric: enrollment.metric,
    environment: enrollment.environment,
    accountLimits: enrollment.accountLimits,
    observedAtMs: observation.recordedAtMs,
    outcome: recorded?.outcome ?? null,
    outcomeAvailability: recorded ? 'recorded' as const : 'unavailable' as const,
    nonConvertibleReasons: reasons,
    trial: null,
    // The upstream immutable outcome explicitly stores these measurements as
    // null/absent. This projection must remain non-convertible for that data.
    limitation: 'current-outcome-contract-does-not-store-required-trial-measurements' as const,
  };
}

/** Read validated outcome lineage without creating or upgrading a projection row. */
export function readEvaluationTrialOutcome(db:Ledger,input:unknown){
  if(!db.open||db.inTransaction)fail('outer_transaction');
  const fields=exact(input,['enrollmentId','observationId']);
  const enrollment=createEvaluationEnrollmentStore(db).read(id(fields.enrollmentId));
  const observation=createEvaluationObservationStore(db).read(id(fields.observationId));
  if(!enrollment||!observation)fail('dependency_missing');
  return freeze({enrollment,observation,outcome:assess(db,'read-only-outcome',enrollment,observation).outcome});
}

export function createEvaluationTrialProjectionStore(db: Ledger) {
  const enrollments = createEvaluationEnrollmentStore(db);
  const observations = createEvaluationObservationStore(db);
  function rowById(projectionId: string) {
    return db.prepare(`SELECT projection_id,enrollment_id,observation_id,enrollment_digest,observation_digest,payload_digest,
      length(CAST(payload AS BLOB)) bytes,substr(payload,1,?) bounded_payload
      FROM evaluation_trial_projection INDEXED BY sqlite_autoindex_evaluation_trial_projection_1 WHERE projection_id=?`)
      .get(MAX_BYTES + 1, projectionId) as any;
  }
  function dependencies(enrollmentId: string, observationId: string): { enrollment: EvaluationEnrollment; observation: EvaluationObservation } {
    const enrollment = enrollments.read(enrollmentId); if (!enrollment) fail('enrollment_missing');
    const observation = observations.read(observationId); if (!observation) fail('observation_missing');
    return { enrollment: enrollment as EvaluationEnrollment, observation: observation as EvaluationObservation };
  }
  function decode(row: any, enrollment: EvaluationEnrollment, observation: EvaluationObservation): EvaluationTrialProjection {
    if (!row || !Number.isSafeInteger(row.bytes) || row.bytes < 0 || row.bytes > MAX_BYTES) fail('payload');
    if (id(row.enrollment_id) !== enrollment.enrollmentId || id(row.observation_id) !== observation.observationId || sha(row.enrollment_digest) !== enrollment.digest || sha(row.observation_digest) !== observation.digest) fail('lineage');
    let parsed: unknown; try { parsed = JSON.parse(row.bounded_payload); } catch { fail('integrity'); }
    const expected = assess(db, id(row.projection_id), enrollment, observation);
    const payload = JSON.stringify(expected);
    if (payload !== row.bounded_payload || sha(row.payload_digest) !== hash(payload)) fail('integrity');
    return freeze({ ...expected, digest: row.payload_digest });
  }
  function read(projectionId: string): EvaluationTrialProjection | null {
    const row = rowById(id(projectionId));
    if (!row) return null;
    const refs = dependencies(id(row.enrollment_id), id(row.observation_id));
    return decode(row, refs.enrollment, refs.observation);
  }
  return Object.freeze({
    read(projectionId: string) { if (!db.open || db.inTransaction) fail('outer_transaction'); return read(projectionId); },
    project(input: unknown): EvaluationTrialProjection {
      if (!db.open || db.inTransaction) fail('outer_transaction');
      const fields = exact(input, ['projectionId','enrollmentId','observationId']);
      const projectionId = id(fields.projectionId), enrollmentId = id(fields.enrollmentId), observationId = id(fields.observationId);
      const existing = rowById(projectionId);
      if (existing) {
        const refs = dependencies(id(existing.enrollment_id), id(existing.observation_id));
        const saved = decode(existing, refs.enrollment, refs.observation);
        if (saved.enrollmentId !== enrollmentId || saved.observationId !== observationId) fail('replay_conflict');
        return saved;
      }
      const refs = dependencies(enrollmentId, observationId);
      const value = assess(db, projectionId, refs.enrollment, refs.observation);
      const payload = JSON.stringify(value); if (Buffer.byteLength(payload) > MAX_BYTES) fail('payload');
      const payloadDigest = hash(payload);
      return db.transaction(() => {
        const replay = rowById(projectionId);
        if (replay) { const saved = decode(replay, refs.enrollment, refs.observation); if (saved.enrollmentId !== enrollmentId || saved.observationId !== observationId) fail('replay_conflict'); return saved; }
        const occupied = db.prepare('SELECT projection_id FROM evaluation_trial_projection WHERE enrollment_id=? AND observation_id=?').get(enrollmentId, observationId) as any;
        if (occupied) fail('slot_conflict');
        try {
          db.prepare(`INSERT INTO evaluation_trial_projection(projection_id,enrollment_id,observation_id,enrollment_digest,observation_digest,payload_digest,payload)
            VALUES(?,?,?,?,?,?,?)`).run(projectionId,enrollmentId,observationId,refs.enrollment.digest,refs.observation.digest,payloadDigest,payload);
        } catch (error) {
          if (String(error).includes('UNIQUE') || String(error).includes('immutable')) fail('conflict');
          throw error;
        }
        return decode(rowById(projectionId), refs.enrollment, refs.observation);
      })();
    },
  });
}

export const createEvaluationTrialStore = createEvaluationTrialProjectionStore;
