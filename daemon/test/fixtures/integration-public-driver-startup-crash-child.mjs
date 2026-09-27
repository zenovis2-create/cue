import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { openLedger } from '../../dist/src/ledger.js';
import { envelopeHash, normalizeEnvelope } from '../../dist/src/envelope.js';
import { saveSelectionPolicy } from '../../dist/src/selection/policy-store.js';
import { createIntegrationCatalog } from '../../dist/src/integration-catalog.js';
import { SUBJECT_FIELDS, subjectDigest } from '../../dist/src/measurement-subject.js';
import { WRITE_PROBES, MODEL_PROBES } from '../../dist/src/capability-admission.js';
import { compareWriteExistingNative } from '../../dist/src/change-snapshot-host.js';
import { observeProcessTree } from '../../dist/src/process-termination.js';
import { ownDaemonWorktree } from '../../dist/src/daemon-ownership.js';
import { createGitStagingHost } from '../../dist/src/orchestration/git-staging-factory.js';
import { createOrchestrationDriver } from '../../../app/orchestration-driver.mjs';

export function resolvePublicationIntent(db,attemptId,input){
 const replacementSha256=createHash('sha256').update(input.replacement).digest('hex');
 const rows=db.prepare(`SELECT publication_id,payload_sha256,payload FROM change_publication_intent
  WHERE attempt_id=? AND worktree_realpath=? AND root_volume_serial=? AND root_file_id=? AND relative_path=? AND max_bytes=?
   AND preimage_volume_serial=? AND preimage_file_id=? AND preimage_byte_length=? AND preimage_sha256=?
   AND replacement_byte_length=? AND replacement_sha256=?`).all(attemptId,input.root,input.expectedRoot.volumeSerial,input.expectedRoot.fileId,input.target,input.maxBytes,input.expected.identity.volumeSerial,input.expected.identity.fileId,input.expected.byteLength,input.expected.sha256,input.replacement.length,replacementSha256);
 if(rows.length!==1)throw Error('public_driver_restart_intent_binding');const row=rows[0];
 if(!Buffer.isBuffer(row.payload)||createHash('sha256').update(row.payload).digest('hex')!==row.payload_sha256)throw Error('public_driver_restart_intent_corrupt');
 let payload;try{payload=JSON.parse(row.payload.toString('utf8'))}catch{throw Error('public_driver_restart_intent_corrupt')}
 if(payload.publicationId!==row.publication_id||payload.attemptId!==attemptId||payload.worktreeRealpath!==input.root||payload.relativePath!==input.target||payload.maxBytes!==input.maxBytes||payload.rootIdentity?.volumeSerial!==input.expectedRoot.volumeSerial||payload.rootIdentity?.fileId!==input.expectedRoot.fileId||payload.preimage?.identity?.volumeSerial!==input.expected.identity.volumeSerial||payload.preimage?.identity?.fileId!==input.expected.identity.fileId||payload.preimage?.byteLength!==input.expected.byteLength||payload.preimage?.sha256!==input.expected.sha256||payload.replacement?.byteLength!==input.replacement.length||payload.replacement?.sha256!==replacementSha256)throw Error('public_driver_restart_intent_corrupt');
 return{publicationId:row.publication_id,payloadSha256:row.payload_sha256,payload:row.payload.toString('utf8')};
}

export function createRestartHost(counts){return{runtime:{evidence:{resolveEvidence:()=>null,now:()=>0,maxAgeMs:1},resolveCandidate:()=>{counts.launches++;throw Error('public_driver_restart_autolaunch')}},finalPublication:{authorize:()=>{counts.authorizeCalls++;return false},openStagedAttempt:async()=>{counts.opens++;throw Error('public_driver_restart_reopen')},readStagedReplacement:async()=>{counts.reads++;throw Error('public_driver_restart_reread')},execute:()=>{counts.executeCalls++;throw Error('public_driver_restart_resend')}}}}

