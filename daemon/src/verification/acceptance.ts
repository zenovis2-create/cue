import { createHash } from 'node:crypto';
import { relative, isAbsolute } from 'node:path';
import type { Ledger } from '../ledger.js';
import { isPlanMaker, validateTaskPlan, type ValidatedPlan } from '../orchestration/plan.js';
import { createStageEnvelopeBinder, type StageEnvelopeBinding } from '../orchestration/stage-envelope.js';
import { createOrchestrationStore } from '../orchestration/store.js';
import { createRequirementContractStore, type RequirementBinding, type RequirementContract, type RequirementCheck, type RegisteredRequirementChecker } from './requirements.js';
import { createGeneratedOutputStore } from './generated-output.js';
import { evaluateEvidence, type EvidenceObservation, type EvidencePolicyDescriptor } from './evidence-policy.js';

export type AcceptanceVerdict = 'pass' | 'fail' | 'unknown';
export interface AcceptanceContext {
  readonly runId: string; readonly revision?: number; readonly planDigest: string; readonly policyDigest: string; readonly requirementsDigest: string;
}
export interface AcceptanceArtifact { readonly targetId: string; readonly digest: string; readonly sizeBytes: number; readonly sourceRef: string; readonly kind: 'filesystem' | 'retrieved-source' | 'remote-state' | 'generated-output' }
export interface AcceptanceManifest extends AcceptanceContext { readonly artifacts: readonly AcceptanceArtifact[]; readonly observedAt: number }
export interface CheckerContext extends AcceptanceContext {
  readonly requirement: RequirementContract; readonly check: RequirementCheck;
  readonly verifierAttemptId: string; readonly stageEnvelopeHash: string; readonly reviewerPrincipal: string;
  readonly manifestDigest: string; readonly targets: readonly AcceptanceArtifact[]; readonly digest: string;
  readonly producerPrincipals: readonly string[];
  readonly evidencePolicy: EvidencePolicyDescriptor;
}
export interface RawCheckerObservation {
  readonly contextDigest: string; readonly principalId: string; readonly sourceRefs: readonly string[];
  readonly observedAt: number; readonly origin: 'host-observation' | 'model-report'; readonly bytes: Uint8Array;
  readonly evidence?: EvidenceObservation;
}
export interface AcceptanceChecker extends RegisteredRequirementChecker {
  collect(context: CheckerContext, signal: AbortSignal): Promise<RawCheckerObservation>;
  // Trusted registered implementation compares observations to its approved contract.
  // It must not translate a model-generated "pass" string into this verdict.
  evaluate(context: CheckerContext, observation: Readonly<RawCheckerObservation>): AcceptanceVerdict;
}
export interface AcceptanceHost {
  now(): number; readonly timeoutMs: number; readonly maxObservationAgeMs: number;
  resolveChecker(id: string, revision: string): AcceptanceChecker | undefined;
  principalForAttempt(binding: StageEnvelopeBinding): string | null;
  captureManifest(context: AcceptanceContext, signal: AbortSignal): Promise<AcceptanceManifest>;
  // Synchronous content/source revision recheck while the shared writer lease is held.
  isManifestCurrent(context: AcceptanceContext, manifest: AcceptanceManifest): boolean;
}
export interface RequirementOutcome { readonly requirementId: string; readonly required: boolean; readonly verdict: AcceptanceVerdict; readonly reasons: readonly string[] }
export interface AcceptanceEvaluation { readonly id: string; readonly runId: string; readonly verdict: AcceptanceVerdict; readonly outcomes: readonly RequirementOutcome[] }
export interface AcceptanceReceipt extends AcceptanceContext { readonly status: 'accepted'; readonly evaluationId: string; readonly manifestDigest: string; readonly acceptedAt: number }
export type Finalization = AcceptanceReceipt | Readonly<{ status: 'blocked'; reason: string; evaluationId: string }>;
export interface AcceptanceHistory {
  readonly receipt: AcceptanceReceipt | null;
  readonly evaluationId: string;
  readonly verdict: AcceptanceVerdict;
  readonly outcomes: readonly Readonly<Pick<RequirementOutcome, 'requirementId' | 'required' | 'verdict'>>[];
}
type State = { context: AcceptanceContext; requirements: RequirementBinding; plan: ValidatedPlan; taskId: string; worktree: string; stages: readonly StageEnvelopeBinding[]; currentStages: readonly StageEnvelopeBinding[]; lineage: string };
type StoredObservation = { context: CheckerContext; sha256: string; principalId: string; sourceRefs: readonly string[]; observedAt: number; origin: 'host-observation'; verdict: AcceptanceVerdict; evidence: EvidenceObservation };
export interface AcceptanceRevision { readonly revision: number; readonly planDigest: string }
type PrivateEvaluation = { public: AcceptanceEvaluation; state: State | null; manifest: AcceptanceManifest | null; manifestDigest: string | null; observations: readonly StoredObservation[]; encoded: string; signal?: AbortSignal };
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const validHash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/u.test(value);
const validRef = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 4096 && !/[\u0000-\u001f\u007f]/u.test(value);
const finiteTime = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const overlaps = (a: string, b: string) => { const within = (root: string, child: string) => { const p = relative(root, child); return p === '' || (!isAbsolute(p) && p.split(/[\\/]/u)[0] !== '..'); }; return within(a, b) || within(b, a); };

