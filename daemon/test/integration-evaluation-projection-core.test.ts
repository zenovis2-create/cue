import { afterEach, expect, test, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createCueCore, initializeConfig, type CueCore } from '../../app/core.mjs';
import { registerIpcHandlers } from '../../app/ipc.mjs';
import { normalizeEnvelope, envelopeHash } from '../src/envelope.js';
import { saveSelectionPolicy, bindRunSelectionPolicy } from '../src/selection/policy-store.js';
import { createEvaluationEnrollmentStore } from '../src/evaluation/enrollment.js';

const roots:string[]=[],cores:CueCore[]=[];
afterEach(async()=>{for(const core of cores.splice(0))await core.close();for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true})});
const h=(value:string)=>createHash('sha256').update(value).digest('hex');

function seed(core:CueCore,workspace:string,foreign:string){
  const db=core.daemon.db,policy=saveSelectionPolicy(db,{policyId:'policy',expectedRevision:null,createdAt:'2026-09-13T00:00:00.000Z',sourceVersion:'fixture',policy:{version:'cue-selection-v1',mode:'efficiency',qualityMinimum:.5,costBasis:1,timeBasisMs:1000,currency:'TEST',costLimit:null,remainingTimeMs:null,maxEstimateAgeMs:100,allowedCandidateIds:['agent'],pinnedCandidateId:null}});
  for(const [runId,taskId,path] of [['local','task-local',workspace],['foreign','task-foreign',foreign]]){const env=normalizeEnvelope({run_id:runId,worktree_realpath:path,allowed_actions:['file_change'],egress:[],expires_at:'2027-01-01T00:00:00.000Z',autonomy_level:'bounded'}),digest=envelopeHash(env);db.prepare('INSERT INTO task VALUES(?,?,NULL,?)').run(taskId,'awaiting_approval','now');db.prepare("INSERT INTO envelope VALUES(?,?,'[]','now')").run(digest,path);db.prepare('INSERT INTO run VALUES(?,?,?,0,?)').run(runId,taskId,digest,'now');bindRunSelectionPolicy(db,{runId,policyId:'policy',revision:1,digest:policy.digest,boundAt:'2026-09-13T00:00:00.000Z'});}
  const dataset={id:'data',revision:'v1',cases:[{id:'eval',kind:'code' as const,inputDigest:h('eval'),split:'evaluation' as const},{id:'hold',kind:'code' as const,inputDigest:h('hold'),split:'holdout' as const}]};
  const common={dataset,arm:'efficiency' as const,policy:{kind:'monetary' as const,policyId:'policy',revision:1,digest:policy.digest},metric:{id:'metric',revision:'v1',digest:h('metric')},environment:{id:'env',revision:'v1',digest:h('env')},accountLimits:{id:'limits',revision:'v1',digest:h('limits')},enrolledAtMs:1};
  core.enrollEvaluation({...common,enrollmentId:'enroll-local',runId:'local',caseId:'eval'});createEvaluationEnrollmentStore(db).enroll({...common,enrollmentId:'enroll-foreign',runId:'foreign',caseId:'hold'});
  db.prepare("UPDATE task SET state='failed' WHERE id IN ('task-local','task-foreign')").run();
  core.observeEvaluation({enrollmentId:'enroll-local',observationId:'observation-local',expectedPriorRevision:0});
  return policy;
}

