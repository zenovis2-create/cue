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
import { decideRecovery,createRecoveryPolicyStore } from '../src/orchestration/recovery-policy.js';

const base={cause:'transient' as const,priorCandidateId:'a',candidateId:null,candidateApproved:false,candidateAuthenticated:false,candidateCapable:false,terminalHandoffVerified:true,cleanupVerified:true,writerLeaseReleasable:true,externalEffects:'not-applicable' as const,retryableHostCode:true,quotaResetAtMs:null,nowMs:10,deadlineMs:100,attemptsUsed:1,maxAttemptsTotal:3,independentQualityFailure:false,unchangedPlan:true,policySealed:false,priorCandidateEligible:true,budgetAvailable:true};
const roots:string[]=[],handles:Ledger[]=[];
afterEach(()=>{for(const db of handles.splice(0))if(db.open)db.close();for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});
const sha=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');

function ownedFixture(){
  const root=mkdtempSync(join(tmpdir(),'cue-recovery-policy-'));roots.push(root);const db=openLedger(join(root,'ledger.db'));handles.push(db);db.pragma('foreign_keys=ON');
  const envelope=normalizeEnvelope({run_id:'run',worktree_realpath:root,allowed_actions:[],egress:[],expires_at:new Date(10000).toISOString(),autonomy_level:'bounded'}),envelopeDigest=envelopeHash(envelope);
  db.prepare("INSERT INTO task VALUES('root','awaiting_approval',NULL,'now')").run();db.prepare("INSERT INTO envelope VALUES(?,?,'[]','now')").run(envelopeDigest,root);db.prepare("INSERT INTO run VALUES('run','root',?,0,'now')").run(envelopeDigest);
  const policy=saveSelectionPolicy(db,{policyId:'policy',expectedRevision:null,createdAt:new Date(1000).toISOString(),sourceVersion:'fixture',policy:{version:'cue-selection-v1',mode:'efficiency',qualityMinimum:.5,costBasis:1,timeBasisMs:1,currency:'TEST',costLimit:null,remainingTimeMs:null,maxEstimateAgeMs:100,allowedCandidateIds:['agent','alternate'],pinnedCandidateId:'agent'}});
  bindRunSelectionPolicy(db,{runId:'run',policyId:'policy',revision:1,digest:policy.digest,boundAt:new Date(1000).toISOString()});
  const approval={policyRevision:'policy:1',policyDigest:policy.digest,requirementIds:['req'],allowedCandidateIds:['agent','alternate'],allowedScopeIds:[]};
  const plan=validateTaskPlan(approval,{revision:'plan1',policyRevision:'policy:1',policyDigest:policy.digest,tasks:[
    {id:'make',role:'model-producer' as const,ownerId:'maker',requirementIds:['req'],dependencyIds:[],candidateIds:['agent','alternate'],scopeIds:[]},
    {id:'check',role:'verifier' as const,ownerId:'checker',requirementIds:['req'],dependencyIds:['make'],candidateIds:['agent'],scopeIds:[]},
  ]});
  const artifact=Buffer.from('recovery-artifact'),clock={now:1000,retryCalls:0,retryMutationAt:0,recoveryMutation:null as null|(()=>void),proofReads:0,candidateCalls:0,candidate:{authenticated:false,capable:false},observation:{cause:'quality-failure' as const,sourceRef:'quality-proof',observedAtMs:1000,externalEffects:'not-applicable' as const,retryableHostCode:false,quotaResetAtMs:null as number|null,independentQualityFailure:true,priorCandidateEligible:true} as any};
  const store=createOrchestrationStore(db,{authorizePlan:()=>true,authorizeClaim:()=>true,verifyReceipt:context=>({outcomeVerified:true,cleanupVerified:true,handoff:{handoffId:`handoff-${context.attemptId}`,identityId:`identity-${context.attemptId}`,artifacts:[{kind:'output',sourceRef:`artifact-${context.attemptId}`}]}}),resolveHandoffArtifact:()=>artifact,authorizeHandoffArtifact:()=>true,retry:{now:()=>{clock.retryCalls++;if(clock.retryCalls===clock.retryMutationAt)db.prepare("INSERT INTO orchestration_attempt VALUES('clock-consumer','run','check','agent','running','{}',?,NULL,0)").run(root);return clock.now;},authorizeContract:()=>true,classifyFailure:()=>({cause:'transient',sourceRef:'host-proof',sourceDigest:'a'.repeat(64),observedAtMs:clock.now})}});
  store.install('run',plan);
  const requirements=createRequirementContractStore(db,{now:()=>clock.now,resolveChecker:()=>({id:'tests',revision:'v1',kinds:['code'],evidencePolicies:[{requirementId:'req',kind:'code',producerTaskIds:['make'],sourceRevision:'fixture',targetIds:['work'],checkerId:'tests',checkerRevision:'v1',parametersDigest:'b'.repeat(64),hostileCheckIds:['negative'],requiredSectionIds:[],claimIds:[],requiresRender:false}]})}).bind('run',[{id:'req',text:'Required behavior',kind:'code',required:true,checks:[{checkerId:'tests',revision:'v1',parametersDigest:'b'.repeat(64),targetIds:['work']}]}]);
  const retry=store.bindRetryContract({runId:'run',requirementsDigest:requirements.requirements.digest,maxAttemptsPerTask:3,maxAttemptsTotal:2,deadlineMs:9000,boundAtMs:1000});
  db.prepare("INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,approval_id,request_ordinal,decision,created_at) VALUES('run',?,'desktop','goal','approval',0,'accept','now')").run(envelopeDigest);db.prepare("UPDATE task SET state='running' WHERE id='root'").run();
  const budget=createBudgetManager(db,{verifyFinalReceipt:()=>false});budget.initialize({runId:'run',currency:'TEST',unit:'micro',limitUnits:100,policyRevision:'policy:1',source:'fixture',observedAtMs:1000});
  const recovery=createRecoveryPolicyStore(db,{now:()=>{clock.recoveryMutation?.();return clock.now;},observeFailure:()=>clock.observation,readObservation:ref=>{clock.proofReads++;return ref==='quality-proof'?Buffer.from('quality-proof'):null},observeCandidate:()=>{clock.candidateCalls++;return clock.candidate},resolveHandoffArtifact:()=>artifact,authorizeHandoffArtifact:()=>true});
  const approvalId=(db.prepare("SELECT id FROM approval_event WHERE run_id='run'").get() as {id:number}).id;recovery.registerScope({runId:'run',approvalId,budgetKind:'monetary',budgetIdentity:'run',maxAttemptsTotal:2,deadlineMs:9000,createdAtMs:1000});
  store.claim({runId:'run',taskId:'make',attemptId:'failed',candidateId:'agent',observedAtMs:1000,revision:0,planDigest:plan.digest});
  const stage=createStageEnvelopeBinder(db,{now:()=>clock.now,authorizeStage:()=>true,resolveScope:()=>{throw Error('no-scope');}}).bind({workflowRunId:'run',taskId:'make',attemptId:'failed',parentEnvelope:envelope,revision:0,planDigest:plan.digest,stage:{worktreeRealpath:root,allowedActions:[],egress:[],expiresAt:envelope.expires_at,autonomyLevel:'bounded'}});
  const selectionBody=JSON.stringify({fixture:true});db.prepare("INSERT INTO attempt_selection VALUES('failed','run','fixture-request','monetary',?,?)").run(sha(selectionBody),selectionBody);
  store.handoffActivity.recordLaunchIntent({runId:'run',taskId:'make',attemptId:'failed',candidateId:'agent',selectionDigest:sha(selectionBody),expectedSubjectDigest:'c'.repeat(64),tool:{id:'fixture',revision:'v1'},model:null,parentEnvelopeHash:envelopeDigest,stageEnvelopeHash:stage.envelopeHash,planDigest:plan.digest,policyDigest:policy.digest});
  db.prepare("INSERT INTO session_handle VALUES('session',1,'fixture',?,'root','failed')").run(root);store.handoffActivity.recordAttemptIdentity({identityId:'identity-failed',attemptId:'failed',subjectDigest:'c'.repeat(64),durableRef:'session:session',observedAtMs:1000});
  store.finish({runId:'run',taskId:'make',attemptId:'failed',receiptId:'receipt-failed',revision:1,outcome:'failed',cleanup:'clean',evidenceRef:'quality-proof',observedAtMs:1000});
  return{db,plan,approval,recovery,clock,retry,store,budget};
}
describe('S4 recovery policy',()=>{
  it.each([false,true])('handles capability mismatch with approved alternate available=%s',available=>{
    const result=decideRecovery({...base,cause:'capability-mismatch',retryableHostCode:false,candidateId:'b',candidateApproved:available,candidateAuthenticated:true,candidateCapable:true});
    expect(result).toMatchObject({action:available?'switch':'replan',selectedCandidateId:available?'b':null,reason:available?'capable-alternate':'same-requirements-replan'});
    expect(decideRecovery({...base,cause:'capability-mismatch',cleanupVerified:false,candidateId:'b',candidateApproved:true,candidateAuthenticated:true,candidateCapable:true}).action).toBe('stop');
  });
  it('selects the branch from host facts and stops unknown or unsafe state',()=>{
    expect(decideRecovery(base).action).toBe('retry');
    expect(decideRecovery({...base,cause:'unknown'}).action).toBe('stop');
    expect(decideRecovery({...base,cleanupVerified:false}).action).toBe('stop');
    expect(decideRecovery({...base,externalEffects:'unknown'}).action).toBe('stop');
  });
  it('switches only to an approved authenticated capable alternate',()=>{
    const authentication={...base,cause:'authentication' as const,retryableHostCode:false,candidateId:'b'};
    expect(decideRecovery(authentication).action).toBe('stop');
    expect(decideRecovery({...authentication,candidateApproved:true,candidateAuthenticated:true,candidateCapable:true}).action).toBe('switch');
    expect(decideRecovery({...base,priorCandidateEligible:false,candidateId:'b',candidateApproved:true,candidateAuthenticated:true,candidateCapable:true}).action).toBe('switch');
  });
  it('requires reset proof for quota and independent failure for quality replans',()=>{
    expect(decideRecovery({...base,cause:'quota',retryableHostCode:false} as const).action).toBe('stop');
    expect(decideRecovery({...base,cause:'quota',retryableHostCode:false,quotaResetAtMs:50} as const).action).toBe('retry');
    expect(decideRecovery({...base,cause:'quality-failure',retryableHostCode:false} as const).action).toBe('stop');
    expect(decideRecovery({...base,cause:'quality-failure',retryableHostCode:false,independentQualityFailure:true} as const).action).toBe('replan');
  });
  it('re-reads the final monetary slot after the last recovery host callback',()=>{
    const f=ownedFixture(),observation=f.recovery.observeFailure({runId:'run',attemptId:'failed'});f.clock.recoveryMutation=()=>{f.clock.recoveryMutation=null;f.budget.reserve({runId:'run',requestId:'final-budget',attemptId:'failed',currency:'TEST',unit:'micro',upperUnits:100,source:'fixture-total',observedAtMs:1000,scope:'verified-completion-attempt-total'});};
    const decision=f.recovery.recordDecision({decisionId:'decision-stop',observationId:observation.observationId});
    expect(decision.action).toBe('stop');expect(decision.facts.budgetAvailable).toBe(false);expect(f.budget.summary('run').remainingUnits).toBe(0n);
  });
  it('rejects false-to-true and true-to-false classification authority drift',()=>{
    const promoted=ownedFixture();promoted.clock.observation.independentQualityFailure=false;const first=promoted.recovery.observeFailure({runId:'run',attemptId:'failed'});promoted.clock.observation.independentQualityFailure=true;
    expect(()=>promoted.recovery.recordDecision({decisionId:'drift-promoted',observationId:first.observationId})).toThrow('failure_observation_stale');
    expect(promoted.db.prepare('SELECT COUNT(*) n FROM orchestration_recovery_decision').get()).toEqual({n:0});
    const demoted=ownedFixture();const second=demoted.recovery.observeFailure({runId:'run',attemptId:'failed'});demoted.clock.observation.independentQualityFailure=false;
    expect(()=>demoted.recovery.recordDecision({decisionId:'drift-demoted',observationId:second.observationId})).toThrow('failure_observation_stale');
    expect(demoted.db.prepare('SELECT COUNT(*) n FROM orchestration_recovery_decision').get()).toEqual({n:0});
  });
  it('snapshots returned authority before later callbacks and rejects proxies without traps',()=>{
    const f=ownedFixture(),returned=f.clock.observation;f.clock.recoveryMutation=()=>{f.clock.recoveryMutation=null;returned.independentQualityFailure=false;};
    f.recovery.observeFailure({runId:'run',attemptId:'failed'});const payload=JSON.parse(Buffer.from((f.db.prepare('SELECT payload FROM orchestration_failure_observation').get() as {payload:Buffer}).payload).toString());
    expect(payload.authority).toMatchObject({version:'cue-recovery-classification-v1',independentQualityFailure:true});expect(returned.independentQualityFailure).toBe(false);
    const hostile=ownedFixture();let traps=0;hostile.clock.observation=new Proxy({}, {get(){traps++;throw Error('trap')}});
    expect(()=>hostile.recovery.observeFailure({runId:'run',attemptId:'failed'})).toThrow('recovery_observation_invalid');expect(traps).toBe(0);expect(hostile.clock.proofReads).toBe(0);
  });
  it('fails closed when a legacy v1 observation lacks classification authority',()=>{
    const f=ownedFixture(),observation=f.recovery.observeFailure({runId:'run',attemptId:'failed'}),row=f.db.prepare('SELECT payload FROM orchestration_failure_observation').get() as {payload:Buffer};
    const body=JSON.parse(row.payload.toString());delete body.authority;const legacy=Buffer.from(JSON.stringify(body));
    f.db.exec('DROP TRIGGER failure_observation_update');f.db.prepare('UPDATE orchestration_failure_observation SET payload=?,payload_sha256=?').run(legacy,sha(legacy));
    expect(()=>f.recovery.recordDecision({decisionId:'legacy-denied',observationId:observation.observationId})).toThrow('recovery_observation_authority_missing');
    expect(f.db.prepare('SELECT COUNT(*) n FROM orchestration_recovery_decision').get()).toEqual({n:0});
  });
  it('observes an alternate candidate once and retains that immutable result',()=>{
    const f=ownedFixture();f.clock.observation={...f.clock.observation,cause:'authentication',independentQualityFailure:false};f.clock.candidate={authenticated:true,capable:true};
    const observation=f.recovery.observeFailure({runId:'run',attemptId:'failed'});const decision=f.recovery.recordDecision({decisionId:'single-candidate-read',observationId:observation.observationId,proposedCandidateId:'alternate'});
    expect(decision.action).toBe('switch');expect(f.clock.candidateCalls).toBe(1);
  });
  it('rejects malformed or extra persisted classification authority before decision replay',()=>{
    for(const authority of [{version:'cue-recovery-classification-v1',retryableHostCode:false,quotaResetAtMs:null,independentQualityFailure:true,priorCandidateEligible:true,extra:true},{version:'cue-recovery-classification-v1',retryableHostCode:'yes',quotaResetAtMs:null,independentQualityFailure:true,priorCandidateEligible:true}]){
      const f=ownedFixture();f.recovery.observeFailure({runId:'run',attemptId:'failed'});const row=f.db.prepare('SELECT payload FROM orchestration_failure_observation').get() as {payload:Buffer},body=JSON.parse(row.payload.toString());body.authority=authority;const malformed=Buffer.from(JSON.stringify(body));f.db.exec('DROP TRIGGER failure_observation_update');f.db.prepare('UPDATE orchestration_failure_observation SET payload=?,payload_sha256=?').run(malformed,sha(malformed));
      expect(()=>f.recovery.recordDecision({decisionId:'malformed-denied',observationId:body.observationId})).toThrow('recovery_observation_invalid');expect(f.db.prepare('SELECT COUNT(*) n FROM orchestration_recovery_decision').get()).toEqual({n:0});
    }
  });
  it('rejects a retry when the trusted clock callback consumes the final attempt slot',()=>{
    const f=ownedFixture();f.clock.retryCalls=0;f.clock.retryMutationAt=2;
    expect(()=>f.store.claimRetry({runId:'run',taskId:'make',attemptId:'retry',candidateId:'agent',observedAtMs:1000,revision:0,planDigest:f.plan.digest,retry:{previousAttemptId:'failed',receiptId:'receipt-failed',contractDigest:f.retry.digest}})).toThrow('retry_attempt_limit');
    expect(f.clock.retryCalls).toBe(2);
    expect(f.db.prepare("SELECT COUNT(*) n FROM orchestration_attempt WHERE run_id='run'").get()).toEqual({n:1});
    expect(f.db.prepare("SELECT 1 FROM orchestration_attempt WHERE attempt_id='retry'").get()).toBeUndefined();
  });
  it('admits one normal retry in the remaining attempt slot',()=>{
    const f=ownedFixture();
    const result=f.store.claimRetry({runId:'run',taskId:'make',attemptId:'retry',candidateId:'agent',observedAtMs:1000,revision:0,planDigest:f.plan.digest,retry:{previousAttemptId:'failed',receiptId:'receipt-failed',contractDigest:f.retry.digest}});
    expect(result.launchRequired).toBe(true);
    expect(f.db.prepare("SELECT COUNT(*) n FROM orchestration_attempt WHERE run_id='run'").get()).toEqual({n:2});
  });
  it('keeps revision role and attempt lineage immutable through migration 036',()=>{
    const f=ownedFixture(),observation=f.recovery.observeFailure({runId:'run',attemptId:'failed'}),decision=f.recovery.recordDecision({decisionId:'decision-replan',observationId:observation.observationId});
    const revised=f.recovery.appendRevision({runId:'run',decisionId:decision.decisionId,approval:f.approval,plan:{revision:'plan2',policyRevision:f.approval.policyRevision,policyDigest:f.approval.policyDigest,tasks:f.plan.tasks.map(task=>({...task}))},createdAtMs:1001});
    const read=f.recovery.readRevision('run',1,revised.digest);expect(read.tasks.find(task=>task.id==='make')?.role).toBe('model-producer');
    expect(()=>f.db.prepare("UPDATE orchestration_revision_step SET payload=? WHERE run_id='run' AND revision=1 AND task_id='make'").run(Buffer.from('{}'))).toThrow('immutable');
    expect(()=>f.db.prepare("UPDATE orchestration_plan_revision SET plan_digest=? WHERE run_id='run' AND revision=1").run('0'.repeat(64))).toThrow('immutable');
    expect(()=>f.db.prepare("UPDATE orchestration_attempt_revision SET task_id='audit' WHERE attempt_id='failed'").run()).toThrow('immutable');
    expect(f.db.pragma('foreign_key_check')).toEqual([]);
  });
});
