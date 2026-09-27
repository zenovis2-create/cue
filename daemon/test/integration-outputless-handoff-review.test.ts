import { afterEach, expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openLedger, type Ledger } from '../src/ledger.js';
import { createCleanupObservationStore } from '../src/cleanup-observation-store.js';
import { createHandoffActivityStore } from '../src/orchestration/handoff-activity.js';
import { createGeneratedJsonHandoffAuthority } from '../../app/generated-json-handoff-authority.mjs';

const dbs: Ledger[] = [], roots: string[] = [];
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
afterEach(() => { for (const db of dbs.splice(0)) if (db.open) db.close(); for (const root of roots.splice(0)) rmSync(root,{recursive:true,force:true}); });

function fixture(persisted=false) {
  const root=persisted?mkdtempSync(join(tmpdir(),'cue-outputless-review-')):null;if(root)roots.push(root);
  const file=root?join(root,'ledger.sqlite'):undefined, db = openLedger(file); dbs.push(db);
  const parent=sha('parent'), stage=sha('stage'), plan=sha('plan'), policy=sha('policy'), selection=sha('selection'), subject=sha('subject');
  db.prepare("INSERT INTO task VALUES('root','running',NULL,'now')").run();
  db.prepare("INSERT INTO envelope VALUES(?,'C:\\work','[]','now')").run(parent);
  db.prepare("INSERT INTO run VALUES('workflow','root',?,0,'now')").run(parent);
  db.prepare("INSERT INTO orchestration_plan VALUES('workflow',?,?,?)").run(parent,plan,JSON.stringify({revision:'plan',tasks:[{id:'produce-json',role:'implementation',dependencyIds:[]}]}));
  db.prepare("INSERT INTO orchestration_step VALUES('workflow','produce-json','running')").run();
  db.prepare("INSERT INTO orchestration_attempt VALUES('attempt','workflow','produce-json','candidate','running','{}','C:\\work',NULL,0)").run();
  db.prepare("INSERT INTO task VALUES('produce-task','running',NULL,'now')").run();
  db.prepare("INSERT INTO envelope VALUES(?,'C:\\work','[]','now')").run(stage);
  db.prepare("INSERT INTO run VALUES('attempt','produce-task',?,0,'now')").run(stage);
  db.prepare("INSERT INTO session_handle VALUES('session-attempt',1,'now','C:\\work','produce-task','attempt')").run();
  db.prepare("INSERT INTO orchestration_stage_envelope VALUES('attempt','workflow','produce-json','produce-task','attempt',?,?,?,?,?,?,?,?)").run(parent,stage,plan,policy,'{}','{}','{}','{}');
  db.prepare("INSERT INTO attempt_selection VALUES('attempt','workflow','request','monetary',?,?)").run(selection,'{}');
  const inert={authorizeArtifact:()=>false,resolveArtifact:()=>null}, activity=createHandoffActivityStore(db,inert);
  activity.recordLaunchIntent({runId:'workflow',taskId:'produce-json',attemptId:'attempt',candidateId:'candidate',selectionDigest:selection,expectedSubjectDigest:subject,tool:{id:'tool',revision:'unknown'},model:null,parentEnvelopeHash:parent,stageEnvelopeHash:stage,planDigest:plan,policyDigest:policy});
  activity.recordAttemptIdentity({identityId:'identity',attemptId:'attempt',subjectDigest:subject,durableRef:'session:session-attempt',observedAtMs:1});
  activity.activity({runId:'workflow',taskId:'produce-json',attemptId:'attempt',eventId:'terminal',ordinal:1,kind:'terminal',observedAtMs:2,data:{status:'failed',handoffRef:'unknown'}});
  const session={handle:'session-attempt',pid:1,start_time:'now',cwd:'C:\\work',task_id:'produce-task',run_id:'attempt'};
  const base={runId:'attempt',candidateId:'candidate',role:'model',subjectDigest:subject,measuredAt:'2026-09-13T00:00:00.000Z',result:'verified-clean',reason:'review-fixture',providerStopped:'unknown',billing:'unknown',session};
  const store=createCleanupObservationStore(db), ref=store.persist(base), sourceRef=ref.replace(/^cue-cleanup:/,'cleanup-observation:');
  return {db,file,store,base,ref,sourceRef,resolve:(refInput:string)=>createGeneratedJsonHandoffAuthority({db}).resolveHandoffArtifact(refInput,'attempt')};
}

