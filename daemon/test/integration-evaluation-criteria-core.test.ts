import { afterEach, expect, test, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createCueCore, initializeConfig, type CueCore } from '../../app/core.mjs';
import { registerIpcHandlers } from '../../app/ipc.mjs';
import { createHash } from 'node:crypto';
import { normalizeEnvelope, envelopeHash } from '../src/envelope.js';
import { saveSelectionPolicy, bindRunSelectionPolicy } from '../src/selection/policy-store.js';
import { createEvaluationObservationStore } from '../src/evaluation/observations.js';
import { createEvaluationTrialProjectionStore } from '../src/evaluation/trials.js';

const roots:string[]=[],cores:CueCore[]=[];afterEach(async()=>{for(const core of cores.splice(0))await core.close();for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true})});
const defaults={maxPriceAgeMs:86400000,minPairsPerSplit:2,qualityFloor:.5,minSuccessRate:.5,maxUnknownRate:.5,costLimitUnits:null,costBasisUnits:1,timeBasisMs:1,minImprovement:0};
const h=(value:string)=>createHash('sha256').update(value).digest('hex');
function actual(mode:'value'|'performance'){
  const root=mkdtempSync(join(tmpdir(),'cue-criteria-actual-')),workspace=join(root,'workspace'),state=join(root,'state');roots.push(root);mkdirSync(workspace);const core=createCueCore(initializeConfig(state,{worktreeRoot:workspace}),undefined,{verifyExplicitUserBaselineAuthority:()=>true});cores.push(core);const db=core.daemon.db,dataset={id:'dataset',revision:'v1',cases:[{id:'eval',kind:'code',inputDigest:h('eval'),split:'evaluation'},{id:'hold',kind:'code',inputDigest:h('hold'),split:'holdout'}]} as const;
  const policy=saveSelectionPolicy(db,{policyId:'policy',expectedRevision:null,createdAt:'2026-09-14T00:00:00.000Z',sourceVersion:'fixture',policy:{version:'cue-selection-v1',mode,qualityMinimum:.5,costBasis:1,timeBasisMs:1,currency:'TEST',costLimit:mode==='performance'?10:null,remainingTimeMs:null,maxEstimateAgeMs:100,allowedCandidateIds:['agent'],pinnedCandidateId:'agent'}}),observations=createEvaluationObservationStore(db),projections=createEvaluationTrialProjectionStore(db),baselineProjectionIds:string[]=[],candidateProjectionIds:string[]=[];let serial=0;
  for(const item of dataset.cases)for(const arm of ['manual-baseline',mode] as const){const n=++serial,runId=`run-${n}`,taskId=`task-${n}`,enrollmentId=`enrollment-${n}`,env=normalizeEnvelope({run_id:runId,worktree_realpath:workspace,allowed_actions:['file_change'],egress:[],expires_at:'2027-01-01T00:00:00.000Z',autonomy_level:'bounded'}),eh=envelopeHash(env);db.prepare('INSERT INTO task VALUES(?,?,NULL,?)').run(taskId,'awaiting_approval','now');db.prepare("INSERT OR IGNORE INTO envelope VALUES(?,?,'[]','now')").run(eh,workspace);db.prepare('INSERT INTO run VALUES(?,?,?,0,?)').run(runId,taskId,eh,'now');bindRunSelectionPolicy(db,{runId,policyId:'policy',revision:1,digest:policy.digest,boundAt:'2026-09-14T00:00:00.000Z'});const common={enrollmentId,runId,dataset,caseId:item.id,policy:{kind:'monetary',policyId:'policy',revision:1,digest:policy.digest},metric:{id:'metric',revision:'v1',digest:h('metric')},environment:{id:'environment',revision:'v1',digest:h('environment')},accountLimits:{id:'limits',revision:'v1',digest:h('limits')},enrolledAtMs:1} as const;if(arm==='manual-baseline')core.declareManualEvaluationBaseline({baselineId:`baseline-${n}`,...common,candidate:{id:'agent',revision:'v1',digest:h('agent')},authorityRef:{id:'user',revision:'v1',digest:h('user')}});else core.enrollEvaluation({...common,arm});db.prepare('UPDATE task SET state=? WHERE id=?').run('failed',taskId);const observationId=`observation-${n}`;observations.observe({enrollmentId,observationId,expectedPriorRevision:0},10+n);const projection=projections.project({projectionId:`projection-${n}`,enrollmentId,observationId});(arm==='manual-baseline'?baselineProjectionIds:candidateProjectionIds).push(projection.projectionId)}
  return {root,workspace,state,core,db,baselineProjectionIds,candidateProjectionIds,ipc:registerIpcHandlers({handle:vi.fn()},core)};
}
test('criteria are exact and rejected before SQLite comparison writes or projection reads',()=>{
  const root=mkdtempSync(join(tmpdir(),'cue-criteria-core-')),workspace=join(root,'workspace');roots.push(root);mkdirSync(workspace);const core=createCueCore(initializeConfig(join(root,'state'),{worktreeRoot:workspace}));cores.push(core);const db=core.daemon.db;
  const input={snapshotId:'criteria',baselineProjectionIds:['baseline'],candidateProjectionIds:['candidate'],mode:'value',criteria:defaults} as const;
  let reads=0;const prepare=db.prepare.bind(db);(db as any).prepare=(sql:string)=>{if(sql.includes('FROM evaluation_trial_projection'))reads++;return prepare(sql)};
  const invalid=[{...defaults,minPairsPerSplit:1},{...defaults,qualityFloor:NaN},{...defaults,timeBasisMs:Infinity},{...defaults,maxPriceAgeMs:Number.MAX_SAFE_INTEGER+1},{...defaults,extra:1},Object.defineProperty({...defaults},'qualityFloor',{enumerable:true,get(){throw Error('getter touched')}})];
  for(const criteria of invalid)expect(()=>core.createEvaluationComparisonFromRecords({...input,criteria} as never)).toThrow('resource_input');
  expect(()=>core.createEvaluationComparisonFromRecords({...input,mode:'performance',criteria:defaults} as never)).toThrow('resource_input');expect(reads).toBe(0);expect((prepare('SELECT count(*) n FROM evaluation_comparison_snapshot').get() as any).n).toBe(0);
});