// An approved generated document is a separate opt-in contract, not a replacement
// for filesystem, retrieved-source or remote-state evidence. Read exact current
// producer lineage; never choose the most recently stored response implicitly.
function generatedCheckMatches(db: Ledger, context: AcceptanceContext, requirement: RequirementContract,
  check: RequirementCheck, manifest: AcceptanceManifest, stages: readonly (StageEnvelopeBinding | null)[]): boolean {
  try {
    if (!Array.isArray(manifest.artifacts)) return false;
    const artifacts = check.targetIds.map(id => manifest.artifacts.find(a => a.targetId === id));
    const hasBoundTarget = check.targetIds.some(targetId => !!db.prepare('SELECT 1 FROM generated_output_target WHERE run_id=? AND target_id=?').get(context.runId, targetId));
    if (!hasBoundTarget && !artifacts.some(a => a?.kind === 'generated-output')) return true;
    if (requirement.kind !== 'document' || artifacts.length !== 1 || artifacts[0]?.kind !== 'generated-output') return false;
    const artifact = artifacts[0];
    const store = createGeneratedOutputStore(db, { now: () => 0, authorizeObservation: () => false });
    const target = store.readTarget(context.runId, artifact.targetId);
    if (!target || target.requirementId !== requirement.id || target.checkerId !== check.checkerId
      || target.checkerRevision !== check.revision || target.parametersDigest !== check.parametersDigest
      || target.policyDigest !== context.policyDigest
      || target.requirementsDigest !== context.requirementsDigest) return false;
    const producers = stages.filter(s => s?.taskId === target.producerTaskId);
    if (producers.length !== 1 || !producers[0]) return false;
    const output = store.read(context.runId, artifact.targetId, producers[0].attemptId);
    return !!output && output.record.planDigest === context.planDigest && output.record.stageEnvelopeHash === producers[0].envelopeHash
      && artifact.digest === output.record.sha256 && artifact.sizeBytes === output.record.byteLength
      && artifact.sourceRef === `cue-generated-output:${output.record.digest}`;
  } catch { return false; }
}

