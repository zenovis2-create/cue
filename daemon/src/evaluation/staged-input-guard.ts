import {createHash} from 'node:crypto';
import type {Ledger} from '../ledger.js';
import {createEvaluationEnrollmentStore} from './enrollment.js';
import {readExistingFileWorkload} from './workload-release.js';
import {snapshotRelativeNative} from '../change-snapshot-host.js';
import type {StageEnvelopeBinding} from '../orchestration/stage-envelope.js';
import type {createNativeExistingFileContract} from '../verification/native-existing-file-checker.js';

const ID=/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const issued=new WeakMap<object,{db:Ledger;payload:Record<string,unknown>;epoch:string}>();
const canonical=(v:unknown):string=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)
  ?`[${v.map(canonical).join(',')}]`:`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical((v as Record<string,unknown>)[k])}`).join(',')}}`;
const content=(v:unknown)=>createHash('sha256').update(typeof v==='string'?v:canonical(v)).digest('hex');
function fail(reason:string):never{throw Error('evaluation_staged_input_'+reason);}
const sha=(v:Uint8Array)=>createHash('sha256').update(v).digest('hex');
function epoch(db:Ledger){return JSON.stringify([db.pragma('data_version',{simple:true}),db.pragma('schema_version',{simple:true}),(db.prepare('SELECT total_changes() n').get() as {n:number}).n]);}
function stamp(db:Ledger){if(!db.open||db.inTransaction)fail('boundary');return epoch(db);}

/** A read-only gate at the native runtime authorization boundary. This does not
 * issue a measured-fact input receipt: the stage may change after this point,
 * and a launch intent is not proof that the process consumed these bytes. */
export function checkFrozenStagedInput(db:Ledger,input:Readonly<{
  binding:StageEnvelopeBinding;contract:ReturnType<typeof createNativeExistingFileContract>;
}>){
 const before=stamp(db),{binding,contract}=input;
 if(!binding||!ID.test(binding.workflowRunId)||!ID.test(binding.taskId)||!ID.test(binding.attemptId))fail('identity');
 const found=db.prepare('SELECT enrollment_id FROM evaluation_enrollment WHERE run_id=?').get(binding.workflowRunId) as {enrollment_id:string}|undefined;
 if(!found)return Object.freeze({status:'not-enrolled' as const,executedInputVerified:false as const});
 const enrolled=createEvaluationEnrollmentStore(db).read(found.enrollment_id);
 if(!enrolled||enrolled.runId!==binding.workflowRunId)fail('enrollment');
 const workload=readExistingFileWorkload();
 if(enrolled.dataset.id!==workload.dataset.id)return Object.freeze({status:'not-frozen-workload' as const,executedInputVerified:false as const});
 if(enrolled.dataset.digest!==workload.dataset.digest||enrolled.dataset.revision!==workload.dataset.revision)fail('dataset');
 const selected=workload.cases.find(c=>c.id===enrolled.caseId);
 if(!selected||selected.split!==enrolled.split||selected.inputDigest!==enrolled.inputDigest||selected.contract.parametersDigest!==contract?.parametersDigest
   ||JSON.stringify(selected.contract)!==JSON.stringify(contract))fail('contract');
 const goals=db.prepare("SELECT content FROM artifact WHERE run_id=? AND kind='goal' LIMIT 2").all(enrolled.runId) as {content:string}[];
 if(goals.length!==1||goals[0]!.content!==selected.goal)fail('goal');
 const stage=db.prepare(`SELECT a.execution_worktree_realpath root,a.execution_volume_serial volume,a.execution_file_id file,
      s.run_id,s.task_id,s.candidate_id,l.run_id launch_run,l.task_id launch_task,l.candidate_id launch_candidate,
      o.candidate_id attempt_candidate,l.plan_digest,l.policy_digest launch_policy,a.policy_digest stage_policy,
      a.plan_digest stage_plan,a.parent_envelope_hash stage_parent,a.stage_envelope_hash stage_hash,
      l.parent_envelope_hash,l.stage_envelope_hash,o.state,o.cleanup_verified
    FROM attempt_staging_authority a JOIN attempt_staging_setup s USING(attempt_id)
    JOIN orchestration_attempt o ON o.attempt_id=a.attempt_id
    JOIN orchestration_launch_intent l ON l.attempt_id=a.attempt_id
    WHERE a.attempt_id=? AND NOT EXISTS(SELECT 1 FROM attempt_staging_cleanup c WHERE c.attempt_id=a.attempt_id)`)
    .get(binding.attemptId) as {root:string;volume:string;file:string;run_id:string;task_id:string;candidate_id:string;launch_run:string;launch_task:string;launch_candidate:string;attempt_candidate:string;plan_digest:string;launch_policy:string;stage_policy:string;stage_plan:string;stage_parent:string;stage_hash:string;parent_envelope_hash:string;stage_envelope_hash:string;state:string;cleanup_verified:number}|undefined;
 if(!stage||stage.run_id!==enrolled.runId||stage.task_id!==binding.taskId||stage.state!=='running'||stage.cleanup_verified!==0
   ||stage.launch_run!==enrolled.runId||stage.launch_task!==binding.taskId||stage.candidate_id!==stage.launch_candidate||stage.candidate_id!==stage.attempt_candidate
   ||stage.root!==binding.envelope.worktree_realpath||stage.parent_envelope_hash!==binding.parentEnvelopeHash||stage.stage_parent!==binding.parentEnvelopeHash
   ||stage.stage_envelope_hash!==binding.envelopeHash||stage.stage_hash!==binding.envelopeHash||stage.plan_digest!==binding.planDigest||stage.stage_plan!==binding.planDigest
   ||stage.launch_policy!==binding.policyDigest||stage.stage_policy!==binding.policyDigest
   ||binding.envelope.allowed_actions.includes('file_change')!==true)fail('stage');
 const paths=selected.files.map(f=>f.relativePath),maxBytes=Math.max(1,...selected.files.map(f=>Buffer.byteLength(f.content)));
 const snapshot=snapshotRelativeNative({root:stage.root,expectedRoot:{volumeSerial:stage.volume,fileId:stage.file},targets:paths,maxBytes});
 if(snapshot.state!=='ok'||snapshot.results.length!==paths.length||snapshot.results.some((r,i)=>{
   const expected=Buffer.from(selected.files[i]!.content);
   return r.state!=='ok'||r.path!==paths[i]||r.byteLength!==expected.length||r.sha256!==sha(expected)
     ||!r.bytes||!r.bytes.equals(expected);
 }))fail('seed');
 const observedAtMs=Date.now();if(!Number.isSafeInteger(observedAtMs)||observedAtMs<0)fail('clock');
 if(stamp(db)!==before)fail('concurrent-change');
 const payload={version:'cue-staged-input-observation-v1',authority:'point-in-time-staged-seed-observation-only',
   attemptId:binding.attemptId,enrollmentId:enrolled.enrollmentId,runId:enrolled.runId,taskId:binding.taskId,caseId:selected.id,
   datasetDigest:enrolled.dataset.digest,inputDigest:selected.inputDigest,goalDigest:content(selected.goal),contractDigest:content(selected.contract),
   stageEnvelopeHash:binding.envelopeHash,planDigest:binding.planDigest,policyDigest:binding.policyDigest,
   rootIdentityDigest:content([stage.volume,stage.file]),seedManifestDigest:content(snapshot.results.map(r=>[r.path,r.byteLength,r.sha256])),
   observedAtMs,fileCount:paths.length,executedInputVerified:false,executionAuthorized:false,promotionEligible:false};
 const result=Object.freeze({status:'prelaunch-stage-seeds-match' as const,authority:'point-in-time-staged-seed-check-only' as const,
   enrollmentId:enrolled.enrollmentId,attemptId:binding.attemptId,caseId:selected.id,inputDigest:selected.inputDigest,
   stageEnvelopeHash:binding.envelopeHash,planDigest:binding.planDigest,fileCount:paths.length,
   executedInputVerified:false as const,executionAuthorized:false as const,promotionEligible:false as const});
 issued.set(result,{db,payload,epoch:before});return result;
}

/** Consume only the exact locally issued point-in-time check. The native helper
 * ran outside the writer lock; SQLite rechecks active immutable lineage inside. */
export function recordFrozenStagedInputObservation(db:Ledger,checked:object){
 const authority=issued.get(checked);if(!authority||authority.db!==db)fail('unissued');issued.delete(checked);
 if(stamp(db)!==authority.epoch)fail('concurrent-change');
 const payload=authority.payload,encoded=canonical(payload),digest=content(encoded);
 if(Buffer.byteLength(encoded)>8192)fail('payload');
 const prior=readFrozenStagedInputObservation(db,payload.attemptId as string);
 const same=(saved:Record<string,unknown>)=>Object.keys(payload).every(k=>k==='observedAtMs'||saved[k]===payload[k]);
 if(prior){if(!same(prior))fail('replay-conflict');return prior;}
 return db.transaction(()=>{
   if(epoch(db)!==authority.epoch||db.prepare('SELECT 1 FROM evaluation_staged_input_observation WHERE attempt_id=?').get(payload.attemptId))fail('concurrent-change');
   db.prepare('INSERT INTO evaluation_staged_input_observation VALUES(?,?,?,?,?,?,?,?)').run(
     payload.attemptId,payload.enrollmentId,payload.runId,payload.taskId,payload.stageEnvelopeHash,payload.observedAtMs,digest,encoded);
   return Object.freeze({...payload,digest});
 }).immediate();
}

/** Historical database/source verification only. No native filesystem recheck. */
export function readFrozenStagedInputObservation(db:Ledger,attemptId:string){
 stamp(db);if(typeof attemptId!=='string'||!ID.test(attemptId))fail('identity');
 const row=db.prepare('SELECT *,length(CAST(payload AS BLOB)) bytes FROM evaluation_staged_input_observation WHERE attempt_id=?').get(attemptId) as any;
 if(!row)return null;if(row.bytes>8192)fail('integrity');
 let p:Record<string,unknown>;try{p=JSON.parse(row.payload);}catch{fail('integrity');}
 if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).length!==21||canonical(p)!==row.payload||content(row.payload)!==row.payload_digest
   ||p.version!=='cue-staged-input-observation-v1'||p.authority!=='point-in-time-staged-seed-observation-only'
   ||p.attemptId!==row.attempt_id||p.enrollmentId!==row.enrollment_id||p.runId!==row.run_id||p.taskId!==row.task_id
   ||p.stageEnvelopeHash!==row.stage_envelope_hash||p.observedAtMs!==row.observed_at_ms
   ||p.executedInputVerified!==false||p.executionAuthorized!==false||p.promotionEligible!==false)fail('integrity');
 const base=createEvaluationEnrollmentStore(db).read(row.enrollment_id),workload=readExistingFileWorkload();
 const item=workload.cases.find(c=>c.id===p.caseId);
 const goals=db.prepare("SELECT content FROM artifact WHERE run_id=? AND kind='goal' LIMIT 2").all(row.run_id) as {content:string}[];
 if(!base||base.runId!==p.runId||base.dataset.digest!==p.datasetDigest||base.dataset.digest!==workload.dataset.digest
   ||base.inputDigest!==p.inputDigest||item?.inputDigest!==p.inputDigest||content(item.goal)!==p.goalDigest
   ||goals.length!==1||goals[0]!.content!==item.goal||content(item.contract)!==p.contractDigest||item.files.length!==p.fileCount
   ||content(item.files.map(f=>[f.relativePath,Buffer.byteLength(f.content),sha(Buffer.from(f.content))]))!==p.seedManifestDigest)fail('source');
 const source=db.prepare(`SELECT s.run_id,s.task_id,a.execution_volume_serial volume,a.execution_file_id file,
   a.stage_envelope_hash stage_hash,a.plan_digest stage_plan,a.policy_digest stage_policy,
   l.stage_envelope_hash launch_hash,l.plan_digest launch_plan,l.policy_digest launch_policy
   FROM attempt_staging_setup s JOIN attempt_staging_authority a USING(attempt_id)
   JOIN orchestration_launch_intent l USING(attempt_id) WHERE s.attempt_id=?`).get(attemptId) as any;
 if(!source||source.run_id!==p.runId||source.task_id!==p.taskId||source.stage_hash!==p.stageEnvelopeHash||source.launch_hash!==p.stageEnvelopeHash
   ||source.stage_plan!==p.planDigest||source.launch_plan!==p.planDigest||source.stage_policy!==p.policyDigest||source.launch_policy!==p.policyDigest
   ||content([source.volume,source.file])!==p.rootIdentityDigest)fail('source');
 return Object.freeze({...p,digest:row.payload_digest});
}
