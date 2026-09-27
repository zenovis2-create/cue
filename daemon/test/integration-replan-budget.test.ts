import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import Database from 'better-sqlite3';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { createHash } from 'node:crypto';
import { openLedger, type Ledger } from '../src/ledger.js';
import { applyOrchestrationRetryMigration } from '../src/orchestration/retry-migration.js';
import { createOrchestrationStore, type ClaimRequest, type RetryReason, type RetryReference } from '../src/orchestration/store.js';
import { createOrchestrationEngine, type EngineRequest } from '../src/orchestration/engine.js';
import { createIntegrationRuntime } from '../src/integration-runtime.js';
import { createBudgetManager } from '../src/budget.js';
import { normalizeEnvelope, envelopeHash } from '../src/envelope.js';
import { saveSelectionPolicy, bindRunSelectionPolicy } from '../src/selection/policy-store.js';
import { validateTaskPlan } from '../src/orchestration/plan.js';
import { createRequirementContractStore } from '../src/verification/requirements.js';
import { createStageEnvelopeBinder } from '../src/orchestration/stage-envelope.js';
import { createRecoveryPolicyStore } from '../src/orchestration/recovery-policy.js';

const roots: string[] = [], handles: Ledger[] = [];
afterEach(() => { for (const db of handles.splice(0)) if (db.open) db.close(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const request = (attemptId = 'first', taskId = 'make'): ClaimRequest => ({ runId: 'run', taskId, attemptId, candidateId: 'agent', observedAtMs: 1000 });
function fixture(upgraded = true) {
  const root = mkdtempSync(join(tmpdir(), 'cue-retry-')); roots.push(root);
  const path = join(root, 'ledger.db'), db = upgraded ? openLedger(path) : new Database(path); handles.push(db);
  // An actual prior schema, independent of the current openLedger migrations.
  if (!upgraded) for (const name of readdirSync(resolve('migrations')).filter(name => /^\d{3}_.*\.sql$/.test(name) && Number(name.slice(0, 3)) <= 15).sort()) db.exec(readFileSync(resolve('migrations', name), 'utf8'));
  db.pragma('foreign_keys=ON');
  if (upgraded) applyOrchestrationRetryMigration(db);
  const envelope = normalizeEnvelope({ run_id: 'run', worktree_realpath: root, allowed_actions: ['file_change'], egress: [],
    expires_at: new Date(100000).toISOString(), autonomy_level: 'bounded' });
  const hash = envelopeHash(envelope);
  db.prepare("INSERT INTO task VALUES('parent','awaiting_approval',NULL,'now')").run();
  db.prepare("INSERT INTO envelope VALUES(?,?,'[]','now')").run(hash, root);
  db.prepare("INSERT INTO run VALUES('run','parent',?,0,'now')").run(hash);
  const policy = saveSelectionPolicy(db, { policyId: 'policy', expectedRevision: null, createdAt: new Date(1000).toISOString(), sourceVersion: 'fixture', policy: {
    version: 'cue-selection-v1', mode: 'efficiency', qualityMinimum: 0.5, costBasis: 1, timeBasisMs: 1, currency: 'TEST', costLimit: null,
    remainingTimeMs: null, maxEstimateAgeMs: 100, allowedCandidateIds: ['agent'], pinnedCandidateId: 'agent',
  } });
  bindRunSelectionPolicy(db, { runId: 'run', policyId: 'policy', revision: 1, digest: policy.digest, boundAt: new Date(1000).toISOString() });
  const approval = { policyRevision: 'policy:1', policyDigest: policy.digest, requirementIds: ['req'], allowedCandidateIds: ['agent'], allowedScopeIds: ['work'] };
  const plan = validateTaskPlan(approval, { revision: 'plan1', policyRevision: 'policy:1', policyDigest: policy.digest, tasks: [
    { id: 'make', role: 'implementation', ownerId: 'maker', requirementIds: ['req'], dependencyIds: [], candidateIds: ['agent'], scopeIds: ['work'] },
    { id: 'check', role: 'verifier', ownerId: 'checker', requirementIds: ['req'], dependencyIds: ['make'], candidateIds: ['agent'], scopeIds: [] },
  ] });
  const artifactBytes=Buffer.from('retry fixture output');
  const sha=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
  const truth = { now: 1000, classify: true, cleanup: true, launches: [] as string[], failPreparation: false };
  const host = { authorizePlan: () => true, authorizeClaim: () => true,
    verifyReceipt: (context:any) => ({ outcomeVerified: true, cleanupVerified: truth.cleanup, ...(truth.cleanup?{handoff:{handoffId:`handoff-${context.attemptId}`,identityId:`identity-${context.attemptId}`,artifacts:[{kind:'output',sourceRef:`artifact-${context.attemptId}`}]}}:{}) }),
    resolveHandoffArtifact: (sourceRef:string,attemptId:string) => sourceRef===`artifact-${attemptId}`?artifactBytes:null,
    authorizeHandoffArtifact: (sourceRef:string,attemptId:string) => sourceRef===`artifact-${attemptId}`,
    retry: { now: () => truth.now, authorizeContract: () => true,
      classifyFailure: (_context: unknown, receipt: any): RetryReason | null => {
        expect(receipt.outcome).toBe('failed'); expect(Object.isFrozen(receipt)).toBe(true);
        return truth.classify ? { cause: 'transient', sourceRef: 'host-proof', sourceDigest: 'a'.repeat(64), observedAtMs: truth.now } : null;
      } },
  };
  const store = createOrchestrationStore(db, host); store.install('run', plan);
  const requirements = createRequirementContractStore(db, { now: () => 1000, resolveChecker: () => ({ id: 'tests', revision: 'v1', kinds: ['code'], evidencePolicies:[{
    requirementId:'req',kind:'code',producerTaskIds:['make'],sourceRevision:'fixture-source-v1',targetIds:['work'],checkerId:'tests',checkerRevision:'v1',parametersDigest:'b'.repeat(64),hostileCheckIds:['negative'],requiredSectionIds:[],claimIds:[],requiresRender:false,
  }] }) }).bind('run', [
    { id: 'req', text: 'Required behavior', kind: 'code', required: true, checks: [{ checkerId: 'tests', revision: 'v1', parametersDigest: 'b'.repeat(64), targetIds: ['work'] }] },
  ]);
  const terms = { runId: 'run', requirementsDigest: requirements.requirements.digest, maxAttemptsPerTask: 3, maxAttemptsTotal: 4, deadlineMs: 5000, boundAtMs: 1000 };
  const approve = () => {
    db.prepare("INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,approval_id,request_ordinal,decision,created_at) VALUES('run',?,'desktop','goal','approval',0,'accept','now')").run(hash);
    db.prepare("UPDATE task SET state='running' WHERE id='parent'").run();
  };
  const bindStage = (attemptId: string, taskId = 'make', revision = 0, planDigest = plan.digest) => createStageEnvelopeBinder(db, { now: () => truth.now, authorizeStage: () => true,
    resolveScope: () => ({ id: 'work', worktreeRealpath: root, allowedActions: ['file_change'], egress: [] }) }).bind({
      workflowRunId: 'run', taskId, attemptId, revision, planDigest, parentEnvelope: envelope,
      stage: { worktreeRealpath: root, allowedActions: taskId === 'make' ? ['file_change'] : [], egress: [], expiresAt: envelope.expires_at, autonomyLevel: 'bounded' },
    });
  const finish = (attemptId = 'first', outcome: 'failed' | 'succeeded' = 'failed', taskId = 'make') => {
    let stage=db.prepare('SELECT parent_envelope_hash,stage_envelope_hash,plan_digest,policy_digest FROM orchestration_stage_envelope WHERE attempt_id=?').get(attemptId) as any;
    if(!stage){const lineage=db.prepare('SELECT ar.revision,p.plan_digest FROM orchestration_attempt_revision ar JOIN orchestration_plan_revision p ON p.run_id=ar.run_id AND p.revision=ar.revision WHERE ar.attempt_id=?').get(attemptId) as {revision:number;plan_digest:string};bindStage(attemptId,taskId,lineage.revision,lineage.plan_digest);stage=db.prepare('SELECT parent_envelope_hash,stage_envelope_hash,plan_digest,policy_digest FROM orchestration_stage_envelope WHERE attempt_id=?').get(attemptId) as any;}
    let selection=db.prepare('SELECT digest FROM attempt_selection WHERE attempt_id=?').get(attemptId) as {digest:string}|undefined;
    if(!selection){const body=JSON.stringify({fixture:true,attemptId});const digest=sha(body);db.prepare("INSERT INTO attempt_selection VALUES(?,?,'fixture-request','monetary',?,?)").run(attemptId,'run',digest,body);selection={digest};}
    const subject=sha(`subject-${attemptId}`),session=`session-${attemptId}`;
    store.handoffActivity.recordLaunchIntent({runId:'run',taskId,attemptId,candidateId:'agent',selectionDigest:selection.digest,expectedSubjectDigest:subject,tool:{id:'fixture-tool',revision:'v1'},model:null,parentEnvelopeHash:stage.parent_envelope_hash,stageEnvelopeHash:stage.stage_envelope_hash,planDigest:stage.plan_digest,policyDigest:stage.policy_digest});
    if(!db.prepare('SELECT 1 FROM session_handle WHERE handle=?').get(session))db.prepare('INSERT INTO session_handle VALUES(?,?,?,?,?,?)').run(session,1,'fixture',root,'parent',attemptId);
    store.handoffActivity.recordAttemptIdentity({identityId:`identity-${attemptId}`,attemptId,subjectDigest:subject,durableRef:`session:${session}`,observedAtMs:truth.now});
    return store.finish({ runId: 'run', taskId, attemptId, receiptId: `receipt-${attemptId}`, revision: 1, outcome, cleanup: truth.cleanup ? 'clean' : 'unknown', evidenceRef: 'host-proof', observedAtMs: truth.now });
  };
  const retry = (contractDigest: string, attemptId = 'second', previousAttemptId = 'first') => ({ ...request(attemptId),
    retry: { previousAttemptId, receiptId: `receipt-${previousAttemptId}`, contractDigest } });
  const budget = createBudgetManager(db, { verifyFinalReceipt: () => false });
  budget.initialize({ runId: 'run', currency: 'TEST', unit: 'micro', limitUnits: 100, policyRevision: 'policy:1', source: 'fixture', observedAtMs: 1000 });
  // Inert host runtime fixture: this unit verifies transaction composition, not OS admission.
  const runtime = { start: async (attemptId: string) => {
    expect(db.inTransaction).toBe(false); truth.launches.push(attemptId);
    return { ok: true, handle: { cancel: async () => 'requested', inspectCleanup: async () => 'not-ready', snapshot: () => null } };
  } } as unknown as ReturnType<typeof createIntegrationRuntime>;
  const engine = createOrchestrationEngine(db, { store, budget, runtime }, {
    now: () => truth.now, verifyBudgetMapping: () => true, authorizeExecution: () => true,
    observeCandidates: () => [{ id: 'agent', checks: { eligible: true, authenticated: true, compatible: true, dataAllowed: true, resourceAvailable: true, quotaAvailable: true },
      estimate: { scope: 'verified-completion-total', quality: 1, expectedCost: 1, conservativeMaxCost: 1, expectedTimeMs: 1, conservativeMaxTimeMs: 1, currency: 'TEST', source: 'fixture', observedAtMs: truth.now } }],
    reservation: context => ({ runId: 'run', attemptId: context.request.attemptId, requestId: context.request.requestId, currency: 'TEST', unit: 'micro', upperUnits: 40,
      scope: 'verified-completion-attempt-total', source: 'fixture', observedAtMs: truth.now }),
    prepareExecution: context => { if (truth.failPreparation) throw Error('fixture_prepare_fail'); bindStage(context.request.attemptId, context.task.id, context.request.revision!, context.request.planDigest!); },
    receipts: () => ({ execution: null, billing: null }),
  });
  const engineRequest = (attemptId = 'first', retry?: RetryReference): EngineRequest =>
    ({ runId: 'run', taskId: 'make', attemptId, requestId: `request-${attemptId}`, observedAtMs: truth.now, timeoutMs: 100, revision:0, planDigest:plan.digest, ...(retry ? { retry } : {}) });
  const recovery=createRecoveryPolicyStore(db,{now:()=>truth.now,observeFailure:()=>({cause:'quality-failure',sourceRef:'quality-proof',observedAtMs:truth.now,externalEffects:'not-applicable',retryableHostCode:false,quotaResetAtMs:null,independentQualityFailure:true,priorCandidateEligible:true}),readObservation:ref=>ref==='quality-proof'?Buffer.from('quality-proof'):null,observeCandidate:()=>null,resolveHandoffArtifact:host.resolveHandoffArtifact,authorizeHandoffArtifact:host.authorizeHandoffArtifact});
  return { root, path, db, store, host, truth, plan, approval, requirements, terms, approve, finish, retry, bindStage, budget, engine, engineRequest, recovery };
}

async function prepared(){const f=fixture();const contract=f.store.bindRetryContract(f.terms);f.approve();const approvalId=(f.db.prepare("SELECT id FROM approval_event WHERE run_id='run'").get() as {id:number}).id;f.recovery.registerScope({runId:'run',approvalId,budgetKind:'monetary',budgetIdentity:'run',maxAttemptsTotal:contract.maxAttemptsTotal,deadlineMs:contract.deadlineMs,createdAtMs:1000});await f.engine.start(f.plan,{...f.engineRequest(),revision:0,planDigest:f.plan.digest});f.finish();const observation=f.recovery.observeFailure({runId:'run',attemptId:'first'}),decision=f.recovery.recordDecision({decisionId:'replan',observationId:observation.observationId}),proposed={revision:'plan2',policyRevision:f.approval.policyRevision,policyDigest:f.approval.policyDigest,tasks:f.plan.tasks.map(task=>({...task}))},revised=f.recovery.appendRevision({runId:'run',decisionId:decision.decisionId,approval:f.approval,plan:proposed,createdAtMs:1001});return{f,decision,revised,proposed};}
function revisedRequest(x:Awaited<ReturnType<typeof prepared>>,attemptId='second'){return{...x.f.engineRequest(attemptId),revision:1,planDigest:x.revised.digest,recoveryDecisionId:x.decision.decisionId};}
describe('S4 replan cumulative budget and requirements',()=>{
 it('rolls back revised engine admission when remaining original budget is consumed',async()=>{const x=await prepared();x.f.budget.reserve({runId:'run',requestId:'outside',attemptId:'capacity-contention',currency:'TEST',unit:'micro',upperUnits:60,scope:'verified-completion-attempt-total',source:'fixture',observedAtMs:1000});await expect(x.f.engine.start(x.revised,revisedRequest(x))).rejects.toThrow('budget_limit_exceeded');expect(x.f.truth.launches).toEqual(['first']);expect(x.f.budget.summary('run').committedUnits).toBe(100n);for(const table of ['orchestration_attempt','orchestration_recovery_activation','orchestration_stage_envelope','attempt_selection'])expect((x.f.db.prepare("SELECT COUNT(*) n FROM "+table+" WHERE attempt_id='second'").get() as {n:number}).n).toBe(0);});
 it('adds revised reservation cumulatively and replays without reset or relaunch',async()=>{const x=await prepared(),request=revisedRequest(x);const started=await x.f.engine.start(x.revised,request);expect(started.replayed).toBe(false);expect(x.f.budget.summary('run').committedUnits).toBe(80n);const replay=await x.f.engine.start(x.revised,request);expect(replay.replayed).toBe(true);expect(x.f.budget.summary('run').committedUnits).toBe(80n);expect(x.f.truth.launches).toEqual(['first','second']);});
 it('rejects altered authority and removed original requirements without changing stored revisions',async()=>{const x=await prepared(),changed={...x.f.approval,requirementIds:['other']},count=()=>x.f.db.prepare('SELECT COUNT(*) n FROM orchestration_plan_revision').get() as {n:number},before=count().n;expect(()=>x.f.recovery.appendRevision({runId:'run',decisionId:x.decision.decisionId,approval:changed as any,plan:x.proposed,createdAtMs:1002})).toThrow('replan_authority_changed');expect(()=>x.f.recovery.appendRevision({runId:'run',decisionId:x.decision.decisionId,approval:x.f.approval,plan:{...x.proposed,tasks:x.proposed.tasks.map(t=>({...t,requirementIds:[]}))},createdAtMs:1002})).toThrow('invalid_plan:array-size');expect(count().n).toBe(before);const original=x.f.recovery.readRevision('run',0,x.f.plan.digest);expect(original.approval.requirementIds).toEqual(['req']);expect(original.tasks.every(t=>t.requirementIds.includes('req'))).toBe(true);expect(x.f.recovery.readRevision('run',1,x.revised.digest).digest).toBe(x.revised.digest);});
});
