import { createHash, timingSafeEqual } from 'node:crypto';
import { types } from 'node:util';

const SHA=/^[a-f0-9]{64}$/u;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const KINDS=['provider-terminal','billing-finalized'] as const;

export type ProviderEvidenceKind=typeof KINDS[number];
export interface ProviderLifecycleEvidenceRequest {
  readonly runId:string;readonly taskId:string;readonly attemptId:string;readonly candidateId:string;
  readonly providerId:string;readonly providerRevision:string;readonly accountReference:string;readonly accountDigest:string;readonly subjectDigest:string;
  readonly kind:ProviderEvidenceKind;readonly status:string;readonly receiptReference:string;readonly receiptDigest:string;
}
export type ProviderLifecycleEvidenceVerifier=(request:Readonly<ProviderLifecycleEvidenceRequest>)=>Promise<unknown>;

function record(value:unknown,keys:readonly string[],label:string):Record<string,unknown>{
  if(!value||typeof value!=='object'||types.isProxy(value)||Object.getPrototypeOf(value)!==Object.prototype)throw Error(`lifecycle_evidence_${label}`);
  const descriptors=Object.getOwnPropertyDescriptors(value);
  if(Reflect.ownKeys(descriptors).length!==keys.length)throw Error(`lifecycle_evidence_${label}`);
  for(const key of keys){const descriptor=descriptors[key];if(!descriptor?.enumerable||!Object.hasOwn(descriptor,'value'))throw Error(`lifecycle_evidence_${label}`);}
  return value as Record<string,unknown>;
}
function text(value:unknown,label:string,maximum=4096){
  if(typeof value!=='string'||value.length===0||Buffer.byteLength(value)>maximum||value.includes('\0')||/[\uD800-\uDFFF]/u.test(value))throw Error(`lifecycle_evidence_${label}`);
  return value;
}
function id(value:unknown,label:string){const result=text(value,label,128);if(!ID.test(result)||result.includes('..')||result.includes('/')||result.includes('\\'))throw Error(`lifecycle_evidence_${label}`);return result;}
function sha(value:unknown,label:string){const result=text(value,label,64);if(!SHA.test(result))throw Error(`lifecycle_evidence_${label}`);return result;}
function same(left:string,right:string){return SHA.test(left)&&SHA.test(right)&&timingSafeEqual(Buffer.from(left,'hex'),Buffer.from(right,'hex'));}
function digest(bytes:Uint8Array){return createHash('sha256').update(bytes).digest('hex');}

function request(input:unknown):Readonly<ProviderLifecycleEvidenceRequest>{
  const value=record(input,['runId','taskId','attemptId','candidateId','providerId','providerRevision','accountReference','accountDigest','subjectDigest','kind','status','receiptReference','receiptDigest'],'request');
  const kind=id(value.kind,'kind') as ProviderEvidenceKind;if(!KINDS.includes(kind))throw Error('lifecycle_evidence_kind');
  const status=id(value.status,'status');if(kind==='provider-terminal'?!['succeeded','failed','cancelled'].includes(status):status!=='final')throw Error('lifecycle_evidence_status');
  return Object.freeze({runId:id(value.runId,'run_id'),taskId:id(value.taskId,'task_id'),attemptId:id(value.attemptId,'attempt_id'),candidateId:id(value.candidateId,'candidate_id'),providerId:id(value.providerId,'provider_id'),providerRevision:id(value.providerRevision,'provider_revision'),accountReference:text(value.accountReference,'account_reference',1024),accountDigest:sha(value.accountDigest,'account_digest'),subjectDigest:sha(value.subjectDigest,'subject_digest'),kind,status,receiptReference:text(value.receiptReference,'receipt_reference',1024),receiptDigest:sha(value.receiptDigest,'receipt_digest')});
}

export async function verifyProviderLifecycleEvidence(input:ProviderLifecycleEvidenceRequest,verify:ProviderLifecycleEvidenceVerifier|undefined,timeoutMs:number){
  const expected=request(input);
  if(typeof verify!=='function')throw Error('lifecycle_evidence_verifier_unavailable');
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60_000)throw Error('lifecycle_evidence_timeout');
  let timer:NodeJS.Timeout|undefined;
  let result:unknown;
  try{
    result=await Promise.race([Promise.resolve().then(()=>verify(expected)),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('lifecycle_evidence_timeout')),timeoutMs);})]);
  }catch(error){if(error instanceof Error&&error.message==='lifecycle_evidence_timeout')throw error;throw Error('lifecycle_evidence_verification_failed');}
  finally{if(timer)clearTimeout(timer);}
  const row=record(result,['authenticated','final','runId','taskId','attemptId','candidateId','providerId','providerRevision','accountReference','accountDigest','subjectDigest','kind','status','receiptReference','receiptDigest','evidenceBase64','evidenceSha256'],'verdict');
  if(row.authenticated!==true||row.final!==true)throw Error('lifecycle_evidence_not_final');
  const evidenceBase64=text(row.evidenceBase64,'bytes',64*1024);
  if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(evidenceBase64))throw Error('lifecycle_evidence_bytes');
  const bytes=Buffer.from(evidenceBase64,'base64');if(bytes.length===0||bytes.toString('base64')!==evidenceBase64)throw Error('lifecycle_evidence_bytes');
  const evidenceSha256=sha(row.evidenceSha256,'evidence_sha256');
  const echoed=request({runId:row.runId,taskId:row.taskId,attemptId:row.attemptId,candidateId:row.candidateId,providerId:row.providerId,providerRevision:row.providerRevision,accountReference:row.accountReference,accountDigest:row.accountDigest,subjectDigest:row.subjectDigest,kind:row.kind,status:row.status,receiptReference:row.receiptReference,receiptDigest:row.receiptDigest});
  for(const key of Object.keys(expected) as (keyof ProviderLifecycleEvidenceRequest)[])if(expected[key]!==echoed[key])throw Error('lifecycle_evidence_lineage_mismatch');
  if(!same(digest(bytes),evidenceSha256)||!same(evidenceSha256,expected.receiptDigest))throw Error('lifecycle_evidence_digest_mismatch');
  return Object.freeze({...echoed,evidenceSha256,evidenceBytes:Uint8Array.from(bytes)});
}
