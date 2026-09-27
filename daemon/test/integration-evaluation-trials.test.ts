import { afterEach, expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openLedger, type Ledger } from '../src/ledger.js';
import { normalizeEnvelope, envelopeHash } from '../src/envelope.js';
import { saveSelectionPolicy, bindRunSelectionPolicy } from '../src/selection/policy-store.js';
import { validateTaskPlan } from '../src/orchestration/plan.js';
import { createOrchestrationStore } from '../src/orchestration/store.js';
import { createEvaluationEnrollmentStore } from '../src/evaluation/enrollment.js';
import { createEvaluationObservationStore } from '../src/evaluation/observations.js';
import { createEvaluationTrialProjectionStore } from '../src/evaluation/trials.js';

const roots: string[] = [], handles: Ledger[] = [];
afterEach(() => { for (const db of handles.splice(0)) if (db.open) db.close(); for (const root of roots.splice(0)) rmSync(root,{recursive:true,force:true}); });
const h = (value: string) => createHash('sha256').update(value).digest('hex');
function fixture() {
  const root=mkdtempSync(join(tmpdir(),'cue-eval-trial-'));roots.push(root);const db=openLedger(join(root,'ledger.db'));handles.push(db);
  const env=normalizeEnvelope({run_id:'run',worktree_realpath:root,allowed_actions:['file_change'],egress:[],expires_at:'2027-01-01T00:00:00.000Z',autonomy_level:'bounded'}),eh=envelopeHash(env);
  db.prepare("INSERT INTO task VALUES('task','awaiting_approval',NULL,'now')").run();db.prepare("INSERT INTO envelope VALUES(?,?,'[]','now')").run(eh,root);db.prepare("INSERT INTO run VALUES('run','task',?,0,'now')").run(eh);
  const policy=saveSelectionPolicy(db,{policyId:'policy',expectedRevision:null,createdAt:'2026-09-12T00:00:00.000Z',sourceVersion:'fixture',policy:{version:'cue-selection-v1',mode:'efficiency',qualityMinimum:.5,costBasis:1,timeBasisMs:1000,currency:'TEST',costLimit:null,remainingTimeMs:null,maxEstimateAgeMs:100,allowedCandidateIds:['agent'],pinnedCandidateId:null}});bindRunSelectionPolicy(db,{runId:'run',policyId:'policy',revision:1,digest:policy.digest,boundAt:'2026-09-12T00:00:00.000Z'});
  const approval={policyRevision:'policy:1',policyDigest:policy.digest,requirementIds:['code'],allowedCandidateIds:['agent'],allowedScopeIds:[]};
  const plan=validateTaskPlan(approval,{revision:'v1',policyRevision:'policy:1',policyDigest:policy.digest,tasks:[
    {id:'plan',role:'planner',ownerId:'planner',requirementIds:['code'],dependencyIds:[],candidateIds:['agent'],scopeIds:[]},
    {id:'make',role:'implementation',ownerId:'maker',requirementIds:['code'],dependencyIds:['plan'],candidateIds:['agent'],scopeIds:[]},
    {id:'check',role:'verifier',ownerId:'checker',requirementIds:['code'],dependencyIds:['make'],candidateIds:['agent'],scopeIds:[]},
  ]});
  const orchestration=createOrchestrationStore(db,{authorizePlan:()=>true,authorizeClaim:()=>true,verifyReceipt:()=>({outcomeVerified:true,cleanupVerified:true})});orchestration.install('run',plan);
  const enrollment=createEvaluationEnrollmentStore(db).enroll({enrollmentId:'enrollment',runId:'run',dataset:{id:'dataset',revision:'v1',cases:[{id:'case',kind:'code',inputDigest:h('input'),split:'evaluation'},{id:'holdout',kind:'code',inputDigest:h('holdout'),split:'holdout'}]},caseId:'case',arm:'efficiency',policy:{kind:'monetary',policyId:'policy',revision:1,digest:policy.digest},metric:{id:'quality',revision:'v1',digest:h('metric')},environment:{id:'env',revision:'v1',digest:h('environment')},accountLimits:{id:'limits',revision:'v1',digest:h('limits')},enrolledAtMs:1});
  db.prepare("UPDATE task SET state='failed' WHERE id='task'").run();
  const observations=createEvaluationObservationStore(db),observation=observations.observe({enrollmentId:'enrollment',observationId:'observation',expectedPriorRevision:0},10);
  return {root,db,enrollment,observation,observations,store:createEvaluationTrialProjectionStore(db)};
}

