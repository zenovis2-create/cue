import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openLedger, type Ledger } from '../src/ledger.js';
import { createHandoffActivityStore } from '../src/orchestration/handoff-activity.js';
import { readOrchestrationSnapshot } from '../src/ui/orchestration.js';
import { readRunReport } from '../src/reports/ir.js';

const roots:string[]=[];const handles:Ledger[]=[];
afterEach(()=>{for(const db of handles.splice(0))if(db.open)db.close();for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});
const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
function seed(db:Ledger){
  const parent=hash('parent'),stage=hash('stage'),plan=hash('plan'),policy=hash('policy'),selection=hash('selection'),subject=hash('subject');
  db.prepare("INSERT INTO task VALUES('root','running',NULL,'now')").run();db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(parent,'C:\\work','[]','now');
  db.prepare("INSERT INTO run VALUES('run','root',?,0,'now')").run(parent);db.prepare("INSERT INTO orchestration_plan VALUES('run',?,?,?)").run(parent,plan,JSON.stringify({revision:'plan',tasks:[{id:'stage',role:'implementation',dependencyIds:[]}]}));
  db.prepare("INSERT INTO orchestration_step VALUES('run','stage','running')").run();db.prepare("INSERT INTO orchestration_attempt VALUES('attempt','run','stage','candidate','running','{}','C:\\work',NULL,0)").run();
  db.prepare("INSERT INTO task VALUES('stage-task','running',NULL,'now')").run();db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(stage,'C:\\work','[]','now');db.prepare("INSERT INTO run VALUES('attempt','stage-task',?,0,'now')").run(stage);
  db.prepare("INSERT INTO session_handle VALUES('session-attempt',1,'now','C:\\work','stage-task','attempt')").run();
  db.prepare("INSERT INTO orchestration_stage_envelope VALUES('attempt','run','stage','stage-task','attempt',?,?,?,?,?,?,?,?)").run(parent,stage,plan,policy,'{}','{}','{}','{}');
  db.prepare("INSERT INTO attempt_selection VALUES('attempt','run','request','monetary',?,?)").run(selection,'{}');
  const bytes=Buffer.from('trusted bytes'),store=createHandoffActivityStore(db,{authorizeArtifact:r=>r==='artifact-ref',resolveArtifact:r=>r==='artifact-ref'?bytes:null});
  store.recordLaunchIntent({runId:'run',taskId:'stage',attemptId:'attempt',candidateId:'candidate',selectionDigest:selection,expectedSubjectDigest:subject,tool:{id:'tool',revision:'unknown'},model:null,parentEnvelopeHash:parent,stageEnvelopeHash:stage,planDigest:plan,policyDigest:policy});
  store.recordAttemptIdentity({identityId:'identity',attemptId:'attempt',subjectDigest:subject,durableRef:'session:session-attempt',observedAtMs:1});
  return {store,bytes};
}
describe('S3 current handoff integrity boundary',()=>{
  it('projects verified only through the active host reader across replay and reopen',()=>{
    const root=mkdtempSync(join(tmpdir(),'cue-positive-integrity-'));roots.push(root);const file=join(root,'ledger.db'),db=openLedger(file);handles.push(db);const {store}=seed(db);
    const receipt=JSON.stringify({attemptId:'attempt',receiptId:'receipt',revision:1,outcome:'succeeded',cleanup:'clean'}),handoff=store.prepareHandoff({handoffId:'handoff',attemptId:'attempt',receiptId:'receipt',receiptRevision:1,identityId:'identity',outcome:'succeeded',cleanup:'clean',artifacts:[{kind:'output',sourceRef:'artifact-ref'}]});
    db.transaction(()=>{db.prepare("INSERT INTO orchestration_receipt VALUES('receipt','attempt',1,?)").run(receipt);store.commitHandoff(handoff);store.commitTerminalState('attempt','completed');db.prepare("UPDATE orchestration_step SET state='completed' WHERE run_id='run' AND task_id='stage'").run();}).immediate();
    expect(store.validateTerminal('attempt','receipt',1,'succeeded',receipt)).toBe(true);expect(store.readTerminalIntegrity('attempt').status).toBe('verified');
    expect(readOrchestrationSnapshot(db,'run',store.readTerminalIntegrity)?.stages[0]).toMatchObject({state:'completed',attemptState:'completed',handoffStatus:'verified',cleanup:'verified-clean'});
    expect(readOrchestrationSnapshot(db,'run')?.stages[0]).toMatchObject({state:'blocked',attemptState:'completed',handoffStatus:'integrity-unavailable',cleanup:'unknown'});
    expect(readRunReport(db,'run',store.readTerminalIntegrity)?.nodes[0]?.state).toBe('completed');expect(readRunReport(db,'run')?.nodes[0]?.state).toBe('blocked');
    db.close();handles.splice(handles.indexOf(db),1);const reopened=openLedger(file);handles.push(reopened);const resumed=createHandoffActivityStore(reopened,{authorizeArtifact:r=>r==='artifact-ref',resolveArtifact:r=>r==='artifact-ref'?Buffer.from('trusted bytes'):null});
    expect(resumed.readTerminalIntegrity('attempt').status).toBe('verified');expect(readOrchestrationSnapshot(reopened,'run',resumed.readTerminalIntegrity)?.stages[0]?.handoffStatus).toBe('verified');
  });
  it('a raw connection without registered integrity functions cannot write current authority',()=>{
    const root=mkdtempSync(join(tmpdir(),'cue-raw-integrity-'));roots.push(root);const file=join(root,'ledger.db'),trusted=openLedger(file);handles.push(trusted);const {store}=seed(trusted);
    const handoff=store.prepareHandoff({handoffId:'handoff',attemptId:'attempt',receiptId:'receipt',receiptRevision:1,identityId:'identity',outcome:'succeeded',cleanup:'clean',artifacts:[{kind:'output',sourceRef:'artifact-ref'}]});trusted.close();handles.splice(handles.indexOf(trusted),1);
    const raw=new Database(file) as Ledger;handles.push(raw);const intent=raw.prepare("SELECT * FROM orchestration_launch_intent WHERE attempt_id='attempt'").get() as any,identity=raw.prepare("SELECT * FROM orchestration_attempt_identity WHERE attempt_id='attempt'").get() as any;
    expect(()=>raw.prepare('INSERT INTO orchestration_launch_intent VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(...Object.values(intent))).toThrow(/no such function: cue_sha256/);
    expect(()=>raw.prepare('INSERT INTO orchestration_attempt_identity VALUES(?,?,?,?,?,?,?)').run(...Object.values(identity))).toThrow(/no such function: cue_sha256/);
    raw.prepare("INSERT INTO orchestration_receipt VALUES('receipt','attempt',1,?)").run(JSON.stringify({attemptId:'attempt',receiptId:'receipt',revision:1,outcome:'succeeded',cleanup:'clean'}));
    expect(()=>raw.prepare('INSERT INTO orchestration_handoff VALUES(?,?,?,?,?,?,?,?,?)').run(handoff.handoffId,handoff.attemptId,handoff.receiptId,handoff.receiptRevision,handoff.identityId,handoff.outcome,handoff.cleanup,handoff.payloadSha256,Buffer.from(handoff.encoded))).toThrow(/no such function: cue_sha256/);
    expect(()=>raw.prepare("UPDATE orchestration_attempt SET state='completed',cleanup_verified=1 WHERE attempt_id='attempt'").run()).toThrow(/no such function/);
    expect(raw.prepare("SELECT (SELECT COUNT(*) FROM orchestration_handoff) handoffs,(SELECT COUNT(*) FROM orchestration_handoff_artifact) artifacts,(SELECT COUNT(*) FROM orchestration_attempt WHERE state='completed') terminal").get()).toEqual({handoffs:0,artifacts:0,terminal:0});
  });
  it('rejects wrong hashes and hash-correct fake artifacts without terminal authority',()=>{
    const db=openLedger(':memory:');handles.push(db);const {store}=seed(db),receipt=JSON.stringify({attemptId:'attempt',receiptId:'receipt',revision:1,outcome:'succeeded',cleanup:'clean'});
    db.prepare("INSERT INTO orchestration_receipt VALUES('receipt','attempt',1,?)").run(receipt);
    const valid=store.prepareHandoff({handoffId:'handoff',attemptId:'attempt',receiptId:'receipt',receiptRevision:1,identityId:'identity',outcome:'succeeded',cleanup:'clean',artifacts:[{kind:'output',sourceRef:'artifact-ref'}]});
    expect(()=>db.prepare('INSERT INTO orchestration_handoff VALUES(?,?,?,?,?,?,?,?,?)').run(valid.handoffId,valid.attemptId,valid.receiptId,valid.receiptRevision,valid.identityId,valid.outcome,valid.cleanup,'4'.repeat(64),Buffer.from(valid.encoded))).toThrow('payload hash mismatch');
    expect(db.prepare("SELECT COUNT(*) n FROM orchestration_handoff").get()).toEqual({n:0});
    store.commitHandoff(valid);
    expect(()=>db.prepare("UPDATE orchestration_attempt SET state='completed',cleanup_verified=1 WHERE attempt_id='attempt'").run()).toThrow('terminal handoff integrity unavailable');
    expect(db.prepare("SELECT state,cleanup_verified FROM orchestration_attempt WHERE attempt_id='attempt'").get()).toEqual({state:'running',cleanup_verified:0});
    const denied=createHandoffActivityStore(db,{authorizeArtifact:()=>false,resolveArtifact:()=>null});expect(denied.readTerminalIntegrity('attempt').status).toBe('integrity-unavailable');
    const ui=readOrchestrationSnapshot(db,'run',denied.readTerminalIntegrity);expect(ui?.stages[0]).toMatchObject({state:'running',handoffStatus:'integrity-unavailable',cleanup:'unknown'});
  });

  it('fences a pre-033 forged terminal row without rewriting or deleting audit history',()=>{
    const root=mkdtempSync(join(tmpdir(),'cue-pre033-'));roots.push(root);const file=join(root,'ledger.db');
    const old=openLedger(file);handles.push(old);
    const added=old.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND (name LIKE 'handoff_integrity_%' OR name IN ('launch_intent_current_hash','attempt_identity_current_hash','handoff_current_hash','handoff_current_attempt','attempt_terminal_current_integrity'))").all() as {name:string}[];
    for(const {name} of added)old.exec(`DROP TRIGGER "${name}"`);
    old.exec('DROP TABLE orchestration_handoff_integrity_legacy; DROP TABLE orchestration_handoff_integrity_migration;');
    const {store}=seed(old),receipt=JSON.stringify({attemptId:'attempt',receiptId:'receipt',revision:1,outcome:'succeeded',cleanup:'clean'});
    old.prepare("INSERT INTO orchestration_receipt VALUES('receipt','attempt',1,?)").run(receipt);
    const prepared=store.prepareHandoff({handoffId:'handoff',attemptId:'attempt',receiptId:'receipt',receiptRevision:1,identityId:'identity',outcome:'succeeded',cleanup:'clean',artifacts:[{kind:'output',sourceRef:'artifact-ref'}]});
    old.prepare('INSERT INTO orchestration_handoff VALUES(?,?,?,?,?,?,?,?,?)').run(prepared.handoffId,prepared.attemptId,prepared.receiptId,prepared.receiptRevision,prepared.identityId,prepared.outcome,prepared.cleanup,'4'.repeat(64),Buffer.from(prepared.encoded));
    const artifact=prepared.artifacts[0]!;old.prepare('INSERT INTO orchestration_handoff_artifact VALUES(?,?,?,?,?,?,?)').run(prepared.handoffId,0,'attempt',artifact.kind,artifact.sourceRef,artifact.sha256,artifact.byteLength);
    old.prepare("UPDATE orchestration_attempt SET state='completed',cleanup_verified=1 WHERE attempt_id='attempt'").run();old.prepare("UPDATE orchestration_step SET state='completed' WHERE run_id='run' AND task_id='stage'").run();
    const before={attempts:old.prepare('SELECT COUNT(*) n FROM orchestration_attempt').get(),handoffs:old.prepare('SELECT COUNT(*) n FROM orchestration_handoff').get(),artifacts:old.prepare('SELECT COUNT(*) n FROM orchestration_handoff_artifact').get()};
    old.close();handles.splice(handles.indexOf(old),1);
    for(let pass=0;pass<2;pass++){const current=openLedger(file);handles.push(current);const currentStore=createHandoffActivityStore(current,{authorizeArtifact:()=>true,resolveArtifact:()=>Buffer.from('trusted bytes')});
      expect(current.prepare("SELECT reason FROM orchestration_handoff_integrity_legacy WHERE attempt_id='attempt'").all()).toEqual([{reason:'pre-current-handoff-integrity-unavailable'}]);
      expect(currentStore.readTerminalIntegrity('attempt').status).toBe('legacy-handoff-unavailable');
      expect(readOrchestrationSnapshot(current,'run',currentStore.readTerminalIntegrity)?.stages[0]).toMatchObject({state:'blocked',attemptState:'completed',handoffStatus:'legacy-handoff-unavailable',cleanup:'unknown'});
      expect({attempts:current.prepare('SELECT COUNT(*) n FROM orchestration_attempt').get(),handoffs:current.prepare('SELECT COUNT(*) n FROM orchestration_handoff').get(),artifacts:current.prepare('SELECT COUNT(*) n FROM orchestration_handoff_artifact').get()}).toEqual(before);
      expect(current.pragma('integrity_check')).toEqual([{integrity_check:'ok'}]);expect(current.pragma('foreign_key_check')).toEqual([]);current.close();handles.splice(handles.indexOf(current),1);}
  });
});
import Database from 'better-sqlite3';
