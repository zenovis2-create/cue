import { createHash } from 'node:crypto';
import { types } from 'node:util';
import type { Ledger } from '../ledger.js';
import { readRunPolicyIdentity } from '../selection/run-policy-identity.js';
import { freezeEvaluationDataset, type EvaluationDataset, type EvaluationSplit } from './comparison.js';

const MAX_BYTES = 1048576;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const SHA = /^[a-f0-9]{64}$/;
const ARMS = ['efficiency','performance','value','speed','manual-baseline'] as const;
type Arm = typeof ARMS[number];
type Ref = Readonly<{ id: string; revision: string; digest: string }>;
type PolicyRef = Readonly<{ kind: 'monetary' | 'local-invocation'; policyId: string; revision: number; digest: string }>;
export type EvaluationEnrollment = Readonly<{
  version: 'cue-evaluation-enrollment-v1'; authority: 'pre-approval-cohort-binding-only'; enrollmentId: string;
  runId: string; dataset: EvaluationDataset; caseId: string; inputDigest: string; split: EvaluationSplit;
  arm: Arm; policy: PolicyRef; metric: Ref; environment: Ref; accountLimits: Ref;
  enrolledAtMs: number; inputBinding: 'claimed-not-verified'; digest: string;
}>;

const hash = (v: string) => createHash('sha256').update(v).digest('hex');
function fail(code: string): never { throw Error(`evaluation_enrollment_${code}`); }
function plain(v: unknown, keys: readonly string[]) {
  if (!v || typeof v !== 'object' || types.isProxy(v) || Object.getPrototypeOf(v) !== Object.prototype) fail('input');
  const d = Object.getOwnPropertyDescriptors(v);
  if (Reflect.ownKeys(d).length !== keys.length || keys.some(k => !d[k]?.enumerable || !Object.hasOwn(d[k], 'value'))) fail('input');
  return Object.fromEntries(keys.map(k => [k, d[k]!.value]));
}
function id(v: unknown): string { if (typeof v !== 'string' || !ID.test(v)) fail('identity'); return v; }
function digest(v: unknown): string { if (typeof v !== 'string' || !SHA.test(v)) fail('digest'); return v; }
function ref(v: unknown): Ref {
  const f = plain(v, ['id','revision','digest']);
  return Object.freeze({ id: id(f.id), revision: id(f.revision), digest: digest(f.digest) });
}
function freeze<T>(v: T): T { if (v && typeof v === 'object' && !Object.isFrozen(v)) { for (const child of Object.values(v)) freeze(child); Object.freeze(v); } return v; }
function datasetPayload(dataset: EvaluationDataset) { return JSON.stringify({ id: dataset.id, revision: dataset.revision, cases: dataset.cases }); }

