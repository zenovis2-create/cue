import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openLedger, type Ledger } from '../src/ledger.js';
import { createProviderLifecycleStore } from '../src/orchestration/provider-lifecycle.js';
import { verifyProviderLifecycleEvidence, type ProviderLifecycleEvidenceRequest } from '../src/orchestration/provider-lifecycle-evidence.js';
import { createOrchestrationDriver } from '../../app/orchestration-driver.mjs';
import { normalizeEnvelope, envelopeHash } from '../src/envelope.js';
import { saveSelectionPolicy } from '../src/selection/policy-store.js';
import { createIntegrationCatalog } from '../src/integration-catalog.js';
import { SUBJECT_FIELDS, subjectDigest, type MeasurementSubject } from '../src/measurement-subject.js';
import { WRITE_PROBES, MODEL_PROBES } from '../src/capability-admission.js';

const dbs:Ledger[]=[];afterEach(()=>{for(const db of dbs.splice(0))db.close();});
const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
const receipt=Buffer.from('deployment-owned provider receipt');
const request:ProviderLifecycleEvidenceRequest={runId:'run',taskId:'task',attemptId:'attempt',candidateId:'candidate',providerId:'tool',providerRevision:'v1',accountReference:'account/ref',accountDigest:hash('account'),subjectDigest:hash('subject'),kind:'provider-terminal',status:'cancelled',receiptReference:'receipt/ref',receiptDigest:hash(receipt)};
const verdict=(overrides:Record<string,unknown>={})=>({authenticated:true,final:true,...request,evidenceBase64:receipt.toString('base64'),evidenceSha256:hash(receipt),...overrides});

