import { createHash } from 'node:crypto';
import type { Ledger } from '../ledger.js';
import type { RuntimeContext } from '../integration-runtime.js';
import type { SessionRecord } from '../session-spawn.js';
import { snapshotModelControlBundle, type ModelControlBundle } from '../model-control-bundle.js';
import { createStageEnvelopeBinder, type StageEnvelopeBinding } from '../orchestration/stage-envelope.js';
import { validateTaskPlan, type ValidatedPlan } from '../orchestration/plan.js';
import { createRequirementContractStore } from './requirements.js';
import type { EvidencePolicyDescriptor } from './evidence-policy.js';
import { createGeneratedOutputStore, type GeneratedOutputTarget } from './generated-output.js';
import type { AcceptanceHost, AcceptanceContext, AcceptanceManifest, CheckerContext, RawCheckerObservation, AcceptanceVerdict } from './acceptance.js';
import type { IsolatedJsonCheckerExecution, IsolatedJsonCheckerResult } from '../adapters/isolated-json-checker.js';

export const GENERATED_JSON_CHECKER_ID = 'cue-json-format';
export function generatedJsonCheckerRevision(bundle: ModelControlBundle): string {
  return 'v1:' + snapshotModelControlBundle(bundle, 'json-checker', bundle.nodeSha256).checkerCoreSha256;
}
/** Conservative preapproval carrier limit, including IDs/protocol and JSON framing. */
export function assertGeneratedJsonTemplateBounds(inputBytes: number, maxOutputBytes: number): void {
  if (![inputBytes, maxOutputBytes].every(n => Number.isSafeInteger(n) && n > 0 && n <= 1_048_576)
    || 4 * Math.ceil(inputBytes / 3) + 4 * Math.ceil(maxOutputBytes / 3) + 2048 > 1_048_576) throw Error('generated_checker_carrier_limit');
}
export interface ApprovedGeneratedCheck {
  readonly stage: StageEnvelopeBinding; readonly target: GeneratedOutputTarget;
  readonly inputBytes: Uint8Array; readonly outputBytes: Uint8Array; readonly controlBundle: Readonly<ModelControlBundle>;
}
const sha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const identity = (c: RuntimeContext) => JSON.stringify([c.runId, c.candidateId, c.role, c.subjectDigest]);
const sessionKeys = ['handle', 'pid', 'start_time', 'cwd', 'task_id', 'run_id'] as const;
type Attempt = { attempt_id: string; task_id: string; candidate_id: string; state: string; cleanup_verified: number };
type GeneratedPolicyTarget=Pick<GeneratedOutputTarget,'requirementId'|'producerTaskId'|'targetId'|'checkerId'|'checkerRevision'|'parametersDigest'|'inputSha256'>;
export function generatedJsonEvidencePolicy(target:GeneratedPolicyTarget):Readonly<EvidencePolicyDescriptor>{
  if(target.checkerId!==GENERATED_JSON_CHECKER_ID)throw Error('generated_checker_policy_binding');
  return Object.freeze({requirementId:target.requirementId,kind:'document' as const,producerTaskIds:Object.freeze([target.producerTaskId]),
    sourceRevision:'generated-json:'+sha(JSON.stringify({inputSha256:target.inputSha256,targetId:target.targetId,producerTaskId:target.producerTaskId,checkerRevision:target.checkerRevision,parametersDigest:target.parametersDigest})),
    targetIds:Object.freeze([target.targetId]),checkerId:target.checkerId,checkerRevision:target.checkerRevision,parametersDigest:target.parametersDigest,
    hostileCheckIds:Object.freeze([]),requiredSectionIds:Object.freeze(['json-document']),claimIds:Object.freeze([]),requiresRender:false});
}
const policyIdentity=(p:EvidencePolicyDescriptor)=>JSON.stringify([p.requirementId,p.kind,p.producerTaskIds,p.sourceRevision,p.targetIds,p.checkerId,p.checkerRevision,p.parametersDigest,p.hostileCheckIds,p.requiredSectionIds,p.claimIds,p.requiresRender,p.remote??null]);

