import { afterEach,describe,expect,it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync,rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openLedger,type Ledger } from '../src/ledger.js';
import { normalizeEnvelope,envelopeHash } from '../src/envelope.js';
import { saveSelectionPolicy,bindRunSelectionPolicy } from '../src/selection/policy-store.js';
import { validateTaskPlan } from '../src/orchestration/plan.js';
import { createOrchestrationStore } from '../src/orchestration/store.js';
import { createRequirementContractStore } from '../src/verification/requirements.js';
import { createStageEnvelopeBinder } from '../src/orchestration/stage-envelope.js';
import { createBudgetManager } from '../src/budget.js';
import { createRecoveryPolicyStore } from '../src/orchestration/recovery-policy.js';
import { createHeldRecovery } from '../src/held-recovery.js';

const base={cause:'transient' as const,priorCandidateId:'a',candidateId:null,candidateApproved:false,candidateAuthenticated:false,candidateCapable:false,terminalHandoffVerified:true,cleanupVerified:true,writerLeaseReleasable:true,externalEffects:'not-applicable' as const,retryableHostCode:true,quotaResetAtMs:null,nowMs:10,deadlineMs:100,attemptsUsed:1,maxAttemptsTotal:3,independentQualityFailure:false,unchangedPlan:true,policySealed:false,priorCandidateEligible:true,budgetAvailable:true};
const roots:string[]=[],handles:Ledger[]=[];
afterEach(()=>{for(const db of handles.splice(0))if(db.open)db.close();for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});
const sha=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');

