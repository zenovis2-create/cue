import { afterEach, expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openLedger, type Ledger } from '../src/ledger.js';
import { normalizeEnvelope, envelopeHash } from '../src/envelope.js';
import { saveSelectionPolicy, bindRunSelectionPolicy } from '../src/selection/policy-store.js';
import { createEvaluationEnrollmentStore } from '../src/evaluation/enrollment.js';
import { createEvaluationBaselineStore } from '../src/evaluation/baseline.js';
import { createEvaluationObservationStore } from '../src/evaluation/observations.js';
import { createEvaluationTrialProjectionStore } from '../src/evaluation/trials.js';
import { createEvaluationComparisonStore } from '../src/evaluation/comparisons.js';
import { validateTaskPlan } from '../src/orchestration/plan.js';
import { createOrchestrationStore } from '../src/orchestration/store.js';

const roots:string[]=[],handles:Ledger[]=[];afterEach(()=>{for(const db of handles.splice(0))if(db.open)db.close();for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true})});
const h=(value:string)=>createHash('sha256').update(value).digest('hex');
const constraints=(digest:string)=>({mode:'value',baselinePolicyDigest:digest,candidatePolicyDigest:digest,maxPriceAgeMs:100,minPairsPerSplit:2,qualityFloor:.5,minSuccessRate:.5,maxUnknownRate:.5,costLimitUnits:null,costBasisUnits:1,timeBasisMs:1,minImprovement:0});
function fixture() {
  const root=mkdtempSync(join(tmpdir(),'cue-comparisons-'));roots.push(root);const file=join(root,'ledger.db'),db=openLedger(file);handles.push(db);
  const dataset={id:'dataset',revision:'v1',cases:['eval-1','eval-2','hold-1','hold-2'].map((caseId,index)=>({id:caseId,kind:'code',inputDigest:h(caseId),split:index<2?'evaluation':'holdout'}))} as const;
  const policy=saveSelectionPolicy(db,{policyId:'policy',expectedRevision:null,createdAt:'2026-09-12T00:00:00.000Z',sourceVersion:'fixture',policy:{version:'cue-selection-v1',mode:'value',qualityMinimum:.5,costBasis:1,timeBasisMs:1,currency:'TEST',costLimit:null,remainingTimeMs:null,maxEstimateAgeMs:100,allowedCandidateIds:['agent'],pinnedCandidateId:'agent'}});
  const enrollments=createEvaluationEnrollmentStore(db),baselines=createEvaluationBaselineStore(db,()=>true),observations=createEvaluationObservationStore(db),projections=createEvaluationTrialProjectionStore(db);
  const orchestration=createOrchestrationStore(db,{authorizePlan:()=>true,authorizeClaim:()=>true,verifyReceipt:()=>({outcomeVerified:true,cleanupVerified:true})});
  let serial=0;
  function project(caseId:string,arm:'manual-baseline'|'value',outcome:'fail'|'cancelled'|'unknown'='fail',otherDataset:unknown=dataset){
    const n=++serial,runId=`run-${n}`,taskId=`task-${n}`,enrollmentId=`enrollment-${n}`,observationId=`observation-${n}`,projectionId=`projection-${n}`;
    const env=normalizeEnvelope({run_id:runId,worktree_realpath:root,allowed_actions:['file_change'],egress:[],expires_at:'2027-01-01T00:00:00.000Z',autonomy_level:'bounded'}),eh=envelopeHash(env);
    db.prepare('INSERT INTO task VALUES(?,?,NULL,?)').run(taskId,'awaiting_approval','now');db.prepare("INSERT OR IGNORE INTO envelope VALUES(?,?,'[]','now')").run(eh,root);db.prepare('INSERT INTO run VALUES(?,?,?,0,?)').run(runId,taskId,eh,'now');bindRunSelectionPolicy(db,{runId,policyId:'policy',revision:1,digest:policy.digest,boundAt:'2026-09-12T00:00:00.000Z'});
    const approval={policyRevision:'policy:1',policyDigest:policy.digest,requirementIds:['code'],allowedCandidateIds:['agent'],allowedScopeIds:[]};
    if(arm==='value')orchestration.install(runId,validateTaskPlan(approval,{revision:'v1',policyRevision:'policy:1',policyDigest:policy.digest,tasks:[
      {id:`plan-${n}`,role:'planner',ownerId:'planner',requirementIds:['code'],dependencyIds:[],candidateIds:['agent'],scopeIds:[]},
      {id:`make-${n}`,role:'implementation',ownerId:'maker',requirementIds:['code'],dependencyIds:[`plan-${n}`],candidateIds:['agent'],scopeIds:[]},
      {id:`check-${n}`,role:'verifier',ownerId:'checker',requirementIds:['code'],dependencyIds:[`make-${n}`],candidateIds:['agent'],scopeIds:[]},
    ]}));
    const common={enrollmentId,runId,dataset:otherDataset,caseId,policy:{kind:'monetary',policyId:'policy',revision:1,digest:policy.digest},metric:{id:'metric',revision:'v1',digest:h('metric')},environment:{id:'environment',revision:'v1',digest:h('environment')},accountLimits:{id:'limits',revision:'v1',digest:h('limits')},enrolledAtMs:1} as const;
    if(arm==='manual-baseline')baselines.declare({baselineId:`baseline-${n}`,...common,candidate:{id:'agent',revision:'v1',digest:h('agent')},authorityRef:{id:'user',revision:'v1',digest:h('user')}});
    else enrollments.enroll({...common,arm});
    db.prepare('UPDATE task SET state=?,blocked_reason=? WHERE id=?').run(outcome==='fail'?'failed':'blocked',outcome==='cancelled'?'cancelled':null,taskId);
    observations.observe({enrollmentId,observationId,expectedPriorRevision:0},10+n);
    return projections.project({projectionId,enrollmentId,observationId});
  }
  const baseline=dataset.cases.map((item,index)=>project(item.id,'manual-baseline',index===0?'cancelled':index===1?'unknown':'fail'));
  const candidate=dataset.cases.map((item,index)=>project(item.id,'value',index===0?'cancelled':index===1?'unknown':'fail'));
  const input={snapshotId:'snapshot',baselineProjectionIds:baseline.map(x=>x.projectionId),candidateProjectionIds:candidate.map(x=>x.projectionId),constraints:constraints(policy.digest)};
  return {root,file,db,dataset,policy,project,baseline,candidate,input,store:createEvaluationComparisonStore(db)};
}