// Shared by live acceptance and callback-free history. Legacy single-attempt
// encoding is retained byte-for-byte; retry chains add their immutable links,
// approved contract and receipt history to the lineage digest.
function executionHistory(db: Ledger, context: AcceptanceContext, envelopeHash: string) {
  const invalid = (): never => { throw Error('acceptance_history_integrity'); };
  const recovery = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='orchestration_recovery_scope'").get()
    && db.prepare('SELECT 1 FROM orchestration_recovery_scope WHERE run_id=?').get(context.runId);
  if (recovery) {
    const revision = db.prepare('SELECT plan_digest,requirements_digest,policy_digest,envelope_hash,payload FROM orchestration_plan_revision WHERE run_id=? AND revision=? AND plan_digest=?')
      .get(context.runId, context.revision, context.planDigest) as { plan_digest:string;requirements_digest:string;policy_digest:string;envelope_hash:string;payload:Buffer }|undefined;
    if (!revision || revision.requirements_digest!==context.requirementsDigest || revision.policy_digest!==context.policyDigest || revision.envelope_hash!==envelopeHash) return invalid();
    const p=JSON.parse(Buffer.from(revision.payload).toString()) as ValidatedPlan;
    const plan=validateTaskPlan(p.approval,{revision:p.revision,policyRevision:p.approval.policyRevision,policyDigest:p.approval.policyDigest,tasks:p.tasks});
    if(plan.digest!==context.planDigest)return invalid();
    const steps=db.prepare('SELECT task_id,state,payload_sha256,payload FROM orchestration_revision_step WHERE run_id=? AND revision=? ORDER BY task_id').all(context.runId,context.revision) as {task_id:string;state:string;payload_sha256:string;payload:Buffer}[];
    if(steps.length!==plan.tasks.length||steps.some(step=>step.state!=='completed'||!plan.tasks.some(task=>task.id===step.task_id)||sha(step.payload)!==step.payload_sha256))return invalid();
    const attempts=db.prepare('SELECT a.attempt_id,a.task_id,a.state,a.cleanup_verified,ar.revision FROM orchestration_attempt a JOIN orchestration_attempt_revision ar ON ar.attempt_id=a.attempt_id AND ar.run_id=a.run_id AND ar.task_id=a.task_id WHERE a.run_id=? ORDER BY ar.revision,a.task_id,a.attempt_id').all(context.runId) as {attempt_id:string;task_id:string;state:string;cleanup_verified:number;revision:number}[];
    if(!attempts.length||attempts.some(attempt=>attempt.cleanup_verified!==1||!['completed','failed'].includes(attempt.state)))return invalid();
    const binder=createStageEnvelopeBinder(db,{now:()=>0,authorizeStage:()=>false,resolveScope:()=>{throw Error('historical-only');}});
    const stages=attempts.map(attempt=>{const stage=binder.readHistorical(attempt.attempt_id);if(!stage||stage.workflowRunId!==context.runId||stage.taskId!==attempt.task_id||stage.revision!==attempt.revision)return invalid();return stage;});
    const currentAttempts=attempts.filter(attempt=>attempt.revision===context.revision);
    const activationEdges=db.prepare('SELECT d.prior_attempt_id prior,a.attempt_id next FROM orchestration_recovery_activation a JOIN orchestration_recovery_decision d ON d.decision_id=a.decision_id WHERE a.run_id=? AND a.revision=?').all(context.runId,context.revision) as {prior:string;next:string}[];
    const retryEdges=db.prepare("SELECT previous_attempt_id prior,attempt_id next FROM orchestration_retry_link WHERE attempt_id IN(SELECT attempt_id FROM orchestration_attempt_revision WHERE run_id=? AND revision=?)").all(context.runId,context.revision) as {prior:string;next:string}[];
    const edges=[...activationEdges,...retryEdges];
    const currentStages=plan.tasks.map(task=>{const chain=currentAttempts.filter(attempt=>attempt.task_id===task.id),roots=chain.filter(attempt=>!edges.some(edge=>edge.next===attempt.attempt_id&&chain.some(member=>member.attempt_id===edge.prior)));if(!chain.length||roots.length!==1)return invalid();let tip=roots[0];const visited=new Set<string>();while(true){if(visited.has(tip.attempt_id))return invalid();visited.add(tip.attempt_id);const next=edges.filter(edge=>edge.prior===tip.attempt_id&&chain.some(attempt=>attempt.attempt_id===edge.next));if(!next.length)break;if(next.length!==1)return invalid();tip=chain.find(attempt=>attempt.attempt_id===next[0].next)!;}if(visited.size!==chain.length||tip.state!=='completed')return invalid();const stage=stages.find(value=>value.attemptId===tip.attempt_id);if(!stage||stage.planDigest!==context.planDigest||stage.policyDigest!==context.policyDigest)return invalid();return stage;});
    return {stages,currentStages,lineage:sha(JSON.stringify({context,envelopeHash,revision:{...revision,payload:Buffer.from(revision.payload).toString('base64')},steps:steps.map(step=>({...step,payload:Buffer.from(step.payload).toString('base64')})),attempts,stages}))};
  }
  if(context.revision!==0)return invalid();
  const saved = db.prepare('SELECT payload FROM orchestration_plan WHERE run_id=?').get(context.runId) as { payload: string } | undefined;
  if (!saved) return invalid();
  const p = JSON.parse(saved.payload) as ValidatedPlan;
  const plan = validateTaskPlan(p.approval, { revision: p.revision, policyRevision: p.approval.policyRevision, policyDigest: p.approval.policyDigest, tasks: p.tasks });
  if (plan.digest !== context.planDigest) invalid();
  const attempts = db.prepare('SELECT attempt_id,task_id,state,cleanup_verified FROM orchestration_attempt WHERE run_id=? ORDER BY task_id,attempt_id').all(context.runId) as { attempt_id: string; task_id: string; state: string; cleanup_verified: number }[];
  const steps = db.prepare('SELECT task_id,state FROM orchestration_step WHERE run_id=? ORDER BY task_id').all(context.runId) as { task_id: string; state: string }[];
  if (steps.length !== plan.tasks.length || steps.some(s => s.state !== 'completed' || !plan.tasks.some(t => t.id === s.task_id))
    || attempts.length < plan.tasks.length || attempts.some(a => a.cleanup_verified !== 1 || !['completed', 'failed'].includes(a.state) || !plan.tasks.some(t => t.id === a.task_id))) invalid();
  const binder = createStageEnvelopeBinder(db, { now: () => 0, authorizeStage: () => false, resolveScope: () => { throw Error('historical-only'); } });
  const stages = attempts.map(a => {
    const stage = binder.readHistorical(a.attempt_id);
    if (!stage || stage.workflowRunId !== context.runId || stage.taskId !== a.task_id || stage.planDigest !== context.planDigest || stage.policyDigest !== context.policyDigest) return invalid();
    return stage;
  });
  const base = { context, envelopeHash, attempts, steps, stages };
  if (attempts.length === plan.tasks.length) {
    if (new Set(attempts.map(a => a.task_id)).size !== plan.tasks.length || attempts.some(a => a.state !== 'completed')) invalid();
    return { stages, currentStages: stages, lineage: sha(JSON.stringify(base)) };
  }
  const store = createOrchestrationStore(db, { authorizePlan: () => false, authorizeClaim: () => false, verifyReceipt: () => ({ outcomeVerified: false, cleanupVerified: false }) });
  const contract = store.readRetryContract(context.runId);
  if (!contract || contract.envelopeHash !== envelopeHash || contract.requirementsDigest !== context.requirementsDigest || attempts.length > contract.maxAttemptsTotal) return invalid();
  const links = db.prepare('SELECT l.* FROM orchestration_retry_link l JOIN orchestration_attempt a ON a.attempt_id=l.attempt_id WHERE a.run_id=? ORDER BY l.attempt_id').all(context.runId) as { attempt_id: string; previous_attempt_id: string; receipt_id: string; contract_digest: string; payload: string }[];
  const receipts = db.prepare('SELECT r.* FROM orchestration_receipt r JOIN orchestration_attempt a ON a.attempt_id=r.attempt_id WHERE a.run_id=? ORDER BY r.attempt_id,r.revision').all(context.runId) as { receipt_id: string; attempt_id: string; revision: number; payload: string }[];
  if (links.length !== attempts.length - plan.tasks.length) invalid();
  for (const link of links) {
    const old = attempts.find(a => a.attempt_id === link.previous_attempt_id), next = attempts.find(a => a.attempt_id === link.attempt_id);
    const receipt = receipts.filter(r => r.attempt_id === link.previous_attempt_id).at(-1);
    const data = JSON.parse(link.payload);
    if (!old || !next || old.task_id !== next.task_id || old.state !== 'failed' || !receipt || receipt.receipt_id !== link.receipt_id
      || link.contract_digest !== contract.digest || data.request?.previousAttemptId !== link.previous_attempt_id || data.request?.receiptId !== link.receipt_id || data.request?.contractDigest !== contract.digest
      || data.reason?.cause !== 'transient' || !validRef(data.reason.sourceRef) || !validHash(data.reason.sourceDigest) || !finiteTime(data.reason.observedAtMs)) invalid();
  }
  for (const attempt of attempts) {
    const receipt = receipts.filter(r => r.attempt_id === attempt.attempt_id).at(-1);
    if (!receipt) return invalid();
    const data = JSON.parse(receipt.payload);
    if (data.runId !== context.runId || data.taskId !== attempt.task_id || data.attemptId !== attempt.attempt_id || data.receiptId !== receipt.receipt_id || data.revision !== receipt.revision
      || data.cleanup !== 'clean' || data.outcome !== (attempt.state === 'completed' ? 'succeeded' : 'failed')) invalid();
  }
  const currentStages = plan.tasks.map(task => {
    const chain = attempts.filter(a => a.task_id === task.id);
    const roots = chain.filter(a => !links.some(l => l.attempt_id === a.attempt_id));
    if (!chain.length || chain.length > contract.maxAttemptsPerTask || roots.length !== 1) return invalid();
    let tip = roots[0]; const visited = new Set<string>();
    while (true) {
      if (visited.has(tip.attempt_id)) return invalid();
      visited.add(tip.attempt_id);
      const next = links.filter(l => l.previous_attempt_id === tip.attempt_id);
      if (!next.length) break;
      if (next.length !== 1) return invalid();
      tip = chain.find(a => a.attempt_id === next[0].attempt_id)!;
      if (!tip) return invalid();
    }
    if (visited.size !== chain.length || tip.state !== 'completed') return invalid();
    return stages.find(s => s.attemptId === tip.attempt_id)!;
  });
  return { stages, currentStages, lineage: sha(JSON.stringify({ ...base, retryVersion: 1, contract, links, receipts })) };
}

/** Historical integrity only. No live checker, principal, filesystem or model callback.
 * A passing evaluation without an accepted receipt is never acceptance. */
