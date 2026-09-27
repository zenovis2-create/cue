import { readRunOutcome } from '../src/evaluation/run-outcome.js';
import { createLocalInvocationBudget } from '../src/local-invocation-budget.js';
import { saveLocalSelectionPolicy, bindRunLocalSelectionPolicy } from '../src/selection/local-policy-store.js';
import { applyOrchestrationRetryMigration } from '../src/orchestration/retry-migration.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { openLedger, type Ledger } from '../src/ledger.js';
import { normalizeEnvelope, envelopeHash } from '../src/envelope.js';
import { saveSelectionPolicy, bindRunSelectionPolicy } from '../src/selection/policy-store.js';
import { validateTaskPlan } from '../src/orchestration/plan.js';
import { createOrchestrationStore } from '../src/orchestration/store.js';
import { createHandoffActivityStore } from '../src/orchestration/handoff-activity.js';
import { createStageEnvelopeBinder } from '../src/orchestration/stage-envelope.js';
import { createRequirementContractStore, type RequirementKind } from '../src/verification/requirements.js';
import { createBudgetManager } from '../src/budget.js';
import { createAcceptanceVerifier, readAcceptanceHistory, type AcceptanceHost, type AcceptanceChecker, type AcceptanceManifest, type RawCheckerObservation, type CheckerContext } from '../src/verification/acceptance.js';
import { createGeneratedOutputStore, generatedOutputParametersDigest } from '../src/verification/generated-output.js';
import { readRunOutcomeReport } from '../src/reports/ir.js';
import type { EvidenceObservation } from '../src/verification/evidence-policy.js';
const roots: string[] = [], handles: Ledger[] = [];
afterEach(() => { for (const db of handles.splice(0)) if (db.open) db.close(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const kinds: RequirementKind[] = ['code', 'research', 'document', 'external'];
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
function fixture(multipleMakers = false, withRetry = false, retryTask = 'make', makerRole: 'implementation' | 'model-producer' = 'implementation', generated = false) {
  const root = mkdtempSync(join(tmpdir(), 'cue-acceptance-')); roots.push(root);
  const db = openLedger(join(root, 'ledger.db')); handles.push(db);
  for (const file of ['009_selection_policy.sql', '010_orchestration.sql', '012_stage_envelope.sql', '013_requirement_contract.sql', '014_requirement_acceptance.sql']) db.exec(readFileSync(resolve('migrations', file), 'utf8'));
  if (withRetry) applyOrchestrationRetryMigration(db);
  const clock = Date.parse('2026-09-11T00:00:00.000Z');
  const parent = normalizeEnvelope({ run_id: 'run', worktree_realpath: root, allowed_actions: ['file_change'], egress: [], expires_at: new Date(clock + 3600000).toISOString(), autonomy_level: 'bounded' });
  const parentHash = envelopeHash(parent);
  db.prepare("INSERT INTO task VALUES('root-task','awaiting_approval',NULL,'now')").run();
  db.prepare("INSERT INTO envelope VALUES(?,?,'[]','now')").run(parentHash, root);
  db.prepare("INSERT INTO run VALUES('run','root-task',?,0,'now')").run(parentHash);
  const policy = saveSelectionPolicy(db, { policyId: 'policy', expectedRevision: null, createdAt: new Date(clock).toISOString(), sourceVersion: 'fixture', policy: {
    version: 'cue-selection-v1', mode: 'efficiency', qualityMinimum: .5, costBasis: 1, timeBasisMs: 1000, currency: 'TEST', costLimit: null, remainingTimeMs: null, maxEstimateAgeMs: 100, allowedCandidateIds: ['agent'], pinnedCandidateId: null,
  } });
  bindRunSelectionPolicy(db, { runId: 'run', policyId: 'policy', revision: 1, digest: policy.digest, boundAt: new Date(clock).toISOString() });
  const approval = { policyRevision: 'policy:1', policyDigest: policy.digest, requirementIds: kinds, allowedCandidateIds: ['agent'], allowedScopeIds: ['workspace'] };
  const plan = validateTaskPlan(approval, { revision: 'plan1', policyRevision: approval.policyRevision, policyDigest: approval.policyDigest, tasks: [
    { id: 'make', role: makerRole, ownerId: 'maker', requirementIds: kinds, dependencyIds: [], candidateIds: ['agent'], scopeIds: makerRole === 'implementation' ? ['workspace'] : [] },
    ...(multipleMakers ? [{ id: 'make-extra', role: 'implementation' as const, ownerId: 'other-maker', requirementIds: kinds, dependencyIds: [], candidateIds: ['agent'], scopeIds: ['workspace'] }] : []),
    { id: 'check', role: 'verifier', ownerId: 'reviewer', requirementIds: kinds, dependencyIds: multipleMakers ? ['make', 'make-extra'] : ['make'], candidateIds: ['agent'], scopeIds: [] },
  ] });
  const artifactBytes=Buffer.from('outcome-fixture-artifact');
  const store = createOrchestrationStore(db, { authorizePlan: () => true, authorizeClaim: () => true, verifyReceipt: (context) => ({ outcomeVerified: true, cleanupVerified: true, handoff:{handoffId:`handoff-${context.attemptId}`,identityId:`identity-${context.attemptId}`,artifacts:[{kind:'output',sourceRef:`artifact-${context.attemptId}`}]}}), resolveHandoffArtifact:()=>artifactBytes, authorizeHandoffArtifact:()=>true, retry: { now: () => clock, authorizeContract: () => true, classifyFailure: () => ({ cause: 'transient', sourceRef: 'host-retry', sourceDigest: hash('retry'), observedAtMs: clock }) } });
  const handoffs=createHandoffActivityStore(db,{resolveArtifact:()=>artifactBytes,authorizeArtifact:()=>true});
  store.install('run', plan);
  const requirementStore = createRequirementContractStore(db, { now: () => clock, resolveChecker: (id, revision) => {const kind=kinds.find(value=>id===`checker-${value}`);if(!kind)return undefined;const parametersDigest=generated&&kind==='document'?generatedOutputParametersDigest(generatedParameters):hash(kind);return {id,revision,kinds:[kind],evidencePolicies:[{requirementId:kind,kind,producerTaskIds:plan.tasks.filter(task=>task.role!=='verifier').map(task=>task.id),sourceRevision:plan.digest,targetIds:[`target-${kind}`],checkerId:id,checkerRevision:revision,parametersDigest,hostileCheckIds:kind==='code'?['negative']:[],requiredSectionIds:kind==='document'?['approved-section']:[],claimIds:kind==='research'?['approved-claim']:[],requiresRender:kind==='document',...(kind==='external'?{remote:{accountId:'account',resourceId:'resource',operationId:'operation',idempotencyKey:'key',expectedTransition:'updated',observerId:'remote-reader',observerRevision:'v1'}}:{})}]};} });
  const inputBytes = Buffer.from('{"answer":42}');
  const generatedParameters = { version: 'cue-generated-output-v1' as const, kind: 'generated-output' as const, targetId: 'target-document', requirementId: 'document', producerTaskId: 'make', checkerId: 'checker-document', checkerRevision: 'v1', inputSha256: hash(inputBytes.toString()), maxBytes: 1024 };
  requirementStore.bind('run', kinds.map(kind => ({ id: kind, text: `${kind} approved criterion`, kind, required: true, checks: [{ checkerId: `checker-${kind}`, revision: 'v1', parametersDigest: generated && kind === 'document' ? generatedOutputParametersDigest(generatedParameters) : hash(kind), targetIds: [`target-${kind}`] }] })));
  const outputs = createGeneratedOutputStore(db, { now: () => clock, authorizeObservation: () => true });
  if (generated) outputs.bindTarget({ runId: 'run', targetId: 'target-document', requirementId: 'document', producerTaskId: 'make', checkerId: 'checker-document', checkerRevision: 'v1', inputBytes, maxBytes: 1024, boundAtMs: clock });
  const retryContract = withRetry ? store.bindRetryContract({ runId: 'run', requirementsDigest: requirementStore.read('run')!.requirements.digest, maxAttemptsPerTask: 3, maxAttemptsTotal: 8, boundAtMs: clock, deadlineMs: clock + 30000 }) : null;
  db.prepare("INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,request_ordinal,decision,created_at) VALUES('run',?,'desktop','goal',0,'accept','now')").run(parentHash);
  db.prepare("UPDATE task SET state='running' WHERE id='root-task'").run();
  const binder = createStageEnvelopeBinder(db, { now: () => clock, authorizeStage: () => true, resolveScope: id => ({ id, worktreeRealpath: root, allowedActions: parent.allowed_actions, egress: [] }) });
  for (const task of multipleMakers ? ['make', 'make-extra', 'check'] : ['make', 'check']) {
    const attemptId = `attempt-${task}`;
    const writes = task === 'make-extra' || task === 'make' && makerRole === 'implementation';
    if (withRetry && task === retryTask) {
      store.claim({ runId: 'run', taskId: task, attemptId: 'failed-maker', candidateId: 'agent', observedAtMs: clock });
      if(!db.prepare("SELECT 1 FROM attempt_selection WHERE attempt_id='failed-maker'").get())db.prepare("INSERT INTO attempt_selection VALUES('failed-maker','run','fixture-failed','monetary',?,'{}')").run(hash('selection-failed-maker'));
      const failedStage=binder.bind({ workflowRunId: 'run', taskId: task, attemptId: 'failed-maker', parentEnvelope: parent, stage: { worktreeRealpath: root, allowedActions: writes ? ['file_change'] : [], egress: [], expiresAt: parent.expires_at, autonomyLevel: 'supervised' } });
      db.prepare('INSERT INTO session_handle VALUES(?,?,?,?,?,?)').run('session-failed-maker',1,'now',root,failedStage.owner.task_id,failedStage.owner.run_id);
      const failedSelection=db.prepare("SELECT digest FROM attempt_selection WHERE attempt_id='failed-maker'").get() as any;
      handoffs.recordLaunchIntent({runId:'run',taskId:task,attemptId:'failed-maker',candidateId:'agent',selectionDigest:failedSelection.digest,expectedSubjectDigest:hash('failed-maker'),tool:{id:'fixture-tool',revision:'unknown'},model:null,parentEnvelopeHash:parentHash,stageEnvelopeHash:failedStage.envelopeHash,planDigest:failedStage.planDigest,policyDigest:failedStage.policyDigest});
      handoffs.recordAttemptIdentity({identityId:'identity-failed-maker',attemptId:'failed-maker',subjectDigest:hash('failed-maker'),durableRef:'session:session-failed-maker',observedAtMs:clock});
      store.finish({ runId: 'run', taskId: task, attemptId: 'failed-maker', receiptId: 'failed-maker-receipt', revision: 1, outcome: 'failed', cleanup: 'clean', evidenceRef: 'host-failure', observedAtMs: clock });
      store.claimRetry({ runId: 'run', taskId: task, attemptId, candidateId: 'agent', observedAtMs: clock, retry: { previousAttemptId: 'failed-maker', receiptId: 'failed-maker-receipt', contractDigest: retryContract!.digest } });
    } else store.claim({ runId: 'run', taskId: task, attemptId, candidateId: 'agent', observedAtMs: clock });
    if(!db.prepare('SELECT 1 FROM attempt_selection WHERE attempt_id=?').get(attemptId))db.prepare("INSERT INTO attempt_selection VALUES(?,'run',?,'monetary',?,'{}')").run(attemptId,`fixture-${attemptId}`,hash(`selection-${attemptId}`));
    const stage=binder.bind({ workflowRunId: 'run', taskId: task, attemptId, parentEnvelope: parent, stage: { worktreeRealpath: root, allowedActions: writes ? ['file_change'] : [], egress: [], expiresAt: parent.expires_at, autonomyLevel: 'supervised' } });
    db.prepare('INSERT INTO session_handle VALUES(?,?,?,?,?,?)').run(`session-${attemptId}`,1,'now',root,stage.owner.task_id,stage.owner.run_id);
    const selection=db.prepare('SELECT digest FROM attempt_selection WHERE attempt_id=?').get(attemptId) as any;
    handoffs.recordLaunchIntent({runId:'run',taskId:task,attemptId,candidateId:'agent',selectionDigest:selection.digest,expectedSubjectDigest:hash(attemptId),tool:{id:'fixture-tool',revision:'unknown'},model:null,parentEnvelopeHash:parentHash,stageEnvelopeHash:stage.envelopeHash,planDigest:stage.planDigest,policyDigest:stage.policyDigest});
    handoffs.recordAttemptIdentity({identityId:`identity-${attemptId}`,attemptId,subjectDigest:hash(attemptId),durableRef:`session:session-${attemptId}`,observedAtMs:clock});
    store.finish({ runId: 'run', taskId: task, attemptId, receiptId: `finished-${task}`, revision: 1, outcome: 'succeeded', cleanup: 'clean', evidenceRef: 'fixture-completion', observedAtMs: clock });
  }
  if (generated) {
    for (const attemptId of withRetry ? ['failed-maker', 'attempt-make'] : ['attempt-make']) outputs.record({ runId: 'run', targetId: 'target-document', attemptId, observationId: `output-${attemptId}`, observedAtMs: clock, bytes: Buffer.from('generated-response-fixture') });
  }
  const budget = createBudgetManager(db, { verifyFinalReceipt: () => false });
  budget.initialize({ runId: 'run', currency: 'TEST', unit: 'micro', limitUnits: 100, policyRevision: 'policy:1', source: 'fixture', observedAtMs: clock });
  budget.reserve({ runId: 'run', requestId: 'bill', attemptId: 'attempt-make', currency: 'TEST', unit: 'micro', upperUnits: 50, source: 'pending-fixture', observedAtMs: clock, scope: 'verified-completion-attempt-total' });
  const flags = { now: clock, available: true, collision: false, missingPrincipal: false, current: true, rawMode: 'valid', manifestMode: 'valid', hang: false, delayMs: 0, captured: 0, aborted: false, lockSeen: false, onCurrent: undefined as (() => void) | undefined };
  const registry = new Map<string, AcceptanceChecker>();
  for (const kind of kinds) registry.set(`checker-${kind}`, {
    id: `checker-${kind}`, revision: 'v1', kinds: [kind], evidencePolicies:requirementStore.read('run')!.requirements.evidencePolicies.filter(policy=>policy.kind===kind),
    async collect(context, signal) {
      flags.captured++; signal.addEventListener('abort', () => { flags.aborted = true; });
      if (flags.hang) return await new Promise<RawCheckerObservation>(() => {});
      if (flags.delayMs) await new Promise(done => setTimeout(done, flags.delayMs));
      const targets=context.targets.map(target=>({targetId:target.targetId,kind:target.kind,byteLength:target.sizeBytes,digest:target.digest,...(kind==='research'?{sourceIdentity:'retrieved-source',retrievedAtMs:flags.now}:{}),...(kind==='external'?{accountId:'account',resourceId:'resource',operationId:'operation',idempotencyKey:'key',transition:'updated',observerId:'remote-reader',observerRevision:'v1',observedAtMs:flags.now}:{})}));
      const evidence:EvidenceObservation={origin:'host-observation',checkerId:context.check.checkerId,checkerRevision:context.check.revision,checkerPrincipal:context.reviewerPrincipal,producerAttemptPrincipal:context.producerPrincipals[0]??'',parametersDigest:context.check.parametersDigest,observedAtMs:flags.now,sourceRevision:context.evidencePolicy.sourceRevision,exitStatus:0,targetManifestDigest:hash(JSON.stringify(targets)),verdict:'pass',hostileChecks:kind==='code'?['negative']:[],claimSourceMap:kind==='research'?{'approved-claim':['target-research']}:{},requirementSections:kind==='document'?['approved-section']:[],renderVerified:kind==='document',targets};
      const raw: RawCheckerObservation = { contextDigest: context.digest, principalId: context.reviewerPrincipal, sourceRefs: ['host-check/source'], observedAt: flags.now, origin: 'host-observation', bytes: Buffer.from(JSON.stringify({ assertions: 3, failures: 0 })),evidence };
      if (flags.rawMode === 'self-report') return { ...raw, origin: 'model-report' };
      if (flags.rawMode === 'model-json') return { ...raw, bytes: Buffer.from('{"pass":true}'),evidence:undefined };
      if (flags.rawMode === 'wrong-lineage') return { ...raw, contextDigest: hash('another-run-plan-policy-parameters') };
      if (flags.rawMode === 'empty') return { ...raw, bytes: new Uint8Array() };
      if (flags.rawMode === 'missing-source') return { ...raw, sourceRefs: [] };
      if (flags.rawMode === 'fail') return { ...raw, bytes: Buffer.from('{"assertions":3,"failures":1}'),evidence:{...evidence,verdict:'fail'} };
      return raw;
    },
    evaluate(_context, raw) { const parsed = JSON.parse(Buffer.from(raw.bytes).toString()); return Number.isSafeInteger(parsed.assertions) && parsed.assertions > 0 && Number.isSafeInteger(parsed.failures) ? parsed.failures === 0 ? 'pass' : 'fail' : 'unknown'; },
  });
  const host: AcceptanceHost = {
    now: () => flags.now, timeoutMs: 1000, maxObservationAgeMs: 10000,
    resolveChecker: (id, revision) => flags.available && revision === 'v1' ? registry.get(id) : undefined,
    principalForAttempt: binding => flags.missingPrincipal ? null : binding.taskId.startsWith('make') ? `actual-${binding.taskId}` : flags.collision ? multipleMakers ? 'actual-make-extra' : 'actual-make' : 'actual-reviewer',
    async captureManifest(context, signal) {
      signal.addEventListener('abort', () => { flags.aborted = true; });
      const artifacts = kinds.map(kind => ({ targetId: `target-${kind}`, digest: hash(`actual-${kind}`), sizeBytes: 10, sourceRef: `source/${kind}`,
        kind: kind === 'research' ? 'retrieved-source' as const : kind === 'external' ? 'remote-state' as const : 'filesystem' as const }));
      const output = generated ? outputs.read('run', 'target-document', 'attempt-make') : null;
      const manifest: AcceptanceManifest = { ...context, artifacts: artifacts.map(a => output && a.targetId === 'target-document' ? { targetId: a.targetId, digest: output.record.sha256, sizeBytes: output.record.byteLength, sourceRef: `cue-generated-output:${output.record.digest}`, kind: 'generated-output' as const } : a), observedAt: flags.now };
      if (flags.manifestMode === 'empty-artifact') return { ...manifest, artifacts: artifacts.map(a => ({ ...a, sizeBytes: 0 })) };
      if (flags.manifestMode === 'missing-target') return { ...manifest, artifacts: artifacts.slice(1) };
      if (flags.manifestMode === 'wrong-run') return { ...manifest, runId: 'other' };
      return manifest;
    },
    isManifestCurrent() { flags.lockSeen = !!db.prepare("SELECT 1 FROM workspace_write_lease WHERE run_id='run'").get(); flags.onCurrent?.(); return flags.current; },
  };
  return { root, db, binder, store, budget, flags, host, outputs, verifier: createAcceptanceVerifier(db, host) };
}
describe('ledger outcome collection without trial fabrication',()=>{
  it('verified acceptance stays success with unresolved billing and numeric quality unknown',async()=>{
    const f=fixture(); const evaluation=await f.verifier.collect('run'); expect(f.verifier.finalize(evaluation).status).toBe('accepted');
    const before=f.db.prepare('SELECT total_changes() n').get(), result=readRunOutcome(f.db,{runId:'run'});
    expect(result).toMatchObject({status:'recorded',outcome:'success',outcomeBasis:'historical-acceptance',quality:null,elapsedMs:null,accounting:{kind:'monetary',final:false,actualUnits:null},trialReadiness:{status:'not-convertible'}});
    expect(result?.status==='recorded'&&result.uncertaintyReasons).toContain('billing-unresolved');
    expect(f.db.prepare('SELECT total_changes() n').get()).toEqual(before);
    expect(readRunOutcome(f.db,{runId:'run'})).toEqual(result);expect(Object.isFrozen(result)).toBe(true);
    expect(JSON.stringify(result)).not.toContain(f.root);expect(JSON.stringify(result)).not.toContain('fixture-completion');
    f.db.close();const reopened=openLedger(join(f.root,'ledger.db'));handles.push(reopened);expect(readRunOutcome(reopened,{runId:'run'})).toEqual(result);
  });
  it('provider completion without acceptance remains unknown and stored failure is explicitly unverified',()=>{
    const f=fixture();expect(readRunOutcome(f.db,{runId:'run'})).toMatchObject({status:'recorded',outcome:'unknown',quality:null});
    f.db.exec("UPDATE task SET state='failed' WHERE id='root-task'");
    expect(readRunOutcome(f.db,{runId:'run'})).toMatchObject({status:'recorded',outcome:'fail',outcomeBasis:'stored-task-failure',quality:null});
  });
  it('cancel request preserves unresolved cleanup and does not claim process termination',()=>{
    const f=fixture();f.db.exec("UPDATE task SET state='blocked',blocked_reason='cancelled' WHERE id='root-task'; UPDATE orchestration_attempt SET cleanup_verified=0 WHERE attempt_id='attempt-make'");
    expect(readRunOutcome(f.db,{runId:'run'})).toMatchObject({status:'recorded',outcome:'cancelled',outcomeBasis:'stored-cancel-request',uncertaintyReasons:expect.arrayContaining(['cleanup-unresolved','cancellation-not-clean'])});
  });
  it('retains failed retry history instead of exporting only latest successes',()=>{
    const f=fixture(false,true);const result=readRunOutcome(f.db,{runId:'run'});
    expect(result?.status).toBe('recorded');if(result?.status!=='recorded')throw Error('fixture');
    expect(result.attempts).toHaveLength(3);expect(result.attempts.find(a=>a.attemptId==='failed-maker')?.state).toBe('failed');expect(result.trialReadiness.status).toBe('not-convertible');
  });
  it('late actual receipts change snapshot without double counting and unknown differs from actual zero',()=>{
    const f=fixture(), budget=createBudgetManager(f.db,{verifyFinalReceipt:()=>true});const before=readRunOutcome(f.db,{runId:'run'});
    budget.observe({runId:'run',requestId:'bill',receiptId:'actual-1',revision:1,currency:'TEST',unit:'micro',kind:'actual',units:0,providerFinal:false,source:'private-billing-source',observedAtMs:1});
    expect(readRunOutcome(f.db,{runId:'run'})).toMatchObject({accounting:{actualUnits:'0',final:false}});
    budget.observe({runId:'run',requestId:'bill',receiptId:'actual-2',revision:2,currency:'TEST',unit:'micro',kind:'actual',units:7,providerFinal:true,source:'private-billing-source',observedAtMs:2});
    const after=readRunOutcome(f.db,{runId:'run'});expect(after).toMatchObject({accounting:{actualUnits:'7',final:false}});
    expect(after?.status==='recorded'&&after.sourceDigest).not.toEqual(before?.status==='recorded'&&before.sourceDigest);expect(JSON.stringify(after)).not.toContain('private-billing-source');
  });
  it('exports authoritative all-reservation class totals through the outcome report and preserves debt totals',()=>{
    const f=fixture(),budget=createBudgetManager(f.db,{verifyFinalReceipt:()=>true});
    budget.reserve({runId:'run',requestId:'check-bill',attemptId:'attempt-check',currency:'TEST',unit:'micro',upperUnits:20,source:'fixture',observedAtMs:1,scope:'verified-completion-attempt-total'});
    budget.observe({runId:'run',requestId:'bill',receiptId:'bill-final',revision:1,currency:'TEST',unit:'micro',kind:'actual',units:70,providerFinal:true,source:'fixture',observedAtMs:2});
    budget.observe({runId:'run',requestId:'check-bill',receiptId:'check-final',revision:1,currency:'TEST',unit:'micro',kind:'actual',units:10,providerFinal:true,source:'fixture',observedAtMs:2});
    const direct=readRunOutcome(f.db,{runId:'run'});expect(direct).toMatchObject({status:'recorded',accounting:{final:true,actualUnits:'80',breakdown:{baseUnits:'70',retryUnits:'0',handoffUnits:null,verificationUnits:'10'}}});
    const report=readRunOutcomeReport(f.db,'run')!;expect((report.details as any).runOutcome).toEqual(direct);
    budget.observe({runId:'run',requestId:'bill',receiptId:'bill-debt',revision:2,currency:'TEST',unit:'micro',kind:'actual',units:120,providerFinal:true,source:'fixture',observedAtMs:3});
    expect(readRunOutcome(f.db,{runId:'run'})).toMatchObject({accounting:{final:true,actualUnits:'130',committedUnits:'130',remainingUnits:'0',debtUnits:'30',breakdown:{baseUnits:'120',verificationUnits:'10'}}});
  });
  it('keeps missing and estimated inventory unfinalized, and quarantines revised cost class without losing valid totals',()=>{
    const estimated=fixture(),estimatedBudget=createBudgetManager(estimated.db,{verifyFinalReceipt:()=>true});
    estimatedBudget.reserve({runId:'run',requestId:'check-bill',attemptId:'attempt-check',currency:'TEST',unit:'micro',upperUnits:20,source:'fixture',observedAtMs:1,scope:'verified-completion-attempt-total'});
    estimatedBudget.observe({runId:'run',requestId:'bill',receiptId:'bill-estimate',revision:1,currency:'TEST',unit:'micro',kind:'estimated',units:8,providerFinal:false,source:'fixture',observedAtMs:2});
    expect(readRunOutcome(estimated.db,{runId:'run'})).toMatchObject({accounting:{final:false,breakdown:{baseUnits:null,retryUnits:null,handoffUnits:null,verificationUnits:null}}});
    const missing=fixture();missing.budget.reserve({runId:'run',requestId:'extra',attemptId:'attempt-check',currency:'TEST',unit:'micro',upperUnits:5,source:'fixture',observedAtMs:1,scope:'verified-completion-attempt-total'});
    expect(readRunOutcome(missing.db,{runId:'run'})).toMatchObject({accounting:{final:false,breakdown:{baseUnits:null,verificationUnits:null}}});

    const revised=fixture(),revisedBudget=createBudgetManager(revised.db,{verifyFinalReceipt:()=>true});
    revisedBudget.reserve({runId:'run',requestId:'check-bill',attemptId:'attempt-check',currency:'TEST',unit:'micro',upperUnits:20,source:'fixture',observedAtMs:1,scope:'verified-completion-attempt-total'});
    revisedBudget.observe({runId:'run',requestId:'bill',receiptId:'bill-final',revision:1,currency:'TEST',unit:'micro',kind:'actual',units:7,providerFinal:true,source:'fixture',observedAtMs:2});
    revisedBudget.observe({runId:'run',requestId:'check-bill',receiptId:'check-final',revision:1,currency:'TEST',unit:'micro',kind:'actual',units:3,providerFinal:true,source:'fixture',observedAtMs:2});
    revised.db.pragma('foreign_keys=OFF');revised.db.exec('DROP TRIGGER recovery_attempt_current');revised.db.prepare("INSERT INTO orchestration_attempt_revision VALUES('attempt-make','run',99,'make')").run();
    expect(readRunOutcome(revised.db,{runId:'run'})).toMatchObject({accounting:{final:true,actualUnits:'10',committedUnits:'10',breakdown:{baseUnits:null,retryUnits:null,handoffUnits:null,verificationUnits:null}}});
  });
  it('classifies complete retry inventory without omitting failed attempts',()=>{
    const f=fixture(false,true),budget=createBudgetManager(f.db,{verifyFinalReceipt:()=>true});
    budget.reserve({runId:'run',requestId:'failed-bill',attemptId:'failed-maker',currency:'TEST',unit:'micro',upperUnits:20,source:'fixture',observedAtMs:1,scope:'verified-completion-attempt-total'});
    budget.reserve({runId:'run',requestId:'check-bill',attemptId:'attempt-check',currency:'TEST',unit:'micro',upperUnits:20,source:'fixture',observedAtMs:1,scope:'verified-completion-attempt-total'});
    for(const [requestId,units] of [['bill',7],['failed-bill',11],['check-bill',3]] as const)budget.observe({runId:'run',requestId,receiptId:`${requestId}-final`,revision:1,currency:'TEST',unit:'micro',kind:'actual',units,providerFinal:true,source:'fixture',observedAtMs:2});
    expect(readRunOutcome(f.db,{runId:'run'})).toMatchObject({accounting:{final:true,actualUnits:'21',breakdown:{baseUnits:'11',retryUnits:'7',handoffUnits:null,verificationUnits:'3'}}});
  });
  it('corrupt acceptance, contradictory parent state and corrupt policy fail closed',async()=>{
    const f=fixture();const evaluation=await f.verifier.collect('run');f.verifier.finalize(evaluation);
    f.db.exec("UPDATE task SET state='failed' WHERE id='root-task'");expect(readRunOutcome(f.db,{runId:'run'})?.status).toBe('unavailable');
    f.db.exec("UPDATE task SET state='completed' WHERE id='root-task'; DROP TRIGGER acceptance_final_no_update; UPDATE acceptance_final SET payload='{}'");expect(readRunOutcome(f.db,{runId:'run'})?.status).toBe('unavailable');
    const p=fixture();p.db.exec("DROP TRIGGER selection_policy_snapshot_no_update; UPDATE selection_policy_snapshot SET policy_json='{}'");expect(readRunOutcome(p.db,{runId:'run'})?.status).toBe('unavailable');
  });
  it('rejects outer writer transactions, missing runs, hostile DTO and oversized validation input before readers',()=>{
    const f=fixture();expect(readRunOutcome(f.db,{runId:'missing'})).toBeNull();expect(()=>f.db.transaction(()=>readRunOutcome(f.db,{runId:'run'}))()).toThrow('outcome_read_boundary');
    let reads=0;expect(()=>readRunOutcome(f.db,Object.defineProperty({},'runId',{enumerable:true,get(){reads++;return 'run';}}) as never)).toThrow();expect(reads).toBe(0);
    f.db.prepare('INSERT INTO acceptance_evaluation VALUES(?,?,?,?)').run('large','run','x'.repeat(8*1048576+1),'large');
    expect(readRunOutcome(f.db,{runId:'run'})).toEqual({status:'unavailable',runId:'run',authority:'evaluation-input-only',reason:'coverage-limit'});
  });
  it('local committed attempts remain nonmonetary and unavailable revisions do not become trial metadata',()=>{
    const db=openLedger();handles.push(db);
    const producer='provider/'+ 'm'.repeat(100), makerTask='group/make',policyId='policy/private',policyRevision=policyId+':1';
    db.exec("INSERT INTO task VALUES('task','running',NULL,'now'); INSERT INTO envelope VALUES('env','C:/PRIVATE','[]','now'); INSERT INTO run VALUES('local','task','env',0,'now')");
    const saved=saveLocalSelectionPolicy(db,{policyId,expectedRevision:null,sourceVersion:'fixture',createdAt:new Date(1000).toISOString(),policy:{version:'cue-local-selection-v1',mode:'value',producerCandidateId:producer,checkerCandidateId:'checker',limitAttempts:3,timeoutMs:1000}});
    bindRunLocalSelectionPolicy(db,{runId:'local',policyId:saved.policyId,revision:1,digest:saved.digest,boundAt:new Date(1000).toISOString()});
    const approval={policyRevision,policyDigest:saved.digest,requirementIds:['req'],allowedCandidateIds:[producer,'checker'],allowedScopeIds:[]};
    const plan=validateTaskPlan(approval,{revision:'plan',policyRevision:approval.policyRevision,policyDigest:saved.digest,tasks:[
      {id:makerTask,role:'model-producer',ownerId:'maker',requirementIds:['req'],dependencyIds:[],candidateIds:[producer],scopeIds:[]},
      {id:'check',role:'verifier',ownerId:'reviewer',requirementIds:['req'],dependencyIds:[makerTask],candidateIds:['checker'],scopeIds:[]},
    ]});
    const store=createOrchestrationStore(db,{authorizePlan:()=>true,authorizeClaim:()=>true,verifyReceipt:()=>({outcomeVerified:true,cleanupVerified:true})});store.install('local',plan);
    const budget=createLocalInvocationBudget(db);budget.initialize({runId:'local',limit:3,policyRevision:approval.policyRevision,source:'PRIVATE source',observedAtMs:1000});
    db.transaction(()=>{store.claim({runId:'local',taskId:makerTask,attemptId:'one',candidateId:producer,observedAtMs:1000});budget.reserve({runId:'local',taskId:makerTask,attemptId:'one',candidateId:producer,requestId:'r1',kind:'producer',observedAtMs:1000});})();
    const result=readRunOutcome(db,{runId:'local'});expect(result).toMatchObject({status:'recorded',outcome:'unknown',accounting:{kind:'local-invocation',committed:1,remaining:2,semantics:'committed-dispatch-intent'},trialReadiness:{status:'not-convertible'}});
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE|currency|actualUnits/);
    expect(result?.status==='recorded'&&result.attempts[0]!.modelRevision).toBeNull();
    expect(result?.status==='recorded'&&result.attempts[0]).toMatchObject({candidateId:null,taskId:null,candidateIdDigest:expect.stringMatching(/^[a-f0-9]{64}$/)});
    expect(result?.status==='recorded'&&result.policy).toMatchObject({id:null,idDigest:expect.stringMatching(/^[a-f0-9]{64}$/)});expect(JSON.stringify(result)).not.toContain(policyId);
  });
  it('attempt coverage overflow is unavailable, never a truncated success cohort',()=>{
    const f=fixture();f.db.transaction(()=>{for(let n=0;n<1023;n++){f.db.prepare('INSERT INTO orchestration_step VALUES(?,?,?)').run('run','extra-'+n,'blocked');f.db.prepare('INSERT INTO orchestration_attempt VALUES(?,?,?,?,?,?,?,?,0)').run('extra-'+n,'run','extra-'+n,'agent','blocked','{}',f.root,null);}})();
    expect(readRunOutcome(f.db,{runId:'run'})).toMatchObject({status:'unavailable',reason:'coverage-limit'});
  });
  it('zero attempts with excessive steps fails SQL preflight rather than invoking unbounded validation',()=>{
    const db=openLedger();handles.push(db);db.exec("INSERT INTO task VALUES('task','running',NULL,'now'); INSERT INTO envelope VALUES('env','fixture','[]','now'); INSERT INTO run VALUES('run','task','env',0,'now'); INSERT INTO orchestration_plan VALUES('run','env','digest','{}')");
    db.transaction(()=>{for(let n=0;n<4097;n++)db.prepare('INSERT INTO orchestration_step VALUES(?,?,?)').run('run','s'+n,'pending');})();
    expect(readRunOutcome(db,{runId:'run'})).toMatchObject({status:'unavailable',reason:'coverage-limit'});
  });
});
