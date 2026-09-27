import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openLedger, type Ledger } from '../src/ledger.js';
import { createHandoffActivityStore } from '../src/orchestration/handoff-activity.js';

const roots:string[]=[]; const dbs:Ledger[]=[];
afterEach(()=>{for(const db of dbs.splice(0))if(db.open)db.close();for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});
const h=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
function fixture(file=':memory:') {
  const db=openLedger(file);dbs.push(db);const parent=h('parent'),stage=h('stage'),plan=h('plan'),policy=h('policy'),selection=h('selection'),subject=h('subject');
  db.prepare("INSERT INTO task VALUES('root','running',NULL,'now')").run();
  db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(parent,'C:\\work','[]','now');
  db.prepare("INSERT INTO run VALUES('run','root',?,0,'now')").run(parent);
  db.prepare("INSERT INTO orchestration_plan VALUES('run',?,?,?)").run(parent,plan,'{}');
  db.prepare("INSERT INTO orchestration_step VALUES('run','stage','running')").run();
  db.prepare("INSERT INTO orchestration_attempt VALUES('attempt','run','stage','candidate','running','{}','C:\\work',NULL,0)").run();
  db.prepare("INSERT INTO task VALUES('stage-task','running',NULL,'now')").run();
  db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(stage,'C:\\work','[]','now');
  db.prepare("INSERT INTO run VALUES('attempt','stage-task',?,0,'now')").run(stage);
  db.prepare("INSERT INTO session_handle VALUES('session-attempt',1,'now','C:\\work','stage-task','attempt')").run();
  db.prepare("INSERT INTO orchestration_stage_envelope VALUES('attempt','run','stage','stage-task','attempt',?,?,?,?,?,?,?,?)")
    .run(parent,stage,plan,policy,'{}','{}','{}','{}');
  db.prepare("INSERT INTO attempt_selection VALUES('attempt','run','request','monetary',?,?)").run(selection,'{}');
  const bytes=new Map([['artifact-ref',Buffer.from('verified bytes')]]);
  const store=createHandoffActivityStore(db,{authorizeArtifact:ref=>bytes.has(ref),resolveArtifact:ref=>bytes.get(ref)??null});
  const intent={runId:'run',taskId:'stage',attemptId:'attempt',candidateId:'candidate',selectionDigest:selection,expectedSubjectDigest:subject,
    tool:{id:'tool',revision:'unknown'},model:null,parentEnvelopeHash:parent,stageEnvelopeHash:stage,planDigest:plan,policyDigest:policy};
  return {db,store,intent,subject,bytes};
}