function ownedFixture(){
  const root=mkdtempSync(join(tmpdir(),'cue-recovery-policy-'));roots.push(root);const db=openLedger(join(root,'ledger.db'));handles.push(db);db.pragma('foreign_keys=ON');
  const envelope=normalizeEnvelope({run_id:'run',worktree_realpath:root,allowed_actions:[],egress:[],expires_at:new Date(10000).toISOString(),autonomy_level:'bounded'}),envelopeDigest=envelopeHash(envelope);
  db.prepare("INSERT INTO task VALUES('root','awaiting_approval',NULL,'now')").run();db.prepare("INSERT INTO envelope VALUES(?,?,'[]','now')").run(envelopeDigest,root);db.prepare("INSERT INTO run VALUES('run','root',?,0,'now')").run(envelopeDigest);
  const policy=saveSelectionPolicy(db,{policyId:'policy',expectedRevision:null,createdAt:new Date(1000).toISOString(),sourceVersion:'fixture',policy:{version:'cue-selection-v1',mode:'efficiency',qualityMinimum:.5,costBasis:1,timeBasisMs:1,currency:'TEST',costLimit:null,remainingTimeMs:null,maxEstimateAgeMs:100,allowedCandidateIds:['agent'],pinnedCandidateId:'agent'}});
  bindRunSelectionPolicy(db,{runId:'run',policyId:'policy',revision:1,digest:policy.digest,boundAt:new Date(1000).toISOString()});
  const approval={policyRevision:'policy:1',policyDigest:policy.digest,requirementIds:['req'],allowedCandidateIds:['agent'],allowedScopeIds:[]};
  const plan=validateTaskPlan(approval,{revision:'plan1',policyRevision:'policy:1',policyDigest:policy.digest,tasks:[
    {id:'make',role:'model-producer' as const,ownerId:'maker',requirementIds:['req'],dependencyIds:[],candidateIds:['agent'],scopeIds:[]},
    {id:'check',role:'verifier' as const,ownerId:'checker',requirementIds:['req'],dependencyIds:['make'],candidateIds:['agent'],scopeIds:[]},
  ]});
  const artifact=Buffer.from('recovery-artifact'),clock={now:1000,retryCalls:0,retryMutationAt:0,recoveryMutation:null as null|(()=>void),claimMutation:null as null|(()=>void)};
  const store=createOrchestrationStore(db,{authorizePlan:()=>true,authorizeClaim:()=>{clock.claimMutation?.();return true;},verifyReceipt:context=>({outcomeVerified:true,cleanupVerified:true,handoff:{handoffId:`handoff-${context.attemptId}`,identityId:`identity-${context.attemptId}`,artifacts:[{kind:'output',sourceRef:`artifact-${context.attemptId}`}]}}),resolveHandoffArtifact:()=>artifact,authorizeHandoffArtifact:()=>true,retry:{now:()=>{clock.retryCalls++;if(clock.retryCalls===clock.retryMutationAt)db.prepare("INSERT INTO orchestration_attempt VALUES('clock-consumer','run','check','agent','running','{}',?,NULL,0)").run(root);return clock.now;},authorizeContract:()=>true,classifyFailure:()=>({cause:'transient',sourceRef:'host-proof',sourceDigest:'a'.repeat(64),observedAtMs:clock.now})}});
  store.install('run',plan);
  const requirements=createRequirementContractStore(db,{now:()=>clock.now,resolveChecker:()=>({id:'tests',revision:'v1',kinds:['code'],evidencePolicies:[{requirementId:'req',kind:'code',producerTaskIds:['make'],sourceRevision:'fixture',targetIds:['work'],checkerId:'tests',checkerRevision:'v1',parametersDigest:'b'.repeat(64),hostileCheckIds:['negative'],requiredSectionIds:[],claimIds:[],requiresRender:false}]})}).bind('run',[{id:'req',text:'Required behavior',kind:'code',required:true,checks:[{checkerId:'tests',revision:'v1',parametersDigest:'b'.repeat(64),targetIds:['work']}]}]);
  const retry=store.bindRetryContract({runId:'run',requirementsDigest:requirements.requirements.digest,maxAttemptsPerTask:3,maxAttemptsTotal:2,deadlineMs:9000,boundAtMs:1000});
  db.prepare("INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,approval_id,request_ordinal,decision,created_at) VALUES('run',?,'desktop','goal','approval',0,'accept','now')").run(envelopeDigest);db.prepare("UPDATE task SET state='running' WHERE id='root'").run();
  const budget=createBudgetManager(db,{verifyFinalReceipt:()=>false});budget.initialize({runId:'run',currency:'TEST',unit:'micro',limitUnits:100,policyRevision:'policy:1',source:'fixture',observedAtMs:1000});
  const recovery=createRecoveryPolicyStore(db,{now:()=>{clock.recoveryMutation?.();return clock.now;},observeFailure:()=>({cause:'quality-failure',sourceRef:'quality-proof',observedAtMs:1000,externalEffects:'not-applicable',retryableHostCode:false,quotaResetAtMs:null,independentQualityFailure:true,priorCandidateEligible:true}),readObservation:ref=>ref==='quality-proof'?Buffer.from('quality-proof'):null,observeCandidate:()=>null,resolveHandoffArtifact:()=>artifact,authorizeHandoffArtifact:()=>true});
  const approvalId=(db.prepare("SELECT id FROM approval_event WHERE run_id='run'").get() as {id:number}).id;recovery.registerScope({runId:'run',approvalId,budgetKind:'monetary',budgetIdentity:'run',maxAttemptsTotal:2,deadlineMs:9000,createdAtMs:1000});
  store.claim({runId:'run',taskId:'make',attemptId:'failed',candidateId:'agent',observedAtMs:1000,revision:0,planDigest:plan.digest});
  const stage=createStageEnvelopeBinder(db,{now:()=>clock.now,authorizeStage:()=>true,resolveScope:()=>{throw Error('no-scope');}}).bind({workflowRunId:'run',taskId:'make',attemptId:'failed',parentEnvelope:envelope,revision:0,planDigest:plan.digest,stage:{worktreeRealpath:root,allowedActions:[],egress:[],expiresAt:envelope.expires_at,autonomyLevel:'bounded'}});
  const selectionBody=JSON.stringify({fixture:true});db.prepare("INSERT INTO attempt_selection VALUES('failed','run','fixture-request','monetary',?,?)").run(sha(selectionBody),selectionBody);
  store.handoffActivity.recordLaunchIntent({runId:'run',taskId:'make',attemptId:'failed',candidateId:'agent',selectionDigest:sha(selectionBody),expectedSubjectDigest:'c'.repeat(64),tool:{id:'fixture',revision:'v1'},model:null,parentEnvelopeHash:envelopeDigest,stageEnvelopeHash:stage.envelopeHash,planDigest:plan.digest,policyDigest:policy.digest});
  db.prepare("INSERT INTO session_handle VALUES('session',1,'fixture',?,'root','failed')").run(root);store.handoffActivity.recordAttemptIdentity({identityId:'identity-failed',attemptId:'failed',subjectDigest:'c'.repeat(64),durableRef:'session:session',observedAtMs:1000});
  store.finish({runId:'run',taskId:'make',attemptId:'failed',receiptId:'receipt-failed',revision:1,outcome:'failed',cleanup:'clean',evidenceRef:'quality-proof',observedAtMs:1000});
  return{db,plan,approval,recovery,clock,retry,store,budget};
}
function issueReplan(f:ReturnType<typeof ownedFixture>,decisionId:string){
  const observation=f.recovery.observeFailure({runId:'run',attemptId:'failed'}),decision=f.recovery.recordDecision({decisionId,observationId:observation.observationId});
  const proposed={revision:'plan2',policyRevision:f.approval.policyRevision,policyDigest:f.approval.policyDigest,tasks:f.plan.tasks.map(task=>({...task}))};
  const revised=f.recovery.appendRevision({runId:'run',decisionId,approval:f.approval,plan:proposed,createdAtMs:1001});
  return{decision,revised};
}
function replacement(f:ReturnType<typeof ownedFixture>,decisionId:string,planDigest:string){return{runId:'run',taskId:'make',attemptId:'replacement',candidateId:'agent',observedAtMs:f.clock.now,revision:1,planDigest,recoveryDecisionId:decisionId};}
function expectNoReplacement(f:ReturnType<typeof ownedFixture>){expect(f.db.prepare("SELECT 1 FROM orchestration_attempt WHERE attempt_id='replacement'").get()).toBeUndefined();expect(f.db.prepare("SELECT 1 FROM orchestration_recovery_activation WHERE attempt_id='replacement'").get()).toBeUndefined();expect(f.db.prepare("SELECT write_in_progress FROM run WHERE id='run'").get()).toEqual({write_in_progress:0});}
describe('S4 decision-backed recovery claim limits',()=>{
  it('uses a valid bound retry contract and recovery scope',()=>{
    const f=ownedFixture();expect(f.db.prepare("SELECT 1 FROM orchestration_retry_contract WHERE run_id='run'").get()).toBeDefined();expect(f.db.prepare("SELECT 1 FROM orchestration_recovery_scope WHERE run_id='run'").get()).toBeDefined();
  });
  it('rejects a persisted replan replacement after the original deadline',()=>{
    const f=ownedFixture(),issued=issueReplan(f,'deadline-decision');f.clock.now=9000;
    expect(()=>f.store.claim(replacement(f,'deadline-decision',issued.revised.digest))).toThrow('retry_deadline');expectNoReplacement(f);
  });
  it('rejects a persisted replan replacement after cumulative attempts are consumed',()=>{
    const f=ownedFixture(),issued=issueReplan(f,'attempt-decision');f.db.prepare("INSERT INTO orchestration_attempt VALUES('slot-consumer','run','check','agent','running','{}',?,NULL,0)").run((f.db.prepare("SELECT worktree_realpath FROM orchestration_attempt WHERE attempt_id='failed'").get() as {worktree_realpath:string}).worktree_realpath);
    expect(()=>f.store.claim(replacement(f,'attempt-decision',issued.revised.digest))).toThrow('retry_attempt_limit');expectNoReplacement(f);
  });
  it('re-reads limits after the final authorization callback and admits an in-limit control',()=>{
    const late=ownedFixture(),issued=issueReplan(late,'late-decision');late.clock.claimMutation=()=>{late.clock.claimMutation=null;late.clock.now=9000;};expect(()=>late.store.claim(replacement(late,'late-decision',issued.revised.digest))).toThrow('retry_deadline');expectNoReplacement(late);
    late.db.close();handles.splice(handles.indexOf(late.db),1);
    const allowed=ownedFixture(),control=issueReplan(allowed,'control-decision');expect(allowed.store.claim(replacement(allowed,'control-decision',control.revised.digest))).toMatchObject({launchRequired:true,state:'running'});
  });
});