function driverFixture(verify?:any){
  const root=mkdtempSync(join(tmpdir(),'cue-lifecycle-driver-'));const work=join(root,'work');mkdirSync(work);const db=openLedger();dbs.push(db);let currentSubject='';
  const now=Date.parse('2026-09-16T00:00:00Z'),subject=Object.fromEntries(SUBJECT_FIELDS.map(key=>[key,key.endsWith('Sha256')?'a'.repeat(64):key])) as MeasurementSubject;currentSubject=subjectDigest(subject);
  const evidence=new Map<string,Buffer>(),refs:any={};for(const probe of [...WRITE_PROBES,...MODEL_PROBES]){const bytes=Buffer.from(JSON.stringify({probe,subjectDigest:currentSubject,measuredAt:new Date(now-1).toISOString(),kind:'live',status:'pass'}));evidence.set(probe,bytes);refs[probe]={id:probe,sha256:hash(bytes)};}
  const catalog=createIntegrationCatalog({now:()=>now,maxAgeMs:100,currentSubjectDigest:()=>currentSubject},[{canonicalId:'agent',toolId:'fixture-tool',kind:'agent',aliases:[],installation:'installed',protocol:'verified',authReference:'fixture-account',authAvailable:true,sourceVersion:'fixture-v1',observedAt:new Date(now).toISOString(),subjectDigest:currentSubject,binding:null}]);
  const envelope=normalizeEnvelope({run_id:'workflow',worktree_realpath:work,allowed_actions:['read'],egress:[],expires_at:'2026-09-17T00:00:00Z',autonomy_level:'bounded'}),run={taskId:'root',runId:'workflow',envelopeHash:envelopeHash(envelope),envelope,goal:'lifecycle',scope:'test'};
  db.prepare("INSERT INTO task VALUES('root','awaiting_approval',NULL,'now')").run();db.prepare("INSERT INTO envelope VALUES(?,?,'[]','now')").run(run.envelopeHash,work);db.prepare("INSERT INTO run VALUES('workflow','root',?,0,'now')").run(run.envelopeHash);
  const policy=saveSelectionPolicy(db,{policyId:'policy',expectedRevision:null,createdAt:new Date(now).toISOString(),sourceVersion:'fixture',policy:{version:'cue-selection-v1',mode:'efficiency',qualityMinimum:.5,costBasis:1,timeBasisMs:1,currency:'TEST',costLimit:null,remainingTimeMs:null,maxEstimateAgeMs:100,allowedCandidateIds:['agent'],pinnedCandidateId:null}});
  let emit:(context:any)=>Promise<void>=async()=>{},emitted=false,emittedAttemptId='';const lifecycleErrors:unknown[]=[];
  const host:any={now:()=>now,catalog,...(verify?{lifecycleEvidence:{timeoutMs:100,verify}}:{}),prepare:()=>({policy:{policyId:'policy',revision:1,digest:policy.digest},requirementIds:['req'],proposedPlan:{revision:'p1',policyRevision:'policy:1',policyDigest:policy.digest,tasks:[{id:'make',role:'model-producer',ownerId:'maker',requirementIds:['req'],dependencyIds:[],candidateIds:['agent'],scopeIds:[]},{id:'check',role:'verifier',ownerId:'checker',requirementIds:['req'],dependencyIds:['make'],candidateIds:['agent'],scopeIds:[]}]},scopes:[],budget:{runId:'workflow',currency:'TEST',unit:'micro',limitUnits:100,policyRevision:'policy:1',source:'fixture',observedAtMs:now},limits:{launchTimeoutMs:100,taskTimeoutMs:200,pollMs:2}}),verifyFinalBilling:()=>false,
    authority:{authorizePlan:()=>true,authorizeClaim:()=>true,authorizeStage:()=>true,verifyReceipt:()=>({outcomeVerified:false,cleanupVerified:false})},runtime:{evidence:{now:()=>now,maxAgeMs:100,resolveEvidence:(ref:any)=>evidence.get(ref.id)},authorizeRun:()=>true,resolveCandidate:(_id:string,_attempt:string,_role:string,_binding:any)=>({kind:'agent',supportedRoles:['implementation','model'],cancellation:'supported',usage:'unsupported',availability:'ready',typedActivitySource:'host-codex-controller-v1',durableExecutionRef:'session-handle-v1',buildCurrentSubject:()=>subject,evidenceReferences:()=>refs,launch:async(context:any)=>{if(!emitted){emitted=true;emittedAttemptId=context.runId;try{await emit(context);}catch(error){lifecycleErrors.push(error);throw error;}}return{durableRef:`session:${context.runId}`,completion:Promise.resolve('succeeded'),cancel:async()=>{}};}}),verifyCleanup:async(context:any)=>({runId:context.runId,subjectDigest:context.subjectDigest,result:'unknown',evidenceRef:'none'})},engine:{observeCandidates:()=>[{id:'agent',checks:{eligible:true,authenticated:true,compatible:true,dataAllowed:true,resourceAvailable:true,quotaAvailable:true},estimate:{scope:'verified-completion-total',quality:1,expectedCost:1,conservativeMaxCost:1,expectedTimeMs:1,conservativeMaxTimeMs:1,currency:'TEST',source:'fixture',observedAtMs:now}}],reservation:(context:any)=>({runId:context.request.runId,attemptId:context.request.attemptId,requestId:context.request.requestId,currency:'TEST',unit:'micro',upperUnits:10,source:'fixture',observedAtMs:now,scope:'verified-completion-attempt-total'}),verifyBudgetMapping:()=>true,authorizeExecution:()=>true,receipts:()=>({execution:null,billing:null})},stage:()=>({worktreeRealpath:work,allowedActions:[],egress:[],expiresAt:envelope.expires_at,autonomyLevel:'bounded'})};
  const driver=createOrchestrationDriver({db,host}),start=async()=>{driver.prepare(run);db.prepare("INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,approval_id,request_ordinal,decision,created_at) VALUES('workflow',?,'desktop','goal','approval',0,'accept','now')").run(run.envelopeHash);driver.activate(run);await driver.start(run);};
  return{db,driver,host,start,lifecycleErrors,emittedAttemptId:()=>emittedAttemptId,setEmit:(value:typeof emit)=>{emit=value;},driftSubject:()=>{currentSubject=hash('drift');},dispose:()=>rmSync(root,{recursive:true,force:true})};
}

function fixture(){
  const db=openLedger();dbs.push(db);const envelope=hash('envelope'),plan=hash('plan');
  db.prepare("INSERT INTO task VALUES('root','running',NULL,'now')").run();db.prepare("INSERT INTO envelope VALUES(?,'C:\\work','[]','now')").run(envelope);
  db.prepare("INSERT INTO run VALUES('run','root',?,0,'now')").run(envelope);db.prepare("INSERT INTO orchestration_plan VALUES('run',?,?,?)").run(envelope,plan,'{}');
  db.prepare("INSERT INTO orchestration_step VALUES('run','task','running')").run();db.prepare("INSERT INTO orchestration_attempt VALUES('attempt','run','task','candidate','running','{}','C:\\work',NULL,0)").run();
  const store=createProviderLifecycleStore(db,{nowMs:()=>1});
  const append=async(verify:Parameters<typeof verifyProviderLifecycleEvidence>[1],input=request)=>{await verifyProviderLifecycleEvidence(input,verify,5);return store.append({runId:input.runId,taskId:input.taskId,attemptId:input.attemptId,candidateId:input.candidateId,eventId:`event-${input.kind}`,ordinal:(db.prepare('SELECT COUNT(*) n FROM provider_lifecycle_event').get() as {n:number}).n+1,kind:input.kind,data:input.kind==='provider-terminal'?{status:input.status,receiptDigest:input.receiptDigest}:{status:input.status,providerReceiptDigest:input.receiptDigest}});};
  return{db,store,append};
}