test('all-null projections persist an insufficient descriptive snapshot with stable reasons and complete denominators',()=>{
  const f=fixture(),before={approval:(f.db.prepare('SELECT count(*) n FROM approval_event').get() as any).n,execution:(f.db.prepare('SELECT count(*) n FROM execution_event').get() as any).n,attempt:(f.db.prepare('SELECT count(*) n FROM orchestration_attempt').get() as any).n,policy:(f.db.prepare('SELECT count(*) n FROM selection_policy_snapshot').get() as any).n};
  const saved=f.store.create(f.input,100);
  expect(saved).toMatchObject({authority:'immutable-projection-membership-descriptive-only',recordedAtMs:100,datasetDigest:f.baseline[0].dataset.digest,promotionEligible:false,comparison:{status:'insufficient',promotionEligible:false}});
  for(const split of saved.availability.splits)expect(split).toMatchObject({expectedCaseCount:2,baseline:{projectionCount:2,trialCount:0,missingProjectionCount:0,missingTrialCount:2,outcomeDenominator:2,outcomes:{unavailable:2}},candidate:{projectionCount:2,trialCount:0,missingProjectionCount:0,missingTrialCount:2,outcomeDenominator:2}});
  expect(saved.availability.splits[0].candidate.outcomes).toMatchObject({cancelled:1,unknown:1});expect(saved.availability.splits[1].candidate.outcomes.fail).toBe(2);
  expect(saved.availability.nonConvertibleReasonCounts['quality-unavailable']).toBe(8);expect(saved.availability.comparisonReasonCounts['incomplete-paired-coverage']).toBe(2);
  expect({approval:(f.db.prepare('SELECT count(*) n FROM approval_event').get() as any).n,execution:(f.db.prepare('SELECT count(*) n FROM execution_event').get() as any).n,attempt:(f.db.prepare('SELECT count(*) n FROM orchestration_attempt').get() as any).n,policy:(f.db.prepare('SELECT count(*) n FROM selection_policy_snapshot').get() as any).n}).toEqual(before);
});

test('exact replay ignores later host time while rebinding and caller authority injection fail',()=>{
  const f=fixture(),saved=f.store.create(f.input,100);expect(f.store.create(f.input,999)).toEqual(saved);
  expect(()=>f.store.create({...f.input,candidateProjectionIds:f.input.candidateProjectionIds.slice(0,3)},100)).toThrow('replay_conflict');
  expect(()=>f.store.create({...f.input,nowMs:100} as never,100)).toThrow('input');expect(()=>f.store.create({...f.input,trial:{}} as never,100)).toThrow('input');expect(()=>f.store.create({...f.input,result:{}} as never,100)).toThrow('input');
});

