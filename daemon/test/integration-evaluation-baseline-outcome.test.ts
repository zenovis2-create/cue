import {afterEach,expect,test,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openLedger,type Ledger} from '../src/ledger.js';
import {saveSelectionPolicy,bindRunSelectionPolicy} from '../src/selection/policy-store.js';
import {createEvaluationBaselineStore} from '../src/evaluation/baseline.js';
import {createEvaluationObservationStore} from '../src/evaluation/observations.js';
import {createEvaluationTrialProjectionStore} from '../src/evaluation/trials.js';
import {createEvaluationEnrollmentStore} from '../src/evaluation/enrollment.js';
import {createEvaluationComparisonStore} from '../src/evaluation/comparisons.js';
import {validateTaskPlan} from '../src/orchestration/plan.js';
import {createOrchestrationStore} from '../src/orchestration/store.js';
import {normalizeEnvelope,envelopeHash} from '../src/envelope.js';

const dbs:Ledger[]=[],roots:string[]=[];
afterEach(()=>{for(const db of dbs.splice(0))if(db.open)db.close();for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});
const h=(v:string)=>createHash('sha256').update(v).digest('hex');
function fixture(mode:'efficiency'|'performance'|'value'|'speed'='efficiency'){
  const root=mkdtempSync(join(tmpdir(),'cue-baseline-outcome-'));roots.push(root);const db=openLedger(join(root,'ledger.db'));dbs.push(db);
  const env=normalizeEnvelope({run_id:'run',worktree_realpath:root,allowed_actions:['file_change'],egress:[],expires_at:'2027-01-01T00:00:00.000Z',autonomy_level:'bounded'}),eh=envelopeHash(env);
  db.prepare("INSERT INTO task VALUES('task','awaiting_approval',NULL,'now')").run();db.prepare("INSERT INTO envelope VALUES(?,?,'[]','now')").run(eh,root);db.prepare("INSERT INTO run VALUES('run','task',?,0,'now')").run(eh);
  const policy=saveSelectionPolicy(db,{policyId:'policy',expectedRevision:null,createdAt:'2026-09-22T00:00:00.000Z',sourceVersion:'offline-fixture',policy:{version:'cue-selection-v1',mode,qualityMinimum:.5,costBasis:1,timeBasisMs:1,currency:'TEST',costLimit:null,remainingTimeMs:null,maxEstimateAgeMs:100,allowedCandidateIds:['agent'],pinnedCandidateId:'agent'}});
  bindRunSelectionPolicy(db,{runId:'run',policyId:'policy',revision:1,digest:policy.digest,boundAt:'2026-09-22T00:00:00.000Z'});
  const approval={policyRevision:'policy:1',policyDigest:policy.digest,requirementIds:['code'],allowedCandidateIds:['agent'],allowedScopeIds:[]};
  const plan=validateTaskPlan(approval,{revision:'v1',policyRevision:'policy:1',policyDigest:policy.digest,tasks:[{id:'make',role:'implementation',ownerId:'maker',requirementIds:['code'],dependencyIds:[],candidateIds:['agent'],scopeIds:[]},{id:'verify',role:'verifier',ownerId:'checker',requirementIds:['code'],dependencyIds:['make'],candidateIds:['agent'],scopeIds:[]}]});
  createOrchestrationStore(db,{authorizePlan:()=>true,authorizeClaim:()=>true,verifyReceipt:()=>({outcomeVerified:true,cleanupVerified:true})}).install('run',plan);
  const input={baselineId:'baseline',enrollmentId:'enrollment',runId:'run',dataset:{id:'data',revision:'v1',cases:[{id:'eval',kind:'code',split:'evaluation',inputDigest:h('eval')},{id:'hold',kind:'code',split:'holdout',inputDigest:h('hold')}]},caseId:'eval',policy:{kind:'monetary',policyId:'policy',revision:1,digest:policy.digest},candidate:{id:'agent',revision:'v1',digest:h('candidate')},metric:{id:'metric',revision:'v1',digest:h('metric')},environment:{id:'env',revision:'v1',digest:h('env')},accountLimits:{id:'limits',revision:'v1',digest:h('limits')},enrolledAtMs:1,authorityRef:{id:'fixture-user-consent',revision:'v1',digest:h('fixture-only')}} as const;
  const baselines=createEvaluationBaselineStore(db,()=>true),observations=createEvaluationObservationStore(db),projections=createEvaluationTrialProjectionStore(db);
  function observe(outcome:'fail'|'cancelled'|'unknown'='fail'){db.prepare("UPDATE task SET state=?,blocked_reason=? WHERE id='task'").run(outcome==='fail'?'failed':'blocked',outcome==='cancelled'?'cancelled':null);return observations.observe({enrollmentId:'enrollment',observationId:'observation',expectedPriorRevision:0},10);}
  const projectionInput={projectionId:'projection',enrollmentId:'enrollment',observationId:'observation'};
  return{db,input,plan,baselines,observations,projections,observe,projectionInput};
}

