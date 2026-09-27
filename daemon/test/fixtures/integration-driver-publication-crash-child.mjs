import { createHash } from 'node:crypto';
import { readFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { openLedger } from '../../dist/src/ledger.js';
import { captureChangeSet, registerNativeChangeJournal } from '../../dist/src/change-records.js';
import { createHandoffActivityStore } from '../../dist/src/orchestration/handoff-activity.js';
import { createFinalPublicationStore } from '../../dist/src/final-publication.js';
import { compareWriteExistingNative } from '../../dist/src/change-snapshot-host.js';
import { observeProcessTree } from '../../dist/src/process-termination.js';
import { holdInterruptedJournalRecoveries, reconcileInterruptedWrites } from '../../dist/src/recovery.js';

const [mode,databasePath,worktree]=process.argv.slice(2);
if(!['crash-window','reopen'].includes(mode)||!databasePath||!worktree)throw Error('publication_restart_fixture_arguments');
const replacement=Buffer.from('published-after-crash-window'),publicationId='publication-real-restart',changeSetId='publication-real-restart-set',relativePath='final.txt';
const sha=value=>createHash('sha256').update(value).digest('hex');
const emit=value=>writeSync(1,`${JSON.stringify(value)}\n`,undefined,'utf8');
const identity=()=>{const row=observeProcessTree(process.pid).descendants.find(value=>value.pid===process.pid);if(!row)throw Error('publication_restart_identity_missing');return{pid:row.pid,createdAt:row.createdAt}};
const self=identity();emit({kind:'identity',mode,pid:self.pid,createdAt:self.createdAt});
const input=createInterface({input:process.stdin});let timer;const [command]=await Promise.race([once(input,'line'),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('publication_restart_handshake_timeout')),10_000)})]).finally(()=>clearTimeout(timer));input.close();if(command!=='continue')throw Error('publication_restart_handshake_invalid');
const db=openLedger(databasePath);

function seed(){
 const parent=sha('publication-parent'),stage=sha('publication-stage'),plan=sha('publication-plan'),policy=sha('publication-policy'),selection=sha('publication-selection'),subject=sha('publication-subject');
 db.prepare("INSERT INTO task VALUES('publication-root','running',NULL,'now')").run();
 db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(parent,worktree,'[]','now');
 db.prepare("INSERT INTO run VALUES('publication-run','publication-root',?,0,'now')").run(parent);
 db.prepare("INSERT INTO orchestration_plan VALUES('publication-run',?,?,?)").run(parent,plan,JSON.stringify({revision:'publication-plan',tasks:[{id:'publication-stage',role:'implementation',dependencyIds:[]}]}));
 db.prepare("INSERT INTO orchestration_step VALUES('publication-run','publication-stage','running')").run();
 registerNativeChangeJournal(db,{runId:'publication-run',worktreeRealpath:worktree,targets:[{taskId:'publication-stage',targetId:'publication-target',relativePath,maxBackupBytes:1024}],observedAtMs:0});
 db.prepare("INSERT INTO workspace_write_lease VALUES(?,'publication-run','publication-lease')").run(worktree);
 db.prepare("INSERT INTO orchestration_attempt VALUES('publication-attempt','publication-run','publication-stage','synthetic-publication-candidate','running','{}',?,'publication-lease',0)").run(worktree);
 db.prepare("INSERT INTO task VALUES('publication-stage-task','running',NULL,'now')").run();
 db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(stage,worktree,'[]','now');
 db.prepare("INSERT INTO run VALUES('publication-attempt','publication-stage-task',?,0,'now')").run(stage);
 db.prepare("INSERT INTO orchestration_stage_envelope VALUES('publication-attempt','publication-run','publication-stage','publication-stage-task','publication-attempt',?,?,?,?,?,?,?,?)").run(parent,stage,plan,policy,'{}','{}','{}','{}');
 db.prepare("INSERT INTO attempt_selection VALUES('publication-attempt','publication-run','publication-request','monetary',?,?)").run(selection,'{}');
 createHandoffActivityStore(db,{authorizeArtifact:()=>false,resolveArtifact:()=>null}).recordLaunchIntent({runId:'publication-run',taskId:'publication-stage',attemptId:'publication-attempt',candidateId:'synthetic-publication-candidate',selectionDigest:selection,expectedSubjectDigest:subject,tool:{id:'synthetic-publication-tool',revision:'fixture-v1'},model:null,parentEnvelopeHash:parent,stageEnvelopeHash:stage,planDigest:plan,policyDigest:policy});
 captureChangeSet(db,{changeSetId,runId:'publication-run',taskId:'publication-stage',attemptId:'publication-attempt',stageEnvelopeHash:stage,launchIntentId:'publication-attempt',worktree,targets:[relativePath],limits:{maxTargets:1,maxBackupBytes:1024},nowMs:1});
}