describe('S3 immutable handoff and typed activity facts',()=>{
  it('rejects accessors, proxies, custom prototypes, unknown fields and bounds',()=>{
    const f=fixture();
    expect(()=>f.store.recordLaunchIntent(new Proxy(f.intent,{}))).toThrow('invalid_launch_intent');
    expect(()=>f.store.recordLaunchIntent(Object.assign(Object.create(null),f.intent))).toThrow('invalid_launch_intent');
    const accessor={...f.intent};Object.defineProperty(accessor,'candidateId',{get(){throw Error('read');},enumerable:true});
    expect(()=>f.store.recordLaunchIntent(accessor as any)).toThrow('invalid_launch_intent_fields');
    expect(()=>f.store.recordLaunchIntent({...f.intent,extra:true} as any)).toThrow('invalid_launch_intent_fields');
    expect(()=>f.store.activity({runId:'run',taskId:'stage',attemptId:'attempt',eventId:'e1',ordinal:1,kind:'progress',observedAtMs:1,data:{summary:'x'.repeat(1025),progress:1}})).toThrow('invalid_activity_summary');
    const artifacts:any[]=[];Object.defineProperty(artifacts,'0',{get(){throw Error('read');},enumerable:true});Object.defineProperty(artifacts,'length',{value:1});
    expect(()=>f.store.prepareHandoff({handoffId:'h',attemptId:'attempt',receiptId:'r',receiptRevision:1,identityId:'i',outcome:'succeeded',cleanup:'clean',artifacts})).toThrow('invalid_handoff_artifacts');
  });
  it('binds exact intent/identity and rejects replay or event/order conflicts',()=>{
    const f=fixture(); const first=f.store.recordLaunchIntent(f.intent); expect(f.store.recordLaunchIntent(f.intent).payloadSha256).toBe(first.payloadSha256);
    expect(()=>f.store.recordLaunchIntent({...f.intent,tool:{id:'other',revision:'unknown'}})).toThrow('launch_intent_replay_mismatch');
    expect(()=>f.store.recordAttemptIdentity({identityId:'identity',attemptId:'attempt',subjectDigest:h('wrong'),durableRef:'session:session-attempt',observedAtMs:1})).toThrow('attempt_identity_subject_mismatch');
    expect(()=>f.store.recordAttemptIdentity({identityId:'identity',attemptId:'attempt',subjectDigest:f.subject,durableRef:'session:missing-session',observedAtMs:1})).toThrow('attempt identity durable lineage required');
    f.store.recordAttemptIdentity({identityId:'identity',attemptId:'attempt',subjectDigest:f.subject,durableRef:'session:session-attempt',observedAtMs:1});
    const event={runId:'run',taskId:'stage',attemptId:'attempt',eventId:'e1',ordinal:1,kind:'heartbeat' as const,observedAtMs:2,data:{status:'alive'}};
    f.store.activity(event);f.store.activity(event);
    expect(()=>f.store.activity({...event,data:{status:'changed'}})).toThrow('activity_replay_mismatch');
    expect(()=>f.store.activity({...event,eventId:'e2',ordinal:3})).toThrow('activity_out_of_order');
  });
  it('persists only allowlisted failure diagnostics and keeps legacy terminal facts valid',()=>{
    const root=mkdtempSync(join(tmpdir(),'cue-diagnostic-'));roots.push(root);const file=join(root,'ledger.db'),f=fixture(file);
    const base={runId:'run',taskId:'stage',attemptId:'attempt',eventId:'terminal',ordinal:1,kind:'terminal' as const,observedAtMs:2};
    f.store.activity({...base,data:{status:'failed',handoffRef:'unknown',diagnosticCode:'local-http-429'}});
    expect(()=>f.store.activity({...base,eventId:'secret',ordinal:2,data:{status:'failed',handoffRef:'unknown',diagnosticCode:'quota-secret-token'}} as any)).toThrow('invalid_activity_diagnostic');
    expect(()=>f.store.activity({...base,eventId:'success',ordinal:2,data:{status:'succeeded',handoffRef:'unknown',diagnosticCode:'unknown'}} as any)).toThrow('invalid_activity_diagnostic');
    f.db.close();dbs.splice(dbs.indexOf(f.db),1);const reopened=openLedger(file);dbs.push(reopened);
    const payload=JSON.parse((reopened.prepare("SELECT payload FROM orchestration_activity WHERE event_id='terminal'").get() as any).payload.toString());
    expect(payload.data).toEqual({diagnosticCode:'local-http-429',handoffRef:'unknown',status:'failed'});
    expect(JSON.stringify(payload)).not.toContain('secret-token');
    const store=createHandoffActivityStore(reopened,{authorizeArtifact:()=>false,resolveArtifact:()=>null});
    expect(()=>store.activity({...base,eventId:'legacy',ordinal:2,data:{status:'failed',handoffRef:'unknown'}})).not.toThrow();
  });
  it('rejects proxied terminal diagnostics before invoking proxy traps',()=>{
    const f=fixture();let traps=0;const data=new Proxy({status:'failed',handoffRef:'unknown',diagnosticCode:'unknown'},{getOwnPropertyDescriptor(){traps++;throw Error('evaluated');},ownKeys(){traps++;throw Error('evaluated');},getPrototypeOf(){traps++;throw Error('evaluated');}});
    expect(()=>f.store.activity({runId:'run',taskId:'stage',attemptId:'attempt',eventId:'terminal',ordinal:1,kind:'terminal',observedAtMs:2,data})).toThrow('invalid_activity_data');
    expect(traps).toBe(0);
  });
  it('recomputes artifacts and rejects missing, duplicate, or mismatched resolvers',()=>{
    const f=fixture();f.store.recordLaunchIntent(f.intent);f.store.recordAttemptIdentity({identityId:'identity',attemptId:'attempt',subjectDigest:f.subject,durableRef:'session:session-attempt',observedAtMs:1});
    const value=f.store.prepareHandoff({handoffId:'handoff',attemptId:'attempt',receiptId:'receipt',receiptRevision:1,identityId:'identity',outcome:'succeeded',cleanup:'clean',artifacts:[{kind:'output',sourceRef:'artifact-ref'}]});
    expect(value.artifacts[0]).toMatchObject({sha256:h('verified bytes'),byteLength:14});
    expect(()=>f.store.prepareHandoff({handoffId:'h2',attemptId:'attempt',receiptId:'r2',receiptRevision:1,identityId:'identity',outcome:'succeeded',cleanup:'clean',artifacts:[{kind:'a',sourceRef:'missing'}]})).toThrow('artifact_source_denied');
    expect(()=>f.store.prepareHandoff({handoffId:'h2',attemptId:'attempt',receiptId:'r2',receiptRevision:1,identityId:'identity',outcome:'succeeded',cleanup:'clean',artifacts:[{kind:'a',sourceRef:'artifact-ref'},{kind:'a',sourceRef:'artifact-ref'}]})).toThrow('duplicate_artifact_target');
  });
  it('atomically seals terminal receipt plus handoff and database guards deny mutation',()=>{
    const f=fixture();f.store.recordLaunchIntent(f.intent);f.store.recordAttemptIdentity({identityId:'identity',attemptId:'attempt',subjectDigest:f.subject,durableRef:'session:session-attempt',observedAtMs:1});
    const handoff=f.store.prepareHandoff({handoffId:'handoff',attemptId:'attempt',receiptId:'receipt',receiptRevision:1,identityId:'identity',outcome:'succeeded',cleanup:'clean',artifacts:[{kind:'output',sourceRef:'artifact-ref'}]});
    const observer=createHandoffActivityStore(f.db,{authorizeArtifact:()=>false,resolveArtifact:()=>null});
    expect(observer.readTerminalIntegrity('attempt').status).toBe('integrity-unavailable');
    expect(()=>f.db.transaction(()=>observer.commitTerminalState('attempt','completed')).immediate()).toThrow('terminal_handoff_missing');
    expect(()=>f.db.prepare("UPDATE orchestration_attempt SET state='completed' WHERE attempt_id='attempt'").run()).toThrow('terminal handoff integrity unavailable');
    const receipt=JSON.stringify({attemptId:'attempt',receiptId:'receipt',revision:1,outcome:'succeeded',cleanup:'clean'});
    f.db.prepare("INSERT INTO orchestration_receipt VALUES('receipt','attempt',1,?)").run(receipt);
    expect(()=>f.db.prepare("INSERT INTO orchestration_handoff VALUES('forged','attempt','receipt',1,'identity','succeeded','clean',?,?)").run('4'.repeat(64),Buffer.from('{}'))).toThrow('handoff payload hash mismatch');
    expect(()=>f.db.prepare("UPDATE orchestration_attempt SET state='completed' WHERE attempt_id='attempt'").run()).toThrow('terminal handoff integrity unavailable');
    f.store.commitHandoff(handoff);
    expect(()=>f.db.transaction(()=>observer.commitTerminalState('attempt','completed')).immediate()).toThrow('artifact_source_denied');
    f.db.exec("CREATE TRIGGER reject_terminal_test BEFORE UPDATE OF state ON orchestration_attempt WHEN NEW.state='completed' BEGIN SELECT RAISE(ABORT,'test terminal rejection'); END");
    expect(()=>f.db.transaction(()=>f.store.commitTerminalState('attempt','completed')).immediate()).toThrow('test terminal rejection');
    f.db.exec('DROP TRIGGER reject_terminal_test');
    expect(()=>f.db.prepare("UPDATE orchestration_attempt SET state='completed',cleanup_verified=1 WHERE attempt_id='attempt'").run()).toThrow('terminal handoff integrity unavailable');
    let nested='';const reentrant=createHandoffActivityStore(f.db,{authorizeArtifact:()=>{try{f.store.commitTerminalState('attempt','completed');}catch(error){nested=error instanceof Error?error.message:String(error);}return true;},resolveArtifact:()=>Buffer.from('verified bytes')});
    f.db.transaction(()=>reentrant.commitTerminalState('attempt','completed')).immediate();expect(nested).toBe('terminal_commit_nested');
    expect(f.store.validateTerminal('attempt','receipt',1,'succeeded',receipt)).toBe(true);
    f.bytes.set('artifact-ref',Buffer.from('changed after terminal'));
    expect(()=>f.store.validateTerminal('attempt','receipt',1,'succeeded',receipt)).toThrow('artifact_changed');
    for(const sql of ["UPDATE orchestration_handoff SET outcome='failed'","DELETE FROM orchestration_handoff","INSERT OR REPLACE INTO orchestration_handoff SELECT * FROM orchestration_handoff"])expect(()=>f.db.exec(sql)).toThrow(/immutable/);
    expect(()=>f.db.prepare("INSERT INTO orchestration_handoff_legacy VALUES('attempt','legacy-handoff-unavailable')").run()).toThrow('membership closed');
  });
  it('rejects reviewer cross-attempt receipt and identity substitution in API and SQLite',()=>{
    const f=fixture();f.store.recordLaunchIntent(f.intent);f.store.recordAttemptIdentity({identityId:'identity-a',attemptId:'attempt',subjectDigest:f.subject,durableRef:'session:session-attempt',observedAtMs:1});
    const stageB=h('stage-b'),selection=h('selection-b');
    f.db.prepare("INSERT INTO orchestration_step VALUES('run','other','running')").run();
    f.db.prepare("INSERT INTO orchestration_attempt VALUES('attempt-b','run','other','candidate','running','{}','C:\\work',NULL,0)").run();
    f.db.prepare("INSERT INTO task VALUES('stage-task-b','running',NULL,'now')").run();f.db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(stageB,'C:\\work','[]','now');
    f.db.prepare("INSERT INTO run VALUES('attempt-b','stage-task-b',?,0,'now')").run(stageB);
    f.db.prepare("INSERT INTO session_handle VALUES('session-attempt-b',2,'now','C:\\work','stage-task-b','attempt-b')").run();
    f.db.prepare("INSERT INTO orchestration_stage_envelope VALUES('attempt-b','run','other','stage-task-b','attempt-b',?,?,?,?,?,?,?,?)").run(f.intent.parentEnvelopeHash,stageB,f.intent.planDigest,f.intent.policyDigest,'{}','{}','{}','{}');
    f.db.prepare("INSERT INTO attempt_selection VALUES('attempt-b','run','request-b','monetary',?,?)").run(selection,'{}');
    const intentB={...f.intent,taskId:'other',attemptId:'attempt-b',selectionDigest:selection,stageEnvelopeHash:stageB};f.store.recordLaunchIntent(intentB);
    f.store.recordAttemptIdentity({identityId:'identity-b',attemptId:'attempt-b',subjectDigest:f.subject,durableRef:'session:session-attempt-b',observedAtMs:1});
    const receiptB=JSON.stringify({attemptId:'attempt-b',receiptId:'receipt-b',revision:1,outcome:'succeeded',cleanup:'clean'});
    f.db.prepare("INSERT INTO orchestration_receipt VALUES('receipt-b','attempt-b',1,?)").run(receiptB);
    const crossed=f.store.prepareHandoff({handoffId:'crossed',attemptId:'attempt',receiptId:'receipt-b',receiptRevision:1,identityId:'identity-b',outcome:'succeeded',cleanup:'clean',artifacts:[{kind:'output',sourceRef:'artifact-ref'}]});
    expect(()=>f.store.commitHandoff(crossed)).toThrow('handoff_lineage_mismatch');
    expect(()=>f.db.prepare("INSERT INTO orchestration_handoff VALUES('direct-cross','attempt','receipt-b',1,'identity-b','succeeded','clean',?,?)").run(h('x'),Buffer.from('{}'))).toThrow('handoff payload hash mismatch');
    expect(()=>f.db.prepare("UPDATE orchestration_attempt SET state='completed' WHERE attempt_id='attempt'").run()).toThrow('terminal handoff integrity unavailable');
    expect(f.db.prepare("SELECT state FROM orchestration_attempt WHERE attempt_id='attempt'").get()).toEqual({state:'running'});
  });
  it('survives close/reopen exactly and leaves preidentity crash intent fenced',()=>{
    const root=mkdtempSync(join(tmpdir(),'cue-handoff-'));roots.push(root);const file=join(root,'ledger.db');const f=fixture(file);const intent=f.store.recordLaunchIntent(f.intent);f.db.close();dbs.splice(dbs.indexOf(f.db),1);
    const reopened=openLedger(file);dbs.push(reopened);const store=createHandoffActivityStore(reopened,{authorizeArtifact:()=>false,resolveArtifact:()=>null});
    expect(store.readLaunchIntent('attempt')?.payloadSha256).toBe(intent.payloadSha256);
    expect(reopened.prepare("SELECT COUNT(*) n FROM orchestration_attempt_identity WHERE attempt_id='attempt'").get()).toEqual({n:0});
    expect(reopened.prepare("SELECT state FROM orchestration_attempt WHERE attempt_id='attempt'").get()).toEqual({state:'running'});
  });
  it('revalidates the durable session reference after reopen and rejects missing ownership',()=>{
    const root=mkdtempSync(join(tmpdir(),'cue-handoff-terminal-'));roots.push(root);const file=join(root,'ledger.db'),f=fixture(file);
    f.store.recordLaunchIntent(f.intent);f.store.recordAttemptIdentity({identityId:'identity',attemptId:'attempt',subjectDigest:f.subject,durableRef:'session:session-attempt',observedAtMs:1});
    const receipt=JSON.stringify({attemptId:'attempt',receiptId:'receipt',revision:1,outcome:'succeeded',cleanup:'clean'});
    const handoff=f.store.prepareHandoff({handoffId:'handoff',attemptId:'attempt',receiptId:'receipt',receiptRevision:1,identityId:'identity',outcome:'succeeded',cleanup:'clean',artifacts:[{kind:'output',sourceRef:'artifact-ref'}]});
    f.db.transaction(()=>{f.db.prepare("INSERT INTO orchestration_receipt VALUES('receipt','attempt',1,?)").run(receipt);f.store.commitHandoff(handoff);f.store.commitTerminalState('attempt','completed');}).immediate();
    f.db.close();dbs.splice(dbs.indexOf(f.db),1);const reopened=openLedger(file);dbs.push(reopened);
    const store=createHandoffActivityStore(reopened,{authorizeArtifact:ref=>ref==='artifact-ref',resolveArtifact:ref=>ref==='artifact-ref'?Buffer.from('verified bytes'):null});
    expect(store.validateTerminal('attempt','receipt',1,'succeeded',receipt)).toBe(true);
    reopened.prepare("DELETE FROM session_handle WHERE handle='session-attempt'").run();
    expect(()=>store.validateTerminal('attempt','receipt',1,'succeeded',receipt)).toThrow('terminal_durable_identity');
  });
});