test('cleanup fallback rejects unknown and cross candidate, subject, and session provenance',()=>{
  const f=fixture(); expect(f.resolve(f.sourceRef)).not.toBeNull();
  const variants:any[]=[{...f.base,result:'unknown',reason:'unknown-review-fixture'},{...f.base,candidateId:'foreign-candidate'},{...f.base,subjectDigest:'b'.repeat(64)}];
  f.db.prepare("INSERT INTO session_handle VALUES('foreign-session',2,'later','C:\\work','produce-task','attempt')").run();
  variants.push({...f.base,session:{...f.base.session,handle:'foreign-session',pid:2,start_time:'later'}});
  for(const value of variants){const ref=f.store.persist(value).replace(/^cue-cleanup:/,'cleanup-observation:');expect(f.resolve(ref)).toBeNull();}
});

test('cleanup fallback rejects payload tamper and a succeeded receipt while the attempt is still running',()=>{
  const tampered=fixture();tampered.db.exec('DROP TRIGGER cleanup_observation_no_update');
  tampered.db.prepare('UPDATE cleanup_observation SET payload=? WHERE sha256=?').run(Buffer.from('{}'),tampered.ref.slice('cue-cleanup:'.length));
  expect(tampered.resolve(tampered.sourceRef)).toBeNull();
  const success=fixture(),receipt={runId:'workflow',taskId:'produce-json',attemptId:'attempt',receiptId:'success-receipt',revision:1,outcome:'succeeded',cleanup:'clean',evidenceRef:success.ref,observedAtMs:3};
  success.db.prepare("INSERT INTO orchestration_receipt VALUES('success-receipt','attempt',1,?)").run(JSON.stringify(receipt));
  expect(success.db.prepare("SELECT state FROM orchestration_attempt WHERE attempt_id='attempt'").get()).toEqual({state:'running'});
  expect(success.resolve(success.sourceRef)).toBeNull();
});

test('failed cleanup-evidence handoff retains full terminal integrity after SQLite reopen',()=>{
  const f=fixture(true),authority=createGeneratedJsonHandoffAuthority({db:f.db}),handoffs=createHandoffActivityStore(f.db,{authorizeArtifact:authority.authorizeHandoffArtifact,resolveArtifact:authority.resolveHandoffArtifact});
  const receipt={runId:'workflow',taskId:'produce-json',attemptId:'attempt',receiptId:'failed-receipt',revision:1,outcome:'failed',cleanup:'clean',evidenceRef:f.ref,observedAtMs:3};
  const prepared=handoffs.prepareHandoff({handoffId:'failed-handoff',attemptId:'attempt',receiptId:'failed-receipt',receiptRevision:1,identityId:'identity',outcome:'failed',cleanup:'clean',artifacts:[{kind:'cleanup-evidence',sourceRef:f.sourceRef}]});
  f.db.transaction(()=>{f.db.prepare("INSERT INTO orchestration_receipt VALUES('failed-receipt','attempt',1,?)").run(JSON.stringify(receipt));handoffs.commitHandoff(prepared);handoffs.commitTerminalState('attempt','failed');}).immediate();
  expect(handoffs.readTerminalIntegrity('attempt').status).toBe('verified');
  f.db.close();dbs.splice(dbs.indexOf(f.db),1);const reopened=openLedger(f.file);dbs.push(reopened);const reopenedAuthority=createGeneratedJsonHandoffAuthority({db:reopened});
  expect(createHandoffActivityStore(reopened,{authorizeArtifact:reopenedAuthority.authorizeHandoffArtifact,resolveArtifact:reopenedAuthority.resolveHandoffArtifact}).readTerminalIntegrity('attempt').status).toBe('verified');
  expect(reopened.prepare("SELECT state,cleanup_verified FROM orchestration_attempt WHERE attempt_id='attempt'").get()).toEqual({state:'failed',cleanup_verified:1});
});