export function readAcceptanceHistory(db: Ledger, runId: string, selected?: AcceptanceRevision): AcceptanceHistory | null {
  if (!validId(runId)) throw Error('acceptance_history_run');
  return db.transaction(() => {
    const fail = (): never => { throw Error('acceptance_history_integrity'); };
    const final = db.prepare('SELECT evaluation_id,payload,payload_sha256 FROM acceptance_final WHERE run_id=?').get(runId) as
      { evaluation_id: string; payload: string; payload_sha256: string } | undefined;
    const row = (final
      ? db.prepare('SELECT id,run_id,payload,payload_sha256 FROM acceptance_evaluation WHERE id=?').get(final.evaluation_id)
      : db.prepare('SELECT id,run_id,payload,payload_sha256 FROM acceptance_evaluation WHERE run_id=? ORDER BY rowid DESC LIMIT 1').get(runId)) as
      { id: string; run_id: string; payload: string; payload_sha256: string } | undefined;
    if (!row) { if (final) fail(); return null; }
    if (row.run_id !== runId || !validHash(row.id) || row.id !== row.payload_sha256 || sha(row.payload) !== row.id || Buffer.byteLength(row.payload) > 16_777_216) fail();
    const value = JSON.parse(row.payload);
    const bound = createRequirementContractStore(db, { now: () => 0, resolveChecker: () => undefined }).read(runId);
    if (!bound) return fail();
    const scoped=!!(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='orchestration_recovery_scope'").get()&&db.prepare('SELECT 1 FROM orchestration_recovery_scope WHERE run_id=?').get(runId));
    if(scoped&&!selected)fail();
    const context: AcceptanceContext = { runId, revision:selected?.revision??0, planDigest:selected?.planDigest??bound.requirements.planDigest,
      policyDigest: bound.requirements.policyDigest, requirementsDigest: bound.requirements.digest };
    const matches = (candidate: unknown): boolean => !!candidate && typeof candidate === 'object' &&
      Object.entries(context).every(([key, expected]) => (candidate as Record<string, unknown>)[key] === expected);
    if (!value || value.runId !== runId || !['pass', 'fail', 'unknown'].includes(value.verdict) || !finiteTime(value.collectedAt)
      || !Array.isArray(value.outcomes) || !Array.isArray(value.observations) || value.observations.length > 2048) fail();
    const earlyFailure = value.verdict === 'unknown' && typeof value.initialFailure === 'string'
      && value.outcomes.length === 0 && value.observations.length === 0 && value.manifest === null && value.manifestDigest === null;
    if (value.context === null ? !earlyFailure || value.lineage !== null : !matches(value.context) || !validHash(value.lineage)) fail();
    let historicalStages: (StageEnvelopeBinding | null)[] = [];
    if (value.context !== null) {
      const history = executionHistory(db, context, bound.envelopeHash);
      historicalStages = history.currentStages;
      if (history.lineage !== value.lineage) fail();
    }
    if (value.manifest !== null) {
      if (!matches(value.manifest) || !validHash(value.manifestDigest) || sha(JSON.stringify(value.manifest)) !== value.manifestDigest) fail();
    } else if (value.verdict !== 'unknown' || value.observations.length || value.manifestDigest !== null) fail();
    const contracts = bound.requirements.contracts;
    const outcomeRows = earlyFailure ? contracts.map(c => ({ requirementId: c.id, required: c.required, verdict: 'unknown' })) : value.outcomes;
    if (outcomeRows.length !== contracts.length || new Set(outcomeRows.map((o: { requirementId?: string }) => o?.requirementId)).size !== contracts.length) fail();
    const outcomes = contracts.map(contract => {
      const outcome = outcomeRows.find((o: { requirementId?: string }) => o?.requirementId === contract.id);
      if (!outcome || outcome.required !== contract.required || !['pass', 'fail', 'unknown'].includes(outcome.verdict)) fail();
      return Object.freeze({ requirementId: contract.id, required: contract.required, verdict: outcome.verdict as AcceptanceVerdict });
    });
    for (const observation of value.observations) {
      const c = observation?.context;
      if (!c || !matches(c) || c.manifestDigest !== value.manifestDigest || !validHash(c.digest)
        || !validHash(observation.sha256) || observation.origin !== 'host-observation'
        || !['pass', 'fail', 'unknown'].includes(observation.verdict)
        || !validRef(c.reviewerPrincipal) || observation.principalId !== c.reviewerPrincipal
        || !finiteTime(observation.observedAt) || observation.observedAt > value.collectedAt || observation.observedAt < value.manifest.observedAt
        || !Array.isArray(observation.sourceRefs) || !observation.sourceRefs.length || observation.sourceRefs.length > 64 || observation.sourceRefs.some((ref: unknown) => !validRef(ref))
        || !historicalStages.some(stage => stage !== null && stage.attemptId === c.verifierAttemptId && stage.envelopeHash === c.stageEnvelopeHash)) fail();
      const { digest: _digest, ...base } = c;
      if (sha(JSON.stringify(base)) !== c.digest) fail();
      const requirement = contracts.find(req => req.id === c.requirement?.id);
      if (!requirement || JSON.stringify(requirement) !== JSON.stringify(c.requirement)
        || !requirement.checks.some(check => JSON.stringify(check) === JSON.stringify(c.check))) fail();
      if (!generatedCheckMatches(db, context, requirement!, c.check, value.manifest, historicalStages)) fail();
      const bytes = db.prepare('SELECT bytes FROM acceptance_blob WHERE sha256=?').get(observation.sha256) as { bytes: Buffer } | undefined;
      if (!bytes || !Buffer.isBuffer(bytes.bytes) || sha(bytes.bytes) !== observation.sha256) fail();
      const policy=bound.requirements.evidencePolicies.find(candidate=>candidate.requirementId===requirement!.id&&candidate.checkerId===c.check.checkerId&&candidate.checkerRevision===c.check.revision&&candidate.parametersDigest===c.check.parametersDigest);
      if(!policy||observation.evidence?.sourceRevision!==policy.sourceRevision||evaluateEvidence(policy,observation.evidence,value.collectedAt,Number.MAX_SAFE_INTEGER).verdict!==observation.verdict)fail();
    }
    for (const outcome of outcomes) {
      const observations = value.observations.filter((o: StoredObservation) => o.context.requirement.id === outcome.requirementId);
      if (outcome.verdict === 'pass' && !contracts.find(c => c.id === outcome.requirementId)!.checks.every(check =>
        observations.some((o: StoredObservation) => o.verdict === 'pass' && JSON.stringify(o.context.check) === JSON.stringify(check)))) fail();
      if (outcome.verdict === 'fail' && !observations.some((o: StoredObservation) => o.verdict === 'fail')) fail();
    }
    const required = outcomes.filter(o => o.required);
    if ((value.verdict === 'pass' && (!required.length || required.some(o => o.verdict !== 'pass')))
      || (value.verdict === 'fail' && !required.some(o => o.verdict === 'fail'))) fail();
    let receipt: AcceptanceReceipt | null = null;
    if (final) {
      if (!validHash(final.payload_sha256) || sha(final.payload) !== final.payload_sha256 || Buffer.byteLength(final.payload) > 4096) fail();
      const parsed = JSON.parse(final.payload);
      if (!matches(parsed) || parsed.status !== 'accepted' || parsed.evaluationId !== row.id || value.verdict !== 'pass'
        || parsed.manifestDigest !== value.manifestDigest || !finiteTime(parsed.acceptedAt)) fail();
      receipt = Object.freeze({ ...context, status: 'accepted', evaluationId: row.id, manifestDigest: parsed.manifestDigest, acceptedAt: parsed.acceptedAt });
    }
    return Object.freeze({ receipt, evaluationId: row.id, verdict: value.verdict as AcceptanceVerdict, outcomes: Object.freeze(outcomes) });
  })();
}

/** Host-only acceptance. Evidence integrity is not evidence truth: registered host
 * collectors/evaluators and principal resolution remain trusted implementation seams.
 * No checker command, public verdict record, billing settlement, or tool launch here. */
export function createAcceptanceVerifier(db: Ledger, host: AcceptanceHost) {
  if (!finiteTime(host.timeoutMs) || host.timeoutMs < 1 || host.timeoutMs > 120000 || !finiteTime(host.maxObservationAgeMs)) throw Error('invalid_acceptance_limits');
  const owned = new WeakMap<object, PrivateEvaluation>();
  const requirements = createRequirementContractStore(db, { now: host.now, resolveChecker: () => undefined });
  const stageStore = createStageEnvelopeBinder(db, { now: host.now, authorizeStage: () => false, resolveScope: () => { throw Error('historical-only'); } });
  function now() { const n = host.now(); if (!finiteTime(n)) throw Error('invalid_acceptance_clock'); return n; }
  async function bounded<T>(operation: (signal: AbortSignal) => Promise<T>, external?: AbortSignal): Promise<T> {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
    let abort: (() => void) | undefined;
    try { return await Promise.race([Promise.resolve().then(() => { if (external?.aborted) throw Error('acceptance_cancelled'); return operation(controller.signal); }), new Promise<T>((_, reject) => {
      abort = () => { controller.abort(); reject(Error('acceptance_cancelled')); };
      external?.addEventListener('abort', abort, { once: true }); if (external?.aborted) abort();
      timer = setTimeout(() => { controller.abort(); reject(Error('acceptance_timeout')); }, host.timeoutMs);
    })]); }
    finally { if (timer) clearTimeout(timer); if (abort) external?.removeEventListener('abort', abort); }
  }
  function state(runId: string, selected?: AcceptanceRevision): State {
    const req = requirements.read(runId); if (!req) throw Error('requirements_missing');
    const scoped=!!(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='orchestration_recovery_scope'").get()&&db.prepare('SELECT 1 FROM orchestration_recovery_scope WHERE run_id=?').get(runId));
    if(scoped&&!selected)throw Error('acceptance_revision_required');
    if(selected&&(!Number.isSafeInteger(selected.revision)||selected.revision<0||!validHash(selected.planDigest)))throw Error('acceptance_revision_invalid');
    const row = db.prepare('SELECT r.task_id,r.envelope_hash,e.worktree_realpath,p.payload FROM run r JOIN envelope e ON e.envelope_hash=r.envelope_hash JOIN orchestration_plan p ON p.run_id=r.id WHERE r.id=?').get(runId) as { task_id: string; envelope_hash: string; worktree_realpath: string; payload: string } | undefined;
    if (!row || row.envelope_hash !== req.envelopeHash) throw Error('acceptance_run_lineage');
    const revision=selected?.revision??0, planDigest=selected?.planDigest??req.requirements.planDigest;
    const revisionRow=scoped?db.prepare('SELECT payload FROM orchestration_plan_revision WHERE run_id=? AND revision=? AND plan_digest=?').get(runId,revision,planDigest) as {payload:Buffer}|undefined:undefined;
    if(scoped&&!revisionRow)throw Error('acceptance_revision_lineage');
    const p = JSON.parse(revisionRow?Buffer.from(revisionRow.payload).toString():row.payload) as ValidatedPlan;
    const plan = validateTaskPlan(p.approval, { revision: p.revision, policyRevision: p.approval.policyRevision, policyDigest: p.approval.policyDigest, tasks: p.tasks });
    if (plan.digest !== planDigest) throw Error('acceptance_plan_lineage');
    const context = Object.freeze({ runId, revision, planDigest: plan.digest, policyDigest: req.requirements.policyDigest, requirementsDigest: req.requirements.digest });
    const history = executionHistory(db, context, row.envelope_hash);
    return { context, requirements: req, plan, taskId: row.task_id, worktree: row.worktree_realpath, stages: Object.freeze(history.stages), currentStages: Object.freeze(history.currentStages), lineage: history.lineage };
  }
  function checker(check: RequirementCheck, requirement: RequirementContract): AcceptanceChecker | undefined {
    try {
      const c = host.resolveChecker(check.checkerId, check.revision);
      return c && c.id === check.checkerId && c.revision === check.revision && Array.isArray(c.kinds) && c.kinds.includes(requirement.kind) && typeof c.collect === 'function' && typeof c.evaluate === 'function' ? c : undefined;
    } catch { return undefined; }
  }
  function manifestSnapshot(value: AcceptanceManifest, context: AcceptanceContext): AcceptanceManifest {
    if (!value || Object.entries(context).some(([key, v]) => value[key as keyof AcceptanceContext] !== v)
        || !finiteTime(value.observedAt) || value.observedAt > now() || now() - value.observedAt > host.maxObservationAgeMs
        || !Array.isArray(value.artifacts) || !value.artifacts.length || value.artifacts.length > 2048) throw Error('manifest_invalid');
    const artifacts = value.artifacts.map(a => {
      if (!a || !validId(a.targetId) || !validHash(a.digest) || !Number.isSafeInteger(a.sizeBytes) || a.sizeBytes <= 0 || !validRef(a.sourceRef) || !['filesystem', 'retrieved-source', 'remote-state', 'generated-output'].includes(a.kind)) throw Error('artifact_invalid');
      return Object.freeze({ targetId: a.targetId, digest: a.digest, sizeBytes: a.sizeBytes, sourceRef: a.sourceRef, kind: a.kind });
    }).sort((a, b) => a.targetId < b.targetId ? -1 : a.targetId > b.targetId ? 1 : 0);
    if (new Set(artifacts.map(a => a.targetId)).size !== artifacts.length) throw Error('artifact_duplicate');
    return Object.freeze({ ...context, artifacts: Object.freeze(artifacts), observedAt: value.observedAt });
  }
  function principalStages(s: State): readonly StageEnvelopeBinding[] {
    const recoveryScoped = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='orchestration_recovery_scope'").get()
      && db.prepare('SELECT 1 FROM orchestration_recovery_scope WHERE run_id=?').get(s.context.runId);
    if (!recoveryScoped) return s.stages;
    return s.stages.filter(stage => {
      const row = db.prepare('SELECT run_id,revision FROM orchestration_attempt_revision WHERE attempt_id=?').get(stage.attemptId) as {run_id:string;revision:number}|undefined;
      if (!row || row.run_id !== s.context.runId) throw Error('acceptance_history_integrity');
      return row.revision === s.context.revision;
    });
  }
  function reviewer(s: State, requirement: RequirementContract): { stage: StageEnvelopeBinding; principal: string } | null {
    const makers = s.plan.tasks.filter(t => isPlanMaker(t.role));
    const principals = makers.flatMap(t => principalStages(s).filter(stage => stage.taskId === t.id).map(stage => host.principalForAttempt(stage)));
    if (!principals.length || principals.some(p => !validRef(p))) return null;
    for (const task of s.plan.tasks.filter(t => t.role === 'verifier' && t.requirementIds.includes(requirement.id))) {
      const stage = s.currentStages.find(stage => stage.taskId === task.id)!;
      const principal = host.principalForAttempt(stage);
      if (validRef(principal) && !principals.includes(principal)) return { stage, principal };
    }
    return null;
  }
  function saveBlob(bytes: Buffer) {
    const digest = sha(bytes), old = db.prepare('SELECT bytes FROM acceptance_blob WHERE sha256=?').get(digest) as { bytes: Buffer } | undefined;
    if (old) { if (!old.bytes.equals(bytes)) throw Error('acceptance_blob_collision'); }
    else db.prepare('INSERT INTO acceptance_blob VALUES(?,?)').run(digest, bytes);
    return digest;
  }
  function read(runId: string): AcceptanceReceipt | null {
    const row = db.prepare('SELECT payload,payload_sha256 FROM acceptance_final WHERE run_id=?').get(runId) as { payload: string; payload_sha256: string } | undefined;
    if (!row) return null;
    if (sha(row.payload) !== row.payload_sha256) throw Error('acceptance_receipt_corrupt');
    const receipt = JSON.parse(row.payload) as AcceptanceReceipt;
    if (receipt.runId !== runId || receipt.status !== 'accepted') throw Error('acceptance_receipt_lineage');
    return Object.freeze(receipt);
  }
  return Object.freeze({
    read,
    async collect(runId: string, options: { revision?: number; planDigest?: string; signal?: AbortSignal } = {}): Promise<AcceptanceEvaluation> {
      if (!validId(runId) || !db.prepare('SELECT 1 FROM run WHERE id=?').get(runId)) throw Error('acceptance_run_missing');
      const totalController = new AbortController(), deadline = performance.now() + host.timeoutMs;
      const cancel = () => totalController.abort();
      options.signal?.addEventListener('abort', cancel, { once: true }); if (options.signal?.aborted) cancel();
      const totalTimer = setTimeout(cancel, host.timeoutMs), signal = totalController.signal;
      try {
      let s: State | null = null, manifest: AcceptanceManifest | null = null, manifestDigest: string | null = null;
      const observations: StoredObservation[] = [], blobs: Buffer[] = [], outcomes: RequirementOutcome[] = [];
      let initialFailure: string | null = null, totalBytes = 0;
      try { s = db.transaction(() => state(runId,options.revision===undefined&&options.planDigest===undefined?undefined:{revision:options.revision!,planDigest:options.planDigest!}))(); manifest = manifestSnapshot(await bounded(inner => host.captureManifest(s!.context, inner), signal), s.context); manifestDigest = sha(JSON.stringify(manifest)); }
      catch (error) { initialFailure = error instanceof Error ? error.message : 'acceptance_unavailable'; }
      if (s && manifest && manifestDigest) {
        for (const requirement of s.requirements.requirements.contracts) {
          const reasons: string[] = [], verdicts: AcceptanceVerdict[] = [];
          let principal: ReturnType<typeof reviewer> = null;
          try { principal = reviewer(s, requirement); } catch { /* Missing host identity fails closed. */ }
          for (const check of requirement.checks) {
            if (performance.now() >= deadline) cancel();
            if (signal.aborted) { verdicts.push('unknown'); reasons.push('acceptance_cancelled_or_timeout'); continue; }
            if (initialFailure) { verdicts.push('unknown'); reasons.push(initialFailure); continue; }
            const registered = checker(check, requirement);
            if (!registered || !principal) { verdicts.push('unknown'); reasons.push(!registered ? 'checker_unavailable' : 'independent_principal_missing'); continue; }
            const targets = check.targetIds.map(id => manifest!.artifacts.find(a => a.targetId === id));
            if (!generatedCheckMatches(db, s.context, requirement, check, manifest, s.currentStages)) { verdicts.push('unknown'); reasons.push('generated_output_contract_mismatch'); continue; }
            if (targets.some(t => !t) || (requirement.kind === 'external' && !targets.some(t => t?.kind === 'remote-state'))
                || (requirement.kind === 'research' && !targets.some(t => t?.kind === 'retrieved-source'))
                || (requirement.kind === 'code' && !targets.some(t => t?.kind === 'filesystem'))
                || (requirement.kind === 'document' && !targets.some(t => t?.kind === 'filesystem' || t?.kind === 'generated-output'))) { verdicts.push('unknown'); reasons.push('artifact_target_missing'); continue; }
            const policy=s.requirements.requirements.evidencePolicies.find(candidate=>candidate.requirementId===requirement.id&&candidate.kind===requirement.kind&&candidate.checkerId===check.checkerId&&candidate.checkerRevision===check.revision&&candidate.parametersDigest===check.parametersDigest&&JSON.stringify(candidate.targetIds)===JSON.stringify(check.targetIds));
            if(!policy){verdicts.push('unknown');reasons.push('evidence_policy_unavailable');continue;}
            const producerTasks=s.plan.tasks.filter(task=>isPlanMaker(task.role)&&task.requirementIds.includes(requirement.id)).map(task=>task.id).sort();
            const producerPrincipals=producerTasks.flatMap(taskId=>principalStages(s).filter(stage=>stage.taskId===taskId).map(stage=>host.principalForAttempt(stage))).filter(validRef).sort();
            const base = { ...s.context, requirement, check, verifierAttemptId: principal.stage.attemptId, stageEnvelopeHash: principal.stage.envelopeHash, reviewerPrincipal: principal.principal, manifestDigest,targets:Object.freeze(targets as AcceptanceArtifact[]),producerPrincipals:Object.freeze(producerPrincipals),evidencePolicy:policy };
            const context: CheckerContext = Object.freeze({ ...base, digest: sha(JSON.stringify(base)) });
            try {
              const raw = await bounded(inner => registered.collect(context, inner), signal);
              if (signal.aborted) throw Error('acceptance_cancelled');
              if (!raw || raw.contextDigest !== context.digest || raw.principalId !== principal.principal || raw.origin !== 'host-observation'
                  || !finiteTime(raw.observedAt) || raw.observedAt < manifest.observedAt || raw.observedAt > now() || now() - raw.observedAt > host.maxObservationAgeMs
                  || !Array.isArray(raw.sourceRefs) || !raw.sourceRefs.length || raw.sourceRefs.length > 64 || raw.sourceRefs.some(ref => !validRef(ref))
                  || !(raw.bytes instanceof Uint8Array) || !raw.bytes.byteLength || raw.bytes.byteLength > 1_048_576 || (totalBytes += raw.bytes.byteLength) > 16_777_216) throw Error('checker_observation_invalid');
              if(!policy||!raw.evidence||JSON.stringify(policy.producerTaskIds)!==JSON.stringify(producerTasks))throw Error('evidence_policy_unavailable');
              if(!producerPrincipals.length||producerPrincipals.some(value=>!validRef(value))||!producerPrincipals.includes(raw.evidence.producerAttemptPrincipal))throw Error('evidence_producer_lineage');
              const actualTargets=targets.map(target=>({targetId:target!.targetId,kind:target!.kind,byteLength:target!.sizeBytes,digest:target!.digest}));
              if(raw.evidence.sourceRevision!==policy.sourceRevision||raw.evidence.checkerPrincipal!==principal.principal||raw.evidence.targets.some((target,index)=>target.targetId!==actualTargets[index]?.targetId||target.kind!==actualTargets[index]?.kind||target.byteLength!==actualTargets[index]?.byteLength||target.digest!==actualTargets[index]?.digest))throw Error('evidence_target_mismatch');
              const policyResult=evaluateEvidence(policy as EvidencePolicyDescriptor,raw.evidence,now(),host.maxObservationAgeMs);
              const bytes = Buffer.from(raw.bytes), sourceRefs = Object.freeze([...raw.sourceRefs]);
              // Evaluators receive a second copy so mutation cannot rewrite retained evidence.
              const observation = Object.freeze({ contextDigest: raw.contextDigest, principalId: raw.principalId, origin: raw.origin, observedAt: raw.observedAt, sourceRefs, bytes: Buffer.from(bytes) });
              const checkerVerdict=registered.evaluate(context,observation);
              if(!['pass','fail','unknown'].includes(checkerVerdict))throw Error('checker_verdict_invalid');
              const verdict:AcceptanceVerdict=policyResult.verdict==='fail'||checkerVerdict==='fail'?'fail':policyResult.verdict==='pass'&&checkerVerdict==='pass'?'pass':'unknown';
              blobs.push(bytes); observations.push(Object.freeze({ context, sha256: sha(bytes), principalId: principal.principal, sourceRefs, observedAt: raw.observedAt, origin: 'host-observation', verdict, evidence:Object.freeze(structuredClone(raw.evidence)) }));
              verdicts.push(verdict); if (verdict !== 'pass') reasons.push(`checker_${verdict}`);
            } catch { verdicts.push('unknown'); reasons.push('checker_observation_unverified'); }
          }
          const verdict = verdicts.includes('fail') ? 'fail' : verdicts.every(v => v === 'pass') ? 'pass' : 'unknown';
          outcomes.push(Object.freeze({ requirementId: requirement.id, required: requirement.required, verdict, reasons: Object.freeze(reasons) }));
        }
      }
      const required = outcomes.filter(o => o.required);
      if (performance.now() >= deadline) cancel();
      const verdict: AcceptanceVerdict = signal.aborted || initialFailure || !required.length ? 'unknown' : required.some(o => o.verdict === 'fail') ? 'fail' : required.every(o => o.verdict === 'pass') ? 'pass' : 'unknown';
      const encoded = JSON.stringify({ runId, context: s?.context ?? null, lineage: s?.lineage ?? null, manifest, manifestDigest, observations, outcomes, verdict, initialFailure, collectedAt: now() });
      const id = sha(encoded), evaluation = Object.freeze({ id, runId, verdict, outcomes: Object.freeze(outcomes) });
      db.transaction(() => {
        for (const bytes of blobs) saveBlob(bytes);
        const old = db.prepare('SELECT payload FROM acceptance_evaluation WHERE id=?').get(id) as { payload: string } | undefined;
        if (old && old.payload !== encoded) throw Error('acceptance_evaluation_collision');
        if (!old) db.prepare('INSERT INTO acceptance_evaluation VALUES(?,?,?,?)').run(id, runId, encoded, id);
      }).immediate();
      owned.set(evaluation, { public: evaluation, state: s, manifest, manifestDigest, observations: Object.freeze(observations), encoded, signal: options.signal });
      return evaluation;
      } finally { clearTimeout(totalTimer); options.signal?.removeEventListener('abort', cancel); }
    },
    finalize(evaluation: AcceptanceEvaluation, selected?: AcceptanceRevision): Finalization {
      const e = owned.get(evaluation); if (!e) throw Error('unowned_acceptance_evaluation');
      const blocked = (reason: string): Finalization => Object.freeze({ status: 'blocked', reason, evaluationId: evaluation.id });
      return db.transaction(() => {
        const previous = read(evaluation.runId);
        if (previous) { if (previous.evaluationId !== evaluation.id) throw Error('acceptance_already_finalized'); return previous; }
        if (e.signal?.aborted) return blocked('acceptance_cancelled');
        if (evaluation.verdict !== 'pass' || !e.state || !e.manifest || !e.manifestDigest) return blocked('requirements_unverified');
        if (now() - e.manifest.observedAt > host.maxObservationAgeMs || e.manifest.observedAt > now()) return blocked('acceptance_evidence_stale');
        let current: State; try { current = state(evaluation.runId,selected); } catch { return blocked('acceptance_lineage_changed'); }
        if (current.lineage !== e.state.lineage) return blocked('acceptance_lineage_changed');
        const task = db.prepare('SELECT state FROM task WHERE id=?').get(current.taskId) as { state: string };
        if (task.state !== 'running') return blocked('acceptance_task_inactive');
        const persisted = db.prepare('SELECT payload,payload_sha256 FROM acceptance_evaluation WHERE id=?').get(evaluation.id) as { payload: string; payload_sha256: string } | undefined;
        if (!persisted || persisted.payload !== e.encoded || sha(persisted.payload) !== persisted.payload_sha256) return blocked('acceptance_evidence_corrupt');
        for (const observation of e.observations) {
          const bytes = db.prepare('SELECT bytes FROM acceptance_blob WHERE sha256=?').get(observation.sha256) as { bytes: Buffer } | undefined;
          if (!bytes || sha(bytes.bytes) !== observation.sha256) return blocked('acceptance_evidence_corrupt');
          if (!observation.context.requirement.required) continue;
          if (now() - observation.observedAt > host.maxObservationAgeMs || observation.observedAt > now()) return blocked('acceptance_evidence_stale');
          if (!checker(observation.context.check, observation.context.requirement)) return blocked('checker_unavailable');
          const policy=current.requirements.requirements.evidencePolicies.find(candidate=>candidate.requirementId===observation.context.requirement.id&&candidate.checkerId===observation.context.check.checkerId&&candidate.checkerRevision===observation.context.check.revision&&candidate.parametersDigest===observation.context.check.parametersDigest);
          const registered=checker(observation.context.check,observation.context.requirement);
          if(!policy||!registered||observation.evidence.sourceRevision!==policy.sourceRevision)return blocked('evidence_policy_changed');
          const policyVerdict=evaluateEvidence(policy,observation.evidence,now(),host.maxObservationAgeMs).verdict;
          const checkerVerdict=registered.evaluate(observation.context,Object.freeze({contextDigest:observation.context.digest,principalId:observation.principalId,sourceRefs:observation.sourceRefs,observedAt:observation.observedAt,origin:observation.origin,bytes:Buffer.from(bytes.bytes),evidence:observation.evidence}));
          const combined=policyVerdict==='fail'||checkerVerdict==='fail'?'fail':policyVerdict==='pass'&&checkerVerdict==='pass'?'pass':'unknown';
          if(combined!==observation.verdict)return blocked('evidence_policy_changed');
          const principal = reviewer(current, observation.context.requirement);
          if (!principal || principal.principal !== observation.principalId || principal.stage.attemptId !== observation.context.verifierAttemptId) return blocked('independent_principal_changed');
        }
        const leases = db.prepare('SELECT worktree_realpath FROM workspace_write_lease').all() as { worktree_realpath: string }[];
        if (leases.some(lease => overlaps(current.worktree, lease.worktree_realpath))) return blocked('writer_lease_busy');
        const acquired = new Date(now()).toISOString();
        db.prepare('INSERT INTO workspace_write_lease VALUES(?,?,?)').run(current.worktree, evaluation.runId, acquired);
        try {
          if (host.isManifestCurrent(current.context, e.manifest) !== true) return blocked('artifact_manifest_changed');
          if (e.signal?.aborted) return blocked('acceptance_cancelled');
          const finalTask = db.prepare('SELECT state FROM task WHERE id=?').get(current.taskId) as { state: string };
          if (finalTask.state !== 'running') return blocked('acceptance_task_inactive');
          let finalState: State;
          try { finalState = state(evaluation.runId,selected); } catch { return blocked('acceptance_lineage_changed'); }
          if (finalState.lineage !== current.lineage) return blocked('acceptance_lineage_changed');
          if (e.observations.some(observation => !generatedCheckMatches(db, finalState.context,
            observation.context.requirement, observation.context.check, e.manifest!, finalState.currentStages))) return blocked('generated_output_changed');
          const receipt: AcceptanceReceipt = Object.freeze({ ...current.context, status: 'accepted', evaluationId: evaluation.id, manifestDigest: e.manifestDigest, acceptedAt: now() });
          const encoded = JSON.stringify(receipt);
          db.prepare('INSERT INTO acceptance_final VALUES(?,?,?,?)').run(evaluation.runId, evaluation.id, encoded, sha(encoded));
          if (db.prepare("UPDATE task SET state='completed',blocked_reason=NULL WHERE id=? AND state='running'").run(current.taskId).changes !== 1) throw Error('acceptance_commit_conflict');
          return receipt;
        } finally { db.prepare('DELETE FROM workspace_write_lease WHERE worktree_realpath=? AND run_id=? AND acquired_at=?').run(current.worktree, evaluation.runId, acquired); }
      }).immediate();
    },
  });
}