test('IPC accepts sanitized custom criteria and rejects hostile criteria before Core',()=>{
  const saved=vi.fn(()=>({})),core={createEvaluationComparisonFromRecords:saved},ipc=registerIpcHandlers({handle:vi.fn()},core as never),criteria={...defaults,maxPriceAgeMs:42,minImprovement:.25,costLimitUnits:7};
  void ipc.invoke('cue:evaluation',{operation:'comparison-create',snapshotId:'criteria',baselineProjectionIds:['baseline'],candidateProjectionIds:['candidate'],mode:'value',criteria});
  expect(saved).toHaveBeenCalledWith(expect.objectContaining({criteria}));saved.mockClear();let touched=0;const hostile=Object.defineProperty({...criteria},'qualityFloor',{enumerable:true,get(){touched++;return .5}});
  expect(()=>ipc.invoke('cue:evaluation',{operation:'comparison-create',snapshotId:'criteria',baselineProjectionIds:['baseline'],candidateProjectionIds:['candidate'],mode:'value',criteria:hostile})).toThrow('input denied');expect(touched).toBe(0);expect(saved).not.toHaveBeenCalled();
});

test('actual SQLite Core to IPC persists custom and legacy criteria with replay reopen and conflict',async()=>{
  const f=actual('value'),base={operation:'comparison-create',baselineProjectionIds:f.baselineProjectionIds,candidateProjectionIds:f.candidateProjectionIds,mode:'value'} as const,custom={...defaults,maxPriceAgeMs:42,minImprovement:.25,costLimitUnits:7};
  const legacy=await f.ipc.invoke('cue:evaluation',{...base,snapshotId:'legacy'});expect(legacy.value.criteria).toEqual(defaults);const created=await f.ipc.invoke('cue:evaluation',{...base,snapshotId:'custom',criteria:custom});expect(created.value.criteria).toEqual(custom);expect((await f.ipc.invoke('cue:evaluation',{...base,snapshotId:'custom',criteria:custom})).value).toEqual(created.value);expect((f.db.prepare('SELECT count(*) n FROM evaluation_comparison_snapshot').get() as any).n).toBe(2);
  expect(await f.ipc.invoke('cue:evaluation',{...base,snapshotId:'custom',criteria:{...custom,minImprovement:.5}})).toEqual({available:false,reason:'evaluation-unavailable'});expect((f.db.prepare('SELECT count(*) n FROM evaluation_comparison_snapshot').get() as any).n).toBe(2);
  await f.core.close();cores.splice(cores.indexOf(f.core),1);const reopened=createCueCore({...initializeConfig(f.state),worktreeRoot:f.workspace});cores.push(reopened);const reply=await registerIpcHandlers({handle:vi.fn()},reopened).invoke('cue:evaluation',{operation:'comparison-read',snapshotId:'custom'});expect(reply.value.criteria).toEqual(custom);
});

test('performance requires and persists an explicit stored-unit ceiling',async()=>{
  const f=actual('performance'),base={operation:'comparison-create',snapshotId:'performance',baselineProjectionIds:f.baselineProjectionIds,candidateProjectionIds:f.candidateProjectionIds,mode:'performance'} as const;
  expect(()=>f.ipc.invoke('cue:evaluation',{...base,criteria:defaults})).toThrow('input denied');expect((f.db.prepare('SELECT count(*) n FROM evaluation_comparison_snapshot').get() as any).n).toBe(0);const criteria={...defaults,costLimitUnits:9};const created=await f.ipc.invoke('cue:evaluation',{...base,criteria});expect(created.value.criteria).toEqual(criteria);expect((f.db.prepare('SELECT count(*) n FROM evaluation_comparison_snapshot').get() as any).n).toBe(1);
});
