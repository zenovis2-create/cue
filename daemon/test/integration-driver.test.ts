import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { openLedger, type Ledger } from '../src/ledger.js';
import { createBudgetManager } from '../src/budget.js';
import { envelopeHash, normalizeEnvelope } from '../src/envelope.js';
import { saveSelectionPolicy } from '../src/selection/policy-store.js';
import { createIntegrationCatalog } from '../src/integration-catalog.js';
import { SUBJECT_FIELDS, subjectDigest, type MeasurementSubject } from '../src/measurement-subject.js';
import { WRITE_PROBES, MODEL_PROBES } from '../src/capability-admission.js';
import { createOrchestrationDriver } from '../../app/orchestration-driver.mjs';
import { createGeneratedOutputStore, generatedOutputParametersDigest } from '../src/verification/generated-output.js';
import { readInitialDefault, readInitialDefaultAttempt } from '../src/selection/initial-default.js';
import { identifyChangeSnapshotRoot } from '../src/change-snapshot-host.js';
import { createStagedExistingFilePublicationHost } from '../../app/staged-existing-file-publication-host.mjs';

const roots: string[] = [], dbs: Ledger[] = [];
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); for (const db of dbs.splice(0)) db.close(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const time = Date.parse('2026-09-11T00:00:00.000Z');
function fixture(withAcceptance = false, withRetry = false, withRecovery = false, recoveryMode: 'manual'|'automatic-approved' = 'manual') {
  const root = mkdtempSync(join(tmpdir(), 'cue-driver-')); roots.push(root); const work = join(root, 'work'); mkdirSync(work);
  const db = openLedger(); dbs.push(db); for (const name of ['009_selection_policy.sql', '010_orchestration.sql', '012_stage_envelope.sql']) db.exec(readFileSync(resolve('migrations', name), 'utf8'));
  const envelope = normalizeEnvelope({ run_id: 'workflow', worktree_realpath: work, allowed_actions: ['file_change','read','list','search'], egress: [],
    expires_at: '2026-09-12T00:00:00.000Z', autonomy_level: 'bounded' });
  const run = { taskId: 'root-task', runId: 'workflow', envelopeHash: envelopeHash(envelope), envelope, autonomy: 3, copy: {}, goal: 'fixture goal', scope: 'code' };
  db.prepare("INSERT INTO task VALUES('root-task','awaiting_approval',NULL,'now')").run();
  db.prepare("INSERT INTO envelope VALUES(?,?,'[]','now')").run(run.envelopeHash, work);
  db.prepare("INSERT INTO run VALUES('workflow','root-task',?,0,'now')").run(run.envelopeHash);
  const policy = saveSelectionPolicy(db, { policyId: 'policy', expectedRevision: null, createdAt: new Date(time).toISOString(), sourceVersion: 'fixture', policy: {
    version: 'cue-selection-v1', mode: 'efficiency', qualityMinimum: 0.5, costBasis: 1, timeBasisMs: 1, currency: 'TEST', costLimit: null,
    remainingTimeMs: null, maxEstimateAgeMs: 100, allowedCandidateIds: withRecovery ? ['agent','agent-b'] : ['agent'], pinnedCandidateId: null,
  } });
  const subject = Object.fromEntries(SUBJECT_FIELDS.map(key => [key, key.endsWith('Sha256') ? 'a'.repeat(64) : key])) as MeasurementSubject;
  const providerReceiptBytes=Buffer.from('fixture provider terminal receipt'),providerReceiptDigest=createHash('sha256').update(providerReceiptBytes).digest('hex');
  // Fixture-only trusted evidence store. These bytes never enter production configuration.
  const evidence = new Map<string, Buffer>(), refs: Record<string, { id: string; sha256: string }> = {};
  for (const probe of [...WRITE_PROBES, ...MODEL_PROBES]) {
    const bytes = Buffer.from(JSON.stringify({ probe, subjectDigest: subjectDigest(subject), measuredAt: new Date(time - 1).toISOString(), kind: 'live', status: 'pass' }));
    evidence.set(probe, bytes); refs[probe] = { id: probe, sha256: createHash('sha256').update(bytes).digest('hex') };
  }
  const catalog = createIntegrationCatalog({ now: () => time, maxAgeMs: withRecovery?1000:100, currentSubjectDigest: () => subjectDigest(subject) }, ['agent',...(withRecovery?['agent-b']:[])].map(id => ({ canonicalId: id, toolId: 'fixture', kind: 'agent' as const, aliases: [],
    installation: 'installed' as const, protocol: 'verified' as const, authReference: `fixture-account-${id}`, authAvailable: true, sourceVersion: 'fixture', observedAt: new Date(time).toISOString(), subjectDigest: subjectDigest(subject), binding: null })));
  const truth = { cleanup: true, finish: true, admission: true, prepareAllowed: true, hold: false, pendingLaunch: false, launches: [] as string[], cancels: 0,
    failuresRemaining: 0, holdTasks: new Set<string>(), cancelledTasks: [] as string[], onLaunch: (_taskId:string) => {}, failTasks: new Set<string>(), failedAttempts: new Set<string>(), attemptIds: [] as string[], retryAllowed: true, collideFailedMaker: false,
    providerEvidence: false, providerReferences: null as any, initialObservation: null as any, deliveries: 0, deliveryInputs: [] as any[], onWaitAuthorize: () => {}, onFailure: () => {}, onRecovery: () => {}, recoveryCause:'transient' as string, priorCandidateEligible:true, clock:time, quotaResetAt:null as number|null, quotaAlternateAvailable:false };
  const acceptanceTruth = { mode: 'pass', captured: 0, checked: 0, finalized: 0, aborted: false, release: () => {} };
  let enteredCapture!: () => void;
  const captureEntered = new Promise<void>(resolve => { enteredCapture = resolve; });
  const releases = new Map<string, () => void>(); const signals = new Map<string, AbortSignal>(); let configuration: any;
  const publicationIdentity=identifyChangeSnapshotRoot(work);if(publicationIdentity.state!=='ok')throw Error('fixture_publication_identity');
  const executionRoots=new Map<string,string>();
  const host: any = {
    now: () => truth.clock, catalog,
    lifecycleEvidence:{timeoutMs:50,verify:async(request:any)=>({authenticated:true,final:true,...request,evidenceBase64:providerReceiptBytes.toString('base64'),evidenceSha256:providerReceiptDigest})},
    wait: { authorizeWaitRequest: () => true, authorizeResponder: () => { truth.onWaitAuthorize(); return true; }, authorizeResponseContent: (ref: string) => ref.startsWith('response-ref'),
      resolveResponseContent: (ref: string) => ref.startsWith('response-ref') ? Buffer.from(`response bytes:${ref}`) : null,
      authorizeCheckpoint: () => true, authorizeCheckpointContent: () => false, resolveCheckpointContent: () => null },
    deliverWaitResponse: async (input: any) => { truth.deliveries++; truth.deliveryInputs.push(input); return { dispatchId: input.dispatchId, attemptId: input.attemptId,
      identityId: input.identityId, durableRef: input.durableRef, contentSha256: input.contentSha256 }; },
    ...(withRecovery?{recovery:{
      observeFailure:()=>{truth.onRecovery();return {cause:truth.recoveryCause,sourceRef:'fixture-recovery-proof',observedAtMs:time,externalEffects:'not-applicable',retryableHostCode:truth.recoveryCause==='transient',quotaResetAtMs:truth.quotaResetAt,independentQualityFailure:truth.recoveryCause==='quality-failure',priorCandidateEligible:truth.priorCandidateEligible};},
      readObservation:(ref:string)=>ref==='fixture-recovery-proof'?Buffer.from('trusted recovery proof'):null,
      observeCandidate:()=>({authenticated:truth.recoveryCause!=='quota'||truth.quotaAlternateAvailable,capable:truth.recoveryCause!=='quota'||truth.quotaAlternateAvailable}),
    }}:{}),
    prepare: () => configuration,
    verifyFinalBilling: () => true,
    executionStaging:{inspectCleanRoot:()=>({worktreeRealpath:work,rootIdentity:publicationIdentity.identity,baseCommitId:'3'.repeat(40),cleanSnapshotSha256:'4'.repeat(64),trackedModified:[],staged:[],untracked:[],conflicted:[],detached:false,unborn:false,reparseFree:true}),factory:{protocol:'cue-attempt-staging-factory-v1',sha256:'5'.repeat(64),create:(input:any)=>{const execution=mkdtempSync(join(tmpdir(),'cue-driver-execution-'));roots.push(execution);executionRoots.set(input.attemptId,execution);for(const target of configuration.changeTargets??[]){const source=join(work,target.relativePath),destination=join(execution,target.relativePath);writeFileSync(destination,readFileSync(source));}const identity=identifyChangeSnapshotRoot(execution);if(identity.state!=='ok')throw Error('fixture_execution_identity');return{worktreeRealpath:execution,rootIdentity:identity.identity,reparseFree:true};},inspectRoot:(value:any)=>value,cleanup:(value:any)=>{rmSync(value.worktreeRealpath,{recursive:true,force:true});},inspectCleanup:(value:any)=>({rootAbsent:!existsSync(value.worktreeRealpath),metadataAbsent:true,evidenceSha256:'6'.repeat(64)})}},
    authority: { authorizePlan: () => truth.prepareAllowed, authorizeClaim: () => true, authorizeStage: () => true,
      verifyReceipt: (context: any, receipt: any) => { const identity=db.prepare('SELECT identity_id FROM orchestration_attempt_identity WHERE attempt_id=?').get(context.attemptId) as any;
        return { outcomeVerified: truth.finish, cleanupVerified: truth.cleanup,
          ...(truth.finish && truth.cleanup && identity ? { handoff: { handoffId: `handoff-${receipt.attemptId}`, identityId: identity.identity_id,
            artifacts: [{ kind: 'fixture', sourceRef: 'fixture-artifact' }] } } : {}) }; },
      authorizeHandoffArtifact: (sourceRef: string) => sourceRef === 'fixture-artifact',
      resolveHandoffArtifact: (sourceRef: string) => sourceRef === 'fixture-artifact' ? Buffer.from('fixture artifact bytes') : null,
      retry: { now: () => truth.clock, authorizeContract: () => true, classifyFailure: () => truth.retryAllowed
        ? { cause: 'transient', sourceRef: 'fixture-host-failure', sourceDigest: 'c'.repeat(64), observedAtMs: time } : null } },
    runtime: {
      evidence: { now: () => truth.clock, maxAgeMs: withRecovery?1000:100, resolveEvidence: (ref: any) => truth.admission ? evidence.get(ref.id) : undefined },
      authorizeRun: () => true,
      resolveCandidate: (_id: string, _attempt: string, _role: string, binding: any) => ({ kind: 'agent', supportedRoles: ['model', 'implementation'], cancellation: 'supported', usage: 'unsupported', availability: 'ready',stagedPublication:'attempt-owned-existing-files-v1',
        typedActivitySource:'host-codex-controller-v1',durableExecutionRef:'session-handle-v1',
        buildCurrentSubject: () => subject, evidenceReferences: () => refs,
        launch: async (context: any) => { signals.set(context.runId,context.signal); truth.onLaunch(binding.taskId); truth.launches.push(binding.taskId); truth.attemptIds.push(context.runId); expect(context.runId).toBe(binding.owner.run_id);
          if (truth.providerEvidence) await context.emitLifecycle({ kind: 'provider-terminal',
            data: { status: 'succeeded', receiptDigest: providerReceiptDigest },
            references: truth.providerReferences ?? [{ refType: 'turn', label: 'provider-receipt', reference: `opaque-${context.runId}` }] });
          if ((binding.taskId === 'make' || truth.failTasks.has(binding.taskId)) && truth.failuresRemaining > 0) { truth.failuresRemaining--; truth.failedAttempts.add(context.runId); }
          expect(db.prepare('SELECT stage_run_id FROM orchestration_stage_envelope WHERE attempt_id=?').get(context.runId)).toEqual({ stage_run_id: context.runId });
          const handle=`session-${context.runId}`;
          db.prepare('INSERT INTO session_handle VALUES(?,?,?,?,?,?)').run(handle,100+truth.launches.length,'fixture-start',binding.owner.cwd,binding.owner.task_id,binding.owner.run_id);
          const execution = { durableRef:`session:${handle}`, completion: (truth.hold || truth.holdTasks.has(binding.taskId)) ? new Promise(() => {}) : Promise.resolve(truth.failedAttempts.has(context.runId) ? 'failed' : 'succeeded'), cancel: async () => { truth.cancels++; truth.cancelledTasks.push(binding.taskId); } };
          if (truth.pendingLaunch) return new Promise(done => releases.set(context.runId, () => done(execution)));
          return execution; },
      }),
      verifyCleanup: async (context: any) => ({ runId: context.runId, subjectDigest: context.subjectDigest, result: truth.cleanup ? 'verified-clean' : 'unknown', evidenceRef: 'fixture-host-proof' }),
    },
    engine: {
      observeInitialSelection: () => truth.initialObservation,
      observeCandidates: () => ['agent',...(withRecovery?['agent-b']:[])].map(id=>({ id, checks: { eligible: true, authenticated: true, compatible: true, dataAllowed: true, resourceAvailable: true, quotaAvailable: true }, estimate: {
        scope: 'verified-completion-total', quality: 1, expectedCost: 1, conservativeMaxCost: 1, expectedTimeMs: 1, conservativeMaxTimeMs: 1, currency: 'TEST', source: 'fixture', observedAtMs: time } })),
      reservation: (context: any) => ({ runId: context.request.runId, attemptId: context.request.attemptId, requestId: context.request.requestId, currency: 'TEST', unit: 'micro', upperUnits: 10,
        source: 'explicit-fixture-mapping', observedAtMs: context.request.observedAtMs, scope: 'verified-completion-attempt-total' }),
      verifyBudgetMapping: () => true, authorizeExecution: () => true,
      receipts: (context: any) => {
        if (truth.failedAttempts.has(context.request.attemptId)) truth.onFailure();
        return { billing: null, execution: truth.finish ? { runId: context.request.runId, taskId: context.request.taskId, attemptId: context.request.attemptId,
          receiptId: `receipt-${context.request.attemptId}`, revision: 1, outcome: truth.failedAttempts.has(context.request.attemptId) ? 'failed' : 'succeeded',
          cleanup: truth.cleanup ? 'clean' : 'unknown', evidenceRef: 'fixture-host-proof', observedAtMs: time } : null };
      },
    },
    stage: (context: any) => ({ worktreeRealpath: work, allowedActions: configuration.changeTargets?.some((target:any)=>target.taskId===context.task.id) ? ['file_change'] : configuration.limits.maxParallelReadTasks > 1 ? ['read'] : [], egress: [],
      expiresAt: envelope.expires_at, autonomyLevel: 'bounded' }),
  };
  configuration = { policy: { policyId: 'policy', revision: 1, digest: policy.digest }, requirementIds: ['req'], recoveryMode,
    proposedPlan: { revision: 'plan1', policyRevision: 'policy:1', policyDigest: policy.digest, tasks: [
      { id: 'make', role: 'implementation', ownerId: 'maker', requirementIds: ['req'], dependencyIds: [], candidateIds: withRecovery?['agent','agent-b']:['agent'], scopeIds: ['work'] },
      { id: 'check', role: 'verifier', ownerId: 'checker', requirementIds: ['req'], dependencyIds: ['make'], candidateIds: withRecovery?['agent','agent-b']:['agent'], scopeIds: [] },
    ] }, scopes: [{ id: 'work', worktreeRealpath: work, allowedActions: ['file_change','read','list','search'], egress: [] }],
    budget: { runId: 'workflow', currency: 'TEST', unit: 'micro', limitUnits: 100, policyRevision: 'policy:1', source: 'fixture-explicit', observedAtMs: time },
    limits: { launchTimeoutMs: 50, taskTimeoutMs: 100, pollMs: 2 } };
  host.finalPublication=createStagedExistingFilePublicationHost({db,authorizePublication:()=>true});
  if (withAcceptance) {
    configuration.requirements = [{ id: 'req', text: 'Required artifact passes the registered check', kind: 'code', required: true,
      checks: [{ checkerId: 'tests', revision: 'v1', parametersDigest: 'a'.repeat(64), targetIds: ['workspace'] }] }];
    // Deterministic test host only; no model verdict or production source proof.
    host.acceptance = {
      now: () => time, timeoutMs: withRetry ? 1000 : 100, maxObservationAgeMs: 1000,
      principalForAttempt: (stage: any) => truth.collideFailedMaker && truth.failedAttempts.has(stage.attemptId)
        ? 'actual-reviewer' : stage.taskId === 'make' ? 'actual-maker' : 'actual-reviewer',
      captureManifest: async (context: any, signal: AbortSignal) => {
        acceptanceTruth.captured++; enteredCapture();
        signal.addEventListener('abort', () => { acceptanceTruth.aborted = true; }, { once: true });
        const manifest = { ...context, observedAt: time, artifacts: [{ targetId: 'workspace', digest: 'b'.repeat(64), sizeBytes: 10,
          sourceRef: 'fixture:artifact', kind: 'filesystem' }] };
        if (acceptanceTruth.mode === 'hang') return new Promise(resolve => { acceptanceTruth.release = () => resolve(manifest); });
        return manifest;
      },
      resolveChecker: () => ({ id: 'tests', revision: 'v1', kinds: ['code'], evidencePolicies:[{requirementId:'req',kind:'code',producerTaskIds:['make'],sourceRevision:'approved-workspace-source',targetIds:['workspace'],checkerId:'tests',checkerRevision:'v1',parametersDigest:'a'.repeat(64),hostileCheckIds:['negative'],requiredSectionIds:[],claimIds:[],requiresRender:false}],
        collect: async (context: any) => { acceptanceTruth.checked++; return { contextDigest: context.digest,
          principalId: context.reviewerPrincipal, observedAt: time, sourceRefs: ['fixture:host-observation'],
          origin: acceptanceTruth.mode === 'unknown' ? 'model-report' : 'host-observation', bytes: Buffer.from('measured-fixture'),evidence:{origin:'host-observation',checkerId:'tests',checkerRevision:'v1',checkerPrincipal:context.reviewerPrincipal,producerAttemptPrincipal:'actual-maker',parametersDigest:'a'.repeat(64),observedAtMs:time,sourceRevision:context.evidencePolicy.sourceRevision,exitStatus:0,targetManifestDigest:createHash('sha256').update(JSON.stringify(context.targets.map((target:any)=>({targetId:target.targetId,kind:target.kind,byteLength:target.sizeBytes,digest:target.digest})))).digest('hex'),verdict:'pass',hostileChecks:['negative'],claimSourceMap:{},requirementSections:[],renderVerified:false,targets:context.targets.map((target:any)=>({targetId:target.targetId,kind:target.kind,byteLength:target.sizeBytes,digest:target.digest}))} }; },
        evaluate: (_context: any, raw: any) => Buffer.from(raw.bytes).toString() === 'measured-fixture' ? 'pass' : 'unknown',
      }),
      isManifestCurrent: () => { acceptanceTruth.finalized++; return true; },
    };
  }
  if (withRetry) configuration.retry = { maxAttemptsPerTask: 3, maxAttemptsTotal: 4, deadlineMs: time + 1000 };
  const driver = createOrchestrationDriver({ db, host });
  const approve = () => db.prepare("INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,approval_id,request_ordinal,decision,created_at) VALUES('workflow',?,'desktop','goal','approval',0,'accept','now')").run(run.envelopeHash);
  return { db, driver, host, run, truth, configuration, approve, releases, signals, acceptanceTruth, captureEntered };
}
function enableWritableTarget(f:ReturnType<typeof fixture>,taskId='make'){
  const relativePath='journal-target.txt',target=join(f.run.envelope.worktree_realpath,relativePath);writeFileSync(target,'before');
  f.configuration.changeTargets=[{taskId,targetId:'workspace-change',relativePath,maxBackupBytes:1024}];f.configuration.stagedPublication=true;f.configuration.executionStaging=true;return target;
}
function generatedFixture(withRetry = false) {
  const f = fixture(false, withRetry);
  f.configuration.proposedPlan.tasks[0].role = 'model-producer';
  f.configuration.proposedPlan.tasks[0].scopeIds = [];
  delete f.configuration.changeTargets;
  const output = { targetId: 'formatted', requirementId: 'req', producerTaskId: 'make', checkerId: 'json-format', checkerRevision: 'v1', inputText: '{"비밀":1}', maxBytes: 1024 };
  f.configuration.generatedOutputs = [output];
  const parametersDigest = generatedOutputParametersDigest({ version: 'cue-generated-output-v1', kind: 'generated-output',
    targetId: output.targetId, requirementId: output.requirementId, producerTaskId: output.producerTaskId,
    checkerId: output.checkerId, checkerRevision: output.checkerRevision,
    inputSha256: createHash('sha256').update(output.inputText).digest('hex'), maxBytes: output.maxBytes });
  f.host.resolveRequirementChecker = () => ({ id: 'json-format', revision: 'v1', kinds: ['document'],evidencePolicies:[{requirementId:'req',kind:'document',producerTaskIds:['make'],sourceRevision:'approved-json-input',targetIds:[output.targetId],checkerId:output.checkerId,checkerRevision:output.checkerRevision,parametersDigest,hostileCheckIds:[],requiredSectionIds:['json-document'],claimIds:[],requiresRender:false}] });
  f.configuration.requirements = [{ id: 'req', text: 'Format JSON preserving values', kind: 'document', required: true,
    checks: [{ checkerId: output.checkerId, revision: output.checkerRevision, parametersDigest, targetIds: [output.targetId] }] }];
  return f;
}

const initialDefaultPreparation = () => ({ defaultCandidateId: 'agent', conservativeEstimate: {
  scope: 'verified-completion-total' as const, quality: 1, expectedCost: 4, conservativeMaxCost: 7,
  expectedTimeMs: 20, conservativeMaxTimeMs: 30, currency: 'TEST', source: 'fixture-default-estimate', observedAtMs: time,
}, source: 'fixture-trusted-default', boundAtMs: time });

const explorationPreparation = () => ({ candidateId:'agent',limitUnits:10,taskIds:['make'],authorizedAt:new Date(time).toISOString(),sourceVersion:'fixture-exploration-v1' });

describe('explicit exploration consent and dispatch', () => {
  it('keeps a grant inert until explicit consent, then flags only approved task membership and charges both budgets once', async () => {
    const denied=fixture(true);denied.configuration.exploration=explorationPreparation();const deniedSummary=denied.driver.prepare(denied.run);
    expect(deniedSummary.exploration).toMatchObject({candidateId:'agent',limitUnits:10,currency:'TEST',unit:'micro',taskIds:['make']});
    expect(Object.isFrozen(deniedSummary.exploration)).toBe(true);
    denied.approve();expect(()=>denied.driver.activate(denied.run)).toThrow('exploration_consent_required');expect(denied.truth.launches).toEqual([]);

    const f=fixture(true);f.configuration.exploration=explorationPreparation();const summary=f.driver.prepare(f.run);
    expect(()=>f.driver.approveExploration(f.run.runId)).toThrow('driver_exploration_transaction_required');
    const consent=f.db.transaction(()=>{const value=f.driver.approveExploration(f.run.runId);f.approve();return value;})();
    expect(consent).toEqual({consentDigest:summary.exploration!.consentDigest,replay:false});
    f.driver.activate(f.run);await f.driver.start(f.run);
    expect(f.truth.launches).toEqual(['make','check']);
    expect(f.db.prepare('SELECT a.task_id FROM exploration_budget_reservation er JOIN orchestration_attempt a ON a.run_id=er.run_id AND a.attempt_id=er.attempt_id').all()).toEqual([{task_id:'make'}]);
    expect(f.db.prepare('SELECT SUM(upper_units) n FROM integration_budget_reservation').get()).toEqual({n:20});
    expect(f.db.prepare('SELECT SUM(upper_units) n FROM exploration_budget_reservation').get()).toEqual({n:10});
  });

  it('refuses start when explicit consent disappears after activation', async () => {
    const f = fixture(true); f.configuration.exploration = explorationPreparation(); f.driver.prepare(f.run);
    f.db.transaction(() => { f.driver.approveExploration(f.run.runId); f.approve(); })();
    f.driver.activate(f.run);
    const guard = f.db.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name='exploration_consent_no_delete'").get() as { sql: string };
    f.db.exec('DROP TRIGGER exploration_consent_no_delete');
    f.db.prepare("DELETE FROM exploration_consent WHERE run_id='workflow'").run(); f.db.exec(guard.sql);
    let thrown: unknown; let started: Promise<void> | undefined;
    try { started = f.driver.start(f.run); } catch (error) { thrown = error; }
    if (started) await started;
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe('exploration_consent_required');
    expect(f.truth.launches).toEqual([]);
    expect(f.db.prepare('SELECT count(*) n FROM integration_budget_reservation').get()).toEqual({ n: 0 });
    expect(f.db.prepare('SELECT count(*) n FROM exploration_budget_reservation').get()).toEqual({ n: 0 });
  });
  it('rejects local/conflicting/tampered membership and replays exact consent idempotently', () => {
    const conflict=fixture();conflict.configuration.initialDefault=initialDefaultPreparation();conflict.configuration.exploration=explorationPreparation();
    expect(()=>conflict.driver.prepare(conflict.run)).toThrow('driver_exploration_initial_default_conflict');
    expect(conflict.db.prepare('SELECT count(*) n FROM exploration_budget_authorization').get()).toEqual({n:0});

    const invalid=fixture();invalid.configuration.exploration={...explorationPreparation(),taskIds:['make','check']};
    expect(()=>invalid.driver.prepare(invalid.run)).toThrow('driver_exploration_tasks_invalid');

    const f=fixture();f.configuration.exploration=explorationPreparation();const summary=f.driver.prepare(f.run);
    const replay=f.db.transaction(()=>{f.driver.approveExploration(f.run.runId);return f.driver.approveExploration(f.run.runId);})();
    expect(replay).toEqual({consentDigest:summary.exploration!.consentDigest,replay:true});
    expect(()=>f.db.prepare("UPDATE exploration_consent SET candidate_id='agent-b' WHERE run_id='workflow'").run()).toThrow('exploration consent immutable');
  });
});

describe('trusted host initial-default preparation', () => {
  it('binds a frozen canonical default and drives a no-statistics claim through the actual driver', async () => {
    const f = fixture(); const configured = initialDefaultPreparation(); f.configuration.initialDefault = configured;
    f.host.engine.observeCandidates = () => [{ id: 'agent', checks: { eligible: true, authenticated: true, compatible: true,
      dataAllowed: true, resourceAvailable: true, quotaAvailable: true }, estimate: null }];
    f.truth.initialObservation = { version: 'cue-initial-observation-v1', candidateId: 'agent',
      disposition: 'no-statistics', source: 'fixture-no-statistics', observedAtMs: time };
    const summary = f.driver.prepare(f.run);
    expect(summary.initialDefault).toMatchObject({ candidateId: 'agent', conservativeMaxCost: 7, conservativeMaxTimeMs: 30, currency: 'TEST' });
    expect(summary.initialDefault!.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.isFrozen(summary.initialDefault)).toBe(true);
    configured.defaultCandidateId = 'mutated'; configured.conservativeEstimate.conservativeMaxCost = 99;
    expect(f.driver.prepare(f.run)).toBe(summary);
    expect(readInitialDefault(f.db, f.run.runId)).toMatchObject({ defaultCandidateId: 'agent', conservativeEstimate: { conservativeMaxCost: 7 } });
    f.approve(); f.driver.activate(f.run); await f.driver.start(f.run);
    const marker = f.db.prepare('SELECT attempt_id FROM initial_default_attempt ORDER BY rowid LIMIT 1').get() as {attempt_id:string};
    expect(readInitialDefaultAttempt(f.db, marker.attempt_id)).toMatchObject({ disposition: 'no-statistics', candidateId: 'agent', defaultDigest: summary.initialDefault!.digest });
  });

  it('accepts exact reopen, refuses changed or omitted reopen, and rejects foreign/accessor input before effects', () => {
    const exact = fixture(); delete exact.configuration.changeTargets; exact.configuration.initialDefault = initialDefaultPreparation(); const summary = exact.driver.prepare(exact.run);
    expect(createOrchestrationDriver({ db: exact.db, host: exact.host }).prepare(exact.run).initialDefault).toEqual(summary.initialDefault);
    exact.configuration.initialDefault = { ...initialDefaultPreparation(), source: 'changed-default' };
    expect(() => createOrchestrationDriver({ db: exact.db, host: exact.host }).prepare(exact.run)).toThrow('initial_default_binding_conflict');
    delete exact.configuration.initialDefault;
    expect(() => createOrchestrationDriver({ db: exact.db, host: exact.host }).prepare(exact.run)).toThrow('driver_initial_default_mismatch');

    for (const hostile of [
      { ...initialDefaultPreparation(), runId: 'foreign-run' },
      Object.defineProperty({}, 'defaultCandidateId', { enumerable: true, get() { throw Error('accessed'); } }),
    ]) {
      const f = fixture(); f.configuration.initialDefault = hostile;
      expect(() => f.driver.prepare(f.run)).toThrow();
      for (const table of ['selection_run_policy', 'integration_budget', 'orchestration_plan', 'initial_default']) {
        expect(f.db.prepare(`SELECT count(*) n FROM ${table}`).get()).toEqual({ n: 0 });
      }
    }
  });

  it('rolls the bound default back when a later preparation step fails and keeps legacy absence', () => {
    const failed = fixture(); failed.configuration.initialDefault = initialDefaultPreparation();
    failed.configuration.generatedOutputs = [];
    expect(() => failed.driver.prepare(failed.run)).toThrow('driver_generated_targets_invalid');
    for (const table of ['selection_run_policy', 'integration_budget', 'orchestration_plan', 'initial_default']) {
      expect(failed.db.prepare(`SELECT count(*) n FROM ${table}`).get()).toEqual({ n: 0 });
    }
    const legacy = fixture(); expect(legacy.driver.prepare(legacy.run)).not.toHaveProperty('initialDefault');
    expect(readInitialDefault(legacy.db, legacy.run.runId)).toBeNull();
  });
});

describe('durable catalog account identity',()=>{
  it('rejects endpoint drift even with unchanged credential and subject',()=>{
    const f=fixture(),original=f.host.catalog;let endpoint='endpoint-a';
    f.host.catalog={...original,lookup(id:string){const found=original.lookup(id);return found.record?{...found,record:{...found.record,binding:{endpointId:endpoint,modelId:'fixture-model'}}}:found;}};
    f.driver.prepare(f.run);f.approve();endpoint='endpoint-b';expect(()=>f.driver.activate(f.run)).toThrow('driver_account_identity_mismatch');expect(f.truth.launches).toEqual([]);
  });
  it('rechecks account after the final host clock callback at launch',async()=>{
    const f=fixture(),original=f.host.catalog;let drift=false,armed=false,lateCalls=0;
    f.host.catalog={...original,lookup(id:string){const found=original.lookup(id);return drift&&found.record?{...found,record:{...found.record,authReference:'changed-account'}}:found;}};
    const resolve=f.host.runtime.resolveCandidate;
    f.host.runtime.resolveCandidate=(...args:any[])=>{const candidate=resolve(...args),evidence=candidate.evidenceReferences.bind(candidate);return {...candidate,evidenceReferences(){const result=evidence();armed=true;return result;}};};
    f.host.now=()=>{if(armed){lateCalls++;drift=true;}return time;};
    f.driver.prepare(f.run);f.approve();f.driver.activate(f.run);await f.driver.start(f.run);
    expect(lateCalls).toBeGreaterThan(0);expect(f.truth.launches).toEqual([]);expect(f.db.prepare('SELECT count(*) n FROM session_handle').get()).toEqual({n:0});expect(()=>f.driver.snapshot('workflow')).toThrow('driver_account_identity_mismatch');expect(f.db.prepare('SELECT state FROM task WHERE id=?').get(f.run.taskId)).toEqual({state:'blocked'});
  });
  it('retains the exact account-bound launch context through cleanup',async()=>{
    const f=generatedFixture(), originalResolve=f.host.runtime.resolveCandidate, originalCleanup=f.host.runtime.verifyCleanup;
    const contexts=new Map<string,any>();
    f.host.runtime.resolveCandidate=(...args:any[])=>{const candidate=originalResolve(...args);return {...candidate,launch(context:any){
      const binding=f.db.prepare('SELECT digest,payload FROM orchestration_account_identity WHERE run_id=? AND candidate_id=?').get(f.run.runId,context.candidateId) as any;
      expect(context.accountIdentity).toEqual({reference:JSON.parse(binding.payload.toString()).authReference,digest:binding.digest});
      expect(Object.isFrozen(context.accountIdentity)).toBe(true);contexts.set(context.runId,context);return candidate.launch(context);
    }};};
    f.host.runtime.verifyCleanup=(context:any,execution:any)=>{expect(context).toBe(contexts.get(context.runId));return originalCleanup(context,execution);};
    f.driver.prepare(f.run);f.approve();f.driver.activate(f.run);await f.driver.start(f.run);expect(contexts.size).toBe(2);await f.driver.close();
  });
  it('exact monetary reopen retains binding but foreign credential reopen refuses',async()=>{
    const f=generatedFixture();f.driver.prepare(f.run);const before=f.db.prepare('SELECT digest FROM orchestration_account_identity').all();
    const reopened=createOrchestrationDriver({db:f.db,host:f.host});expect(reopened.prepare(f.run).stageCount).toBe(2);expect(f.db.prepare('SELECT digest FROM orchestration_account_identity').all()).toEqual(before);await reopened.close();
    const original=f.host.catalog;f.host.catalog={...original,lookup(id:string){const found=original.lookup(id);return found.record?{...found,record:{...found.record,authReference:'foreign-account'}}:found;}};
    const changed=createOrchestrationDriver({db:f.db,host:f.host});expect(()=>changed.prepare(f.run)).toThrow('account_identity_conflict');expect(f.truth.launches).toEqual([]);await changed.close();
  });

  it('binds every planned candidate and refuses catalog account drift before activation',()=>{const f=fixture();const summary=f.driver.prepare(f.run);expect(summary.stageCount).toBe(2);expect(f.db.prepare('SELECT candidate_id FROM orchestration_account_identity WHERE run_id=?').all(f.run.runId)).toEqual([{candidate_id:'agent'}]);const original=f.host.catalog;f.host.catalog={...original,lookup(id:string){const found=original.lookup(id);return found.record?{...found,record:{...found.record,authReference:'changed-account'}}:found;}};f.approve();expect(()=>f.driver.activate(f.run)).toThrow('driver_account_identity_mismatch');expect(f.truth.launches).toEqual([]);});
});

describe('protected failed-start context',()=>{
  it('passes the exact enriched launch context to optional failed-start cleanup',async()=>{const f=fixture();let launched:any,cleaned:any;const resolve=f.host.runtime.resolveCandidate.bind(f.host.runtime);f.host.runtime.resolveCandidate=(...args:any[])=>{const candidate=resolve(...args);return candidate&&{...candidate,async launch(context:any){launched=context;throw Error('synthetic-start-failure');}}};f.host.runtime.verifyFailedStartCleanup=async(context:any)=>{cleaned=context;return{runId:context.runId,subjectDigest:context.subjectDigest,result:'verified-clean',evidenceRef:'fixture-failed-start-clean'};};const driver=createOrchestrationDriver({db:f.db,host:f.host});driver.prepare(f.run);f.approve();driver.activate(f.run);await driver.start(f.run);expect(cleaned).toBe(launched);expect(launched.accountIdentity.reference).toBe('fixture-account-agent');expect(launched.accountIdentity.digest).toMatch(/^[a-f0-9]{64}$/);expect(f.truth.launches).toEqual([]);});
});

describe('S4 generated output preparation', () => {
  it('binds actual input before approval, projects only immutable metadata, and preserves retry terms', async () => {
    const f = generatedFixture(true), summary = f.driver.prepare(f.run);
    const target = summary.generatedOutputs![0];
    expect(target).toMatchObject({ targetId: 'formatted', requirementId: 'req', producerTaskId: 'make', checkerId: 'json-format',
      checkerRevision: 'v1', inputByteLength: Buffer.byteLength(f.configuration.generatedOutputs[0].inputText), maxBytes: 1024 });
    expect(target.inputSha256).toMatch(/^[a-f0-9]{64}$/); expect(target.targetDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(Object.isFrozen(summary.generatedOutputs)).toBe(true); expect(Object.isFrozen(target)).toBe(true);
    expect(JSON.stringify(summary)).not.toContain('비밀'); expect(target).not.toHaveProperty('inputText');
    const stored = createGeneratedOutputStore(f.db, { now: () => time, authorizeObservation: () => false }).readInput(f.run.runId, 'formatted')!;
    expect(Buffer.from(stored.bytes).toString()).toBe(f.configuration.generatedOutputs[0].inputText);
    expect(stored.target).toMatchObject({ runId: f.run.runId, boundAtMs: time, targetDigest: target.targetDigest });
    expect(summary.retry?.contractDigest).toMatch(/^[a-f0-9]{64}$/);
    f.configuration.generatedOutputs[0].inputText = 'mutated';
    expect(f.driver.prepare(f.run)).toBe(summary);
    f.approve(); expect(f.driver.activate(f.run).started).toBe(true); await f.driver.close();
  });
  it('rolls back a malformed second target with policy, criteria, budget and plan and launches nothing', async () => {
    const f = generatedFixture(); f.configuration.generatedOutputs.push({ ...f.configuration.generatedOutputs[0], targetId: 'other' });
    expect(() => f.driver.prepare(f.run)).toThrow();
    for (const table of ['generated_output_target', 'requirement_contract_binding', 'orchestration_plan', 'integration_budget']) {
      expect(f.db.prepare(`SELECT count(*) AS n FROM ${table}`).get()).toEqual({ n: 0 });
    }
    expect(f.truth.launches).toEqual([]); expect(() => f.driver.activate(f.run)).toThrow('driver_prepare_missing');
    f.configuration.generatedOutputs.pop(); expect(f.driver.prepare(f.run).generatedOutputs).toHaveLength(1); await f.driver.close();
  });
  it('rejects late binding after approval', async () => {
    const f = generatedFixture(); f.approve(); expect(() => f.driver.prepare(f.run)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM generated_output_target').get()).toEqual({ n: 0 });
    expect(f.truth.launches).toEqual([]); await f.driver.close();
  });
  it('rejects corrupted persisted target on both replay and activation', async () => {
    const f = generatedFixture(); f.driver.prepare(f.run); f.approve();
    f.db.exec('DROP TRIGGER generated_target_no_update');
    f.db.prepare('UPDATE generated_output_target SET input_bytes=?').run(Buffer.from('corrupt'));
    expect(() => f.driver.prepare(f.run)).toThrow(); expect(() => f.driver.activate(f.run)).toThrow();
    expect(f.truth.launches).toEqual([]); await expect(f.driver.close()).rejects.toThrow();
  });
  it('rejects missing persisted targets and preserves absent legacy summary field', async () => {
    const f = generatedFixture(); f.driver.prepare(f.run);
    f.db.exec('DROP TRIGGER generated_target_no_delete'); f.db.exec('DELETE FROM generated_output_target');
    expect(() => f.driver.prepare(f.run)).toThrow('driver_generated_target_set_mismatch'); await expect(f.driver.close()).rejects.toThrow('driver_generated_target_set_mismatch');
    const legacy = fixture(); expect(legacy.driver.prepare(legacy.run)).not.toHaveProperty('generatedOutputs'); await legacy.driver.close();
  });
  it('rejects nontext, duplicate, empty, unpaired Unicode and unknown target fields', async () => {
    for (const mutation of [
      (f: any) => { f.configuration.generatedOutputs[0].inputText = 12; },
      (f: any) => { f.configuration.generatedOutputs.push({ ...f.configuration.generatedOutputs[0] }); },
      (f: any) => { f.configuration.generatedOutputs[0].inputText = ''; },
      (f: any) => { f.configuration.generatedOutputs[0].inputText = '\ud800'; },
      (f: any) => { f.configuration.generatedOutputs[0].runId = 'foreign'; },
    ]) {
      const f = generatedFixture(); mutation(f); expect(() => f.driver.prepare(f.run)).toThrow();
      expect(f.db.prepare('SELECT count(*) AS n FROM generated_output_target').get()).toEqual({ n: 0 }); await f.driver.close();
    }
  });
});

describe('S3 actual main-process orchestration driver', () => {
  function enableParallelReaders(f: ReturnType<typeof fixture>, cap = 2) {
    f.configuration.limits.maxParallelReadTasks = cap; f.configuration.limits.launchTimeoutMs=1000; f.configuration.limits.taskTimeoutMs=1000;
    f.configuration.requirementIds = ['req-a','req-b'];
    f.configuration.proposedPlan.tasks = [
      { id:'read-a',role:'model-producer',ownerId:'reader-a',requirementIds:['req-a'],dependencyIds:[],candidateIds:['agent'],scopeIds:['work'] },
      { id:'read-b',role:'model-producer',ownerId:'reader-b',requirementIds:['req-b'],dependencyIds:[],candidateIds:['agent'],scopeIds:['work'] },
      { id:'check',role:'verifier',ownerId:'checker',requirementIds:['req-a','req-b'],dependencyIds:['read-a','read-b'],candidateIds:['agent'],scopeIds:['work'] },
    ];
    delete f.configuration.changeTargets;
  }
  it('keeps explicit exploration membership through a concurrent read wave and replay', async () => {
    const f = fixture(); enableParallelReaders(f); f.truth.pendingLaunch = true;
    f.configuration.exploration = { ...explorationPreparation(), taskIds: ['read-a'] };
    f.driver.prepare(f.run);
    f.db.transaction(() => { f.driver.approveExploration(f.run.runId); f.approve(); })();
    f.driver.activate(f.run); const started = f.driver.start(f.run);
    await expect.poll(() => f.truth.launches.length).toBe(2);
    expect(new Set(f.truth.launches)).toEqual(new Set(['read-a', 'read-b']));
    expect(f.db.prepare('SELECT a.task_id FROM exploration_budget_reservation er JOIN orchestration_attempt a ON a.run_id=er.run_id AND a.attempt_id=er.attempt_id').all()).toEqual([{ task_id: 'read-a' }]);
    f.truth.pendingLaunch = false; for (const release of [...f.releases.values()]) release(); await started;
    expect(f.truth.launches).toEqual(['read-a', 'read-b', 'check']);
    expect(f.db.prepare('SELECT SUM(upper_units) n FROM exploration_budget_reservation').get()).toEqual({ n: 10 });
    expect(f.db.prepare('SELECT SUM(upper_units) n FROM integration_budget_reservation').get()).toEqual({ n: 30 });
    await f.driver.start(f.run); expect(f.truth.launches).toHaveLength(3); await f.driver.close();
  });
  it('preserves explicit exploration on a same-candidate retry and never charges replay again', async () => {
    const f = fixture(true, true); f.truth.failuresRemaining = 1;
    f.configuration.exploration = { ...explorationPreparation(), limitUnits: 20 };
    f.driver.prepare(f.run);
    f.db.transaction(() => { f.driver.approveExploration(f.run.runId); f.approve(); })();
    f.driver.activate(f.run); await f.driver.start(f.run);
    expect(f.truth.launches).toEqual(['make', 'make', 'check']);
    expect(f.db.prepare('SELECT a.task_id,a.candidate_id FROM exploration_budget_reservation er JOIN orchestration_attempt a ON a.run_id=er.run_id AND a.attempt_id=er.attempt_id ORDER BY er.rowid').all()).toEqual([{ task_id: 'make', candidate_id: 'agent' }, { task_id: 'make', candidate_id: 'agent' }]);
    expect(f.db.prepare('SELECT SUM(upper_units) n FROM exploration_budget_reservation').get()).toEqual({ n: 20 });
    expect(f.db.prepare('SELECT SUM(upper_units) n FROM integration_budget_reservation').get()).toEqual({ n: 30 });
    expect(f.driver.snapshot('workflow')).toMatchObject({ state: 'completed', acceptance: 'verified' });
    await f.driver.start(f.run); expect(f.truth.launches).toHaveLength(3); await f.driver.close();
  });
  it('runs an approved bounded read wave concurrently and waits for both before the verifier', async () => {
    const f=fixture();enableParallelReaders(f);f.truth.pendingLaunch=true;
    const summary=f.driver.prepare(f.run);expect(summary.maxParallelReadTasks).toBe(2);f.approve();f.driver.activate(f.run);const started=f.driver.start(f.run);
    await expect.poll(()=>f.truth.launches.length).toBe(2);
    expect(new Set(f.truth.launches)).toEqual(new Set(['read-a','read-b']));
    expect(f.db.prepare("SELECT COUNT(*) n FROM orchestration_attempt WHERE state='running'").get()).toEqual({n:2});
    expect(f.db.prepare('SELECT COUNT(*) n FROM orchestration_stage_envelope').get()).toEqual({n:2});
    expect(f.db.prepare('SELECT COUNT(*) n FROM workspace_write_lease').get()).toEqual({n:0});
    expect(f.db.prepare('SELECT SUM(upper_units) n FROM integration_budget_reservation').get()).toEqual({n:20});
    f.truth.pendingLaunch=false;for(const release of [...f.releases.values()])release();await started;
    expect(f.truth.launches).toEqual(['read-a','read-b','check']);
    expect(f.driver.snapshot('workflow')).toMatchObject({state:'blocked',reason:'acceptance_unverified'});await f.driver.close();
  });
  it('routes parallel wait responses to each owned handle once and never resends after reopen', async () => {
    const f=fixture();enableParallelReaders(f);f.truth.holdTasks.add('read-a');f.truth.holdTasks.add('read-b');
    f.driver.prepare(f.run);f.approve();f.driver.activate(f.run);const started=f.driver.start(f.run);await expect.poll(()=>f.truth.launches.length).toBe(2);await new Promise(done=>setImmediate(done));
    const rows=f.db.prepare(`SELECT a.task_id,a.attempt_id,i.identity_id,i.durable_ref FROM orchestration_attempt a
      JOIN orchestration_attempt_identity i ON i.attempt_id=a.attempt_id ORDER BY a.task_id`).all() as any[];
    expect(rows.map(row=>row.task_id)).toEqual(['read-a','read-b']);
    for(const [index,row] of rows.entries()){
      const ordinal=index+1,requestId=`parallel-wait-${ordinal}`,responseId=`parallel-response-${ordinal}`,contentRef=`response-ref-${row.task_id}`;
      f.driver.waitRequest({requestId,runId:'workflow',taskId:row.task_id,attemptId:row.attempt_id,identityId:row.identity_id,requestOrdinal:1,streamId:`stream-${ordinal}`,reason:'external-response',responseSchema:'cue-wait-response-v1',createdAtMs:time,deadlineAtMs:time+1000,expectedResponder:{id:'fixture-responder',revision:'v1'}});
      f.driver.waitResponse({eventId:`parallel-event-${ordinal}`,requestId,responseId,responseOrdinal:1,responder:{id:'fixture-responder',revision:'v1'},contentRef,observedAtMs:time});
      await expect(f.driver.deliverWaitResponse({requestId,responseId,claimedAtMs:time})).resolves.toMatchObject({delivery:'delivered-observed',newlyClaimed:true,attemptId:row.attempt_id,identityId:row.identity_id,durableRef:row.durable_ref});
    }
    expect(f.truth.deliveryInputs.map(({attemptId,identityId,durableRef,contentRef,contentBytes}:any)=>({attemptId,identityId,durableRef,contentRef,content:Buffer.from(contentBytes).toString()}))).toEqual(rows.map(row=>({attemptId:row.attempt_id,identityId:row.identity_id,durableRef:row.durable_ref,contentRef:`response-ref-${row.task_id}`,content:`response bytes:response-ref-${row.task_id}`})));
    const reopened=createOrchestrationDriver({db:f.db,host:f.host});
    for(const [index] of rows.entries())await expect(reopened.deliverWaitResponse({requestId:`parallel-wait-${index+1}`,responseId:`parallel-response-${index+1}`,claimedAtMs:time})).resolves.toMatchObject({delivery:'delivered-observed',newlyClaimed:false});
    expect(f.truth.deliveries).toBe(2);f.driver.stop('workflow');await started;await expect(f.driver.close()).rejects.toThrow('cleanup_unverified');await reopened.close();
  });
  it('keeps a synchronously cancelled parallel wait claim unresolved without host delivery', async () => {
    const f=fixture();enableParallelReaders(f);f.truth.holdTasks.add('read-a');f.truth.holdTasks.add('read-b');
    f.driver.prepare(f.run);f.approve();f.driver.activate(f.run);const started=f.driver.start(f.run);await expect.poll(()=>f.truth.launches.length).toBe(2);
    const row=f.db.prepare(`SELECT a.task_id,a.attempt_id,i.identity_id FROM orchestration_attempt a JOIN orchestration_attempt_identity i ON i.attempt_id=a.attempt_id WHERE a.task_id='read-a'`).get() as any;
    f.driver.waitRequest({requestId:'cancelled-wait',runId:'workflow',taskId:row.task_id,attemptId:row.attempt_id,identityId:row.identity_id,requestOrdinal:1,streamId:'cancelled-stream',reason:'external-response',responseSchema:'cue-wait-response-v1',createdAtMs:time,deadlineAtMs:time+1000,expectedResponder:{id:'fixture-responder',revision:'v1'}});
    f.driver.waitResponse({eventId:'cancelled-event',requestId:'cancelled-wait',responseId:'cancelled-response',responseOrdinal:1,responder:{id:'fixture-responder',revision:'v1'},contentRef:'response-ref-cancelled',observedAtMs:time});
    f.truth.onWaitAuthorize=()=>{f.truth.onWaitAuthorize=()=>{};expect(f.driver.stop('workflow')).toBe(true);};
    await expect(f.driver.deliverWaitResponse({requestId:'cancelled-wait',responseId:'cancelled-response',claimedAtMs:time})).resolves.toMatchObject({delivery:'blocked-unresolved',newlyClaimed:true});
    expect(f.truth.deliveries).toBe(0);expect(f.db.prepare('SELECT COUNT(*) n FROM orchestration_wait_dispatch_claim').get()).toEqual({n:1});expect(f.db.prepare('SELECT COUNT(*) n FROM orchestration_wait_delivery_observation').get()).toEqual({n:0});
    await expect(f.driver.deliverWaitResponse({requestId:'cancelled-wait',responseId:'cancelled-response',claimedAtMs:time})).resolves.toMatchObject({delivery:'blocked-unresolved',newlyClaimed:false});expect(f.truth.deliveries).toBe(0);
    await started;await expect(f.driver.close()).rejects.toThrow('cleanup_unverified');
  });
  it('records a valid delayed acknowledgement after delivery began even when stop follows', async () => {
    const f=fixture();enableParallelReaders(f);f.truth.holdTasks.add('read-a');f.truth.holdTasks.add('read-b');let releaseAck!:(value:any)=>void;
    f.host.deliverWaitResponse=async(input:any)=>{f.truth.deliveries++;f.truth.deliveryInputs.push(input);return new Promise(resolve=>{releaseAck=()=>resolve({dispatchId:input.dispatchId,attemptId:input.attemptId,identityId:input.identityId,durableRef:input.durableRef,contentSha256:input.contentSha256});});};
    f.driver.prepare(f.run);f.approve();f.driver.activate(f.run);const started=f.driver.start(f.run);await expect.poll(()=>f.truth.launches.length).toBe(2);await new Promise(done=>setImmediate(done));
    const row=f.db.prepare(`SELECT a.task_id,a.attempt_id,i.identity_id FROM orchestration_attempt a JOIN orchestration_attempt_identity i ON i.attempt_id=a.attempt_id WHERE a.task_id='read-a'`).get() as any;
    f.driver.waitRequest({requestId:'delayed-wait',runId:'workflow',taskId:row.task_id,attemptId:row.attempt_id,identityId:row.identity_id,requestOrdinal:1,streamId:'delayed-stream',reason:'external-response',responseSchema:'cue-wait-response-v1',createdAtMs:time,deadlineAtMs:time+1000,expectedResponder:{id:'fixture-responder',revision:'v1'}});
    f.driver.waitResponse({eventId:'delayed-event',requestId:'delayed-wait',responseId:'delayed-response',responseOrdinal:1,responder:{id:'fixture-responder',revision:'v1'},contentRef:'response-ref-delayed',observedAtMs:time});
    const delivery=f.driver.deliverWaitResponse({requestId:'delayed-wait',responseId:'delayed-response',claimedAtMs:time});await expect.poll(()=>f.truth.deliveries).toBe(1);expect(f.driver.stop('workflow')).toBe(true);releaseAck(undefined);
    await expect(delivery).resolves.toMatchObject({delivery:'delivered-observed',newlyClaimed:true});expect(f.db.prepare('SELECT status FROM orchestration_wait_delivery_observation').get()).toEqual({status:'delivered'});await started;await expect(f.driver.close()).rejects.toThrow('cleanup_unverified');
  });
  it('cancels every published parallel start on stop and retains unknown cleanup', async () => {
    const f=fixture();enableParallelReaders(f);f.truth.pendingLaunch=true;f.truth.cleanup=false;
    f.driver.prepare(f.run);f.approve();f.driver.activate(f.run);const started=f.driver.start(f.run);await expect.poll(()=>f.truth.launches.length).toBe(2);
    expect(f.driver.stop('workflow')).toBe(true);await expect.poll(()=>[...f.signals.values()].filter(signal=>signal.aborted).length).toBe(2);let controlSettled=false;void started.then(()=>{controlSettled=true});await expect.poll(()=>controlSettled).toBe(true);expect(f.truth.cancels).toBe(0);await expect(f.driver.settled()).rejects.toThrow('cleanup_unverified');for(const release of f.releases.values())release();await expect.poll(()=>f.truth.cancels).toBe(2);expect(f.truth.launches).toHaveLength(2);await started;
    expect(f.truth.cancels).toBe(2);expect(f.driver.snapshot('workflow').unresolvedAttemptIds).toHaveLength(2);await expect(f.driver.close()).rejects.toThrow('cleanup_unverified');
  });
  it('expires a running parallel wave at taskTimeoutMs and retains exact unknown cleanup', async () => {
    const f=fixture();enableParallelReaders(f);f.configuration.limits.taskTimeoutMs=25;f.truth.cleanup=false;f.truth.finish=false;f.truth.holdTasks.add('read-a');f.truth.holdTasks.add('read-b');
    f.driver.prepare(f.run);f.approve();f.driver.activate(f.run);await f.driver.start(f.run);
    expect(f.truth.launches).toEqual(['read-a','read-b']);expect(f.truth.cancels).toBe(2);expect([...f.signals.values()].filter(signal=>signal.aborted)).toHaveLength(2);
    expect(f.driver.snapshot('workflow')).toMatchObject({state:'blocked',reason:'orchestration_timeout'});expect(f.driver.snapshot('workflow').unresolvedAttemptIds).toEqual([...f.truth.attemptIds].sort());
    expect(f.db.prepare('SELECT SUM(upper_units) n FROM integration_budget_reservation').get()).toEqual({n:20});expect(f.truth.launches).not.toContain('check');
    const row=f.db.prepare(`SELECT a.task_id,a.attempt_id,i.identity_id FROM orchestration_attempt a JOIN orchestration_attempt_identity i ON i.attempt_id=a.attempt_id ORDER BY a.task_id LIMIT 1`).get() as any;
    f.driver.waitRequest({requestId:'timed-out-wait',runId:'workflow',taskId:row.task_id,attemptId:row.attempt_id,identityId:row.identity_id,requestOrdinal:1,streamId:'timed-out-stream',reason:'external-response',responseSchema:'cue-wait-response-v1',createdAtMs:time,deadlineAtMs:time+1000,expectedResponder:{id:'fixture-responder',revision:'v1'}});
    f.driver.waitResponse({eventId:'timed-out-event',requestId:'timed-out-wait',responseId:'timed-out-response',responseOrdinal:1,responder:{id:'fixture-responder',revision:'v1'},contentRef:'response-ref-timeout',observedAtMs:time});
    await expect(f.driver.deliverWaitResponse({requestId:'timed-out-wait',responseId:'timed-out-response',claimedAtMs:time})).resolves.toMatchObject({delivery:'blocked-unresolved',newlyClaimed:true});expect(f.truth.deliveries).toBe(0);
    await expect(f.driver.settled()).rejects.toThrow('cleanup_unverified');await expect(f.driver.close()).rejects.toThrow('cleanup_unverified');
  });
  it('closes a task-timeout wave after verified cleanup without verification success', async () => {
    const f=fixture();enableParallelReaders(f);f.configuration.limits.taskTimeoutMs=25;f.truth.holdTasks.add('read-a');f.truth.holdTasks.add('read-b');
    f.driver.prepare(f.run);f.approve();f.driver.activate(f.run);await f.driver.start(f.run);
    expect(f.truth.launches).toEqual(['read-a','read-b']);expect(f.truth.cancels).toBe(2);expect(f.driver.snapshot('workflow')).toMatchObject({state:'blocked',reason:'orchestration_timeout',acceptance:'unverified',unresolvedAttemptIds:[]});
    expect(f.db.prepare("SELECT state,cleanup_verified FROM orchestration_attempt ORDER BY task_id").all()).toEqual([{state:'completed',cleanup_verified:1},{state:'completed',cleanup_verified:1}]);
    expect(f.truth.launches).not.toContain('check');await expect(f.driver.settled()).resolves.toBeUndefined();await f.driver.close();
  });
  it('rejects invalid or unsafe parallel configuration before persistence and defaults to serial', async () => {
    const serial=fixture();expect(serial.driver.prepare(serial.run).maxParallelReadTasks).toBe(1);await serial.driver.close();
    for(const cap of [0,9,1.5]){const f=fixture();f.configuration.limits.maxParallelReadTasks=cap;expect(()=>f.driver.prepare(f.run)).toThrow('driver_invalid_limit');expect(f.db.prepare('SELECT COUNT(*) n FROM orchestration_plan').get()).toEqual({n:0});await f.driver.close();}
    const retry=fixture(true,true);retry.configuration.limits.maxParallelReadTasks=2;expect(()=>retry.driver.prepare(retry.run)).toThrow('driver_parallel_read_unsupported');expect(retry.db.prepare('SELECT COUNT(*) n FROM orchestration_plan').get()).toEqual({n:0});await retry.driver.close();
  });

  it('blocks a failed read wave and cancels its running sibling without launching verification',async()=>{
    const f=fixture();enableParallelReaders(f);f.truth.failTasks.add('read-a');f.truth.failuresRemaining=1;f.truth.holdTasks.add('read-b');
    f.driver.prepare(f.run);f.approve();f.driver.activate(f.run);await f.driver.start(f.run);
    expect(f.truth.launches).toEqual(['read-a','read-b']);expect(f.truth.cancelledTasks.filter(taskId=>taskId==='read-b')).toHaveLength(1);
    expect(f.signals.get(f.truth.attemptIds[1]!)!.aborted).toBe(true);expect(f.driver.snapshot('workflow')).toMatchObject({state:'blocked',reason:'orchestration_evidence_unverified'});
    const unresolved=f.driver.snapshot('workflow').unresolvedAttemptIds;
    if(unresolved.length)await expect(f.driver.close()).rejects.toThrow('cleanup_unverified');else await f.driver.close();
  });
  it('never mixes a ready writer into a read wave and starts it only after readers settle',async()=>{
    const f=fixture();enableWritableTarget(f,'writer');const targets=f.configuration.changeTargets;enableParallelReaders(f);f.truth.pendingLaunch=true;
    f.configuration.requirementIds.push('req-write');f.configuration.proposedPlan.tasks.push({id:'writer',role:'implementation',ownerId:'writer',requirementIds:['req-write'],dependencyIds:[],candidateIds:['agent'],scopeIds:['work']});
    const checker=f.configuration.proposedPlan.tasks.find((task:any)=>task.id==='check');checker.requirementIds.push('req-write');checker.dependencyIds.push('writer');f.configuration.changeTargets=targets.map((target:any)=>({...target,taskId:'writer'}));
    f.truth.onLaunch=taskId=>{if(taskId==='writer')expect(f.db.prepare("SELECT state FROM orchestration_attempt WHERE task_id IN ('read-a','read-b') ORDER BY task_id").all()).toEqual([{state:'completed'},{state:'completed'}]);};
    f.driver.prepare(f.run);f.approve();f.driver.activate(f.run);const started=f.driver.start(f.run);await expect.poll(()=>f.truth.launches.length).toBe(2);expect(f.truth.launches).toEqual(['read-a','read-b']);expect(f.db.prepare('SELECT COUNT(*) n FROM workspace_write_lease').get()).toEqual({n:0});
    f.truth.pendingLaunch=false;for(const release of f.releases.values())release();await started;expect(f.truth.launches).toEqual(['read-a','read-b','writer','check']);await f.driver.close();
  });
  it('rejects parallel configuration for local and automatic-recovery hosts before persistence',async()=>{
    const f=fixture();f.configuration.limits.maxParallelReadTasks=2;const localDriver=createOrchestrationDriver({db:f.db,host:{...f.host,accountingKind:'local-invocation',engine:{...f.host.engine,maxRequestAgeMs:1000}} as any});expect(()=>localDriver.prepare(f.run)).toThrow('driver_parallel_read_unsupported');expect(f.db.prepare('SELECT COUNT(*) n FROM orchestration_plan').get()).toEqual({n:0});await localDriver.close();await f.driver.close();
    const automatic=fixture(true,true,true,'automatic-approved');automatic.configuration.limits.maxParallelReadTasks=2;expect(()=>automatic.driver.prepare(automatic.run)).toThrow('driver_parallel_read_unsupported');expect(automatic.db.prepare('SELECT COUNT(*) n FROM orchestration_plan').get()).toEqual({n:0});await automatic.driver.close();
  });
  it('blocks retry when the real change journal observes a file identity replacement', async()=>{
    const f=fixture(true,true);const target=enableWritableTarget(f);f.truth.failuresRemaining=1;f.truth.cleanup=false;
    f.truth.onFailure=()=>{rmSync(target);writeFileSync(target,'replacement');};
    f.driver.prepare(f.run);f.approve();f.driver.activate(f.run);
    const revisionsBefore=f.db.prepare('SELECT count(*) n FROM orchestration_plan_revision').get();
    await f.driver.start(f.run);
    expect(f.driver.snapshot(f.run.runId)).toMatchObject({state:'blocked',reason:'change_observation_unknown'});
    expect(f.truth.launches).toEqual(['make']);
    expect(f.db.prepare('SELECT status FROM change_observation ORDER BY observed_at_ms DESC LIMIT 1').get()).toEqual({status:'moved'});
    expect(f.db.prepare('SELECT count(*) n FROM orchestration_recovery_decision').get()).toEqual({n:0});
    expect(f.db.prepare('SELECT count(*) n FROM orchestration_plan_revision').get()).toEqual(revisionsBefore);
    expect(f.db.prepare('SELECT count(*) n FROM workspace_write_lease WHERE run_id=?').get(f.run.runId)).toEqual({n:1});
  });
  it('allows a real modified observation through to the existing evidence gate', async()=>{
    const f=fixture(true,true);const target=enableWritableTarget(f);f.truth.failuresRemaining=1;f.truth.cleanup=false;
    f.truth.onFailure=()=>{writeFileSync(target,'after');};
    f.driver.prepare(f.run);f.approve();f.driver.activate(f.run);await f.driver.start(f.run);
    expect(f.driver.snapshot(f.run.runId)).toMatchObject({state:'blocked',reason:'orchestration_evidence_unverified'});
    expect(f.truth.launches).toEqual(['make']);
    expect(f.db.prepare('SELECT status FROM change_observation ORDER BY observed_at_ms DESC LIMIT 1').get()).toEqual({status:'modified'});
    expect(f.db.prepare('SELECT count(*) n FROM orchestration_recovery_decision').get()).toEqual({n:0});
    expect(f.db.prepare('SELECT count(*) n FROM workspace_write_lease WHERE run_id=?').get(f.run.runId)).toEqual({n:1});
  });
  it('automatically applies an approved retry without resetting the active drive promise',async()=>{
    const f=fixture(true,true,true,'automatic-approved');f.truth.failuresRemaining=1;let nested='';let started:Promise<void>;
    f.truth.onRecovery=()=>{f.truth.onRecovery=()=>{};const failed=f.db.prepare("SELECT attempt_id FROM orchestration_attempt WHERE state='failed'").get() as {attempt_id:string};try{f.driver.recover({runId:'workflow',decisionId:'nested',priorAttemptId:failed.attempt_id});}catch(error){nested=(error as Error).message;}expect(f.driver.start(f.run)).toBe(started);};
    const summary=f.driver.prepare(f.run);expect(summary.recoveryMode).toBe('automatic-approved');expect(Object.isFrozen(summary)).toBe(true);f.approve();f.driver.activate(f.run);started=f.driver.start(f.run);await started;
    expect(nested).toBe('driver_recovery_in_progress');expect(f.truth.launches).toEqual(['make','make','check']);expect(f.db.prepare('SELECT action FROM orchestration_recovery_decision').get()).toEqual({action:'retry'});expect(f.db.prepare('SELECT COUNT(*) n FROM orchestration_recovery_activation').get()).toEqual({n:1});expect(f.driver.snapshot('workflow')).toMatchObject({state:'completed',acceptance:'verified',recovery:null});await f.driver.close();
  });
  it('automatically switches only to the store-derived approved alternate',async()=>{
    const f=fixture(true,true,true,'automatic-approved');f.truth.failuresRemaining=1;f.truth.priorCandidateEligible=false;f.driver.prepare(f.run);f.approve();f.driver.activate(f.run);await f.driver.start(f.run);
    expect(f.truth.launches).toEqual(['make','make','check']);expect(f.db.prepare('SELECT action,selected_candidate_id FROM orchestration_recovery_decision').get()).toEqual({action:'switch',selected_candidate_id:'agent-b'});expect(f.db.prepare('SELECT candidate_id FROM orchestration_attempt ORDER BY rowid LIMIT 1 OFFSET 1').get()).toEqual({candidate_id:'agent-b'});await f.driver.close();
  });
  it('automatically switches after quota failure and retains exact failure, cost and replay lineage',async()=>{
    const f=fixture(true,true,true,'automatic-approved');f.truth.failuresRemaining=1;f.truth.recoveryCause='quota';
    f.truth.quotaAlternateAvailable=true;
    f.driver.prepare(f.run);f.approve();f.driver.activate(f.run);await f.driver.start(f.run);
    expect(f.truth.launches).toEqual(['make','make','check']);
    const attempts=f.db.prepare('SELECT attempt_id,task_id,candidate_id,state FROM orchestration_attempt ORDER BY rowid').all() as any[];
    expect(attempts.map(({task_id,candidate_id,state})=>({task_id,candidate_id,state}))).toEqual([
      {task_id:'make',candidate_id:'agent',state:'failed'},
      {task_id:'make',candidate_id:'agent-b',state:'completed'},
      {task_id:'check',candidate_id:'agent',state:'completed'},
    ]);
    const observation=JSON.parse((f.db.prepare('SELECT payload FROM orchestration_failure_observation').get() as any).payload.toString());
    expect(observation).toMatchObject({attemptId:attempts[0].attempt_id,cause:'quota'});
    expect(f.db.prepare('SELECT action,selected_candidate_id FROM orchestration_recovery_decision').all()).toEqual([{action:'switch',selected_candidate_id:'agent-b'}]);
    expect(f.db.prepare('SELECT candidate_id,revision FROM orchestration_recovery_activation').all()).toEqual([{candidate_id:'agent-b',revision:0}]);
    expect(f.db.prepare('SELECT attempt_id,upper_units FROM integration_budget_reservation ORDER BY rowid').all()).toEqual(attempts.map(a=>({attempt_id:a.attempt_id,upper_units:10})));
    expect(createBudgetManager(f.db,{verifyFinalReceipt:()=>false}).summary('workflow')).toMatchObject({committedUnits:30n,remainingUnits:70n});
    expect(f.driver.snapshot('workflow')).toMatchObject({state:'completed',acceptance:'verified'});
    await f.driver.start(f.run);expect(f.truth.launches).toEqual(['make','make','check']);
    expect(f.db.prepare('SELECT COUNT(*) n FROM orchestration_recovery_activation').get()).toEqual({n:1});
    await f.driver.close();
  });
  it.each([
    {action:'retry' as const,cause:'transient',priorCandidateEligible:true,candidateId:'agent',revision:0},
    {action:'switch' as const,cause:'transient',priorCandidateEligible:false,candidateId:'agent-b',revision:0},
    {action:'replan' as const,cause:'quality-failure',priorCandidateEligible:true,candidateId:'agent',revision:1},
  ])('delivers a wait response once to the exact held $action replacement after explicit recovery',async variant=>{
    const f=fixture(true,true,true);f.truth.failuresRemaining=1;f.truth.recoveryCause=variant.cause;f.truth.priorCandidateEligible=variant.priorCandidateEligible;
    f.truth.onLaunch=taskId=>{if(taskId==='make'&&f.truth.launches.filter(id=>id==='make').length===1)f.truth.hold=true;};
    f.configuration.retry.deadlineMs=time+1000;f.driver.prepare(f.run);f.approve();f.driver.activate(f.run);await f.driver.start(f.run);
    const failedBeforeRecovery=f.db.prepare("SELECT attempt_id FROM orchestration_attempt WHERE task_id='make' AND state='failed'").get() as any;expect(f.driver.snapshot('workflow').state).toBe('blocked');
    const plan=variant.action==='replan'?{...f.configuration.proposedPlan,revision:'recovery-wait-plan2',tasks:f.configuration.proposedPlan.tasks.map((task:any)=>({...task}))}:undefined;
    const result=f.driver.recover({runId:'workflow',decisionId:`recovery-wait-${variant.action}`,priorAttemptId:failedBeforeRecovery.attempt_id,...(plan?{plan}:{})});expect(result).toMatchObject({action:variant.action,revision:variant.revision});const started=f.driver.start(f.run);
    await expect.poll(()=>f.driver.snapshot('workflow').state).toBe('running');await new Promise(done=>setImmediate(done));
    const attempts=f.db.prepare(`SELECT a.attempt_id,a.state,a.cleanup_verified,i.identity_id,i.durable_ref FROM orchestration_attempt a JOIN orchestration_attempt_identity i ON i.attempt_id=a.attempt_id WHERE a.task_id='make' ORDER BY a.rowid`).all() as any[];
    expect(attempts).toHaveLength(2);const [failed,replacement]=attempts;expect(failed).toMatchObject({state:'failed',cleanup_verified:1});expect(replacement.state).toBe('running');
    expect({attemptId:failed.attempt_id,identityId:failed.identity_id,durableRef:failed.durable_ref}).not.toEqual({attemptId:replacement.attempt_id,identityId:replacement.identity_id,durableRef:replacement.durable_ref});expect(f.db.prepare('SELECT action,selected_candidate_id FROM orchestration_recovery_decision').get()).toEqual({action:variant.action,selected_candidate_id:variant.action==='switch'?'agent-b':null});expect(f.db.prepare('SELECT candidate_id,revision FROM orchestration_recovery_activation').get()).toEqual({candidate_id:variant.candidateId,revision:variant.revision});
    if(variant.action==='replan'){expect(f.db.prepare('SELECT plan_digest FROM orchestration_stage_envelope WHERE attempt_id=?').get(replacement.attempt_id)).toEqual({plan_digest:result.planDigest});expect(f.db.prepare('SELECT plan_digest FROM orchestration_plan_revision WHERE run_id=? AND revision=1').get('workflow')).toEqual({plan_digest:result.planDigest});}
    const name=`${variant.action}-replacement`,request=(label:string,row:any,ordinal:number)=>({requestId:`recovery-${label}-wait`,runId:'workflow',taskId:'make',attemptId:row.attempt_id,identityId:row.identity_id,requestOrdinal:ordinal,streamId:`recovery-${label}-stream`,reason:'external-response' as const,responseSchema:'cue-wait-response-v1' as const,createdAtMs:time,deadlineAtMs:time+1000,expectedResponder:{id:'fixture-responder',revision:'v1'}});
    f.driver.waitRequest(request(name,replacement,1));f.driver.waitResponse({eventId:`recovery-${name}-event`,requestId:`recovery-${name}-wait`,responseId:`recovery-${name}-response`,responseOrdinal:1,responder:{id:'fixture-responder',revision:'v1'},contentRef:`response-ref-${name}`,observedAtMs:time});
    await expect(f.driver.deliverWaitResponse({requestId:`recovery-${name}-wait`,responseId:`recovery-${name}-response`,claimedAtMs:time})).resolves.toMatchObject({delivery:'delivered-observed',newlyClaimed:true,attemptId:replacement.attempt_id,identityId:replacement.identity_id,durableRef:replacement.durable_ref});
    const content=`response bytes:response-ref-${name}`;expect(f.truth.deliveryInputs).toHaveLength(1);expect(f.truth.deliveryInputs[0]).toMatchObject({attemptId:replacement.attempt_id,identityId:replacement.identity_id,durableRef:replacement.durable_ref,requestId:`recovery-${name}-wait`,responseId:`recovery-${name}-response`,contentRef:`response-ref-${name}`,contentSha256:createHash('sha256').update(content).digest('hex')});expect(Buffer.from(f.truth.deliveryInputs[0].contentBytes)).toEqual(Buffer.from(content));
    await expect(f.driver.deliverWaitResponse({requestId:`recovery-${name}-wait`,responseId:`recovery-${name}-response`,claimedAtMs:time})).resolves.toMatchObject({delivery:'delivered-observed',newlyClaimed:false});
    const reopened=createOrchestrationDriver({db:f.db,host:f.host});await expect(reopened.deliverWaitResponse({requestId:`recovery-${name}-wait`,responseId:`recovery-${name}-response`,claimedAtMs:time})).resolves.toMatchObject({delivery:'delivered-observed',newlyClaimed:false});expect(f.truth.deliveries).toBe(1);
    expect(()=>f.driver.waitRequest(request(`${variant.action}-failed`,failed,1))).toThrow('wait_attempt_unavailable');expect(f.truth.deliveries).toBe(1);
    expect(f.db.prepare('SELECT COUNT(*) n FROM orchestration_wait_delivery_observation').get()).toEqual({n:1});expect(f.configuration.retry.deadlineMs).toBe(time+1000);
    expect(f.driver.stop('workflow')).toBe(true);await started;await expect(f.driver.close()).rejects.toThrow('cleanup_unverified');
  });
  it('keeps automatic quota recovery dormant until the authoritative reset',async()=>{
    const f=fixture(true,true,true,'automatic-approved');f.truth.failuresRemaining=1;f.truth.recoveryCause='quota';f.truth.quotaResetAt=time+100;f.driver.prepare(f.run);f.approve();f.driver.activate(f.run);const started=f.driver.start(f.run);
    await new Promise(resolve=>setTimeout(resolve,10));expect(f.truth.launches).toEqual(['make']);expect(f.db.prepare('SELECT COUNT(*) n FROM orchestration_recovery_activation').get()).toEqual({n:0});f.truth.clock=time+100;await started;expect(f.truth.launches).toEqual(['make','make','check']);expect(f.db.prepare('SELECT COUNT(*) n FROM orchestration_recovery_activation').get()).toEqual({n:1});await f.driver.close();
  });
  it('persists automatic replan for explicit continuation and stops without replacement',async()=>{
    const replan=fixture(true,true,true,'automatic-approved');replan.truth.failuresRemaining=1;replan.truth.recoveryCause='quality-failure';replan.driver.prepare(replan.run);replan.approve();replan.driver.activate(replan.run);await replan.driver.start(replan.run);
    const pending=replan.driver.snapshot('workflow').recovery!,terminal=replan.db.prepare("SELECT r.receipt_id,a.attempt_id FROM orchestration_receipt r JOIN orchestration_attempt a ON a.attempt_id=r.attempt_id WHERE a.state='failed'").get() as {receipt_id:string;attempt_id:string};expect(pending).toMatchObject({action:'replan',decisionId:`auto-${createHash('sha256').update(`workflow\0${terminal.attempt_id}\0${terminal.receipt_id}\0${0}`).digest('hex').slice(0,48)}`});expect(replan.truth.launches).toEqual(['make']);expect(replan.db.prepare('SELECT action FROM orchestration_recovery_decision').get()).toEqual({action:'replan'});
    const plan={...replan.configuration.proposedPlan,revision:'auto-plan2',tasks:replan.configuration.proposedPlan.tasks.map((task:any)=>({...task}))};expect(replan.driver.recover({runId:'workflow',decisionId:pending.decisionId,priorAttemptId:pending.priorAttemptId,plan})).toMatchObject({action:'replan',revision:1});await replan.driver.start(replan.run);expect(replan.truth.launches).toEqual(['make','make','check']);await replan.driver.close();
    const stopped=fixture(true,true,true,'automatic-approved');stopped.truth.failuresRemaining=1;stopped.truth.recoveryCause='policy-violation';stopped.driver.prepare(stopped.run);stopped.approve();stopped.driver.activate(stopped.run);await stopped.driver.start(stopped.run);expect(stopped.truth.launches).toEqual(['make']);expect(stopped.db.prepare('SELECT action FROM orchestration_recovery_decision').get()).toEqual({action:'stop'});expect(stopped.driver.snapshot('workflow')).toMatchObject({state:'blocked',recovery:null});await stopped.driver.close();
  });
  it('fences automatic recovery when a trusted callback cancels or crosses the deadline',async()=>{
    const cancelled=fixture(true,true,true,'automatic-approved');cancelled.truth.failuresRemaining=1;cancelled.truth.onRecovery=()=>{cancelled.truth.onRecovery=()=>{};cancelled.driver.stop('workflow');};cancelled.driver.prepare(cancelled.run);cancelled.approve();cancelled.driver.activate(cancelled.run);await cancelled.driver.start(cancelled.run);expect(cancelled.truth.launches).toEqual(['make']);expect(cancelled.db.prepare('SELECT COUNT(*) n FROM orchestration_recovery_activation').get()).toEqual({n:0});expect(cancelled.driver.snapshot('workflow').reason).toBe('cancelled');await cancelled.driver.close();
    const expired=fixture(true,true,true,'automatic-approved');expired.truth.failuresRemaining=1;expired.truth.onRecovery=()=>{expired.truth.onRecovery=()=>{};expired.truth.clock=time+1000;};expired.driver.prepare(expired.run);expired.approve();expired.driver.activate(expired.run);await expired.driver.start(expired.run);expect(expired.truth.launches).toEqual(['make']);expect(expired.db.prepare('SELECT COUNT(*) n FROM orchestration_recovery_activation').get()).toEqual({n:0});expect(expired.driver.snapshot('workflow').reason).toBe('orchestration_deadline');await expired.driver.close();
  });
  it('does not extend the original monotonic deadline for deferred replan continuation',async()=>{
    vi.useFakeTimers();let monotonicNow=10;const nowSpy=vi.spyOn(performance,'now').mockImplementation(()=>monotonicNow);
    const f=fixture(true,true,true,'automatic-approved');let resumed:Promise<void>|undefined;
    try {
      f.configuration.retry.deadlineMs=time+1000;f.truth.failuresRemaining=1;f.truth.recoveryCause='quality-failure';
      f.driver.prepare(f.run);f.approve();f.driver.activate(f.run);await f.driver.start(f.run);
      const pending=f.driver.snapshot('workflow').recovery!;expect(pending).toMatchObject({action:'replan'});
      const plan={...f.configuration.proposedPlan,revision:'late-plan2',tasks:f.configuration.proposedPlan.tasks.map((task:any)=>({...task}))};
      expect(f.driver.recover({runId:'workflow',decisionId:pending.decisionId,priorAttemptId:pending.priorAttemptId,plan})).toMatchObject({action:'replan',revision:1});
      f.acceptanceTruth.mode='hang';resumed=f.driver.start(f.run);await f.captureEntered;
      expect(f.truth.launches).toEqual(['make','make','check']);expect(f.acceptanceTruth.aborted).toBe(false);
      f.truth.clock=time+1001;monotonicNow=1011;await vi.advanceTimersByTimeAsync(1001);await resumed;
      expect(f.acceptanceTruth.aborted).toBe(true);expect(f.acceptanceTruth.finalized).toBe(0);
      expect(f.truth.launches).toEqual(['make','make','check']);expect(f.driver.snapshot('workflow').reason).toBe('orchestration_deadline');
    } finally {
      f.acceptanceTruth.release();await f.driver.close();nowSpy.mockRestore();vi.useRealTimers();
    }
  });
  it('rejects unsupported automatic recovery before persistence and preserves manual default',async()=>{
    const missingHost=fixture(true,true,false,'automatic-approved');expect(()=>missingHost.driver.prepare(missingHost.run)).toThrow('driver_automatic_recovery_unsupported');expect(missingHost.db.prepare('SELECT COUNT(*) n FROM orchestration_plan').get()).toEqual({n:0});
    const missingCriteria=fixture(false,true,true,'automatic-approved');expect(()=>missingCriteria.driver.prepare(missingCriteria.run)).toThrow('driver_automatic_recovery_unsupported');
    const invalid=fixture(true,true,true);invalid.configuration.recoveryMode='always';expect(()=>invalid.driver.prepare(invalid.run)).toThrow('driver_recovery_mode');
    const manual=fixture(true,true,true);expect(manual.driver.prepare(manual.run).recoveryMode).toBe('manual');await Promise.all([missingHost.driver.close(),missingCriteria.driver.close(),invalid.driver.close(),manual.driver.close()]);
  });
  it('derives recovery from trusted host proof and executes a forced approved switch', async()=>{
    const f=fixture(true,true,true);f.truth.failuresRemaining=1;f.truth.recoveryCause='transient';f.truth.priorCandidateEligible=false;
    f.driver.prepare(f.run);f.approve();f.driver.activate(f.run);await f.driver.start(f.run);
    const failed=f.db.prepare("SELECT attempt_id FROM orchestration_attempt WHERE state='failed'").get() as {attempt_id:string};
    expect(()=>f.driver.recover({runId:'workflow',decisionId:'decision-switch',priorAttemptId:failed.attempt_id,proposedCandidateId:'agent-b',facts:{cause:'transient'}} as any)).toThrow('driver_recovery_fields');
    expect(f.driver.recover({runId:'workflow',decisionId:'decision-switch',priorAttemptId:failed.attempt_id})).toMatchObject({action:'switch',revision:0});
    await f.driver.start(f.run);
    expect(f.db.prepare('SELECT candidate_id,revision FROM orchestration_recovery_activation').get()).toEqual({candidate_id:'agent-b',revision:0});
    expect(f.db.prepare('SELECT candidate_id FROM orchestration_attempt ORDER BY rowid LIMIT 1 OFFSET 1').get()).toEqual({candidate_id:'agent-b'});
    expect(JSON.parse((f.db.prepare('SELECT payload FROM acceptance_evaluation').get() as any).payload).initialFailure).toBeNull();
    expect(f.driver.snapshot('workflow')).toMatchObject({state:'completed',reason:null,acceptance:'verified'});await f.driver.close();
  });
  it('executes an explicit revision-one replan through claim, stage, finish and acceptance',async()=>{
    const f=fixture(true,true,true);f.truth.failuresRemaining=1;f.truth.recoveryCause='quality-failure';
    f.driver.prepare(f.run);f.approve();f.driver.activate(f.run);await f.driver.start(f.run);
    const failed=f.db.prepare("SELECT attempt_id FROM orchestration_attempt WHERE state='failed'").get() as {attempt_id:string};
    const plan={...f.configuration.proposedPlan,revision:'plan2',tasks:f.configuration.proposedPlan.tasks.map((task:any)=>({...task}))};
    const result=f.driver.recover({runId:'workflow',decisionId:'decision-replan',priorAttemptId:failed.attempt_id,plan});
    expect(result).toMatchObject({action:'replan',revision:1});await f.driver.start(f.run);
    const activation=f.db.prepare('SELECT revision,task_id FROM orchestration_recovery_activation').get();expect(activation).toEqual({revision:1,task_id:'make'});
    const attempt=f.db.prepare('SELECT attempt_id FROM orchestration_attempt_revision WHERE revision=1 ORDER BY rowid LIMIT 1').get() as {attempt_id:string};
    expect(f.db.prepare('SELECT plan_digest FROM orchestration_stage_envelope WHERE attempt_id=?').get(attempt.attempt_id)).toEqual({plan_digest:result.planDigest});
    expect(f.db.prepare("SELECT state FROM orchestration_revision_step WHERE run_id='workflow' AND revision=1 ORDER BY task_id").all()).toEqual([{state:'completed'},{state:'completed'}]);
    expect(JSON.parse((f.db.prepare('SELECT payload FROM acceptance_evaluation').get() as any).payload).initialFailure).toBeNull();
    expect(f.driver.snapshot('workflow').acceptance).toBe('verified');await f.driver.close();
  });
  it('keeps an authoritative quota retry dormant until the recorded reset time',async()=>{
    const f=fixture(true,true,true);f.truth.failuresRemaining=1;f.truth.recoveryCause='quota';f.truth.quotaResetAt=time+100;
    f.driver.prepare(f.run);f.approve();f.driver.activate(f.run);await f.driver.start(f.run);
    const failed=f.db.prepare("SELECT attempt_id FROM orchestration_attempt WHERE state='failed'").get() as {attempt_id:string};
    const input={runId:'workflow',decisionId:'decision-quota',priorAttemptId:failed.attempt_id};
    expect(f.driver.recover(input).action).toBe('retry');const resumed=f.driver.start(f.run);
    await new Promise(resolve=>setTimeout(resolve,10));expect(f.truth.launches).toEqual(['make']);expect(f.db.prepare('SELECT COUNT(*) n FROM orchestration_recovery_activation').get()).toEqual({n:0});
    f.truth.clock=time+100;await resumed;
    expect(f.truth.launches).toEqual(['make','make','check']);expect(f.db.prepare('SELECT COUNT(*) n FROM orchestration_recovery_activation').get()).toEqual({n:1});
    expect(f.driver.snapshot('workflow').acceptance).toBe('verified');await f.driver.close();
  });
  it('runs approved clean transient retry through a new child owner and real acceptance without refunding unknown costs', async () => {
    const f = fixture(true, true); f.truth.failuresRemaining = 1;
    const summary = f.driver.prepare(f.run);
    expect(summary.retry).toMatchObject({ maxAttemptsPerTask: 3, maxAttemptsTotal: 4, deadlineMs: time + 1000 });
    expect(summary.retry?.contractDigest).toMatch(/^[a-f0-9]{64}$/); expect(Object.isFrozen(summary.retry)).toBe(true);
    f.configuration.retry.maxAttemptsTotal = 100;
    expect(f.driver.prepare(f.run).retry?.maxAttemptsTotal).toBe(4);
    f.approve(); f.driver.activate(f.run); await f.driver.start(f.run);
    expect(f.truth.launches).toEqual(['make', 'make', 'check']); expect(new Set(f.truth.attemptIds).size).toBe(3);
    expect(f.driver.snapshot('workflow')).toMatchObject({ state: 'completed', acceptance: 'verified' });
    expect(f.db.prepare('SELECT state FROM orchestration_attempt ORDER BY rowid').all()).toEqual([{ state: 'failed' }, { state: 'completed' }, { state: 'completed' }]);
    expect(f.db.prepare('SELECT COUNT(*) n FROM orchestration_stage_envelope').get()).toEqual({ n: 3 });
    expect(createBudgetManager(f.db, { verifyFinalReceipt: () => false }).summary('workflow')).toMatchObject({ committedUnits: 30n, remainingUnits: 70n });
    await f.driver.start(f.run); expect(f.truth.launches).toHaveLength(3); await f.driver.close();
  });
  it('requires independent verifier identity against failed makers as well as the latest successful maker', async () => {
    const f = fixture(true, true); f.truth.failuresRemaining = 1; f.truth.collideFailedMaker = true;
    f.driver.prepare(f.run); f.approve(); f.driver.activate(f.run); await f.driver.start(f.run);
    expect(f.truth.launches).toEqual(['make', 'make', 'check']);
    expect(f.driver.snapshot('workflow')).toMatchObject({ state: 'blocked', acceptance: 'unverified' });
    expect(f.acceptanceTruth.finalized).toBe(0); await f.driver.close();
  });
  it('does not retry without approval, trusted classification, clean cleanup, or after synchronous stop', async () => {
    for (const mode of ['no-contract', 'unclassified', 'unclean', 'stop']) {
      const f = fixture(true, mode !== 'no-contract'); f.truth.failuresRemaining = 1;
      if (mode === 'unclassified') f.truth.retryAllowed = false;
      if (mode === 'unclean') f.truth.cleanup = false;
      if (mode === 'stop') f.truth.onFailure = () => { f.driver.stop('workflow'); };
      f.driver.prepare(f.run); f.approve(); f.driver.activate(f.run); await f.driver.start(f.run);
      expect(f.truth.launches).toEqual(['make']); expect(f.driver.snapshot('workflow').state).toBe('blocked');
      if (mode === 'unclean') await expect(f.driver.close()).rejects.toThrow('cleanup_unverified'); else await f.driver.close();
    }
  });
  it('bounds retry attempts and cumulative funds, rejects criteria-free or scope-expanding retry approval', async () => {
    for (const mode of ['count', 'money', 'deadline']) {
      const f = fixture(true, true); f.truth.failuresRemaining = 10;
      if (mode === 'count') f.configuration.retry.maxAttemptsPerTask = 2;
      else if (mode === 'money') f.configuration.budget.limitUnits = 15;
      else f.truth.onFailure = () => { f.host.authority.retry.now = () => time + 1000; };
      f.driver.prepare(f.run); f.approve(); f.driver.activate(f.run); await f.driver.start(f.run);
      expect(f.truth.launches).toHaveLength(mode === 'count' ? 2 : 1);
      expect(f.driver.snapshot('workflow').state).toBe('blocked'); await f.driver.close();
    }
    const missing = fixture(false, true); expect(() => missing.driver.prepare(missing.run)).toThrow('retry_requires_criteria');
    const expanded = fixture(true, true); expanded.configuration.retry.deadlineMs = Date.parse(expanded.run.envelope.expires_at) + 1;
    expect(() => expanded.driver.prepare(expanded.run)).toThrow('retry_exceeds_approval');
  });
  it('absolute retry deadline cancels an active owned stage and retains unknown cleanup and billing', async () => {
    const f = fixture(true, true); f.truth.hold = true; f.truth.cleanup = false; f.configuration.retry.deadlineMs = time + 500; f.configuration.limits.taskTimeoutMs=1000;
    f.driver.prepare(f.run); f.approve(); f.driver.activate(f.run); await f.driver.start(f.run);
    expect(f.truth.launches).toEqual(['make']); expect(f.truth.cancels).toBeGreaterThan(0);
    expect(f.driver.snapshot('workflow')).toMatchObject({ state: 'blocked', reason: 'orchestration_deadline', acceptance: 'unverified' });
    expect(createBudgetManager(f.db, { verifyFinalReceipt: () => false }).summary('workflow').committedUnits).toBe(10n);
    await expect(f.driver.close()).rejects.toThrow('cleanup_unverified');
  });
  it('absolute retry deadline aborts a hanging collector and prevents late accepted completion', async () => {
    const f = fixture(true, true); f.acceptanceTruth.mode = 'hang'; f.configuration.retry.deadlineMs = time + 1000;
    f.driver.prepare(f.run); f.approve(); f.driver.activate(f.run); const started = f.driver.start(f.run);
    await f.captureEntered; await started;
    expect(f.acceptanceTruth.aborted).toBe(true); f.acceptanceTruth.release(); await new Promise(resolve => setImmediate(resolve));
    expect(f.driver.snapshot('workflow')).toMatchObject({ state: 'blocked', reason: 'orchestration_deadline', acceptance: 'unverified' });
    expect(f.acceptanceTruth.finalized).toBe(0); await f.driver.close();
  });
  it('rechecks the absolute deadline after synchronous final-manifest callbacks', async () => {
    const f = fixture(true, true);
    f.host.acceptance.isManifestCurrent = () => { f.host.now = () => time + 1000; return true; };
    f.driver.prepare(f.run); f.approve(); f.driver.activate(f.run); await f.driver.start(f.run);
    expect(f.driver.snapshot('workflow')).toMatchObject({ state: 'blocked', reason: 'orchestration_deadline', acceptance: 'unverified' });
    expect(f.db.prepare('SELECT COUNT(*) n FROM acceptance_final').get()).toEqual({ n: 0 }); await f.driver.close();
  });
  it('fences launch when a synchronous runtime authorization callback crosses the absolute deadline', async () => {
    const f = fixture(true, true);
    f.host.runtime.authorizeRun = () => { f.host.now = () => time + 1000; return true; };
    f.driver.prepare(f.run); f.approve(); f.driver.activate(f.run); await f.driver.start(f.run);
    expect(f.truth.launches).toEqual([]);
    expect(f.driver.snapshot('workflow')).toMatchObject({ state: 'blocked', reason: 'orchestration_deadline', acceptance: 'unverified' });
    expect(createBudgetManager(f.db, { verifyFinalReceipt: () => false }).summary('workflow').committedUnits).toBe(10n);
    await expect(f.driver.close()).rejects.toThrow('cleanup_unverified');
  });
  it('checks the last launch boundary after synchronous capability evidence callbacks', async () => {
    const f = fixture(true, true); f.truth.cleanup = false;
    const resolveCandidate = f.host.runtime.resolveCandidate;
    f.host.runtime.resolveCandidate = (...args: any[]) => {
      const candidate = resolveCandidate(...args);
      return { ...candidate, evidenceReferences: () => { f.host.now = () => time + 1000; return candidate.evidenceReferences(); } };
    };
    f.driver.prepare(f.run); f.approve(); f.driver.activate(f.run); await f.driver.start(f.run);
    expect(f.truth.launches).toEqual([]);
    expect(f.driver.snapshot('workflow')).toMatchObject({ state: 'blocked', reason: 'orchestration_deadline', acceptance: 'unverified' });
    expect(createBudgetManager(f.db, { verifyFinalReceipt: () => false }).summary('workflow').committedUnits).toBe(10n);
    await expect(f.driver.close()).rejects.toThrow('cleanup_unverified');
  });
  it('rejects a host policy that differs from the requested mode before binding approval', () => {
    const f = fixture();
    expect(() => f.driver.prepare({ ...f.run, selectionMode: 'performance' })).toThrow('driver_selection_mode_mismatch');
    for (const table of ['selection_run_policy', 'integration_budget', 'orchestration_plan']) expect(f.db.prepare(`SELECT count(*) n FROM ${table}`).get()).toEqual({ n: 0 });
    const requested = { ...f.run, selectionMode: 'efficiency' as const };
    expect(f.driver.prepare(requested).mode).toBe('efficiency');
    expect(() => f.driver.prepare({ ...f.run, selectionMode: 'value' })).toThrow('driver_run_changed');
    expect(f.driver.prepare(requested).mode).toBe('efficiency');
  });
  it('connects clean stages to host acceptance and completes without releasing unknown billing', async () => {
    const f = fixture(true); f.driver.prepare(f.run); f.approve(); f.driver.activate(f.run); await f.driver.start(f.run);
    expect(f.truth.launches).toEqual(['make', 'check']);
    expect(f.driver.snapshot('workflow')).toMatchObject({ state: 'completed', reason: null, acceptance: 'verified', terminalIntegrity: [{status:'verified'},{status:'verified'}] });
    expect(f.driver.snapshot('workflow').terminalIntegrity.every(item=>f.driver.readTerminalIntegrity(item.attemptId).status==='verified')).toBe(true);
    expect(f.db.prepare('SELECT count(*) n FROM acceptance_final').get()).toEqual({ n: 1 });
    expect(f.db.prepare('SELECT SUM(upper_units) n FROM integration_budget_reservation').get()).toEqual({ n: 20 });
    expect(createBudgetManager(f.db, { verifyFinalReceipt: () => false }).summary('workflow')).toMatchObject({ committedUnits: 20n, remainingUnits: 80n });
    expect(f.acceptanceTruth).toMatchObject({ captured: 1, checked: 1, finalized: 1 });
    await f.driver.start(f.run); await f.driver.close();
    expect(f.driver.snapshot('workflow')).toMatchObject({ state: 'completed', acceptance: 'verified' });
    expect(f.acceptanceTruth.finalized).toBe(1);
  });
  it('persists explicit synthetic provider evidence and reopens it without launch or resend', async () => {
    const f = fixture(); f.truth.providerEvidence = true;
    f.driver.prepare(f.run); f.approve(); f.driver.activate(f.run); await f.driver.start(f.run);
    const attemptId = f.truth.attemptIds[0];
    expect(f.driver.lifecycle(attemptId)).toMatchObject({ providerTerminal: 'succeeded', cleanup: 'clean', billing: 'unknown', providerDeath: 'unknown' });
    expect(f.driver.lifecycle(attemptId).references).toHaveLength(1);
    const launches = f.truth.launches.length;
    const reopened = createOrchestrationDriver({ db: f.db, host: f.host });
    expect(reopened.lifecycle(attemptId)).toMatchObject({ providerTerminal: 'succeeded', cleanup: 'clean', billing: 'unknown' });
    expect(f.truth.launches).toHaveLength(launches);
    // Reopening is observation-only. The fixture DB teardown owns shutdown here so
    // this assertion does not turn reading historical state into a cancellation.
  });
  it('rolls back provider terminal and prior bindings when a later reference conflicts', async () => {
    const f = fixture(); f.truth.providerEvidence = true;
    f.truth.providerReferences = [{ refType: 'turn', label: 'provider-receipt', reference: 'same-opaque-ref' },
      { refType: 'subtask', label: 'conflict', reference: 'same-opaque-ref' }];
    f.driver.prepare(f.run); f.approve(); f.driver.activate(f.run); await f.driver.start(f.run);
    expect(f.db.prepare("SELECT count(*) n FROM provider_lifecycle_event WHERE kind IN ('provider-terminal','billing-finalized')").get()).toEqual({ n: 0 });
    expect(f.db.prepare('SELECT count(*) n FROM provider_subtask_binding').get()).toEqual({ n: 0 });
  });
  it('keeps model self-report and missing criteria unverified through the connected verifier', async () => {
    for (const mode of ['unknown', 'missing']) {
      const f = fixture(true); f.acceptanceTruth.mode = mode;
      if (mode === 'missing') delete f.configuration.requirements;
      f.driver.prepare(f.run); f.approve(); f.driver.activate(f.run); await f.driver.start(f.run);
      expect(f.driver.snapshot('workflow')).toMatchObject({ state: 'blocked', reason: 'acceptance_unverified', acceptance: 'unverified' });
      expect(f.db.prepare('SELECT count(*) n FROM acceptance_final').get()).toEqual({ n: 0 });
      expect(f.acceptanceTruth.finalized).toBe(0); await f.driver.close();
    }
  });
  it('downgrades historical acceptance observation when accepted raw evidence is corrupted', async () => {
    const f = fixture(true); f.driver.prepare(f.run); f.approve(); f.driver.activate(f.run); await f.driver.start(f.run);
    expect(f.driver.snapshot('workflow').acceptance).toBe('verified');
    // Deliberately bypass SQL immutability to simulate privileged storage corruption.
    f.db.exec('DROP TRIGGER acceptance_blob_no_update');
    f.db.prepare('UPDATE acceptance_blob SET bytes=?').run(Buffer.from('tampered'));
    expect(f.driver.snapshot('workflow')).toMatchObject({ state: 'completed', acceptance: 'unverified' });
    expect(f.acceptanceTruth.finalized).toBe(1); await f.driver.close();
  });
  it('stop and close abort acceptance collection and never finalize a late successful manifest', async () => {
    for (const action of ['stop', 'close']) {
      const f = fixture(true); f.acceptanceTruth.mode = 'hang';
      f.driver.prepare(f.run); f.approve(); f.driver.activate(f.run); const started = f.driver.start(f.run);
      await f.captureEntered;
      if (action === 'stop') expect(f.driver.stop('workflow')).toBe(true); else await f.driver.close();
      await started; await f.driver.settled();
      expect(f.acceptanceTruth.aborted).toBe(true);
      f.acceptanceTruth.release(); await new Promise(resolve => setImmediate(resolve));
      expect(f.driver.snapshot('workflow')).toMatchObject({ state: 'blocked', reason: 'cancelled', acceptance: 'unverified' });
      expect(f.acceptanceTruth.finalized).toBe(0);
      expect(f.db.prepare('SELECT count(*) n FROM acceptance_final').get()).toEqual({ n: 0 });
      expect(f.db.prepare('SELECT SUM(upper_units) n FROM integration_budget_reservation').get()).toEqual({ n: 20 });
      await f.driver.close();
    }
  });
  it('bounded acceptance timeout blocks completion and ignores late evidence', async () => {
    const f = fixture(true); f.acceptanceTruth.mode = 'hang';
    f.driver.prepare(f.run); f.approve(); f.driver.activate(f.run); await f.driver.start(f.run);
    expect(f.acceptanceTruth.aborted).toBe(true); f.acceptanceTruth.release(); await new Promise(resolve => setImmediate(resolve));
    expect(f.driver.snapshot('workflow')).toMatchObject({ state: 'blocked', reason: 'acceptance_unverified', acceptance: 'unverified' });
    expect(f.acceptanceTruth.finalized).toBe(0); await f.driver.close();
  });
  it('binds immutable requirement criteria before approval without inventing acceptance', async () => {
    const f = fixture();
    f.host.resolveRequirementChecker = () => ({ id: 'tests', revision: 'v1', kinds: ['code'],evidencePolicies:[{requirementId:'req',kind:'code',producerTaskIds:['make'],sourceRevision:'approved-workspace-source',targetIds:['workspace'],checkerId:'tests',checkerRevision:'v1',parametersDigest:'a'.repeat(64),hostileCheckIds:['negative'],requiredSectionIds:[],claimIds:[],requiresRender:false}] });
    f.configuration.requirements = [{ id: 'req', text: 'The required behavior passes its checks', kind: 'code', required: true,
      checks: [{ checkerId: 'tests', revision: 'v1', parametersDigest: 'a'.repeat(64), targetIds: ['workspace'] }] }];
    const summary = f.driver.prepare(f.run);
    expect(summary.requirementsDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(f.db.prepare('SELECT requirements_digest FROM requirement_contract_binding WHERE run_id=?').get('workflow')).toEqual({ requirements_digest: summary.requirementsDigest });
    f.configuration.requirements[0].text = 'silently weakened';
    f.host.resolveRequirementChecker = () => undefined;
    expect(f.driver.prepare(f.run).requirements[0].text).toBe('The required behavior passes its checks');
    f.approve(); f.driver.activate(f.run); await f.driver.start(f.run);
    expect(f.driver.snapshot('workflow')).toMatchObject({ reason: 'acceptance_unverified' });
    await f.driver.close();
  });
  it('freezes policy/DAG/budget approval summary, activates without parent lease and serializes stages', async () => {
    const f = fixture(); const summary = f.driver.prepare(f.run);
    expect(summary).toMatchObject({ mode: 'efficiency', policyRevision: 'policy:1', currency: 'TEST', unit: 'micro', limitUnits: 100, stageCount: 2 });
    expect(Object.isFrozen(summary.stages)).toBe(true); expect(summary.planDigest).toMatch(/^[a-f0-9]{64}$/);
    f.configuration.budget.limitUnits = 999; expect(f.driver.prepare(f.run).limitUnits).toBe(100);
    expect(() => f.driver.activate(f.run)).toThrow('approval_required'); f.approve();
    expect(f.driver.activate(f.run)).toEqual({ state: 'running', started: true });
    expect(f.db.prepare('SELECT count(*) n FROM workspace_write_lease').get()).toEqual({ n: 0 });
    await f.driver.start(f.run); expect(f.truth.launches).toEqual(['make', 'check']);
    expect(f.driver.snapshot('workflow')).toMatchObject({ state: 'blocked', reason: 'acceptance_unverified', acceptance: 'unverified', unresolvedAttemptIds: [] });
    await f.driver.close();
  });
  it('start replay shares the owned promise and never relaunches finished stages', async () => {
    const f = fixture(); f.driver.prepare(f.run); f.approve(); f.driver.activate(f.run);
    const first = f.driver.start(f.run); expect(f.driver.start(f.run)).toBe(first); await first; await f.driver.start(f.run);
    expect(f.truth.launches).toEqual(['make', 'check']); await f.driver.close();
  });
  it('prepare failure rolls back policy binding, budget and plan rows', () => {
    const f = fixture(); f.truth.prepareAllowed = false;
    expect(() => f.driver.prepare(f.run)).toThrow('plan_not_authorized');
    for (const table of ['selection_run_policy', 'integration_budget', 'orchestration_plan']) expect(f.db.prepare(`SELECT count(*) n FROM ${table}`).get()).toEqual({ n: 0 });
    expect(() => f.driver.activate(f.run)).toThrow('prepare_missing');
  });
  it('denied actual admission never launches and close rejects unknown ownership', async () => {
    const f = fixture(); f.truth.admission = false; f.driver.prepare(f.run); f.approve(); f.driver.activate(f.run);
    await f.driver.start(f.run); expect(f.truth.launches).toEqual([]);
    expect(f.driver.snapshot('workflow').unresolvedAttemptIds).toHaveLength(1);
    await expect(f.driver.close()).rejects.toThrow('cleanup_unverified');
  });
  it('outer transaction rollback invalidates cached preparation and permits clean shutdown', async () => {
    const f = fixture();
    expect(() => f.db.transaction(() => { f.driver.prepare(f.run); throw Error('outer_rollback'); })()).toThrow('outer_rollback');
    f.approve();
    expect(() => f.driver.prepare(f.run)).toThrow('preparation_not_persisted');
    expect(() => f.driver.activate(f.run)).toThrow('preparation_not_persisted');
    expect(() => f.driver.start(f.run)).toThrow('preparation_not_persisted');
    expect(f.truth.launches).toEqual([]);
    await expect(f.driver.close()).resolves.toBeUndefined();
  });
  it('identical plan digests never share scope grants between workflows', async () => {
    const f = fixture(); const first = f.driver.prepare(f.run);
    const work2 = join(f.run.envelope.worktree_realpath, '..', 'work2'); mkdirSync(work2);
    const envelope = normalizeEnvelope({ ...f.run.envelope, run_id: 'workflow2', worktree_realpath: work2 });
    const secondRun = { ...f.run, runId: 'workflow2', taskId: 'root-task2', envelope, envelopeHash: envelopeHash(envelope) };
    f.db.prepare("INSERT INTO task VALUES('root-task2','awaiting_approval',NULL,'now')").run();
    f.db.prepare("INSERT INTO envelope VALUES(?,?,'[]','now')").run(secondRun.envelopeHash, work2);
    f.db.prepare("INSERT INTO run VALUES('workflow2','root-task2',?,0,'now')").run(secondRun.envelopeHash);
    f.configuration.scopes[0].worktreeRealpath = work2;
    f.configuration.budget.runId = 'workflow2';
    f.host.stage = (_ctx: any, run: any) => ({ worktreeRealpath: run.envelope.worktree_realpath,
      allowedActions: [], egress: [], expiresAt: run.envelope.expires_at, autonomyLevel: 'bounded' });
    const second = f.driver.prepare(secondRun); expect(second.planDigest).toBe(first.planDigest);
    f.db.prepare("INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,approval_id,request_ordinal,decision,created_at) VALUES('workflow2',?,'desktop','goal2','approval2',0,'accept','now')").run(secondRun.envelopeHash);
    f.driver.activate(secondRun); await f.driver.start(secondRun);
    expect(f.truth.launches).toEqual(['make', 'check']);
    const paths = f.db.prepare('SELECT e.worktree_realpath FROM orchestration_stage_envelope s JOIN envelope e ON e.envelope_hash=s.stage_envelope_hash WHERE s.workflow_run_id=?').all('workflow2');
    expect(paths).toEqual([{ worktree_realpath: work2 }, { worktree_realpath: work2 }]);
    await f.driver.close();
  });
  it('unknown cleanup prevents verifier stage and keeps writer lease and reservation', async () => {
    const f = fixture(); f.truth.cleanup = false; f.driver.prepare(f.run); f.approve(); f.driver.activate(f.run); await f.driver.start(f.run);
    expect(f.truth.launches).toEqual(['make']); expect(f.driver.snapshot('workflow').state).toBe('blocked');
    expect(f.db.prepare('SELECT count(*) n FROM workspace_write_lease').get()).toEqual({ n: 1 });
    expect(f.db.prepare('SELECT SUM(upper_units) n FROM integration_budget_reservation').get()).toEqual({ n: 10 });
    await expect(f.driver.close()).rejects.toThrow('cleanup_unverified');
  });
  it('synchronous stop cancels an in-flight start, retains late ownership, and refuses unsafe close', async () => {
    const f = fixture(); f.truth.pendingLaunch = true; f.truth.cleanup = false;
    f.driver.prepare(f.run); f.approve(); f.driver.activate(f.run); const started = f.driver.start(f.run);
    expect(f.driver.stop('workflow')).toBe(true); expect(f.driver.stop('workflow')).toBe(false); await started;
    expect(f.truth.launches).toEqual(['make']);
    await expect(f.driver.close()).rejects.toThrow('cleanup_unverified');
    for (const release of f.releases.values()) release(); await new Promise(done => setImmediate(done));
    expect(f.truth.cancels).toBe(1); expect(f.db.prepare('SELECT count(*) n FROM workspace_write_lease').get()).toEqual({ n: 1 });
  });
  it('keeps a serial timeout wait claim unresolved without a new host delivery', async () => {
    const f=fixture();f.truth.hold=true;f.truth.finish=false;f.truth.cleanup=false;f.configuration.limits.taskTimeoutMs=25;
    f.driver.prepare(f.run);f.approve();f.driver.activate(f.run);await f.driver.start(f.run);
    const row=f.db.prepare(`SELECT a.task_id,a.attempt_id,i.identity_id FROM orchestration_attempt a JOIN orchestration_attempt_identity i ON i.attempt_id=a.attempt_id WHERE a.task_id='make'`).get() as any;
    expect(f.driver.snapshot('workflow')).toMatchObject({state:'blocked',reason:'orchestration_timeout',unresolvedAttemptIds:[row.attempt_id]});
    expect(f.db.prepare('SELECT SUM(upper_units) n FROM integration_budget_reservation').get()).toEqual({n:10});
    f.driver.waitRequest({requestId:'serial-timeout-wait',runId:'workflow',taskId:row.task_id,attemptId:row.attempt_id,identityId:row.identity_id,requestOrdinal:1,streamId:'serial-timeout-stream',reason:'external-response',responseSchema:'cue-wait-response-v1',createdAtMs:time,deadlineAtMs:time+1000,expectedResponder:{id:'fixture-responder',revision:'v1'}});
    f.driver.waitResponse({eventId:'serial-timeout-event',requestId:'serial-timeout-wait',responseId:'serial-timeout-response',responseOrdinal:1,responder:{id:'fixture-responder',revision:'v1'},contentRef:'response-ref-serial-timeout',observedAtMs:time});
    await expect(f.driver.deliverWaitResponse({requestId:'serial-timeout-wait',responseId:'serial-timeout-response',claimedAtMs:time})).resolves.toMatchObject({delivery:'blocked-unresolved',newlyClaimed:true});
    expect(f.truth.deliveries).toBe(0);expect(f.db.prepare('SELECT COUNT(*) n FROM orchestration_wait_delivery_observation').get()).toEqual({n:0});
    await expect(f.driver.deliverWaitResponse({requestId:'serial-timeout-wait',responseId:'serial-timeout-response',claimedAtMs:time})).resolves.toMatchObject({delivery:'blocked-unresolved',newlyClaimed:false});expect(f.truth.deliveries).toBe(0);
    await expect(f.driver.settled()).rejects.toThrow('cleanup_unverified');await expect(f.driver.close()).rejects.toThrow('cleanup_unverified');
  });
  it('keeps a serial execution-error wait claim unresolved without a new host delivery', async () => {
    const f=fixture();f.truth.failuresRemaining=1;f.truth.cleanup=false;f.truth.onFailure=()=>{throw Error('fixture_receipt_failure');};
    f.driver.prepare(f.run);f.approve();f.driver.activate(f.run);await f.driver.start(f.run);
    const row=f.db.prepare(`SELECT a.task_id,a.attempt_id,i.identity_id FROM orchestration_attempt a JOIN orchestration_attempt_identity i ON i.attempt_id=a.attempt_id WHERE a.task_id='make'`).get() as any;
    expect(f.driver.snapshot('workflow')).toMatchObject({state:'blocked',reason:'orchestration_execution_failed',unresolvedAttemptIds:[row.attempt_id]});
    expect(f.db.prepare('SELECT SUM(upper_units) n FROM integration_budget_reservation').get()).toEqual({n:10});
    f.driver.waitRequest({requestId:'serial-error-wait',runId:'workflow',taskId:row.task_id,attemptId:row.attempt_id,identityId:row.identity_id,requestOrdinal:1,streamId:'serial-error-stream',reason:'external-response',responseSchema:'cue-wait-response-v1',createdAtMs:time,deadlineAtMs:time+1000,expectedResponder:{id:'fixture-responder',revision:'v1'}});
    f.driver.waitResponse({eventId:'serial-error-event',requestId:'serial-error-wait',responseId:'serial-error-response',responseOrdinal:1,responder:{id:'fixture-responder',revision:'v1'},contentRef:'response-ref-serial-error',observedAtMs:time});
    await expect(f.driver.deliverWaitResponse({requestId:'serial-error-wait',responseId:'serial-error-response',claimedAtMs:time})).resolves.toMatchObject({delivery:'blocked-unresolved',newlyClaimed:true});
    expect(f.truth.deliveries).toBe(0);expect(f.db.prepare('SELECT COUNT(*) n FROM orchestration_wait_delivery_observation').get()).toEqual({n:0});
    await expect(f.driver.deliverWaitResponse({requestId:'serial-error-wait',responseId:'serial-error-response',claimedAtMs:time})).resolves.toMatchObject({delivery:'blocked-unresolved',newlyClaimed:false});expect(f.truth.deliveries).toBe(0);
    await expect(f.driver.settled()).rejects.toThrow('cleanup_unverified');await expect(f.driver.close()).rejects.toThrow('cleanup_unverified');
  });
  it('delivers a committed wait response once to the owned live handle and never resends after reopen', async () => {
    const f=fixture();f.truth.hold=true;f.driver.prepare(f.run);f.approve();f.driver.activate(f.run);const started=f.driver.start(f.run);
    for(let n=0;n<50&&!f.db.prepare("SELECT 1 FROM orchestration_attempt_identity").get();n++)await new Promise(done=>setTimeout(done,2));
    const identity=f.db.prepare("SELECT identity_id,attempt_id FROM orchestration_attempt_identity ORDER BY rowid LIMIT 1").get() as any;
    expect(identity).toBeTruthy();const request=(ordinal:number)=>({requestId:`wait-${ordinal}`,runId:'workflow',taskId:'make',attemptId:identity.attempt_id,identityId:identity.identity_id,requestOrdinal:ordinal,streamId:`stream-${ordinal}`,reason:'external-response' as const,responseSchema:'cue-wait-response-v1' as const,createdAtMs:time,deadlineAtMs:time+1000,expectedResponder:{id:'fixture-responder',revision:'v1'}});
    f.driver.waitRequest(request(1));f.driver.waitResponse({eventId:'wait-event-1',requestId:'wait-1',responseId:'response-1',responseOrdinal:1,responder:{id:'fixture-responder',revision:'v1'},contentRef:'response-ref',observedAtMs:time});
    await expect(f.driver.deliverWaitResponse({requestId:'wait-1',responseId:'response-1',claimedAtMs:time})).resolves.toMatchObject({delivery:'delivered-observed',newlyClaimed:true});expect(f.truth.deliveries).toBe(1);
    f.driver.waitRequest(request(2));f.driver.waitResponse({eventId:'wait-event-2',requestId:'wait-2',responseId:'response-2',responseOrdinal:2,responder:{id:'fixture-responder',revision:'v1'},contentRef:'response-ref',observedAtMs:time});delete f.host.deliverWaitResponse;
    await expect(f.driver.deliverWaitResponse({requestId:'wait-2',responseId:'response-2',claimedAtMs:time})).resolves.toMatchObject({delivery:'unsupported',newlyClaimed:true});
    const reopened=createOrchestrationDriver({db:f.db,host:f.host});await expect(reopened.deliverWaitResponse({requestId:'wait-2',responseId:'response-2',claimedAtMs:time})).resolves.toMatchObject({delivery:'blocked-unresolved',newlyClaimed:false});expect(f.truth.deliveries).toBe(1);
    f.driver.stop('workflow');await started;await expect(f.driver.close()).rejects.toThrow('cleanup_unverified');
  });
});
