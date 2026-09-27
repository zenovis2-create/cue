import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, win32, resolve, dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { createGeneratedJsonHost, type LocalGeneratedJsonHostOptions } from '../../app/generated-json-host.mjs';
import { createOrchestrationDriver } from '../../app/orchestration-driver.mjs';
import { openLedger } from '../src/ledger.js';
import { normalizeEnvelope, envelopeHash } from '../src/envelope.js';
import { saveLocalSelectionPolicy } from '../src/selection/local-policy-store.js';
import { LOCAL_JSON_PRODUCER_CANDIDATE_ID, LOCAL_JSON_CHECKER_CANDIDATE_ID } from '../src/selection/local-host-settings.js';
import { SUBJECT_FIELDS, subjectDigest, type MeasurementSubject } from '../src/measurement-subject.js';
import { MODEL_PROBES } from '../src/capability-admission.js';
import { recordSession } from '../src/session-spawn.js';
import { checkJsonFormat } from '../src/verification/json-format-checker.cjs';
const cleanups: (()=>void)[]=[];afterEach(()=>{for(const fn of cleanups.splice(0))fn();});
const hash=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
function fixture(limit=2,timeoutMs=6000,actualCandidateIds=false){
  const ids:Record<string,string>={model:actualCandidateIds?LOCAL_JSON_PRODUCER_CANDIDATE_ID:'fixture-model',checker:actualCandidateIds?LOCAL_JSON_CHECKER_CANDIDATE_ID:'fixture-checker'};
  const root=mkdtempSync(join(tmpdir(),'cue-local-json-host-')),work=join(root,'work');mkdirSync(work);const db=openLedger(),now=Date.now();
  cleanups.push(()=>{db.close();const absolute=resolve(root);expect(dirname(absolute)).toBe(resolve(tmpdir()));expect(basename(absolute).startsWith('cue-local-json-host-')).toBe(true);rmSync(absolute,{recursive:true,force:true});});
  const envelope=normalizeEnvelope({run_id:'workflow',worktree_realpath:work,allowed_actions:['command'],egress:['http://127.0.0.1:8085/v1'],expires_at:new Date(now+120000).toISOString(),autonomy_level:'bounded'});
  const run:any={runId:'workflow',taskId:'root',envelope,envelopeHash:envelopeHash(envelope),goal:'{"source":1}',scope:'document',selectionMode:'efficiency'};
  db.prepare("INSERT INTO task VALUES('root','awaiting_approval',NULL,'now')").run();db.prepare("INSERT INTO envelope VALUES(?,?,?,'now')").run(run.envelopeHash,work,JSON.stringify(envelope.egress));db.prepare("INSERT INTO run VALUES('workflow','root',?,0,'now')").run(run.envelopeHash);
  const subject=Object.fromEntries(SUBJECT_FIELDS.map(key=>[key,key.endsWith('Sha256')?'a'.repeat(64):key])) as MeasurementSubject;
  const refs:any={},evidence=new Map<string,Buffer>();
  // Trusted synthetic eligibility fixture, never registered as live qualification.
  for(const probe of MODEL_PROBES){const bytes=Buffer.from(JSON.stringify({probe,subjectDigest:subjectDigest(subject),measuredAt:new Date(now-1).toISOString(),kind:'live',status:'pass'}));evidence.set(probe,bytes);refs[probe]={id:probe,sha256:hash(bytes)};}
  const policies:any={};for(const mode of ['efficiency','performance','value','speed'] as const){const p=saveLocalSelectionPolicy(db,{policyId:mode,expectedRevision:null,createdAt:new Date(now).toISOString(),sourceVersion:'fixture',policy:{version:'cue-local-selection-v1',mode,producerCandidateId:ids.model!,checkerCandidateId:ids.checker!,limitAttempts:limit,timeoutMs}});policies[mode]={policyId:p.policyId,revision:p.revision,digest:p.digest};}
  const bundle=(clientKind:'model'|'json-checker')=>{const p={version:'cue-model-control-v1' as const,clientKind,nodeSha256:'1'.repeat(64),launcherSha256:'2'.repeat(64),guardianSha256:'3'.repeat(64),clientSha256:'4'.repeat(64),checkerCoreSha256:clientKind==='model'?null:'5'.repeat(64)};return {...p,sha256:hash(JSON.stringify(Object.values(p)))};};
  const controls={eligible:true,missingEvidence:false,launches:[] as string[],checkerSawPersistedProducer:false};
  const candidates:any=Object.fromEntries(['model','checker'].map(kind=>[kind,{record:{canonicalId:ids[kind],toolId:'fixture-'+kind,kind,aliases:[],installation:'installed',protocol:'verified',authReference:null,authAvailable:true,sourceVersion:'fixture',observedAt:new Date(now).toISOString(),subjectDigest:subjectDigest(subject),binding:kind==='model'?{endpointId:'fixed-localhost',modelId:'qwen38-27b-unc'}:null},currentSubject:()=>subject,evidenceReferences:()=>refs,observeCandidate:()=>({candidateId:ids[kind],eligible:controls.eligible,authenticated:true,compatible:true,dataAllowed:true,resourceAvailable:true,quotaAvailable:true})}]));
  const installation={nodeExecutable:process.execPath,nodeSha256:'1'.repeat(64),modelControlBundle:bundle('model'),checkerControlBundle:bundle('json-checker'),taskRootBase:win32.join(root,'tasks'),profileRootBase:win32.join(root,'profiles')};
  const executor=(kind:string)=>(host:any)=>async(context:any)=>{const binding=host.resolveBinding(context);controls.launches.push(kind);const base=kind==='model'?1800000000:1800000003,profile='Cue.Model.'+(kind==='model'?'a':'b').repeat(32),sid='S-1-15-2-1-2-3-4-5-6-7';
    if(kind==='checker')controls.checkerSawPersistedProducer=Boolean(db.prepare("SELECT 1 FROM orchestration_attempt a JOIN orchestration_receipt r ON r.attempt_id=a.attempt_id JOIN cleanup_observation c ON c.run_id=a.attempt_id WHERE a.task_id='produce-json' AND a.state='completed' AND a.cleanup_verified=1 AND a.candidate_id=? AND json_extract(c.payload,'$.result')='verified-clean'").get(ids.model));
    const session={...binding.owner,pid:base,start_time:'synthetic-start',handle:'session-'+context.runId};recordSession(db,session);
    const observations={CUE_MODEL_PID:String(base+1),CUE_MODEL_GUARDIAN_PID:String(base+2),CUE_MODEL_BOUNDARY:{sid,clientOnly:true,profile,taskRoot:win32.join(installation.taskRootBase,profile),profilePath:win32.join(installation.profileRootBase,profile,'AC')},CUE_MODEL_OBSERVATION:{pid:base+1,status:'observed',phase:'suspended-before-resume',createdFileTime:'133000000000000000',appContainer:true,appContainerSid:sid}};
    const result=Promise.resolve({outcome:'succeeded',attemptId:context.runId,requestId:'fixture-request-'+context.runId,text:kind==='model'?JSON.stringify(JSON.parse(run.goal),null,2):null,usage:null,terminal:null,observations,cleanup:'unknown',providerStopped:'unknown',...(kind==='checker'?{checkerVerdict:checkJsonFormat(binding.inputBytes,binding.outputBytes)}:{})});return{session,result,completion:result.then(r=>r.outcome),cancel:async()=>{}};};
  const options:LocalGeneratedJsonHostOptions={db,now:()=>Date.now(),inputForRun:r=>r.goal,installation,candidates,policies,accounting:{kind:'local-invocation',source:'fixture-local-count',observedAtMs:now},evidence:{now:()=>Date.now(),maxAgeMs:60000,resolveEvidence:ref=>controls.missingEvidence?undefined:evidence.get(ref.id)},executorFactories:{model:executor('model') as any,checker:executor('checker') as any}};
  const approve=()=>db.prepare("INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,request_ordinal,decision,created_at) VALUES('workflow',?,'desktop','goal',0,'accept','now')").run(run.envelopeHash);
  return{db,options,run,controls,approve};
}
test('explicit local host uses exact 022 counts/time and exposes no monetary selection or billing functions',()=>{
  const f=fixture(3,2500),ready=createGeneratedJsonHost(f.options);if(!ready.available)throw Error(ready.reasons.join(','));const host=ready.host,prepared=host.prepare(f.run);
  expect(host.accountingKind).toBe('local-invocation');expect(prepared.budget).toMatchObject({limit:3,source:'fixture-local-count'});expect(prepared.limits).toMatchObject({taskTimeoutMs:2500,launchTimeoutMs:2500});
  expect(Object.keys(prepared.budget).sort()).toEqual(['limit','observedAtMs','policyRevision','runId','source']);
  expect('verifyFinalBilling' in host).toBe(false);expect(Object.keys(host.engine).sort()).toEqual(['authorizeExecution','maxRequestAgeMs','observeCandidate','receipts']);
  expect(f.controls.launches).toEqual([]);
});
test('too-small count, mixed accounting fields, wrong local candidate identity, revoked checks and unqualified evidence refuse setup',()=>{
  const small=fixture(1);expect(createGeneratedJsonHost(small.options)).toMatchObject({available:false});
  const f=fixture();expect(createGeneratedJsonHost({...f.options,accounting:{...f.options.accounting,currency:'TEST'} as any})).toMatchObject({available:false});
  f.controls.eligible=false;expect(createGeneratedJsonHost(f.options)).toMatchObject({available:false});f.controls.eligible=true;
  const original=f.options.candidates.model.observeCandidate;f.options.candidates.model.observeCandidate=()=>({...original(),candidateId:'other'});expect(createGeneratedJsonHost(f.options)).toMatchObject({available:false});f.options.candidates.model.observeCandidate=original;
  f.controls.missingEvidence=true;expect(createGeneratedJsonHost(f.options)).toMatchObject({available:false});expect(f.controls.launches).toEqual([]);
});
test('local driver consumes producer and checker invocations with actual capture/cleanup persistence and no money records',async()=>{
  const f=fixture(),ready=createGeneratedJsonHost(f.options);if(!ready.available)throw Error(ready.reasons.join(','));const driver=createOrchestrationDriver({db:f.db,host:ready.host});
  driver.prepare(f.run);f.approve();driver.activate(f.run);await driver.start(f.run);
  expect(f.controls.launches).toEqual(['model','checker']);expect(driver.snapshot('workflow').acceptance).toBe('verified');
  expect((f.db.prepare('SELECT COUNT(*) n FROM local_invocation_reservation').get() as {n:number}).n).toBe(2);
  expect((f.db.prepare('SELECT COUNT(*) n FROM integration_budget_reservation').get() as {n:number}).n).toBe(0);
  expect((f.db.prepare('SELECT COUNT(*) n FROM cleanup_observation').get() as {n:number}).n).toBeGreaterThanOrEqual(2);
  await driver.close();
});
test('default dotted candidate IDs persist real cleanup receipts before checker launch in offline composition',async()=>{
  // Synthetic native frames/executors and in-memory eligibility only; the actual
  // capture, OS absence checker, durable cleanup store and driver are composed.
  const f=fixture(2,6000,true),ready=createGeneratedJsonHost(f.options);if(!ready.available)throw Error(ready.reasons.join(','));
  const driver=createOrchestrationDriver({db:f.db,host:ready.host});
  try {
    driver.prepare(f.run);f.approve();driver.activate(f.run);await driver.start(f.run);
    expect(f.controls.launches).toEqual(['model','checker']);expect(f.controls.checkerSawPersistedProducer).toBe(true);
    expect(driver.snapshot('workflow').acceptance).toBe('verified');
    const receipts=f.db.prepare("SELECT a.candidate_id,a.state,a.cleanup_verified,r.payload FROM orchestration_attempt a JOIN orchestration_receipt r ON r.attempt_id=a.attempt_id ORDER BY a.rowid").all() as {candidate_id:string;state:string;cleanup_verified:number;payload:string}[];
    expect(receipts.map(r=>r.candidate_id)).toEqual([LOCAL_JSON_PRODUCER_CANDIDATE_ID,LOCAL_JSON_CHECKER_CANDIDATE_ID]);
    expect(receipts.every(r=>r.state==='completed'&&r.cleanup_verified===1&&JSON.parse(r.payload).cleanup==='clean')).toBe(true);
    expect((f.db.prepare('SELECT count(*) AS n FROM capability_evidence').get() as {n:number}).n).toBe(0);
  } finally { await driver.close(); }
});