export function createEvaluationEnrollmentStore(db: Ledger) {
  function readDataset(datasetDigest: string): EvaluationDataset {
    const row = db.prepare('SELECT dataset_id,revision,digest,length(CAST(payload AS BLOB)) bytes,substr(payload,1,?) payload FROM evaluation_dataset WHERE digest=?')
      .get(MAX_BYTES + 1, datasetDigest) as any;
    if (!row || row.bytes > MAX_BYTES) fail(row ? 'dataset_payload' : 'dataset_missing');
    let parsed: unknown; try { parsed = JSON.parse(row.payload); } catch { fail('dataset_integrity'); }
    const saved = freezeEvaluationDataset(parsed);
    if (saved.digest !== row.digest || saved.id !== row.dataset_id || saved.revision !== row.revision || datasetPayload(saved) !== row.payload) fail('dataset_integrity');
    return saved;
  }
  function read(enrollmentId: string): EvaluationEnrollment | null {
    const row = db.prepare(`SELECT enrollment_id,run_id,dataset_digest,case_id,arm,policy_kind,policy_digest,input_binding,payload_digest,
      length(CAST(payload AS BLOB)) bytes,substr(payload,1,?) bounded_payload FROM evaluation_enrollment INDEXED BY sqlite_autoindex_evaluation_enrollment_1 WHERE enrollment_id=?`)
      .get(MAX_BYTES + 1, id(enrollmentId)) as any;
    if (!row) return null;
    if (row.bytes > MAX_BYTES) fail('payload');
    let p: any; try { p = JSON.parse(row.bounded_payload); } catch { fail('integrity'); }
    const dataset = readDataset(row.dataset_digest), c = dataset.cases.find(x => x.id === p.caseId);
    if (!c) fail('integrity');
    const expected = { version: 'cue-evaluation-enrollment-v1', authority: 'pre-approval-cohort-binding-only', enrollmentId: row.enrollment_id,
      runId: row.run_id, dataset, caseId: p.caseId, inputDigest: c?.inputDigest, split: c?.split, arm: p.arm,
      policy: p.policy, metric: p.metric, environment: p.environment, accountLimits: p.accountLimits,
      enrolledAtMs: p.enrolledAtMs, inputBinding: 'claimed-not-verified' } as const;
    const stored = JSON.stringify({ ...expected, dataset: undefined });
    if (row.case_id !== c.id || row.arm !== p.arm || row.policy_kind !== p.policy?.kind || row.policy_digest !== p.policy?.digest
      || row.input_binding !== expected.inputBinding || row.bounded_payload !== stored || row.payload_digest !== hash(stored)) fail('integrity');
    return freeze({ ...expected, digest: row.payload_digest });
  }
  return Object.freeze({
    read(enrollmentId: string) { return db.transaction(() => read(enrollmentId))(); },
    enroll(input: unknown): EvaluationEnrollment {
      const f = plain(input, ['enrollmentId','runId','dataset','caseId','arm','policy','metric','environment','accountLimits','enrolledAtMs']);
      return db.transaction(() => {
        const enrollmentId = id(f.enrollmentId), runId = id(f.runId), caseId = id(f.caseId);
        const existing = read(enrollmentId);
        const dataset = freezeEvaluationDataset(f.dataset), item = dataset.cases.find(c => c.id === caseId);
        if (!item) fail('case');
        if (!ARMS.includes(f.arm as Arm)) fail('arm');
        const pf = plain(f.policy, ['kind','policyId','revision','digest']);
        if (!['monetary','local-invocation'].includes(pf.kind as string) || !Number.isSafeInteger(pf.revision) || (pf.revision as number) < 0) fail('policy');
        const policy: PolicyRef = Object.freeze({ kind: pf.kind as PolicyRef['kind'], policyId: id(pf.policyId), revision: pf.revision as number, digest: digest(pf.digest) });
        const metric = ref(f.metric), environment = ref(f.environment), accountLimits = ref(f.accountLimits);
        if (!Number.isSafeInteger(f.enrolledAtMs) || (f.enrolledAtMs as number) < 0) fail('time');
        const value = { version: 'cue-evaluation-enrollment-v1', authority: 'pre-approval-cohort-binding-only', enrollmentId, runId, dataset,
          caseId, inputDigest: item.inputDigest, split: item.split, arm: f.arm as Arm, policy, metric, environment, accountLimits,
          enrolledAtMs: f.enrolledAtMs as number, inputBinding: 'claimed-not-verified' } as const;
        if (existing) {
          const candidate = JSON.stringify({ ...value, dataset: undefined });
          if (candidate !== JSON.stringify({ ...existing, dataset: undefined, digest: undefined })) fail('replay_conflict');
          return existing;
        }
        const actualPolicy = readRunPolicyIdentity(db, runId);
        if (!actualPolicy || actualPolicy.kind !== policy.kind || actualPolicy.policyId !== policy.policyId || actualPolicy.revision !== policy.revision || actualPolicy.digest !== policy.digest) fail('policy_mismatch');
        if (value.arm === 'manual-baseline') fail('manual_baseline_unsupported');
        if (value.arm !== actualPolicy.snapshot.policy.mode) fail('arm_policy_mismatch');
        const run = db.prepare('SELECT t.state FROM run r JOIN task t ON t.id=r.task_id WHERE r.id=?').get(runId) as { state: string } | undefined;
        if (!run) fail('run_missing');
        if (!['queued','awaiting_approval'].includes(run.state)) fail('run_started');
        if (db.prepare("SELECT 1 FROM approval_event WHERE run_id=? AND decision='accept' LIMIT 1").get(runId)) fail('approval_accepted');
        if (db.prepare('SELECT 1 FROM execution_event WHERE run_id=? LIMIT 1').get(runId) || db.prepare('SELECT 1 FROM orchestration_attempt WHERE run_id=? LIMIT 1').get(runId)) fail('attempt_started');
        const dp = datasetPayload(dataset);
        if (Buffer.byteLength(dp) > MAX_BYTES) fail('dataset_payload');
        const priorDataset = db.prepare('SELECT digest,payload FROM evaluation_dataset WHERE dataset_id=? AND revision=?').get(dataset.id,dataset.revision) as any;
        if (priorDataset && (priorDataset.digest !== dataset.digest || priorDataset.payload !== dp)) fail('dataset_conflict');
        if (!priorDataset) db.prepare('INSERT INTO evaluation_dataset(digest,dataset_id,revision,payload) VALUES(?,?,?,?)').run(dataset.digest,dataset.id,dataset.revision,dp);
        const payload = JSON.stringify({ ...value, dataset: undefined });
        if (Buffer.byteLength(payload) > MAX_BYTES) fail('payload');
        const payloadDigest = hash(payload);
        try { db.prepare('INSERT INTO evaluation_enrollment VALUES(?,?,?,?,?,?,?,?,?,?)').run(enrollmentId,runId,dataset.digest,caseId,value.arm,policy.kind,policy.digest,value.inputBinding,payloadDigest,payload); }
        catch (e) { if (String(e).includes('UNIQUE') || String(e).includes('immutable')) fail('cohort_conflict'); throw e; }
        return read(enrollmentId)!;
      })();
    },
  });
}
