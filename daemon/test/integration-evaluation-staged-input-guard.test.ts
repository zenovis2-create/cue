import {afterEach,expect,test,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openLedger} from '../src/ledger.js';
import {saveSelectionPolicy,bindRunSelectionPolicy} from '../src/selection/policy-store.js';
import {createEvaluationEnrollmentStore} from '../src/evaluation/enrollment.js';
import {checkFrozenStagedInput,recordFrozenStagedInputObservation,readFrozenStagedInputObservation} from '../src/evaluation/staged-input-guard.js';
import {readExistingFileWorkload} from '../src/evaluation/workload-release.js';
import {prepareEvaluationWorkloadCase} from '../src/evaluation/workload.js';
import {identifyChangeSnapshotRoot} from '../src/change-snapshot-host.js';
import type {StageEnvelopeBinding} from '../src/orchestration/stage-envelope.js';
const roots:string[]=[],ledgers:ReturnType<typeof openLedger>[]=[];
afterEach(()=>{vi.restoreAllMocks();for(const db of ledgers.splice(0))db.close();for(const path of roots.splice(0))rmSync(path,{recursive:true,force:true,maxRetries:5,retryDelay:50});});
const h=(v:string)=>createHash('sha256').update(v).digest('hex');
function fixture(enroll=true){
 const root=mkdtempSync(join(tmpdir(),'cue-staged-input-'));roots.push(root);const db=openLedger(':memory:');ledgers.push(db);
 const workload=readExistingFileWorkload(),item=workload.cases.find(c=>c.split==='evaluation')!,prepared=prepareEvaluationWorkloadCase(workload,{caseId:item.id,split:item.split,parent:root});
 const runId='run-frozen',taskId='implement',attemptId='attempt-frozen',parentHash=h('parent'),stageHash=h('stage'),planDigest=h('plan');
 db.prepare('INSERT INTO task VALUES(?,?,NULL,?)').run(runId,'awaiting_approval','now');db.prepare("INSERT INTO envelope VALUES(?,?,'[]','now')").run(parentHash,prepared.worktreePath);db.prepare('INSERT INTO run VALUES(?,?,?,0,?)').run(runId,runId,parentHash,'now');
 db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)').run(runId,runId,'goal',item.goal,'now');
 const policy=saveSelectionPolicy(db,{policyId:'policy',expectedRevision:null,createdAt:'2026-09-22T00:00:00.000Z',sourceVersion:'fixture',policy:{version:'cue-selection-v1',mode:'efficiency',qualityMinimum:.5,costBasis:1,timeBasisMs:100,currency:'TEST',costLimit:null,remainingTimeMs:null,maxEstimateAgeMs:100,allowedCandidateIds:['candidate'],pinnedCandidateId:null}});
 bindRunSelectionPolicy(db,{runId,policyId:'policy',revision:1,digest:policy.digest,boundAt:'2026-09-22T00:00:00.000Z'});
 const base={enrollmentId:'enroll-frozen',runId,dataset:workload.datasetInput,caseId:item.id,arm:'efficiency',policy:{kind:'monetary',policyId:'policy',revision:1,digest:policy.digest},metric:{id:'metric',revision:'v1',digest:h('metric')},environment:{id:'env',revision:'v1',digest:h('env')},accountLimits:{id:'limits',revision:'v1',digest:h('limits')},enrolledAtMs:1};
 if(enroll)createEvaluationEnrollmentStore(db).enroll(base);
 const binding={workflowRunId:runId,taskId,attemptId,envelope:{worktree_realpath:prepared.worktreePath,allowed_actions:['file_change']},envelopeHash:stageHash,parentEnvelopeHash:parentHash,planDigest,policyDigest:policy.digest} as StageEnvelopeBinding;
 return{root,db,workload,item,prepared,base,binding,runId,taskId,attemptId,stageHash,parentHash,planDigest};
}
function stage(f:ReturnType<typeof fixture>){
 const id=identifyChangeSnapshotRoot(f.prepared.worktreePath);expect(id.state).toBe('ok');if(id.state!=='ok')throw Error('native helper unavailable');
 // The test writes synthetic lineage rows after enrolling. Production binding
 // is issued by the stage binder/driver; this deliberately does not test that issuer.
 for(const name of ['attempt_staging_setup_insert_guard','attempt_staging_authority_insert_guard','launch_intent_current_hash'])dbDrop(f.db,name);
 f.db.prepare("INSERT INTO envelope VALUES(?,?,'[]','now')").run(f.stageHash,f.prepared.worktreePath);
 f.db.pragma('foreign_keys=OFF');
 f.db.prepare("INSERT INTO orchestration_attempt(attempt_id,run_id,task_id,candidate_id,state,claim_payload,worktree_realpath) VALUES(?,?,?,'candidate','running','{}',?)").run(f.attemptId,f.runId,f.taskId,f.prepared.worktreePath);
 f.db.prepare('INSERT INTO attempt_staging_setup VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run('setup',f.attemptId,f.runId,f.taskId,'candidate',f.prepared.worktreePath,id.identity.volumeSerial,id.identity.fileId,'a'.repeat(40),h('clean'),h('subject'),'cue-attempt-staging-factory-v1',h('factory'),1,h('setup'),Buffer.from('{}'));
 f.db.prepare('INSERT INTO attempt_staging_authority VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(f.attemptId,f.stageHash,f.parentHash,f.planDigest,f.binding.policyDigest,f.prepared.worktreePath,id.identity.volumeSerial,id.identity.fileId,2,h('authority'),Buffer.from('{}'));
 f.db.prepare('INSERT INTO orchestration_launch_intent VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(f.attemptId,f.runId,f.taskId,'candidate',h('selection'),h('subject'),'codex','v1',null,null,f.parentHash,f.stageHash,f.planDigest,f.binding.policyDigest,h('intent'),Buffer.from('{}'));
 f.db.pragma('foreign_keys=ON');
}
function dbDrop(db:ReturnType<typeof openLedger>,name:string){if(db.prepare("SELECT 1 FROM sqlite_master WHERE type='trigger' AND name=?").get(name))db.exec(`DROP TRIGGER ${name}`);}

test('unenrolled run returns no measurement authority and never starts a native seed snapshot',()=>{
 const f=fixture(false);expect(checkFrozenStagedInput(f.db,{binding:f.binding,contract:f.item.contract})).toEqual({status:'not-enrolled',executedInputVerified:false});
});
test('real native helper checks all packaged seeds against the active stage root before launch without writing a trial',()=>{
 const f=fixture();stage(f);const before=f.db.prepare('SELECT count(*) n FROM evaluation_measured_fact').get();
 const result=checkFrozenStagedInput(f.db,{binding:f.binding,contract:f.item.contract});
 expect(result).toMatchObject({status:'prelaunch-stage-seeds-match',authority:'point-in-time-staged-seed-check-only',caseId:f.item.id,inputDigest:f.item.inputDigest,fileCount:f.item.files.length,executedInputVerified:false,executionAuthorized:false,promotionEligible:false});
 expect(f.db.prepare('SELECT count(*) n FROM evaluation_measured_fact').get()).toEqual(before);
});
test('wrong goal or checker contract denies an enrolled frozen workload before snapshot, rather than using a claimed digest',()=>{
 const f=fixture();stage(f);expect(()=>checkFrozenStagedInput(f.db,{binding:f.binding,contract:{...f.item.contract,parametersDigest:h('different')}})).toThrow('contract');
 f.db.prepare("UPDATE artifact SET content='different' WHERE run_id=? AND kind='goal'").run(f.runId);expect(()=>checkFrozenStagedInput(f.db,{binding:f.binding,contract:f.item.contract})).toThrow('goal');
});
test('changed or absent seed in the stage refuses, including a different same-length byte',()=>{
 const f=fixture();stage(f);const path=join(f.prepared.worktreePath,...f.item.files[0]!.relativePath.split('/'));const original=f.item.files[0]!.content;
 writeFileSync(path,original.replace(/^./,original[0]==='X'?'Y':'X'));
 expect(()=>checkFrozenStagedInput(f.db,{binding:f.binding,contract:f.item.contract})).toThrow('seed');
 rmSync(path);expect(()=>checkFrozenStagedInput(f.db,{binding:f.binding,contract:f.item.contract})).toThrow('seed');
});
test('wrong stage root, envelope or plan refuses before native file read',()=>{
 const f=fixture();stage(f);
 for(const binding of [{...f.binding,envelopeHash:h('other')},{...f.binding,planDigest:h('other')},{...f.binding,envelope:{...f.binding.envelope,worktree_realpath:f.root}},{...f.binding,envelope:{...f.binding.envelope,allowed_actions:[]}}])expect(()=>checkFrozenStagedInput(f.db,{binding:binding as StageEnvelopeBinding,contract:f.item.contract})).toThrow('stage');
});
test('a similarly named but changed dataset revision is not treated as the frozen release',()=>{
 const f=fixture(false),dataset={...f.workload.datasetInput,revision:'different'};
 createEvaluationEnrollmentStore(f.db).enroll({...f.base,dataset});
 expect(()=>checkFrozenStagedInput(f.db,{binding:f.binding,contract:f.item.contract})).toThrow('dataset');
});
test('actual native helper issued check saves only an immutable prelaunch observation and historical read does not resnapshot files',()=>{
 const f=fixture();stage(f);const checked=checkFrozenStagedInput(f.db,{binding:f.binding,contract:f.item.contract});
 const saved=recordFrozenStagedInputObservation(f.db,checked);expect(saved).toMatchObject({version:'cue-staged-input-observation-v1',authority:'point-in-time-staged-seed-observation-only',caseId:f.item.id,executedInputVerified:false,executionAuthorized:false,promotionEligible:false});
 expect(readFrozenStagedInputObservation(f.db,f.attemptId)).toEqual(saved);
 expect(f.db.prepare('SELECT count(*) n FROM evaluation_measured_fact').get()).toEqual({n:0});expect(f.db.prepare('SELECT count(*) n FROM approval_event').get()).toEqual({n:0});
 const file=join(f.prepared.worktreePath,...f.item.files[0]!.relativePath.split('/'));writeFileSync(file,'later bytes');
 expect(readFrozenStagedInputObservation(f.db,f.attemptId)).toEqual(saved);
 expect(()=>recordFrozenStagedInputObservation(f.db,checked)).toThrow('unissued');
 expect(()=>f.db.prepare('DELETE FROM evaluation_staged_input_observation').run()).toThrow('immutable');
 expect(()=>f.db.prepare("UPDATE evaluation_staged_input_observation SET payload='{}'").run()).toThrow('immutable');
});
test('forged checked object and changed stage seed cannot write an observation',()=>{
 const f=fixture();stage(f);expect(()=>recordFrozenStagedInputObservation(f.db,{status:'prelaunch-stage-seeds-match'})).toThrow('unissued');
 const path=join(f.prepared.worktreePath,...f.item.files[0]!.relativePath.split('/'));writeFileSync(path,'changed');
 expect(()=>checkFrozenStagedInput(f.db,{binding:f.binding,contract:f.item.contract})).toThrow('seed');
 expect(f.db.prepare('SELECT count(*) n FROM evaluation_staged_input_observation').get()).toEqual({n:0});
});
test('historical read detects source goal changes rather than presenting a current verified claim',()=>{
 const f=fixture();stage(f);recordFrozenStagedInputObservation(f.db,checkFrozenStagedInput(f.db,{binding:f.binding,contract:f.item.contract}));
 f.db.prepare("UPDATE artifact SET content='changed' WHERE run_id=? AND kind='goal'").run(f.runId);
 expect(()=>readFrozenStagedInputObservation(f.db,f.attemptId)).toThrow('source');
});
test('second genuine check replays the original observation, not a new timestamp',()=>{
 const f=fixture();stage(f);const first=recordFrozenStagedInputObservation(f.db,checkFrozenStagedInput(f.db,{binding:f.binding,contract:f.item.contract}));
 const second=recordFrozenStagedInputObservation(f.db,checkFrozenStagedInput(f.db,{binding:f.binding,contract:f.item.contract}));
 expect(second).toEqual(first);expect(f.db.prepare('SELECT count(*) n FROM evaluation_staged_input_observation').get()).toEqual({n:1});
});
test('historical source tamper and direct inserted authority claims fail closed',()=>{
 const f=fixture();stage(f);const saved:any=recordFrozenStagedInputObservation(f.db,checkFrozenStagedInput(f.db,{binding:f.binding,contract:f.item.contract}));
 expect(()=>f.db.prepare('INSERT INTO evaluation_staged_input_observation VALUES(?,?,?,?,?,?,?,?)').run('fake',saved.enrollmentId,saved.runId,saved.taskId,saved.stageEnvelopeHash,saved.observedAtMs,h('fake'),'{}')).toThrow();
 f.db.exec('DROP TRIGGER evaluation_staged_input_no_update');f.db.prepare('UPDATE evaluation_staged_input_observation SET payload_digest=? WHERE attempt_id=?').run(h('tamper'),f.attemptId);
 expect(()=>readFrozenStagedInputObservation(f.db,f.attemptId)).toThrow('integrity');
});
test('a source change after native snapshot refuses persistence rather than converting a stale check into authority',()=>{
 const f=fixture();stage(f);const proof=checkFrozenStagedInput(f.db,{binding:f.binding,contract:f.item.contract});
 f.db.prepare("UPDATE artifact SET content='changed' WHERE run_id=? AND kind='goal'").run(f.runId);
 expect(()=>recordFrozenStagedInputObservation(f.db,proof)).toThrow('concurrent-change');
 expect(f.db.prepare('SELECT count(*) n FROM evaluation_staged_input_observation').get()).toEqual({n:0});
});
test('migration installs and reopens intact, but missing immutable guard fails reopening',()=>{
 const root=mkdtempSync(join(tmpdir(),'cue-stage-observation-db-'));roots.push(root);const path=join(root,'ledger.db');
 const db=openLedger(path);db.close();const reopened=openLedger(path);
 expect(reopened.prepare("SELECT version FROM evaluation_staged_input_migration WHERE singleton=1").get()).toEqual({version:'cue-staged-input-observation-v1'});
 reopened.exec('DROP TRIGGER evaluation_staged_input_no_update');reopened.close();
 expect(()=>openLedger(path)).toThrow('evaluation_staged_input_migration_partial');
});
test('outer transaction blocks record and consumes issuance without a partial row',()=>{
 const f=fixture();stage(f);const proof=checkFrozenStagedInput(f.db,{binding:f.binding,contract:f.item.contract});f.db.exec('BEGIN');
 expect(()=>recordFrozenStagedInputObservation(f.db,proof)).toThrow('boundary');f.db.exec('ROLLBACK');
 expect(f.db.prepare('SELECT count(*) n FROM evaluation_staged_input_observation').get()).toEqual({n:0});
});
test('outside transaction boundary refuses and unexpected additional goal is not accepted',()=>{
 const f=fixture();stage(f);f.db.exec('BEGIN');expect(()=>checkFrozenStagedInput(f.db,{binding:f.binding,contract:f.item.contract})).toThrow('boundary');f.db.exec('ROLLBACK');
 f.db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)').run(f.runId,f.runId,'goal',f.item.goal,'now');expect(()=>checkFrozenStagedInput(f.db,{binding:f.binding,contract:f.item.contract})).toThrow('goal');
});