try{
 if(mode==='crash-window'){
  seed();
  const store=createFinalPublicationStore(db,{authorize:()=>true,nowMs:10,execute:input=>{
   const outcome=compareWriteExistingNative(input);
   const file=readFileSync(join(worktree,relativePath));emit({kind:'effect',mode,pid:self.pid,createdAt:self.createdAt,publicationId,intentCount:db.prepare('SELECT COUNT(*) n FROM change_publication_intent WHERE publication_id=?').get(publicationId).n,resultCount:db.prepare('SELECT COUNT(*) n FROM change_publication_result WHERE publication_id=?').get(publicationId).n,outcome,fileSha256:sha(file),fileBytes:file.toString('utf8')});
   Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);return outcome;
  }});
  store.publish({publicationId,changeSetId,relativePath,replacement});
 }else{
  const held=holdInterruptedJournalRecoveries(db,worktree,20),reconciled=reconcileInterruptedWrites(db,worktree);let authorizeCalls=0,executeCalls=0;
  const store=createFinalPublicationStore(db,{authorize:()=>{authorizeCalls++;return true},execute:()=>{executeCalls++;throw Error('publication_restart_reexecute')}});
  const replay=store.publish({publicationId,changeSetId,relativePath,replacement}),root=db.prepare("SELECT state,blocked_reason FROM task WHERE id='publication-root'").get(),attempt=db.prepare("SELECT state,cleanup_verified FROM orchestration_attempt WHERE attempt_id='publication-attempt'").get();
  const heldRow=db.prepare("SELECT case_id,attempt_id,change_set_id,state,revision,reason,final_seal,payload_sha256,payload FROM held_recovery WHERE attempt_id='publication-attempt'").get(),file=readFileSync(join(worktree,relativePath));emit({kind:'reopen',mode,pid:self.pid,createdAt:self.createdAt,held,reconciled,replay,root,attempt,heldRow:{...heldRow,payload:Buffer.from(heldRow.payload).toString('utf8')},heldTransitionCount:db.prepare('SELECT COUNT(*) n FROM held_recovery_transition WHERE case_id=?').get(heldRow.case_id).n,recoveryDecisionCount:db.prepare("SELECT COUNT(*) n FROM orchestration_recovery_decision WHERE run_id='publication-run'").get().n,recoveryActivationCount:db.prepare("SELECT COUNT(*) n FROM orchestration_recovery_activation WHERE run_id='publication-run'").get().n,gitStatusArtifacts:db.prepare("SELECT content FROM artifact WHERE run_id='publication-run' AND kind='git_status' ORDER BY id").all(),leaseCount:db.prepare("SELECT COUNT(*) n FROM workspace_write_lease WHERE run_id='publication-run'").get().n,receiptCount:db.prepare("SELECT COUNT(*) n FROM orchestration_receipt WHERE attempt_id='publication-attempt'").get().n,acceptanceCount:db.prepare("SELECT COUNT(*) n FROM acceptance_final WHERE run_id='publication-run'").get().n,attemptCount:db.prepare("SELECT COUNT(*) n FROM orchestration_attempt WHERE run_id='publication-run'").get().n,replacementAttemptCount:db.prepare("SELECT COUNT(*) n FROM orchestration_attempt WHERE run_id='publication-run' AND attempt_id<>'publication-attempt'").get().n,resultCount:db.prepare('SELECT COUNT(*) n FROM change_publication_result WHERE publication_id=?').get(publicationId).n,recoveryCount:db.prepare("SELECT COUNT(*) n FROM recovery_attempt WHERE run_id='publication-run' AND outcome='blocked_no_auto_resume'").get().n,authorizeCalls,executeCalls,fileSha256:sha(file),fileBytes:file.toString('utf8')});
  db.close();
 }
}catch(error){try{db.close()}catch{}process.stderr.write(`${error?.stack??error}\n`);process.exitCode=1;}
