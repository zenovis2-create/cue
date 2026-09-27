import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import { openLedger, type Ledger } from '../src/ledger.js';
import { createProviderLifecycleStore, type ProviderLifecycleEventInput } from '../src/orchestration/provider-lifecycle.js';
import { verifyProviderLifecycleEvidence, type ProviderLifecycleEvidenceRequest } from '../src/orchestration/provider-lifecycle-evidence.js';

const roots:string[]=[], dbs:Ledger[]=[];
afterEach(()=>{for(const db of dbs.splice(0))if(db.open)db.close();for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});
const h=(value:string)=>createHash('sha256').update(value).digest('hex');
function rawPayload(scope:{runId:string;taskId:string;attemptId:string;candidateId:string}, eventId:string, ordinal:number, kind:string, observedAtMs:number, data:Record<string,unknown>){
  return Buffer.from(JSON.stringify({attemptId:scope.attemptId,candidateId:scope.candidateId,data,eventId,kind,observedAtMs,ordinal,runId:scope.runId,schemaVersion:'cue-provider-lifecycle-event-v1',taskId:scope.taskId}));
}
function authoritySnapshot(db:Ledger){return {
  attempt:db.prepare("SELECT state,cleanup_verified FROM orchestration_attempt WHERE attempt_id='provider-attempt'").get(),
  budget:(db.prepare('SELECT COUNT(*) n FROM local_invocation_budget').get() as {n:number}).n,
  acceptance:(db.prepare('SELECT COUNT(*) n FROM acceptance_final').get() as {n:number}).n,
};}
function seed(db:Ledger){
  const envelope=h('provider-envelope'), plan=h('provider-plan');
  db.prepare("INSERT INTO task VALUES('provider-root','running',NULL,'now')").run();
  db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(envelope,'C:\\provider','[]','now');
  db.prepare("INSERT INTO run VALUES('provider-run','provider-root',?,0,'now')").run(envelope);
  db.prepare("INSERT INTO orchestration_plan VALUES('provider-run',?,?,?)").run(envelope,plan,'{}');
  db.prepare("INSERT INTO orchestration_step VALUES('provider-run','provider-task','running')").run();
  db.prepare("INSERT INTO orchestration_attempt VALUES('provider-attempt','provider-run','provider-task','provider-candidate','running','{}','C:\\provider',NULL,0)").run();
}
function addSecondAttempt(db:Ledger){
  db.prepare("INSERT INTO orchestration_step VALUES('provider-run','provider-task-b','running')").run();
  db.prepare("INSERT INTO orchestration_attempt VALUES('provider-attempt-b','provider-run','provider-task-b','provider-candidate-b','running','{}','C:\\provider',NULL,0)").run();
}
function fixture(file=':memory:'){
  const db=openLedger(file);dbs.push(db);seed(db);let clock=100;
  const store=createProviderLifecycleStore(db,{nowMs:()=>clock++});
  const scope={runId:'provider-run',taskId:'provider-task',attemptId:'provider-attempt',candidateId:'provider-candidate'};
  const event=(eventId:string,ordinal:number,kind:ProviderLifecycleEventInput['kind'],data:Record<string,unknown>)=>({...scope,eventId,ordinal,kind,data});
  return {db,store,scope,event};
}