if(import.meta.url===pathToFileURL(process.argv[1]).href){
const [mode,databasePath,worktree]=process.argv.slice(2);
if(!['crash-window','restart'].includes(mode)||!databasePath||!worktree)throw Error('public_driver_restart_fixture_arguments');
const time=Date.parse('2026-09-15T00:00:00.000Z'),replacement=Buffer.from('published-by-public-driver');
const sha=value=>createHash('sha256').update(value).digest('hex');
const emit=value=>writeSync(1,`${JSON.stringify(value)}\n`,undefined,'utf8');
const row=observeProcessTree(process.pid).descendants.find(value=>value.pid===process.pid);
if(!row)throw Error('public_driver_restart_identity_missing');
const self={pid:row.pid,createdAt:row.createdAt};emit({kind:'identity',mode,...self});
const input=createInterface({input:process.stdin});let timer;
const [command]=await Promise.race([once(input,'line'),once(input,'close').then(()=>{throw Error('public_driver_restart_handshake_eof')}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('public_driver_restart_handshake_timeout')),30_000)})]).finally(()=>{clearTimeout(timer);input.close()});
if(command!=='continue')throw Error('public_driver_restart_handshake_invalid');
const db=openLedger(databasePath);let releaseOwnership;

try{
 releaseOwnership=ownDaemonWorktree(worktree,databasePath,db);
 if(mode==='crash-window'){
  const envelope=normalizeEnvelope({run_id:'workflow',worktree_realpath:worktree,allowed_actions:['file_change','read'],egress:[],expires_at:'2026-09-16T00:00:00.000Z',autonomy_level:'bounded'});
  const run={taskId:'root-task',runId:'workflow',envelopeHash:envelopeHash(envelope),envelope,goal:'publish staged bytes',scope:'code'};
  db.prepare("INSERT INTO task VALUES('root-task','awaiting_approval',NULL,'now')").run();db.prepare("INSERT INTO envelope VALUES(?,?,'[]','now')").run(run.envelopeHash,worktree);db.prepare("INSERT INTO run VALUES('workflow','root-task',?,0,'now')").run(run.envelopeHash);
  const policy=saveSelectionPolicy(db,{policyId:'policy',expectedRevision:null,createdAt:new Date(time).toISOString(),sourceVersion:'fixture',policy:{version:'cue-selection-v1',mode:'efficiency',qualityMinimum:.5,costBasis:1,timeBasisMs:1,currency:'TEST',costLimit:null,remainingTimeMs:null,maxEstimateAgeMs:100,allowedCandidateIds:['agent'],pinnedCandidateId:null}});
  const subject=Object.fromEntries(SUBJECT_FIELDS.map(key=>[key,key.endsWith('Sha256')?'a'.repeat(64):key])),evidence=new Map(),refs={};
  for(const probe of [...WRITE_PROBES,...MODEL_PROBES]){const bytes=Buffer.from(JSON.stringify({probe,subjectDigest:subjectDigest(subject),measuredAt:new Date(time-1).toISOString(),kind:'live',status:'pass'}));evidence.set(probe,bytes);refs[probe]={id:probe,sha256:sha(bytes)};}
  const catalog=createIntegrationCatalog({now:()=>time,maxAgeMs:100,currentSubjectDigest:()=>subjectDigest(subject)},[{canonicalId:'agent',toolId:'fixture',kind:'agent',aliases:[],installation:'installed',protocol:'verified',authReference:'fixture-account',authAvailable:true,sourceVersion:'fixture',observedAt:new Date(time).toISOString(),subjectDigest:subjectDigest(subject),binding:null}]);
  const configuration={policy:{policyId:'policy',revision:1,digest:policy.digest},requirementIds:['req'],proposedPlan:{revision:'plan1',policyRevision:'policy:1',policyDigest:policy.digest,tasks:[{id:'make',role:'implementation',ownerId:'maker',requirementIds:['req'],dependencyIds:[],candidateIds:['agent'],scopeIds:['work']},{id:'check',role:'verifier',ownerId:'checker',requirementIds:['req'],dependencyIds:['make'],candidateIds:['agent'],scopeIds:[]}]},scopes:[{id:'work',worktreeRealpath:worktree,allowedActions:['file_change','read'],egress:[]}],budget:{runId:'workflow',currency:'TEST',unit:'micro',limitUnits:100,policyRevision:'policy:1',source:'fixture',observedAtMs:time},changeTargets:[{taskId:'make',targetId:'target',relativePath:'target.txt',maxBackupBytes:1024}],stagedPublication:true,executionStaging:true,limits:{launchTimeoutMs:30_000,taskTimeoutMs:120_000,pollMs:10}};
  const executionStaging=createGitStagingHost({storageRoot:join(databasePath,'..','execution-staging')});
  let launches=0,opens=0,reads=0,writes=0,attemptId='';
  const host={now:()=>time,catalog,prepare:()=>configuration,verifyFinalBilling:()=>true,executionStaging,
   finalPublication:{authorize:()=>true,openStagedAttempt:async contract=>{opens++;return{contractId:contract.contractId}},readStagedReplacement:async request=>{reads++;const row=db.prepare('SELECT execution_worktree_realpath FROM attempt_staging_authority WHERE attempt_id=?').get(request.attemptId);if(!row)throw Error('public_driver_restart_staging_missing');return readFileSync(join(row.execution_worktree_realpath,request.relativePath))},execute:publication=>{const intent=resolvePublicationIntent(db,attemptId,publication);writes++;const outcome=compareWriteExistingNative(publication),file=readFileSync(join(worktree,'target.txt'));emit({kind:'effect',mode,...self,attemptId,publicationId:intent.publicationId,intent,intentCount:db.prepare('SELECT COUNT(*) n FROM change_publication_intent WHERE publication_id=?').get(intent.publicationId).n,resultCount:db.prepare('SELECT COUNT(*) n FROM change_publication_result WHERE publication_id=?').get(intent.publicationId).n,outcome,fileSha256:sha(file),fileBytes:file.toString('utf8'),counts:{launches,opens,reads,writes}});Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,120_000);return outcome}},
   authority:{authorizePlan:()=>true,authorizeClaim:()=>true,authorizeStage:()=>true,verifyReceipt:(context,receipt)=>{const identity=db.prepare('SELECT identity_id FROM orchestration_attempt_identity WHERE attempt_id=?').get(context.attemptId);return{outcomeVerified:true,cleanupVerified:true,handoff:{handoffId:`handoff-${receipt.attemptId}`,identityId:identity.identity_id,artifacts:[{kind:'fixture',sourceRef:'fixture-artifact'}]}}},authorizeHandoffArtifact:ref=>ref==='fixture-artifact',resolveHandoffArtifact:ref=>ref==='fixture-artifact'?Buffer.from('artifact'):null},
   runtime:{evidence:{now:()=>time,maxAgeMs:100,resolveEvidence:ref=>evidence.get(ref.id)},authorizeRun:()=>true,resolveCandidate:(_id,currentAttempt,_role,binding)=>({kind:'agent',supportedRoles:['implementation','model'],cancellation:'supported',usage:'unsupported',availability:'ready',typedActivitySource:'host-codex-controller-v1',durableExecutionRef:'session-handle-v1',stagedPublication:'attempt-owned-existing-files-v1',buildCurrentSubject:()=>subject,evidenceReferences:()=>refs,launch:async context=>{launches++;attemptId=currentAttempt;if(!context.stagedPublication||binding.owner.cwd===worktree)throw Error('public_driver_restart_staging_missing');writeFileSync(join(binding.owner.cwd,'target.txt'),replacement);const handle=`session-${sha(context.runId).slice(0,20)}`;db.prepare('INSERT INTO session_handle VALUES(?,?,?,?,?,?)').run(handle,self.pid,self.createdAt,binding.owner.cwd,binding.owner.task_id,binding.owner.run_id);return{durableRef:`session:${handle}`,completion:Promise.resolve('succeeded'),cancel:async()=>{}}}}),verifyCleanup:async context=>({runId:context.runId,subjectDigest:context.subjectDigest,result:'verified-clean',evidenceRef:'fixture-clean'})},
   engine:{observeInitialSelection:()=>null,observeCandidates:()=>[{id:'agent',checks:{eligible:true,authenticated:true,compatible:true,dataAllowed:true,resourceAvailable:true,quotaAvailable:true},estimate:{scope:'verified-completion-total',quality:1,expectedCost:1,conservativeMaxCost:1,expectedTimeMs:1,conservativeMaxTimeMs:1,currency:'TEST',source:'fixture',observedAtMs:time}}],reservation:context=>({runId:context.request.runId,attemptId:context.request.attemptId,requestId:context.request.requestId,currency:'TEST',unit:'micro',upperUnits:1,source:'fixture',observedAtMs:time,scope:'verified-completion-attempt-total'}),verifyBudgetMapping:()=>true,authorizeExecution:()=>true,receipts:context=>({billing:null,execution:{runId:context.request.runId,taskId:context.request.taskId,attemptId:context.request.attemptId,receiptId:`receipt-${context.request.attemptId}`,revision:1,outcome:'succeeded',cleanup:'clean',evidenceRef:'fixture-clean',observedAtMs:time}})},stage:context=>({worktreeRealpath:join(databasePath,'..','execution-staging',sha(context.request.attemptId),'worktree'),allowedActions:['file_change'],egress:[],expiresAt:envelope.expires_at,autonomyLevel:'bounded'})};
  const driver=createOrchestrationDriver({db,host});driver.prepare(run);db.prepare("INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,approval_id,request_ordinal,decision,created_at) VALUES('workflow',?,'desktop','goal','approval',0,'accept','now')").run(run.envelopeHash);driver.activate(run);await driver.start(run);
 }else{
  const counts={launches:0,authorizeCalls:0,opens:0,reads:0,executeCalls:0},driver=createOrchestrationDriver({db,host:createRestartHost(counts)});let replayRefusal='',snapshotRefusal='';try{await driver.start('workflow')}catch(error){replayRefusal=error?.message??String(error)}try{driver.snapshot('workflow')}catch(error){snapshotRefusal=error?.message??String(error)}
  const attempt=db.prepare("SELECT attempt_id,run_id,task_id,state,cleanup_verified FROM orchestration_attempt ORDER BY rowid LIMIT 1").get(),heldRow=db.prepare('SELECT case_id,attempt_id,change_set_id,state,revision,reason,final_seal,payload_sha256,payload FROM held_recovery WHERE attempt_id=?').get(attempt.attempt_id),file=readFileSync(join(worktree,'target.txt'));
  emit({kind:'restart',mode,...self,replayRefusal,snapshotRefusal,ledgerTask:db.prepare("SELECT state,blocked_reason FROM task WHERE id='root-task'").get(),attempt,heldRow:{...heldRow,payload:Buffer.from(heldRow.payload).toString('utf8')},heldTransitionCount:db.prepare('SELECT COUNT(*) n FROM held_recovery_transition WHERE case_id=?').get(heldRow.case_id).n,gitStatusArtifacts:db.prepare("SELECT content FROM artifact WHERE run_id='workflow' AND kind='git_status' ORDER BY id").all(),leaseCount:db.prepare("SELECT COUNT(*) n FROM workspace_write_lease WHERE run_id='workflow'").get().n,receiptCount:db.prepare('SELECT COUNT(*) n FROM orchestration_receipt').get().n,acceptanceCount:db.prepare("SELECT COUNT(*) n FROM acceptance_final WHERE run_id='workflow'").get().n,attemptCount:db.prepare("SELECT COUNT(*) n FROM orchestration_attempt WHERE run_id='workflow'").get().n,replacementAttemptCount:db.prepare("SELECT COUNT(*) n FROM orchestration_attempt WHERE run_id='workflow' AND attempt_id<>?").get(attempt.attempt_id).n,resultCount:db.prepare('SELECT COUNT(*) n FROM change_publication_result').get().n,recoveryCount:db.prepare("SELECT COUNT(*) n FROM recovery_attempt WHERE run_id='workflow' AND outcome='blocked_no_auto_resume'").get().n,...counts,fileSha256:sha(file),fileBytes:file.toString('utf8')});
  releaseOwnership();releaseOwnership=undefined;db.close();
 }
}catch(error){try{releaseOwnership?.()}catch{}try{db.close()}catch{}process.stderr.write(`${error?.stack??error}\n`);process.exitCode=1;}
}