/** Fixed native checker host. launchVerifier is the normal verifier stage launch;
 * acceptance collection NEVER launches a process. Private ownership is lost on
 * restart, yielding unknown; persisted acceptance history remains readable.
 * Host launch must use supplied exact stage, byte snapshots and pinned bundle.
 * Compose cleanup outside this wrapper. Synthetic host seams do not qualify code. */
export function createGeneratedAcceptanceHost(host: {
  db: Ledger; now(): number; controlBundle: ModelControlBundle;
  producerPrincipalForAttempt(stage: StageEnvelopeBinding): string | null;
  launch(context: RuntimeContext, approved: ApprovedGeneratedCheck): Promise<IsolatedJsonCheckerExecution>;
  timeoutMs?: number; maxObservationAgeMs?: number;
}) {
  const { db } = host, pins = snapshotModelControlBundle(host.controlBundle, 'json-checker', host.controlBundle.nodeSha256);
  const revision = generatedJsonCheckerRevision(pins), principal = 'native-json-checker:' + pins.sha256;
  const now = () => { const value = host.now(); if (!Number.isSafeInteger(value) || value < 0) throw Error('generated_checker_clock'); return value; };
  const timeoutMs = host.timeoutMs ?? 5000, maxAge = host.maxObservationAgeMs ?? 60000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000 || !Number.isSafeInteger(maxAge) || maxAge < 1 || maxAge > 86400000) throw Error('generated_checker_limits');
  const stages = createStageEnvelopeBinder(db, { now, resolveScope: () => { throw Error('no-grants'); }, authorizeStage: () => false });
  const outputs = createGeneratedOutputStore(db, { now, authorizeObservation: () => false });
  const requirements = createRequirementContractStore(db, { now, resolveChecker: () => undefined });
  function runData(runId: string,selected?:Readonly<{revision:number;planDigest:string}>) {
    const bound = requirements.read(runId); if (!bound) throw Error('generated_checker_criteria_missing');
    const scoped=!!db.prepare('SELECT 1 FROM orchestration_recovery_scope WHERE run_id=?').get(runId);
    if(scoped&&!selected)throw Error('generated_checker_revision_required');
    const saved = scoped?db.prepare('SELECT payload FROM orchestration_plan_revision WHERE run_id=? AND revision=? AND plan_digest=?').get(runId,selected!.revision,selected!.planDigest) as {payload:Buffer}|undefined
      :db.prepare('SELECT payload FROM orchestration_plan WHERE run_id=?').get(runId) as { payload: string } | undefined;
    if (!saved) throw Error('generated_checker_plan_missing');
    const raw = JSON.parse(Buffer.isBuffer(saved.payload)?saved.payload.toString():saved.payload) as ValidatedPlan;
    const plan = validateTaskPlan(raw.approval, { revision: raw.revision, policyRevision: raw.approval.policyRevision, policyDigest: raw.approval.policyDigest, tasks: raw.tasks });
    if (plan.digest !== (selected?.planDigest??bound.requirements.planDigest)) throw Error('generated_checker_plan_mismatch');
    const context: AcceptanceContext = { runId, revision:selected?.revision??0,planDigest: plan.digest, policyDigest: bound.requirements.policyDigest, requirementsDigest: bound.requirements.digest };
    return { plan, bound, context };
  }
  function latest(runId: string, taskId: string,revision?:number): Attempt {
    const scoped=revision!==undefined&&!!db.prepare('SELECT 1 FROM orchestration_recovery_scope WHERE run_id=?').get(runId);
    const row = !scoped?db.prepare('SELECT attempt_id,task_id,candidate_id,state,cleanup_verified FROM orchestration_attempt WHERE run_id=? AND task_id=? ORDER BY rowid DESC LIMIT 1').get(runId, taskId) as Attempt | undefined
      :db.prepare('SELECT a.attempt_id,a.task_id,a.candidate_id,a.state,a.cleanup_verified FROM orchestration_attempt a JOIN orchestration_attempt_revision ar ON ar.attempt_id=a.attempt_id WHERE a.run_id=? AND a.task_id=? AND ar.revision=? ORDER BY a.rowid DESC LIMIT 1').get(runId,taskId,revision) as Attempt|undefined;
    if (!row) throw Error('generated_checker_attempt_missing'); return row;
  }
  function artifact(runId: string, targetId: string,activeRevision?:number) {
    const input = outputs.readInput(runId, targetId); if (!input) throw Error('generated_checker_target_missing');
    const t = input.target;
    if (t.checkerId !== GENERATED_JSON_CHECKER_ID || t.checkerRevision !== revision) throw Error('generated_checker_contract_unsupported');
    assertGeneratedJsonTemplateBounds(t.inputByteLength, t.maxBytes);
    const producer = latest(runId, t.producerTaskId,activeRevision);
    if (producer.state !== 'completed' || producer.cleanup_verified !== 1) throw Error('generated_checker_producer_incomplete');
    const output = outputs.read(runId, targetId, producer.attempt_id); if (!output) throw Error('generated_checker_response_missing');
    return { input, output, producer, target: t };
  }
  function manifest(context: AcceptanceContext): AcceptanceManifest {
    const current = runData(context.runId,{revision:context.revision??0,planDigest:context.planDigest});
    if (Object.entries(current.context).some(([key, value]) => context[key as keyof AcceptanceContext] !== value)) throw Error('generated_checker_context_mismatch');
    const rows = db.prepare('SELECT target_id FROM generated_output_target WHERE run_id=? ORDER BY target_id').all(context.runId) as { target_id: string }[];
    if (!rows.length || rows.length > 128) throw Error('generated_checker_targets');
    return Object.freeze({ ...current.context, artifacts: Object.freeze(rows.map(row => {
      const a = artifact(context.runId, row.target_id,context.revision);
      return Object.freeze({ targetId: row.target_id, digest: a.output.record.sha256,
        sizeBytes: a.output.record.byteLength, sourceRef: 'cue-generated-output:' + a.output.record.digest, kind: 'generated-output' as const });
    })), observedAt: now() });
  }
  type Owned = { context: RuntimeContext; identity: string; stage: StageEnvelopeBinding; target: GeneratedOutputTarget;
    producerAttemptId: string; outputDigest: string; session: Readonly<SessionRecord>; execution: IsolatedJsonCheckerExecution;
    result: IsolatedJsonCheckerResult | null; measuredAt: number | null };
  const owned = new Map<string, Owned>(), launched = new Set<string>(), executions = new WeakSet<object>();
  function validate(o: Owned, terminal: boolean) {
    const stage = stages.read(o.stage.attemptId), a = artifact(o.target.runId, o.target.targetId,o.stage.revision);
    const current = latest(o.target.runId, o.stage.taskId,o.stage.revision);
    const row = db.prepare('SELECT handle,pid,start_time,cwd,task_id,run_id FROM session_handle WHERE handle=?').get(o.session.handle) as SessionRecord | undefined;
    if (identity(o.context) !== o.identity || stage?.envelopeHash !== o.stage.envelopeHash || current.attempt_id !== o.stage.attemptId
      || current.candidate_id !== o.context.candidateId || a.target.targetDigest !== o.target.targetDigest
      || a.producer.attempt_id !== o.producerAttemptId || a.output.record.digest !== o.outputDigest
      || !row || !Number.isSafeInteger(o.session.pid) || o.session.pid < 1 || o.session.run_id !== o.stage.attemptId
      || o.session.task_id !== o.stage.owner.task_id || o.session.cwd !== o.stage.owner.cwd
      || sessionKeys.some(key => row[key] !== o.session[key] || o.execution.session[key] !== o.session[key])
      || (terminal && (current.state !== 'completed' || current.cleanup_verified !== 1))) throw Error('generated_checker_ownership_drift');
    return a;
  }
  const issued = new Map<string, { hash: string; verdict: AcceptanceVerdict }>();
  function policyFor(target:GeneratedPolicyTarget):Readonly<EvidencePolicyDescriptor>{
    if(target.checkerId!==GENERATED_JSON_CHECKER_ID||target.checkerRevision!==revision)throw Error('generated_checker_policy_binding');
    return generatedJsonEvidencePolicy(target);
  }
  const checker = Object.freeze({ id: GENERATED_JSON_CHECKER_ID, revision, kinds: Object.freeze(['document'] as const),
    async collect(context: CheckerContext, signal: AbortSignal): Promise<RawCheckerObservation> {
      signal.throwIfAborted(); const o = owned.get(context.verifierAttemptId);
      if (!o || !o.result || o.measuredAt === null) throw Error('generated_checker_owned_result_missing');
      const a = validate(o, true), r = o.result, verdict = r.checkerVerdict, expectedPolicy=policyFor(a.target);
      if (r.outcome !== 'succeeded' || r.attemptId !== o.stage.attemptId || !/^[a-zA-Z0-9:_-]{1,128}$/.test(r.requestId)
        || !verdict || verdict.contract !== 'cue-json-format-v1' || !['pass', 'fail', 'unknown'].includes(verdict.status)
        || verdict.inputSha256 !== a.target.inputSha256 || verdict.outputSha256 !== a.output.record.sha256
        || context.stageEnvelopeHash !== o.stage.envelopeHash || context.reviewerPrincipal !== principal
        || context.check.checkerId !== checker.id || context.check.revision !== revision || context.check.parametersDigest !== a.target.parametersDigest
        || context.check.targetIds.length !== 1 || context.check.targetIds[0] !== a.target.targetId || context.requirement.id !== a.target.requirementId
        || context.planDigest !== a.output.record.planDigest || context.policyDigest !== a.target.policyDigest || context.requirementsDigest !== a.target.requirementsDigest
        || context.runId !== a.target.runId || policyIdentity(context.evidencePolicy)!==policyIdentity(expectedPolicy)) throw Error('generated_checker_observation_mismatch');
      const captured = manifest(context); if (sha(JSON.stringify({ ...captured, observedAt: 0 })) !== manifests.get(context.manifestDigest)) throw Error('generated_checker_manifest_changed');
      const bytes = Buffer.from(JSON.stringify({ version: 'cue-native-json-observation-v1', contextDigest: context.digest,
        attemptId: o.stage.attemptId, requestId: r.requestId, session: o.session, controlBundle: pins, targetDigest: a.target.targetDigest,
        producerAttemptId: a.producer.attempt_id, outputRecordDigest: a.output.record.digest, executedAt: o.measuredAt, verdict }));
      const observedAt = now(); validate(o, true); signal.throwIfAborted();
      issued.set(context.digest, { hash: sha(bytes), verdict: verdict.status });
      const evidenceTargets=context.targets.map(target=>({targetId:target.targetId,kind:target.kind,byteLength:target.sizeBytes,digest:target.digest}));
      return Object.freeze({ contextDigest: context.digest, principalId: principal, origin: 'host-observation' as const, observedAt,
        sourceRefs: Object.freeze(['cue-native-json-observation:' + sha(bytes), 'cue-generated-output:' + a.output.record.digest]), bytes,
        evidence:Object.freeze({origin:'host-observation' as const,checkerId:checker.id,checkerRevision:revision,checkerPrincipal:principal,
          producerAttemptPrincipal:context.producerPrincipals[0]??'',parametersDigest:context.check.parametersDigest,
          observedAtMs:observedAt,sourceRevision:context.evidencePolicy.sourceRevision,exitStatus:r.outcome==='succeeded'?0:1,targetManifestDigest:sha(JSON.stringify(evidenceTargets)),
          verdict:verdict.status,hostileChecks:Object.freeze([]),claimSourceMap:Object.freeze({}),requirementSections:Object.freeze(['json-document']),renderVerified:false,targets:Object.freeze(evidenceTargets)}) });
    },
    evaluate(context: CheckerContext, observation: Readonly<RawCheckerObservation>): AcceptanceVerdict {
      const proof = issued.get(context.digest), o = owned.get(context.verifierAttemptId);
      try { if (!o) return 'unknown'; validate(o, true); } catch { return 'unknown'; }
      return proof && observation.contextDigest === context.digest && observation.principalId === principal
        && observation.origin === 'host-observation' && proof.hash === sha(observation.bytes) ? proof.verdict : 'unknown';
    },
  });
  const manifests = new Map<string, string>();
  const acceptance = Object.freeze<AcceptanceHost>({ now, timeoutMs, maxObservationAgeMs: maxAge,
    resolveChecker: (id, rev) => id === checker.id && rev === revision ? checker : undefined,
    principalForAttempt(stage) {
      const o = owned.get(stage.attemptId);
      if (!o) return host.producerPrincipalForAttempt(stage);
      try { validate(o, false); return stage.envelopeHash === o.stage.envelopeHash ? principal : null; } catch { return null; }
    },
    async captureManifest(context, signal) {
      signal.throwIfAborted(); const value = manifest(context); signal.throwIfAborted();
      manifests.set(sha(JSON.stringify(value)), sha(JSON.stringify({ ...value, observedAt: 0 }))); return value;
    },
    isManifestCurrent(context, previous) {
      try { return sha(JSON.stringify({ ...manifest(context), observedAt: 0 })) === sha(JSON.stringify({ ...previous, observedAt: 0 })); } catch { return false; }
    },
  });
  return Object.freeze({ acceptance, requirementChecker(target:Parameters<typeof policyFor>[0]){
      const evidencePolicy=policyFor(target); return Object.freeze({id:GENERATED_JSON_CHECKER_ID,revision,kinds:Object.freeze(['document'] as const),evidencePolicies:Object.freeze([evidencePolicy])});
    },
    async launchVerifier(context: RuntimeContext): Promise<IsolatedJsonCheckerExecution> {
      context.signal.throwIfAborted(); const fingerprint = identity(context), stage = stages.read(context.runId);
      if (!stage || context.role !== 'model' || !/^[a-f0-9]{64}$/.test(context.subjectDigest)) throw Error('generated_checker_context');
      const run = runData(stage.workflowRunId,{revision:stage.revision,planDigest:stage.planDigest}), task = run.plan.tasks.find(task => task.id === stage.taskId), attempt = latest(stage.workflowRunId, stage.taskId,stage.revision);
      if (!task || task.role !== 'verifier' || task.requirementIds.length !== 1 || attempt.attempt_id !== context.runId || attempt.state !== 'running'
        || attempt.candidate_id !== context.candidateId || Date.parse(stage.envelope.expires_at) <= now()) throw Error('generated_checker_verifier_stage');
      const targets = db.prepare('SELECT target_id FROM generated_output_target WHERE run_id=?').all(stage.workflowRunId) as { target_id: string }[];
      const eligible = targets.map(t => outputs.readTarget(stage.workflowRunId, t.target_id)!).filter(t => task.requirementIds.includes(t.requirementId));
      if (eligible.length !== 1) throw Error('generated_checker_one_target');
      const a = artifact(stage.workflowRunId, eligible[0].targetId,stage.revision);
      if (launched.has(context.runId) || identity(context) !== fingerprint) throw Error('generated_checker_duplicate_or_drift');
      context.signal.throwIfAborted(); launched.add(context.runId);
      const execution = await host.launch(context, Object.freeze({ stage, target: a.target, inputBytes: Buffer.from(a.input.bytes), outputBytes: Buffer.from(a.output.bytes), controlBundle: pins }));
      if (execution?.result instanceof Promise) void execution.result.catch(() => {});
      if (execution?.completion instanceof Promise) void execution.completion.catch(() => {});
      if (!execution || executions.has(execution) || !(execution.result instanceof Promise) || !(execution.completion instanceof Promise) || typeof execution.cancel !== 'function') throw Error('generated_checker_execution');
      executions.add(execution);
      const session = Object.freeze(Object.fromEntries(sessionKeys.map(key => [key, execution.session[key]]))) as unknown as Readonly<SessionRecord>;
      const o: Owned = { context, identity: fingerprint, stage, target: a.target, producerAttemptId: a.producer.attempt_id,
        outputDigest: a.output.record.digest, session, execution, result: null, measuredAt: null }; owned.set(context.runId, o);
      const result = Promise.all([execution.result, execution.completion]).then(([raw, completed]) => {
        try {
          validate(o, false);
          if (raw.outcome !== completed) throw Error('generated_checker_completion_mismatch');
          const snapshot = Object.freeze({ ...raw, checkerVerdict: raw.checkerVerdict ? Object.freeze({ ...raw.checkerVerdict }) : null });
          o.result = snapshot; o.measuredAt = now(); validate(o, false); return snapshot;
        } catch { o.result = null; return Object.freeze({ ...raw, outcome: 'unknown' as const }); }
      });
      const completion = result.then(value => value.outcome, () => 'unknown' as const);
      return Object.freeze({ session, result, completion, cancel: execution.cancel.bind(execution) });
    },
  });
}
