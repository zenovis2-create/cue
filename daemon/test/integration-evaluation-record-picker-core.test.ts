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
import { createEvaluationObservationStore } from '../src/evaluation/observations.js';
import { createEvaluationTrialProjectionStore } from '../src/evaluation/trials.js';

const roots:string[]=[],cores:CueCore[]=[];
afterEach(async()=>{for(const core of cores.splice(0))await core.close();for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true})});
const h=(value:string)=>createHash('sha256').update(value).digest('hex');

function seed(core:CueCore,workspace:string,foreign:string){
  const db=core.daemon.db,policy=saveSelectionPolicy(db,{policyId:'policy',expectedRevision:null,createdAt:'2026-09-14T00:00:00.000Z',sourceVersion:'fixture',policy:{version:'cue-selection-v1',mode:'efficiency',qualityMinimum:.5,costBasis:1,timeBasisMs:1,currency:'TEST',costLimit:null,remainingTimeMs:null,maxEstimateAgeMs:100,allowedCandidateIds:['agent'],pinnedCandidateId:null}}),enrollments=createEvaluationEnrollmentStore(db),observations=createEvaluationObservationStore(db),projections=createEvaluationTrialProjectionStore(db);
  for(let index=1;index<=69;index++){
    const local=index!==4,runId=`run-${index}`,taskId=`task-${index}`,path=local?workspace:foreign,enrollmentId=`enroll-${index}`,observationId=`obs-${index}`,projectionId=`projection-${index}`,dataset={id:`data-${index}`,revision:'v1',cases:[{id:'eval',kind:'code' as const,inputDigest:h('eval'),split:'evaluation' as const},{id:'hold',kind:'code' as const,inputDigest:h('hold'),split:'holdout' as const}]},env=normalizeEnvelope({run_id:runId,worktree_realpath:path,allowed_actions:['file_change'],egress:[],expires_at:'2027-01-01T00:00:00.000Z',autonomy_level:'bounded'}),digest=envelopeHash(env);
    db.prepare('INSERT INTO task VALUES(?,?,NULL,?)').run(taskId,'awaiting_approval','now');db.prepare("INSERT INTO envelope VALUES(?,?,'[]','now')").run(digest,path);db.prepare('INSERT INTO run VALUES(?,?,?,0,?)').run(runId,taskId,digest,'now');bindRunSelectionPolicy(db,{runId,policyId:'policy',revision:1,digest:policy.digest,boundAt:'2026-09-14T00:00:00.000Z'});
    enrollments.enroll({enrollmentId,runId,dataset,caseId:index%2?'eval':'hold',arm:'efficiency',policy:{kind:'monetary',policyId:'policy',revision:1,digest:policy.digest},metric:{id:'metric',revision:'v1',digest:h('metric')},environment:{id:'env',revision:'v1',digest:h('env')},accountLimits:{id:'limits',revision:'v1',digest:h('limits')},enrolledAtMs:index});db.prepare('UPDATE task SET state=? WHERE id=?').run('failed',taskId);observations.observe({enrollmentId,observationId,expectedPriorRevision:0},10+index);projections.project({projectionId,enrollmentId,observationId});
  }
}

test('Core and IPC list bounded revalidated workspace projections across pages and reopen',async()=>{
  const root=mkdtempSync(join(tmpdir(),'cue-eval-record-picker-')),workspace=join(root,'workspace'),foreign=join(root,'foreign'),state=join(root,'state');roots.push(root);mkdirSync(workspace);mkdirSync(foreign);let core=createCueCore(initializeConfig(state,{worktreeRoot:workspace}));cores.push(core);seed(core,workspace,foreign);const db=core.daemon.db;
  const first=core.listEvaluationProjections({limit:1,cursor:null});expect(first).toMatchObject({version:'cue-evaluation-projection-list-v1',authority:'bounded-workspace-descriptive-index',order:'sqlite-insertion-desc',complete:false,records:[{projectionId:'projection-69',dataset:{id:'data-69',revision:'v1'},caseId:'eval',split:'evaluation',arm:'efficiency',outcomeAvailability:'unavailable',outcome:null,trialReady:false,promotionEligible:false}]});expect(first.records[0]).not.toHaveProperty('runId');expect(first.records[0]).not.toHaveProperty('digest');
  const second=core.listEvaluationProjections({limit:1,cursor:first.nextCursor});expect(second.records[0].projectionId).toBe('projection-68');expect(second.nextCursor).not.toBe(first.nextCursor);expect(core.listEvaluationProjections.call({listEvaluationProjections:()=>{throw Error('forged')}} as never,{limit:1,cursor:null}).records[0].projectionId).toBe('projection-69');
  db.exec('DROP TRIGGER evaluation_trial_projection_update');for(let index=5;index<=69;index++)db.prepare('UPDATE evaluation_trial_projection SET payload=? WHERE projection_id=?').run('{}',`projection-${index}`);const skipped=core.listEvaluationProjections({limit:20,cursor:null});expect(skipped).toMatchObject({records:[],complete:false});expect(JSON.stringify(skipped)).not.toContain('projection-69');const crossed=core.listEvaluationProjections({limit:20,cursor:skipped.nextCursor});expect(crossed.records.map(row=>row.projectionId)).toEqual(['projection-3','projection-2','projection-1']);expect(JSON.stringify(crossed)).not.toContain('projection-4');
  const ipc=registerIpcHandlers({handle:vi.fn()},core),reply=await ipc.invoke('cue:evaluation',{operation:'projection-list',limit:1,cursor:skipped.nextCursor});expect(reply).toMatchObject({available:true,operation:'projection-list',value:{records:[{projectionId:'projection-3',trialReady:false,promotionEligible:false}]}});expect(()=>ipc.invoke('cue:evaluation',{operation:'projection-list',limit:21,cursor:null})).toThrow('input denied');expect(()=>core.listEvaluationProjections({limit:0,cursor:null})).toThrow('resource_input');expect(()=>core.listEvaluationProjections({limit:1,cursor:999999})).toThrow('evaluation_unavailable');db.exec('BEGIN');expect(()=>core.listEvaluationProjections({limit:1,cursor:null})).toThrow('evaluation_unavailable');db.exec('ROLLBACK');
  await core.close();cores.splice(cores.indexOf(core),1);core=createCueCore({...initializeConfig(state),worktreeRoot:workspace});cores.push(core);expect(core.listEvaluationProjections({limit:1,cursor:skipped.nextCursor}).records[0].projectionId).toBe('projection-3');
});
