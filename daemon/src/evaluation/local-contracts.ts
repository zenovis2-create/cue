import {createHash,randomUUID} from 'node:crypto';
import {closeSync,fstatSync,lstatSync,openSync,readSync} from 'node:fs';
import {arch,platform,release,type as osType} from 'node:os';
import {fileURLToPath} from 'node:url';
import type {Ledger} from '../ledger.js';
import {createMeasurementContractStore,freezeMeasurementDefinition} from './measurement-contracts.js';
import {NATIVE_EXISTING_FILE_CHECKER_ID,NATIVE_EXISTING_FILE_CHECKER_REVISION} from '../verification/native-existing-file-checker.js';

const hash=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex');
const MAX_CODE_BYTES=262144;
export const LOCAL_ENVIRONMENT_MISSING=Object.freeze(['execution-input','execution-sandbox','provider-installation','model-revision','account-limits','price','resource-contention'] as const);
function fail(code:string):never{throw Error('evaluation_local_contract_'+code);}
function time(){const n=Date.now();if(!Number.isSafeInteger(n)||n<0)fail('clock');return n;}
function boundedText(value:unknown):string{if(typeof value!=='string'||value.length<1||Buffer.byteLength(value)>256||/[\x00-\x1f\x7f]/u.test(value))fail('observation');return value;}
// Fixed code assets only, never a user-supplied path. Measure regular-file bytes,
// with bounded FD reads and identity/metadata checks, not executable memory.
function codeBytes(url:URL){
 const path=fileURLToPath(url),before=lstatSync(path,{bigint:true});
 const same=(a:typeof before,b:typeof before)=>a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtimeNs===b.mtimeNs&&a.ctimeNs===b.ctimeNs&&b.nlink===1n&&b.isFile();
 if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1n||before.size<1n||before.size>BigInt(MAX_CODE_BYTES))fail('code');
 const fd=openSync(path,'r');try{
  if(!same(before,fstatSync(fd,{bigint:true})))fail('code');const bytes=Buffer.alloc(Number(before.size));let offset=0;
  while(offset<bytes.length){const n=readSync(fd,bytes,offset,bytes.length-offset,offset);if(n===0)fail('code');offset+=n;}
  if(readSync(fd,Buffer.alloc(1),0,1,offset)!==0||!same(before,fstatSync(fd,{bigint:true}))||!same(before,lstatSync(path,{bigint:true})))fail('code');return hash(bytes);
 }finally{closeSync(fd);}
}
function observe(){
 const started=time(),producerCodeDigest=codeBytes(new URL(import.meta.url));
 // TS-source execution and packaged JS intentionally have distinct code identities.
 const extension=import.meta.url.endsWith('.ts')?'ts':'js';
 const checkerCodeDigest=codeBytes(new URL(`../verification/native-existing-file-checker.${extension}`,import.meta.url));
 const local=Object.freeze({osType:boundedText(osType()),osRelease:boundedText(release()),osPlatform:boundedText(platform()),osArchitecture:boundedText(arch()),processArchitecture:boundedText(process.arch),nodeVersion:boundedText(process.versions.node),v8Version:boundedText(process.versions.v8),electronVersion:process.versions.electron===undefined?null:boundedText(process.versions.electron),chromeVersion:process.versions.chrome===undefined?null:boundedText(process.versions.chrome)});
 const observedAtMs=time();if(observedAtMs<started)fail('clock');
 const algorithmRevision='exact-artifacts-v1:'+hash(JSON.stringify({rule:'all-approved-artifact-bytes-match',checkerId:NATIVE_EXISTING_FILE_CHECKER_ID,checkerRevision:NATIVE_EXISTING_FILE_CHECKER_REVISION,checkerCodeDigest}));
 const metric=freezeMeasurementDefinition({scoreMinimum:0,scoreMaximum:1,algorithmRevision});
 const environment=freezeMeasurementDefinition({schemaRevision:'cue-local-process-environment-v1',complete:false,fields:{scope:'local-process-at-capture-only',local,checkerId:NATIVE_EXISTING_FILE_CHECKER_ID,checkerRevision:NATIVE_EXISTING_FILE_CHECKER_REVISION,checkerCodeDigest,producerCodeDigest,codeObservation:'regular-file-bytes-not-loaded-memory',missing:LOCAL_ENVIRONMENT_MISSING}});
 return Object.freeze({observedAtMs,producerCodeDigest,metric,environment});
}

/** Fixed local producer. No dependency injection, provider calls, filesystem
 * input reads, credentials or inferred execution context. A contract definition
 * is not a quality result; this intentionally cannot supply a ready trial. */
export function captureLocalEvaluationContracts(db:Ledger){
 if(!db.open||db.inTransaction)fail('boundary');
 const observed=observe(),sourceRevision='local-contracts-v1:'+observed.producerCodeDigest;
 const metricId='cue-exact-artifact-quality',metricRevision=observed.metric.sourceDigest;
 const environmentId='cue-local-process-environment',environmentRevision='capture-'+randomUUID();
 const host={nowMs:()=>observed.observedAtMs,read(kind:string,id:string,revision:string){
  const source=kind==='metric'&&id===metricId&&revision===metricRevision?observed.metric
   :kind==='environment'&&id===environmentId&&revision===environmentRevision?observed.environment:null;
  if(!source)fail('unsupported');return Object.freeze({id,revision,sourceRevision,...source});
 }};
 const store=createMeasurementContractStore(db,host);
 // Two existing append-only registries, not a transaction across both. If the
 // second write fails, the first may remain; never claim success or delete it.
 const metric=store.registerMetric({id:metricId,revision:metricRevision});
 const environment=store.registerEnvironment({id:environmentId,revision:environmentRevision});
 return Object.freeze({version:'cue-local-evaluation-contracts-v1' as const,authority:'local-contract-registration-only' as const,metric,environment,missing:LOCAL_ENVIRONMENT_MISSING,qualityMeasured:false as const,executedInputVerified:false as const,trialReady:false as const,promotionEligible:false as const});
}