test('Core and IPC explicitly persist one stable sanitized projection from stored workspace lineage',async()=>{
  const root=mkdtempSync(join(tmpdir(),'cue-eval-projection-core-')),workspace=join(root,'workspace'),foreign=join(root,'foreign');roots.push(root);mkdirSync(workspace);mkdirSync(foreign);
  let core=createCueCore(initializeConfig(join(root,'state'),{worktreeRoot:workspace}));cores.push(core);const policy=seed(core,workspace,foreign),db=core.daemon.db;
  const protectedBefore={approvals:(db.prepare('SELECT count(*) n FROM approval_event').get() as any).n,policies:(db.prepare('SELECT count(*) n FROM selection_policy_snapshot').get() as any).n,runs:(db.prepare('SELECT count(*) n FROM run').get() as any).n};
  const input={enrollmentId:'enroll-local',observationId:'observation-local'},saved=core.projectEvaluationObservation(input);
  expect(saved).toMatchObject({authority:'stored-enrollment-observation-outcome-only',enrollmentId:'enroll-local',observationId:'observation-local',outcome:null,outcomeAvailability:'unavailable',nonConvertibleReasons:expect.arrayContaining(['outcome-unavailable']),trial:null,limitation:'current-outcome-contract-does-not-store-required-trial-measurements'});expect(saved.projectionId).toMatch(/^evaluation-projection:[a-f0-9]{64}$/);
  expect(core.projectEvaluationObservation(input)).toEqual(saved);expect((db.prepare('SELECT count(*) n FROM evaluation_trial_projection').get() as any).n).toBe(1);
  expect(()=>core.projectEvaluationObservation({...input,projectionId:'caller'} as never)).toThrow('resource_input');expect(()=>core.projectEvaluationObservation({enrollmentId:'enroll-foreign',observationId:'observation-local'})).toThrow('evaluation_unavailable');expect(()=>db.transaction(()=>core.projectEvaluationObservation(input))()).toThrow('evaluation_unavailable');
  const real=core,facade={prepareGoal:()=>({runId:'local'}),readEvaluationEnrollment:real.readEvaluationEnrollment,projectEvaluationObservation:real.projectEvaluationObservation};const ipc=registerIpcHandlers({handle:vi.fn()},facade as never);ipc.invoke('cue:prepare',{});
  const reply=await ipc.invoke('cue:evaluation',{operation:'projection',...input});expect(reply).toMatchObject({available:true,operation:'projection',value:{projectionId:saved.projectionId,outcome:null,outcomeAvailability:'unavailable',trial:null,promotionEligible:false}});expect(reply.value).not.toHaveProperty('runId');expect(reply.value).not.toHaveProperty('digest');expect(JSON.stringify(reply)).not.toContain(workspace);
  expect(await ipc.invoke('cue:evaluation',{operation:'projection',enrollmentId:'enroll-local',observationId:'missing'})).toEqual({available:false,reason:'evaluation-unavailable'});
  expect({approvals:(db.prepare('SELECT count(*) n FROM approval_event').get() as any).n,policies:(db.prepare('SELECT count(*) n FROM selection_policy_snapshot').get() as any).n,runs:(db.prepare('SELECT count(*) n FROM run').get() as any).n}).toEqual(protectedBefore);expect(policy.revision).toBe(1);
  await core.close();cores.splice(cores.indexOf(core),1);core=createCueCore(initializeConfig(join(root,'state'),{worktreeRoot:workspace}));cores.push(core);expect(core.projectEvaluationObservation(input)).toEqual(saved);expect((core.daemon.db.prepare('SELECT count(*) n FROM evaluation_trial_projection').get() as any).n).toBe(1);
  await core.close();cores.splice(cores.indexOf(core),1);core=createCueCore({...initializeConfig(join(root,'state')),worktreeRoot:foreign});cores.push(core);expect(()=>core.projectEvaluationObservation(input)).toThrow('evaluation_unavailable');const foreignFacade={prepareGoal:()=>({runId:'local'}),readEvaluationEnrollment:core.readEvaluationEnrollment,projectEvaluationObservation:core.projectEvaluationObservation},foreignIpc=registerIpcHandlers({handle:vi.fn()},foreignFacade as never);foreignIpc.invoke('cue:prepare',{});expect(await foreignIpc.invoke('cue:evaluation',{operation:'projection',...input})).toEqual({available:false,reason:'evaluation-unavailable'});
});

test('Core fails closed when stored observation lineage is tampered',()=>{
  const root=mkdtempSync(join(tmpdir(),'cue-eval-projection-tamper-')),workspace=join(root,'workspace'),foreign=join(root,'foreign');roots.push(root);mkdirSync(workspace);mkdirSync(foreign);
  const core=createCueCore(initializeConfig(join(root,'state'),{worktreeRoot:workspace}));cores.push(core);seed(core,workspace,foreign);const db=core.daemon.db,row=db.prepare("SELECT payload FROM evaluation_observation WHERE observation_id='observation-local'").get() as any,payload=JSON.parse(row.payload);payload.enrollmentDigest=h('tampered');const encoded=JSON.stringify(payload);
  db.exec('DROP TRIGGER evaluation_observation_update');db.prepare("UPDATE evaluation_observation SET payload=?,payload_digest=? WHERE observation_id='observation-local'").run(encoded,h(encoded));
  expect(()=>core.projectEvaluationObservation({enrollmentId:'enroll-local',observationId:'observation-local'})).toThrow();expect((db.prepare('SELECT count(*) n FROM evaluation_trial_projection').get() as any).n).toBe(0);
});