test.each(['efficiency','performance','value','speed'] as const)('recorded manual baseline with %s policy projects failure honestly and reopens/replays',mode=>{
  const f=fixture(mode),baseline=f.baselines.declare(f.input),observation=f.observe();
  expect(observation.outcome).toMatchObject({status:'recorded',outcome:'fail',policy:{mode}});
  const saved=f.projections.project(f.projectionInput);expect(saved).toMatchObject({arm:'manual-baseline',outcome:'fail',outcomeAvailability:'recorded',trial:null,policy:baseline.policy});
  expect(saved.nonConvertibleReasons).toContain('quality-unavailable');expect(f.projections.project(f.projectionInput)).toEqual(saved);
  const file=f.db.name;f.db.close();const reopened=openLedger(file);dbs.push(reopened);
  expect(createEvaluationTrialProjectionStore(reopened).read('projection')).toEqual(saved);
  expect(createEvaluationBaselineStore(reopened).read('baseline')?.enrollment.digest).toBe(baseline.enrollment.digest);
  expect(reopened.prepare('SELECT count(*) n FROM approval_event').get()).toEqual({n:0});
});

test.each(['cancelled','unknown'] as const)('manual baseline preserves %s rather than hiding it as unavailable',outcome=>{
  const f=fixture();f.baselines.declare(f.input);f.observe(outcome);
  expect(f.projections.project(f.projectionInput)).toMatchObject({arm:'manual-baseline',outcome,outcomeAvailability:'recorded',trial:null});
});

test('both splits feed an immutable comparison with recorded baseline failures instead of unavailable outcomes',()=>{
  const f=fixture(),baselineIds:string[]=[],candidateIds:string[]=[];
  const existingPlan=f.plan;
  for(const split of ['eval','hold'])for(const arm of ['manual-baseline','efficiency'] as const){
    const runId=`${arm}-${split}`,taskId=`task-${runId}`;
    const env=normalizeEnvelope({run_id:runId,worktree_realpath:roots.at(-1)!,allowed_actions:['file_change'],egress:[],expires_at:'2027-01-01T00:00:00.000Z',autonomy_level:'bounded'}),eh=envelopeHash(env);
    f.db.prepare('INSERT INTO task VALUES(?,?,NULL,?)').run(taskId,'awaiting_approval','now');f.db.prepare("INSERT INTO envelope VALUES(?,?,'[]','now')").run(eh,env.worktree_realpath);f.db.prepare('INSERT INTO run VALUES(?,?,?,0,?)').run(runId,taskId,eh,'now');
    bindRunSelectionPolicy(f.db,{runId,policyId:'policy',revision:1,digest:f.input.policy.digest,boundAt:'2026-09-22T00:00:00.000Z'});
    createOrchestrationStore(f.db,{authorizePlan:()=>true,authorizeClaim:()=>true,verifyReceipt:()=>({outcomeVerified:true,cleanupVerified:true})}).install(runId,existingPlan);
    const {baselineId,candidate,authorityRef,...common}=f.input,input={...common,enrollmentId:runId,runId,caseId:split};
    if(arm==='manual-baseline')f.baselines.declare({...input,baselineId:runId,candidate,authorityRef});else createEvaluationEnrollmentStore(f.db).enroll({...input,arm});
    f.db.prepare('UPDATE task SET state=? WHERE id=?').run('failed',taskId);f.observations.observe({enrollmentId:runId,observationId:runId,expectedPriorRevision:0},10);
    const projected=f.projections.project({projectionId:runId,enrollmentId:runId,observationId:runId});expect(projected.outcome).toBe('fail');(arm==='manual-baseline'?baselineIds:candidateIds).push(runId);
  }
  const constraints={mode:'efficiency',baselinePolicyDigest:f.input.policy.digest,candidatePolicyDigest:f.input.policy.digest,maxPriceAgeMs:100,minPairsPerSplit:2,qualityFloor:.5,minSuccessRate:.5,maxUnknownRate:.5,costLimitUnits:null,costBasisUnits:1,timeBasisMs:1,minImprovement:0};
  const store=createEvaluationComparisonStore(f.db),saved=store.create({snapshotId:'compare',baselineProjectionIds:baselineIds,candidateProjectionIds:candidateIds,constraints},20);
  for(const split of saved.availability.splits)expect(split.baseline).toMatchObject({projectionCount:1,trialCount:0,outcomes:{fail:1,unavailable:0}});
  expect(saved).toMatchObject({promotionEligible:false,comparison:{status:'insufficient'}});expect(store.read('compare')).toEqual(saved);
});