describe('S1 provider execution lifecycle append-only store',()=>{
  it('keeps client cancel, provider terminal, local cleanup, death, and billing as separate unknown-preserving facts',()=>{
    const cancel=fixture();cancel.store.append(cancel.event('cancel',1,'cancel-requested',{reasonDigest:h('user-request')}));cancel.store.append(cancel.event('ack',2,'client-cancel-acknowledged',{status:'acknowledged'}));
    expect(cancel.store.project(cancel.scope)).toMatchObject({cancelRequest:'requested',clientAcknowledgement:'acknowledged',providerTerminal:'unknown',providerDeath:'unknown',localController:'unknown',localTree:'unknown',cleanup:'unknown',billing:'unknown',authority:{processKill:0,budgetRelease:0,acceptance:0}});

    const provider=fixture();provider.store.append(provider.event('terminal',1,'provider-terminal',{status:'cancelled',receiptDigest:h('provider-receipt')}));
    expect(provider.store.project(provider.scope)).toMatchObject({providerTerminal:'cancelled',providerDeath:'unknown',localController:'unknown',localTree:'unknown',cleanup:'unknown',billing:'unknown'});

    const local=fixture();local.store.append(local.event('clean',1,'cleanup-observed',{status:'clean',receiptDigest:h('local-cleanup')}));
    expect(local.store.project(local.scope)).toMatchObject({providerTerminal:'unknown',providerDeath:'unknown',cleanup:'clean',billing:'unknown'});
    expect(()=>local.store.append(local.event('billing',2,'billing-finalized',{status:'final',providerReceiptDigest:h('missing-provider-receipt')}))).toThrow('provider lifecycle exact event required');
    expect(local.db.prepare('SELECT COUNT(*) n FROM provider_lifecycle_event').get()).toEqual({n:1});
  });

  it('accepts billing finality only after matching provider receipt evidence',()=>{
    const f=fixture(), receipt=h('provider-final-receipt');
    f.store.append(f.event('terminal',1,'provider-terminal',{status:'succeeded',receiptDigest:receipt}));
    expect(()=>f.store.append(f.event('wrong-billing',2,'billing-finalized',{status:'final',providerReceiptDigest:h('wrong')}))).toThrow('provider lifecycle exact event required');
    f.store.append(f.event('billing',2,'billing-finalized',{status:'final',providerReceiptDigest:receipt}));
    expect(f.store.project(f.scope)).toMatchObject({providerTerminal:'succeeded',billing:'final',providerDeath:'unknown'});
  });

  it('permits exact replay and rejects ordinal gaps, conflicts, duplicate terminal facts, and late sealed writes',()=>{
    const f=fixture(), first=f.event('first',1,'local-controller-observed',{status:'running',observationDigest:h('controller')});
    const recorded=f.store.append(first);expect(f.store.append(first).payloadSha256).toBe(recorded.payloadSha256);
    expect(()=>f.store.append({...first,data:{status:'stopped',observationDigest:h('controller')}})).toThrow('provider_lifecycle_replay_mismatch');
    expect(()=>f.store.append(f.event('gap',3,'local-tree-observed',{status:'alive',observationDigest:h('tree')}))).toThrow('provider lifecycle exact event required');
    expect(()=>f.store.append(f.event('ordinal-conflict',1,'local-tree-observed',{status:'alive',observationDigest:h('tree')}))).toThrow(/provider lifecycle (?:event immutable|exact event required)/);
    f.store.append(f.event('terminal',2,'provider-terminal',{status:'failed',receiptDigest:h('receipt')}));
    expect(()=>f.store.append(f.event('terminal-again',3,'provider-terminal',{status:'cancelled',receiptDigest:h('receipt-2')}))).toThrow('provider lifecycle exact event required');
    f.store.append(f.event('seal',3,'lifecycle-sealed',{}));
    expect(()=>f.store.append(f.event('late',4,'cleanup-observed',{status:'clean',receiptDigest:h('cleanup')}))).toThrow('provider lifecycle exact event required');
    expect(()=>f.store.bindReference({...f.scope,bindingId:'late-binding',eventId:'first',refType:'subtask',label:'late',reference:'opaque-after-seal'})).toThrow('provider reference exact lineage required');
    expect(f.store.project(f.scope).sealed).toBe(true);
  });

  it('binds only opaque digests and rejects the same provider reference across attempts despite changed type or label',()=>{
    const f=fixture();addSecondAttempt(f.db);
    f.store.append(f.event('event-a',1,'local-controller-observed',{status:'running',observationDigest:h('a')}));
    const scopeB={runId:'provider-run',taskId:'provider-task-b',attemptId:'provider-attempt-b',candidateId:'provider-candidate-b'};
    f.store.append({...scopeB,eventId:'event-b',ordinal:1,kind:'local-controller-observed',data:{status:'running',observationDigest:h('b')}});
    const binding=f.store.bindReference({...f.scope,bindingId:'binding-a',eventId:'event-a',refType:'subtask',label:'tool-call',reference:'provider/raw/subtask/secret'});
    expect(binding.referenceDigest).toBe(h('provider/raw/subtask/secret'));expect(JSON.stringify(binding)).not.toContain('provider/raw/subtask/secret');
    expect(()=>f.store.bindReference({...scopeB,bindingId:'binding-b',eventId:'event-b',refType:'thread',label:'renamed',reference:'provider/raw/subtask/secret'})).toThrow('provider_reference_replay_mismatch');
    expect(f.db.prepare('SELECT COUNT(*) n FROM provider_subtask_binding').get()).toEqual({n:1});
    expect(Buffer.from((f.db.prepare("SELECT payload FROM provider_subtask_binding WHERE binding_id='binding-a'").get() as {payload:Buffer}).payload).toString()).not.toContain('provider/raw/subtask/secret');
  });

  it('rejects proxies, accessors, custom prototypes, extra keys, invalid hashes, and oversized opaque input without writes',()=>{
    const f=fixture(), valid=f.event('event',1,'cancel-requested',{reasonDigest:h('reason')});
    expect(()=>f.store.append(new Proxy(valid,{}) as ProviderLifecycleEventInput)).toThrow('invalid_provider_lifecycle_event');
    expect(()=>f.store.append(Object.assign(Object.create(null),valid))).toThrow('invalid_provider_lifecycle_event');
    const accessor={...valid};Object.defineProperty(accessor,'eventId',{enumerable:true,get(){throw Error('getter-ran');}});
    expect(()=>f.store.append(accessor)).toThrow('invalid_provider_lifecycle_event_fields');
    expect(()=>f.store.append({...valid,extra:true} as ProviderLifecycleEventInput)).toThrow('invalid_provider_lifecycle_event_fields');
    expect(()=>f.store.append({...valid,data:{reasonDigest:h('reason'),extra:true}})).toThrow('invalid_lifecycle_data_fields');
    expect(()=>f.store.append({...valid,data:Object.assign(Object.create(null),{reasonDigest:h('reason')})})).toThrow('invalid_lifecycle_data');
    expect(()=>f.store.append({...valid,data:{reasonDigest:'F'.repeat(64)}})).toThrow('invalid_reason_digest');
    expect(()=>f.store.bindReference({...f.scope,bindingId:'binding',eventId:'missing',refType:'subtask',label:'call',reference:'x'.repeat(1025)})).toThrow('invalid_opaque_reference');
    expect(f.db.prepare('SELECT COUNT(*) n FROM provider_lifecycle_event').get()).toEqual({n:0});
  });

  it('rejects a structurally valid direct-SQL terminal with a caller-supplied fake hash at the database boundary',()=>{
    const f=fixture();
    const payload=rawPayload(f.scope,'forged-terminal',1,'provider-terminal',1,{receiptDigest:h('forged-receipt'),status:'cancelled'});
    expect(()=>f.db.prepare('INSERT INTO provider_lifecycle_event VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run('forged-terminal','provider-run','provider-task','provider-attempt','provider-candidate',1,'provider-terminal',1,'cancelled',null,h('forged-receipt'),'f'.repeat(64),payload)).toThrow('provider lifecycle exact event required');
    expect(f.store.project(f.scope).events).toEqual([]);
    expect(authoritySnapshot(f.db)).toEqual({attempt:{state:'running',cleanup_verified:0},budget:0,acceptance:0});
    expect(f.store.authority).toEqual({processKill:0,budgetRelease:0,acceptance:0});
  });

  it('revalidates a forged terminal predecessor before billing and writes zero dependent rows',()=>{
    const f=fixture(), receipt=h('forged-provider-receipt'), before=authoritySnapshot(f.db);f.db.exec('DROP TRIGGER provider_lifecycle_event_exact');
    f.db.prepare('INSERT INTO provider_lifecycle_event VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run('forged-terminal','provider-run','provider-task','provider-attempt','provider-candidate',1,'provider-terminal',1,'cancelled',null,receipt,'e'.repeat(64),rawPayload(f.scope,'forged-terminal',1,'provider-terminal',1,{receiptDigest:receipt,status:'cancelled'}));
    expect(()=>f.store.append(f.event('billing',2,'billing-finalized',{status:'final',providerReceiptDigest:receipt}))).toThrow('provider_lifecycle_payload_integrity');
    expect(f.db.prepare('SELECT event_id FROM provider_lifecycle_event ORDER BY ordinal').all()).toEqual([{event_id:'forged-terminal'}]);
    expect(authoritySnapshot(f.db)).toEqual(before);
  });

  it('revalidates forged cancel and parent events before acknowledgement, binding, or seal',()=>{
    const cancel=fixture(), beforeCancel=authoritySnapshot(cancel.db);cancel.db.exec('DROP TRIGGER provider_lifecycle_event_exact');
    cancel.db.prepare('INSERT INTO provider_lifecycle_event VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run('forged-cancel','provider-run','provider-task','provider-attempt','provider-candidate',1,'cancel-requested',1,null,h('reason'),null,'d'.repeat(64),rawPayload(cancel.scope,'forged-cancel',1,'cancel-requested',1,{reasonDigest:h('reason')}));
    expect(()=>cancel.store.append(cancel.event('ack',2,'client-cancel-acknowledged',{status:'acknowledged'}))).toThrow('provider_lifecycle_payload_integrity');
    expect(cancel.db.prepare('SELECT COUNT(*) n FROM provider_lifecycle_event').get()).toEqual({n:1});expect(authoritySnapshot(cancel.db)).toEqual(beforeCancel);

    const parent=fixture(), beforeParent=authoritySnapshot(parent.db);parent.db.exec('DROP TRIGGER provider_lifecycle_event_exact');
    parent.db.prepare('INSERT INTO provider_lifecycle_event VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run('forged-parent','provider-run','provider-task','provider-attempt','provider-candidate',1,'local-controller-observed',1,'running',h('observation'),null,'c'.repeat(64),rawPayload(parent.scope,'forged-parent',1,'local-controller-observed',1,{observationDigest:h('observation'),status:'running'}));
    expect(()=>parent.store.bindReference({...parent.scope,bindingId:'binding',eventId:'forged-parent',refType:'subtask',label:'call',reference:'opaque'})).toThrow('provider_lifecycle_payload_integrity');
    expect(()=>parent.store.append(parent.event('seal',2,'lifecycle-sealed',{}))).toThrow('provider_lifecycle_payload_integrity');
    expect(parent.db.prepare('SELECT COUNT(*) n FROM provider_subtask_binding').get()).toEqual({n:0});expect(parent.db.prepare('SELECT COUNT(*) n FROM provider_lifecycle_event').get()).toEqual({n:1});expect(authoritySnapshot(parent.db)).toEqual(beforeParent);
  });

  it('detects predecessor tamper after reopen even when the immutable update trigger was bypassed',()=>{
    const root=mkdtempSync(join(tmpdir(),'cue-provider-tamper-'));roots.push(root);const file=join(root,'ledger.db'),f=fixture(file),before=authoritySnapshot(f.db);
    f.store.append(f.event('cancel',1,'cancel-requested',{reasonDigest:h('original')}));f.db.close();dbs.splice(dbs.indexOf(f.db),1);
    const raw=new Database(file);raw.exec('DROP TRIGGER provider_lifecycle_event_no_update');raw.prepare("UPDATE provider_lifecycle_event SET payload=? WHERE event_id='cancel'").run(rawPayload(f.scope,'cancel',1,'cancel-requested',100,{reasonDigest:h('tampered')}));raw.close();
    const reopened=openLedger(file);dbs.push(reopened);const store=createProviderLifecycleStore(reopened,{nowMs:()=>500});
    expect(()=>store.append({...f.scope,eventId:'ack',ordinal:2,kind:'client-cancel-acknowledged',data:{status:'acknowledged'}})).toThrow('provider_lifecycle_payload_integrity');
    expect(reopened.prepare('SELECT COUNT(*) n FROM provider_lifecycle_event').get()).toEqual({n:1});expect(authoritySnapshot(reopened)).toEqual(before);
  });

  it('guards update, delete, replace, and mismatched or absent lineage without partial writes',()=>{
    const f=fixture();f.store.append(f.event('event',1,'local-tree-observed',{status:'dead',observationDigest:h('tree')}));
    expect(()=>f.db.exec("UPDATE provider_lifecycle_event SET status='alive'")).toThrow('provider lifecycle event immutable');
    expect(()=>f.db.exec('DELETE FROM provider_lifecycle_event')).toThrow('provider lifecycle event immutable');
    expect(()=>f.db.exec('INSERT OR REPLACE INTO provider_lifecycle_event SELECT * FROM provider_lifecycle_event')).toThrow(/provider lifecycle (?:event immutable|exact event required)/);
    const before=f.db.prepare('SELECT COUNT(*) n FROM provider_lifecycle_event').get();
    expect(()=>f.store.append({...f.event('wrong',2,'lifecycle-sealed',{}),runId:'wrong'})).toThrow('provider_lifecycle_lineage_mismatch');
    expect(()=>f.store.append({...f.event('absent',2,'lifecycle-sealed',{}),attemptId:'absent'})).toThrow('provider_lifecycle_lineage_mismatch');
    expect(f.db.prepare('SELECT COUNT(*) n FROM provider_lifecycle_event').get()).toEqual(before);
  });

  it('serializes two connections, rolls back failed outer transactions, and survives close/reopen with FK integrity',()=>{
    const root=mkdtempSync(join(tmpdir(),'cue-provider-lifecycle-'));roots.push(root);const file=join(root,'ledger.db'),f=fixture(file);
    const second=openLedger(file);dbs.push(second);const other=createProviderLifecycleStore(second,{nowMs:()=>500});
    const first=f.event('event',1,'cancel-requested',{reasonDigest:h('cancel')});f.store.append(first);expect(other.append(first).payloadSha256).toBe(f.store.project(f.scope).events[0].payloadSha256);
    expect(()=>other.append(f.event('conflict',1,'lifecycle-sealed',{}))).toThrow(/provider lifecycle (?:event immutable|exact event required)/);
    expect(()=>f.db.transaction(()=>{f.store.append(f.event('rolled-back',2,'lifecycle-sealed',{}));throw Error('rollback');})()).toThrow('rollback');
    expect(f.db.prepare("SELECT COUNT(*) n FROM provider_lifecycle_event WHERE event_id='rolled-back'").get()).toEqual({n:0});
    second.close();dbs.splice(dbs.indexOf(second),1);f.db.close();dbs.splice(dbs.indexOf(f.db),1);
    const reopened=openLedger(file);dbs.push(reopened);const store=createProviderLifecycleStore(reopened,{nowMs:()=>900});
    expect(store.project(f.scope)).toMatchObject({cancelRequest:'requested',providerTerminal:'unknown',billing:'unknown'});
    expect(reopened.pragma('integrity_check')).toEqual([{integrity_check:'ok'}]);expect(reopened.pragma('foreign_key_check')).toEqual([]);
  });

  it('migrates a pre-032 file as explicit legacy, replays migration, and keeps fresh attempts writable',()=>{
    const root=mkdtempSync(join(tmpdir(),'cue-provider-pre032-'));roots.push(root);const file=join(root,'ledger.db');
    const old=openLedger(file);seed(old);old.exec('DROP TABLE provider_subtask_binding; DROP TABLE provider_lifecycle_event; DROP TABLE provider_lifecycle_legacy; DROP TABLE provider_lifecycle_migration;');old.close();
    const migrated=openLedger(file);dbs.push(migrated);const store=createProviderLifecycleStore(migrated,{nowMs:()=>1});
    const legacy={runId:'provider-run',taskId:'provider-task',attemptId:'provider-attempt',candidateId:'provider-candidate'};
    expect(store.project(legacy)).toMatchObject({availability:'legacy-not-recorded',providerTerminal:'unknown',cleanup:'unknown',billing:'unknown'});
    expect(()=>store.append({...legacy,eventId:'legacy-write',ordinal:1,kind:'lifecycle-sealed',data:{}})).toThrow('provider lifecycle exact event required');
    addSecondAttempt(migrated);const current={runId:'provider-run',taskId:'provider-task-b',attemptId:'provider-attempt-b',candidateId:'provider-candidate-b'};
    store.append({...current,eventId:'current',ordinal:1,kind:'lifecycle-sealed',data:{}});migrated.close();dbs.splice(dbs.indexOf(migrated),1);
    const replayed=openLedger(file);dbs.push(replayed);expect(createProviderLifecycleStore(replayed,{nowMs:()=>2}).project(current).sealed).toBe(true);
    expect(replayed.pragma('integrity_check')).toEqual([{integrity_check:'ok'}]);expect(replayed.pragma('foreign_key_check')).toEqual([]);
    expect(readFileSync(resolve('migrations','032_provider_execution_lifecycle.sql')).byteLength).toBeGreaterThan(0);
  });
});

describe('S1 deployment-owned provider lifecycle evidence admission',()=>{
  const bytes=Buffer.from('provider terminal receipt');
  const request:ProviderLifecycleEvidenceRequest={runId:'provider-run',taskId:'provider-task',attemptId:'provider-attempt',candidateId:'provider-candidate',providerId:'provider-tool',providerRevision:'provider-v1',accountReference:'account/current',accountDigest:h('current-account'),subjectDigest:h('current-subject'),kind:'provider-terminal',status:'cancelled',receiptReference:'receipt/current',receiptDigest:h(bytes.toString())};
  const verdict=(overrides:Record<string,unknown>={})=>({authenticated:true,final:true,...request,evidenceBase64:bytes.toString('base64'),evidenceSha256:h(bytes.toString()),...overrides});

  it('copies a final verdict bound to immutable bytes and exact current lineage',async()=>{
    const source=verdict();
    const admitted=await verifyProviderLifecycleEvidence(request,async()=>source,50);
    source.status='failed';
    expect(admitted).toMatchObject({...request,evidenceSha256:request.receiptDigest});
    expect(Buffer.from(admitted.evidenceBytes).toString()).toBe(bytes.toString());
    const billing={...request,kind:'billing-finalized' as const,status:'final'};
    await expect(verifyProviderLifecycleEvidence(billing,async()=>verdict({kind:'billing-finalized',status:'final'}),50)).resolves.toMatchObject(billing);
  });

  it('rejects absent, non-final, mismatched, malformed, proxy, accessor, thrown, and timed-out verification',async()=>{
    await expect(verifyProviderLifecycleEvidence(request,undefined,50)).rejects.toThrow('lifecycle_evidence_verifier_unavailable');
    await expect(verifyProviderLifecycleEvidence(request,async()=>verdict({final:false}),50)).rejects.toThrow('lifecycle_evidence_not_final');
    for(const changed of [{accountReference:'other'},{accountDigest:h('other')},{attemptId:'other'},{candidateId:'other'},{subjectDigest:h('stale')},{receiptReference:'other'}])
      await expect(verifyProviderLifecycleEvidence(request,async()=>verdict(changed),50)).rejects.toThrow('lifecycle_evidence_lineage_mismatch');
    await expect(verifyProviderLifecycleEvidence(request,async()=>verdict({evidenceSha256:h('wrong')}),50)).rejects.toThrow('lifecycle_evidence_digest_mismatch');
    await expect(verifyProviderLifecycleEvidence(request,async()=>verdict({final:false}),50)).rejects.toThrow('lifecycle_evidence_not_final');
    await expect(verifyProviderLifecycleEvidence(request,async()=>new Proxy(verdict(),{}),50)).rejects.toThrow('lifecycle_evidence_verdict');
    const accessor=verdict();Object.defineProperty(accessor,'status',{enumerable:true,get(){throw Error('getter');}});
    await expect(verifyProviderLifecycleEvidence(request,async()=>accessor,50)).rejects.toThrow('lifecycle_evidence_verdict');
    await expect(verifyProviderLifecycleEvidence(request,async input=>{(input as {status:string}).status='failed';return verdict();},50)).rejects.toThrow('lifecycle_evidence_verification_failed');
    await expect(verifyProviderLifecycleEvidence(request,async()=>{throw Error('provider');},50)).rejects.toThrow('lifecycle_evidence_verification_failed');
    await expect(verifyProviderLifecycleEvidence(request,()=>new Promise(()=>{}),5)).rejects.toThrow('lifecycle_evidence_timeout');
  });
});