test('projects only stored lineage, preserves failure, and fails closed with stable missing-evidence reasons',()=>{
  const f=fixture(),saved=f.store.project({projectionId:'projection',enrollmentId:'enrollment',observationId:'observation'});
  expect(saved).toMatchObject({authority:'stored-enrollment-observation-outcome-only',runId:'run',caseId:'case',arm:'efficiency',outcome:'fail',outcomeAvailability:'recorded',trial:null,dataset:{id:'dataset',revision:'v1',digest:f.enrollment.dataset.digest},policy:f.enrollment.policy,metric:f.enrollment.metric,environment:f.enrollment.environment,accountLimits:f.enrollment.accountLimits});
  expect(saved.nonConvertibleReasons).toEqual(['tool-revision-unavailable','model-revision-unavailable','quality-unavailable','elapsed-unavailable','price-observed-at-unavailable','price-source-unavailable','base-cost-unavailable','retry-cost-unavailable','handoff-cost-unavailable','verification-cost-unavailable','currency-unit-unavailable']);
  expect(Object.isFrozen(saved)&&Object.isFrozen(saved.nonConvertibleReasons)).toBe(true);
});

test('exact replay is idempotent and projection or slot rebinding conflicts',()=>{
  const f=fixture(),input={projectionId:'projection',enrollmentId:'enrollment',observationId:'observation'},saved=f.store.project(input);
  expect(f.store.project(input)).toEqual(saved);
  const second=f.observations.observe({enrollmentId:'enrollment',observationId:'observation-2',expectedPriorRevision:1},11);
  expect(second.outcome).toMatchObject({outcome:'fail'});
  expect(()=>f.store.project({...input,observationId:'observation-2'})).toThrow('replay_conflict');
  expect(()=>f.store.project({...input,projectionId:'other'})).toThrow('slot_conflict');
  expect(()=>f.store.project({...input,quality:1} as never)).toThrow('input');
});

test('reopen reads canonical immutable projection and outer transactions are rejected',()=>{
  const f=fixture(),saved=f.store.project({projectionId:'projection',enrollmentId:'enrollment',observationId:'observation'}),file=f.db.name;
  expect(()=>f.db.transaction(()=>f.store.read('projection'))()).toThrow('outer_transaction');
  expect(()=>f.db.transaction(()=>f.store.project({projectionId:'x',enrollmentId:'enrollment',observationId:'observation'}))()).toThrow('outer_transaction');
  f.db.close();handles.splice(handles.indexOf(f.db),1);const reopened=openLedger(file);handles.push(reopened);
  expect(createEvaluationTrialProjectionStore(reopened).read('projection')).toEqual(saved);
});

test('SQL mutation, oversized payload, recomputed tamper, and policy mismatch fail closed',()=>{
  const f=fixture();f.store.project({projectionId:'projection',enrollmentId:'enrollment',observationId:'observation'});
  for(const sql of ["UPDATE evaluation_trial_projection SET enrollment_id='other'","DELETE FROM evaluation_trial_projection","INSERT OR REPLACE INTO evaluation_trial_projection SELECT * FROM evaluation_trial_projection"]) expect(()=>f.db.exec(sql)).toThrow('immutable');
  f.db.exec('DROP TRIGGER evaluation_trial_projection_update; PRAGMA ignore_check_constraints=ON');
  f.db.prepare("UPDATE evaluation_trial_projection SET payload=? WHERE projection_id='projection'").run('x'.repeat(1048577));expect(()=>f.store.read('projection')).toThrow('payload');
  const g=fixture();g.store.project({projectionId:'projection',enrollmentId:'enrollment',observationId:'observation'});const row=g.db.prepare("SELECT payload FROM evaluation_trial_projection WHERE projection_id='projection'").get() as any,p=JSON.parse(row.payload);p.caseId='other';const payload=JSON.stringify(p);
  g.db.exec('DROP TRIGGER evaluation_trial_projection_update');g.db.prepare("UPDATE evaluation_trial_projection SET payload=?,payload_digest=? WHERE projection_id='projection'").run(payload,h(payload));expect(()=>g.store.read('projection')).toThrow('integrity');
  const q=fixture(),o=q.db.prepare("SELECT payload FROM evaluation_observation WHERE observation_id='observation'").get() as any,op=JSON.parse(o.payload);op.outcome.policy.digest=h('foreign');const inner={...op.outcome};delete inner.sourceDigest;op.outcome.sourceDigest=h(JSON.stringify(inner));const observationPayload=JSON.stringify(op);
  q.db.exec('DROP TRIGGER evaluation_observation_update');q.db.prepare("UPDATE evaluation_observation SET payload=?,payload_digest=? WHERE observation_id='observation'").run(observationPayload,h(observationPayload));expect(()=>q.store.project({projectionId:'projection',enrollmentId:'enrollment',observationId:'observation'})).toThrow('policy');
});