describe('driver provider lifecycle evidence boundary',()=>{
  it('keeps every failed verifier outcome at append count zero and cancel acknowledgement non-terminal',async()=>{
    const failures=[undefined,async()=>verdict({attemptId:'other'}),async()=>verdict({evidenceSha256:hash('wrong')}),async()=>verdict({final:false}),async()=>{throw Error('host');},()=>new Promise(()=>{})];
    for(const verify of failures){const f=fixture();await expect(f.append(verify)).rejects.toThrow();expect(f.db.prepare('SELECT COUNT(*) n FROM provider_lifecycle_event').get()).toEqual({n:0});}
    const f=fixture(),scope={runId:request.runId,taskId:request.taskId,attemptId:request.attemptId,candidateId:request.candidateId};f.store.append({...scope,eventId:'cancel',ordinal:1,kind:'cancel-requested',data:{reasonDigest:hash('cancel')}});f.store.append({...scope,eventId:'ack',ordinal:2,kind:'client-cancel-acknowledged',data:{status:'acknowledged'}});
    expect(f.store.project(scope)).toMatchObject({clientAcknowledgement:'acknowledged',providerTerminal:'unknown',billing:'unknown'});
  });

  it('admits exact terminal then matching billing, preserves replay, and rejects stale billing without a dependent row',async()=>{
    const f=fixture(),verify=async()=>verdict();const first=await f.append(verify);expect(f.store.append({runId:request.runId,taskId:request.taskId,attemptId:request.attemptId,candidateId:request.candidateId,eventId:'event-provider-terminal',ordinal:1,kind:'provider-terminal',data:{status:'cancelled',receiptDigest:request.receiptDigest}}).payloadSha256).toBe(first.payloadSha256);
    const billing={...request,kind:'billing-finalized' as const,status:'final'};
    await f.append(async()=>verdict({kind:'billing-finalized',status:'final'}),billing);
    expect(f.store.project({runId:request.runId,taskId:request.taskId,attemptId:request.attemptId,candidateId:request.candidateId})).toMatchObject({providerTerminal:'cancelled',billing:'final',authority:{processKill:0,budgetRelease:0,acceptance:0}});
    const stale=fixture(),wrong={...billing,receiptDigest:hash('other')};await expect(stale.append(async()=>verdict({kind:'billing-finalized',status:'final',receiptDigest:wrong.receiptDigest,evidenceSha256:wrong.receiptDigest}),wrong)).rejects.toThrow();
    expect(stale.db.prepare('SELECT COUNT(*) n FROM provider_lifecycle_event').get()).toEqual({n:0});
  });

  it('uses the public driver callback and appends zero for missing verification or subject drift during a delayed verdict',async()=>{
    const missing=driverFixture();missing.setEmit(context=>context.emitLifecycle({kind:'provider-terminal',data:{status:'cancelled',receiptDigest:hash(receipt)},references:[{refType:'turn',label:'provider-receipt',reference:'receipt/ref'}]}));await missing.start();expect(missing.db.prepare("SELECT COUNT(*) n FROM provider_lifecycle_event WHERE kind IN ('provider-terminal','billing-finalized')").get()).toEqual({n:0});missing.dispose();
    let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});const delayed=driverFixture(async(input:any)=>{await gate;return{authenticated:true,final:true,...input,evidenceBase64:receipt.toString('base64'),evidenceSha256:hash(receipt)};});
    delayed.setEmit(async context=>{const event:any={kind:'provider-terminal',data:{status:'cancelled',receiptDigest:hash(receipt)},references:[{refType:'turn',label:'provider-receipt',reference:'receipt/ref'}]};const pending=context.emitLifecycle(event);event.data.status='failed';event.references[0].reference='mutated';await pending;});const started=delayed.start();await new Promise(done=>setImmediate(done));delayed.driftSubject();release();await started;expect(delayed.db.prepare("SELECT COUNT(*) n FROM provider_lifecycle_event WHERE kind IN ('provider-terminal','billing-finalized')").get()).toEqual({n:0});delayed.dispose();
  });

  it('serializes the public terminal and billing callbacks and records only their authenticated snapshots',async()=>{
    const f=driverFixture(async(input:any)=>({authenticated:true,final:true,...input,evidenceBase64:receipt.toString('base64'),evidenceSha256:hash(receipt)}));
    f.setEmit(async context=>{const terminal:any={kind:'provider-terminal',data:{status:'cancelled',receiptDigest:hash(receipt)},references:[{refType:'turn',label:'provider-receipt',reference:'receipt/ref'}]};const first=context.emitLifecycle(terminal);terminal.data.status='failed';const second=context.emitLifecycle({kind:'billing-finalized',data:{status:'final',providerReceiptDigest:hash(receipt)},references:[{refType:'turn',label:'provider-receipt',reference:'receipt/ref-billing'}]});await Promise.all([first,second]);});
    await f.start();const attempt=f.emittedAttemptId();
    expect(f.lifecycleErrors).toEqual([]);expect(f.driver.lifecycle(attempt).events.map((event:any)=>event.kind).filter((kind:string)=>kind==='provider-terminal'||kind==='billing-finalized')).toEqual(['provider-terminal','billing-finalized']);expect(f.driver.lifecycle(attempt)).toMatchObject({providerTerminal:'cancelled',billing:'final',authority:{processKill:0,budgetRelease:0,acceptance:0}});f.dispose();
  });

  it('rechecks persisted account identity and close state after a delayed public verdict',async()=>{
    for(const change of ['account','close'] as const){let enter!:()=>void,release!:()=>void;const entered=new Promise<void>(resolve=>{enter=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});
      const f=driverFixture(async(input:any)=>{enter();await gate;return{authenticated:true,final:true,...input,evidenceBase64:receipt.toString('base64'),evidenceSha256:hash(receipt)};});f.setEmit(context=>context.emitLifecycle({kind:'provider-terminal',data:{status:'cancelled',receiptDigest:hash(receipt)},references:[{refType:'turn',label:'provider-receipt',reference:'receipt/ref'}]}));
      const started=f.start();await entered;let closing:Promise<void>|undefined;if(change==='account'){f.db.exec('DROP TRIGGER account_identity_no_update');f.db.prepare("UPDATE orchestration_account_identity SET digest=?").run('f'.repeat(64));}else closing=f.driver.close();release();await started;if(closing)await expect(closing).rejects.toThrow('orchestration_cleanup_unverified');
      expect(f.db.prepare("SELECT COUNT(*) n FROM provider_lifecycle_event WHERE kind IN ('provider-terminal','billing-finalized')").get()).toEqual({n:0});f.dispose();}
  });

  it('rejects accessors, hostile kind coercion, and compact shared graphs before verifier invocation or terminal append',async()=>{
    for(const shape of ['accessor','reference-accessor','hostile-kind','dag'] as const){let calls=0,hostileCalls=0;const f=driverFixture(async(input:any)=>{calls++;return{authenticated:true,final:true,...input,evidenceBase64:receipt.toString('base64'),evidenceSha256:hash(receipt)};});
      f.setEmit(context=>{if(shape==='accessor'){const data:any={receiptDigest:hash(receipt)};Object.defineProperty(data,'status',{enumerable:true,get(){hostileCalls++;throw Error('getter');}});return context.emitLifecycle({kind:'provider-terminal',data,references:[{refType:'turn',label:'provider-receipt',reference:'receipt/ref'}]});}if(shape==='reference-accessor'){const references:any[]=[];Object.defineProperty(references,'0',{enumerable:true,get(){hostileCalls++;throw Error('getter');}});references.length=1;return context.emitLifecycle({kind:'provider-terminal',data:{status:'cancelled',receiptDigest:hash(receipt)},references});}if(shape==='hostile-kind'){const kind={[Symbol.toPrimitive](){hostileCalls++;return'provider-terminal';}};return context.emitLifecycle({kind,data:{status:'cancelled',receiptDigest:hash(receipt)},references:[]} as any);}let shared:any={leaf:'x'};for(let i=0;i<12;i++)shared={left:shared,right:shared};return context.emitLifecycle({kind:'provider-terminal',data:{status:'cancelled',receiptDigest:hash(receipt),shared},references:[{refType:'turn',label:'provider-receipt',reference:'receipt/ref'}]});});
      await f.start();expect(calls).toBe(0);expect(hostileCalls).toBe(0);expect(f.db.prepare("SELECT COUNT(*) n FROM provider_lifecycle_event WHERE kind IN ('provider-terminal','billing-finalized')").get()).toEqual({n:0});f.dispose();}
  });
});