test.each(['mode','digest','idDigest'] as const)('recomputed recorded policy %s tamper still refuses a manual baseline',field=>{
  const f=fixture();f.baselines.declare(f.input);f.observe();
  const row=f.db.prepare('SELECT payload FROM evaluation_observation').get() as any,payload=JSON.parse(row.payload);
  payload.outcome.policy[field]=field==='mode'?'speed':h('changed');const {sourceDigest,...body}=payload.outcome;payload.outcome.sourceDigest=h(JSON.stringify(body));
  const text=JSON.stringify(payload);f.db.exec('DROP TRIGGER evaluation_observation_update');f.db.prepare('UPDATE evaluation_observation SET payload=?,payload_digest=?').run(text,h(text));
  expect(()=>f.projections.project(f.projectionInput)).toThrow();expect(f.db.prepare('SELECT count(*) n FROM evaluation_trial_projection').get()).toEqual({n:0});
});

test('a declaration cannot be absent or disagree with a recomputed enrollment payload',()=>{
  for(const change of ['declaration-missing','metric-changed'] as const){
    const f=fixture();f.baselines.declare(f.input);
    if(change==='declaration-missing'){f.db.exec('DROP TRIGGER evaluation_baseline_declaration_delete');f.db.prepare('DELETE FROM evaluation_baseline_declaration').run();}
    else{
      const row=f.db.prepare('SELECT payload FROM evaluation_enrollment').get() as any,p=JSON.parse(row.payload);p.metric.digest=h('other');const text=JSON.stringify(p);
      f.db.exec('DROP TRIGGER evaluation_enrollment_update');f.db.prepare('UPDATE evaluation_enrollment SET payload=?,payload_digest=?').run(text,h(text));
      expect(()=>f.baselines.read('baseline')).toThrow('integrity');
    }
    f.observe();expect(()=>f.projections.project(f.projectionInput)).toThrow();
  }
});

test.each(['candidate','policy','case','started','dataset-conflict','slot-conflict'] as const)('invalid %s request refuses before invoking external user authority',change=>{
  const f=fixture(),confirm=vi.fn(()=>true),store=createEvaluationBaselineStore(f.db,confirm);let input:any=f.input;
  if(change==='candidate')input={...input,candidate:{...input.candidate,id:'other'}};
  if(change==='policy')input={...input,policy:{...input.policy,digest:h('other')}};
  if(change==='case')input={...input,caseId:'absent'};
  if(change==='started')f.db.prepare("UPDATE task SET state='failed' WHERE id='task'").run();
  if(change==='dataset-conflict')f.db.prepare('INSERT INTO evaluation_dataset VALUES(?,?,?,?)').run(h('other'),'data','v1','{}');
  if(change==='slot-conflict'){f.baselines.declare(f.input);input={...input,baselineId:'another'};}
  expect(()=>store.declare(input)).toThrow();expect(confirm).not.toHaveBeenCalled();
});

test('reentrant verifier cannot enter another baseline store on the same ledger',()=>{
  const f=fixture();let calls=0;const store=createEvaluationBaselineStore(f.db,()=>{calls++;expect(()=>createEvaluationBaselineStore(f.db,()=>true).declare({...f.input,baselineId:'nested'})).toThrow('reentrant');return true;});
  const saved=store.declare(f.input);expect(saved.enrollment.arm).toBe('manual-baseline');expect(calls).toBe(1);expect(f.db.prepare('SELECT count(*) n FROM evaluation_baseline_declaration').get()).toEqual({n:1});
});

test('final eligibility recheck holds an IMMEDIATE writer lock against a separate SQLite connection',()=>{
  const f=fixture(),other=openLedger(f.db.name);dbs.push(other);other.pragma('busy_timeout=1');let confirmed=false,contended=0;
  const prepare=f.db.prepare.bind(f.db);
  (f.db as any).prepare=(sql:string)=>{
    if(confirmed&&sql==='SELECT t.state FROM run r JOIN task t ON t.id=r.task_id WHERE r.id=?'){
      expect(f.db.inTransaction).toBe(true);
      expect(()=>other.prepare("UPDATE task SET state='failed' WHERE id='task'").run()).toThrow(/locked|busy/);contended++;
    }
    return prepare(sql);
  };
  try{createEvaluationBaselineStore(f.db,()=>{confirmed=true;return true;}).declare(f.input);}finally{(f.db as any).prepare=prepare;}
  expect(contended).toBe(1);expect(f.db.prepare('SELECT state FROM task').get()).toEqual({state:'awaiting_approval'});
});

test('state changed during confirmation cannot register and the external change is not erased',()=>{
  const f=fixture(),store=createEvaluationBaselineStore(f.db,()=>{f.db.prepare("UPDATE task SET state='failed' WHERE id='task'").run();return true;});
  expect(()=>store.declare(f.input)).toThrow('run_started');expect(f.db.prepare('SELECT count(*) n FROM evaluation_baseline_declaration').get()).toEqual({n:0});expect(f.db.prepare('SELECT state FROM task').get()).toEqual({state:'failed'});
});