test('mixed dataset, arm, policy, duplicate projection and duplicate case-arm slots fail closed',()=>{
  const f=fixture(),other={id:'other',revision:'v1',cases:f.dataset.cases.map(item=>({...item,inputDigest:h(`other-${item.id}`)}))},mixed=f.project('eval-1','value','fail',other);
  expect(()=>f.store.create({...f.input,snapshotId:'mixed',candidateProjectionIds:[mixed.projectionId]},100)).toThrow('dataset_mismatch');
  expect(()=>f.store.create({...f.input,snapshotId:'arm',baselineProjectionIds:[f.candidate[0].projectionId],candidateProjectionIds:f.input.candidateProjectionIds.slice(1)},100)).toThrow('baseline_binding');
  expect(()=>f.store.create({...f.input,snapshotId:'policy',constraints:{...f.input.constraints,candidatePolicyDigest:h('foreign')}},100)).toThrow('candidate_binding');
  expect(()=>f.store.create({...f.input,snapshotId:'duplicate',candidateProjectionIds:[f.candidate[0].projectionId,f.candidate[0].projectionId]},100)).toThrow('duplicate_projection');
  expect(()=>f.project('eval-1','value')).toThrow('cohort_conflict');
});

test('hostile inputs touch no getters; reads are bounded, immutable, reopenable and reject outer transactions',()=>{
  const f=fixture();let touched=0;const hostile=Object.defineProperty({...f.input},'snapshotId',{enumerable:true,get(){touched++;return 'x'}});expect(()=>f.store.create(hostile,100)).toThrow('input');expect(touched).toBe(0);
  let projectionReads=0;const originalPrepare=f.db.prepare.bind(f.db);(f.db as any).prepare=(sql:string)=>{if(sql.includes('FROM evaluation_trial_projection'))projectionReads++;return originalPrepare(sql)};
  const oversized=Array.from({length:4097},(_,index)=>`p-${index}`);expect(()=>f.store.create({...f.input,baselineProjectionIds:oversized},100)).toThrow('projection_ids');expect(projectionReads).toBe(0);
  const accessorIds=Object.defineProperty([...f.input.baselineProjectionIds],'0',{enumerable:true,get(){touched++;return f.input.baselineProjectionIds[0]}});expect(()=>f.store.create({...f.input,baselineProjectionIds:accessorIds},100)).toThrow('projection_ids');expect(touched).toBe(0);expect(projectionReads).toBe(0);
  expect(()=>f.store.create(new Proxy(f.input,{}),100)).toThrow('input');const saved=f.store.create(f.input,100);
  expect(()=>f.db.transaction(()=>f.store.read('snapshot'))()).toThrow('outer_transaction');expect(()=>f.db.transaction(()=>f.store.create({...f.input,snapshotId:'x'},100))()).toThrow('outer_transaction');
  for(const sql of ["UPDATE evaluation_comparison_snapshot SET snapshot_id='x'","DELETE FROM evaluation_comparison_snapshot","INSERT OR REPLACE INTO evaluation_comparison_snapshot SELECT * FROM evaluation_comparison_snapshot"])expect(()=>f.db.exec(sql)).toThrow('immutable');
  f.db.close();handles.splice(handles.indexOf(f.db),1);const reopened=openLedger(f.file);handles.push(reopened);expect(createEvaluationComparisonStore(reopened).read('snapshot')).toEqual(saved);
  reopened.exec('DROP TRIGGER evaluation_comparison_snapshot_update; PRAGMA ignore_check_constraints=ON');reopened.prepare("UPDATE evaluation_comparison_snapshot SET payload=? WHERE snapshot_id='snapshot'").run('x'.repeat(1048577));expect(()=>createEvaluationComparisonStore(reopened).read('snapshot')).toThrow('payload');
});

test('request digest alone is verified against canonical stored membership and constraints',()=>{
  const f=fixture();f.store.create(f.input,100);f.db.exec('DROP TRIGGER evaluation_comparison_snapshot_update');f.db.prepare("UPDATE evaluation_comparison_snapshot SET request_digest=? WHERE snapshot_id='snapshot'").run(h('tampered'));expect(()=>f.store.read('snapshot')).toThrow('integrity');
});
