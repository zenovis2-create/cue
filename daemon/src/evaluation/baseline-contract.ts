import { createHash } from 'node:crypto';
import { types } from 'node:util';
import { freezeEvaluationDataset, type EvaluationDataset } from './comparison.js';

export const BASELINE_MAX_BYTES=1048576;
export const BASELINE_ROW_COLUMNS=`baseline_id,enrollment_id,run_id,dataset_digest,case_id,policy_kind,policy_id,policy_revision,policy_digest,
  candidate_id,candidate_revision,candidate_digest,metric_digest,environment_digest,account_limits_digest,enrolled_at_ms,
  authority_id,authority_revision,authority_digest,request_digest,length(CAST(request_payload AS BLOB)) request_bytes,substr(request_payload,1,?) request_payload,
  length(CAST(authorization_payload AS BLOB)) authorization_bytes,substr(authorization_payload,1,?) authorization_payload`;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const SHA=/^[a-f0-9]{64}$/;
export type BaselineRef=Readonly<{id:string;revision:string;digest:string}>;
export type BaselinePolicyRef=Readonly<{kind:'monetary'|'local-invocation';policyId:string;revision:number;digest:string}>;
export type ManualBaselineAuthorityRequest=Readonly<{baselineId:string;enrollmentId:string;runId:string;dataset:EvaluationDataset;caseId:string;
  policy:BaselinePolicyRef;candidate:BaselineRef;metric:BaselineRef;environment:BaselineRef;accountLimits:BaselineRef;enrolledAtMs:number;authorityRef:BaselineRef;planDigest?:string}>;
export type ManualBaselineAuthorization=Readonly<{verified:true;authorityRef:BaselineRef}>;

export const baselineHash=(value:string)=>createHash('sha256').update(value).digest('hex');
function fail(code:string):never { throw Error(`evaluation_baseline_${code}`); }
function exact(value:unknown,keys:readonly string[]){
  if(!value||typeof value!=='object'||types.isProxy(value)||Object.getPrototypeOf(value)!==Object.prototype)fail('input');
  const descriptors=Object.getOwnPropertyDescriptors(value);
  if(Reflect.ownKeys(descriptors).length!==keys.length||keys.some(key=>!descriptors[key]?.enumerable||!Object.hasOwn(descriptors[key],'value')))fail('input');
  return Object.fromEntries(keys.map(key=>[key,descriptors[key]!.value]));
}
function identity(value:unknown):string { if(typeof value!=='string'||!ID.test(value))fail('identity');return value; }
export const baselineIdentity=(value:unknown)=>identity(value);
function sha(value:unknown):string { if(typeof value!=='string'||!SHA.test(value))fail('digest');return value; }
function ref(value:unknown):BaselineRef { const f=exact(value,['id','revision','digest']);return Object.freeze({id:identity(f.id),revision:identity(f.revision),digest:sha(f.digest)}); }
function policy(value:unknown):BaselinePolicyRef { const f=exact(value,['kind','policyId','revision','digest']);
  if(!['monetary','local-invocation'].includes(f.kind as string)||!Number.isSafeInteger(f.revision)||(f.revision as number)<0)fail('policy');
  return Object.freeze({kind:f.kind as BaselinePolicyRef['kind'],policyId:identity(f.policyId),revision:f.revision as number,digest:sha(f.digest)}); }
export function freezeBaseline<T>(value:T):T { if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freezeBaseline);Object.freeze(value)}return value; }
export function canonicalizeManualBaselineRequest(input:unknown):ManualBaselineAuthorityRequest {
  const hasPlan=!!input&&typeof input==='object'&&!types.isProxy(input)&&Object.hasOwn(input,'planDigest');
  const f=exact(input,['baselineId','enrollmentId','runId','dataset','caseId','policy','candidate','metric','environment','accountLimits','enrolledAtMs','authorityRef',...(hasPlan?['planDigest']:[])]);
  if(!Number.isSafeInteger(f.enrolledAtMs)||(f.enrolledAtMs as number)<0)fail('time');
  return freezeBaseline({baselineId:identity(f.baselineId),enrollmentId:identity(f.enrollmentId),runId:identity(f.runId),dataset:freezeEvaluationDataset(f.dataset),
    caseId:identity(f.caseId),policy:policy(f.policy),candidate:ref(f.candidate),metric:ref(f.metric),environment:ref(f.environment),
    accountLimits:ref(f.accountLimits),enrolledAtMs:f.enrolledAtMs as number,authorityRef:ref(f.authorityRef),...(hasPlan?{planDigest:sha(f.planDigest)}:{})});
}
export function manualBaselineRequestPayload(request:ManualBaselineAuthorityRequest){return {baselineId:request.baselineId,enrollmentId:request.enrollmentId,runId:request.runId,
  dataset:{id:request.dataset.id,revision:request.dataset.revision,cases:request.dataset.cases},caseId:request.caseId,policy:request.policy,candidate:request.candidate,
  metric:request.metric,environment:request.environment,accountLimits:request.accountLimits,enrolledAtMs:request.enrolledAtMs,authorityRef:request.authorityRef,...(request.planDigest===undefined?{}:{planDigest:request.planDigest})};}
export function validateStoredManualBaseline(row:any):Readonly<{request:ManualBaselineAuthorityRequest;authorization:ManualBaselineAuthorization}> {
  if(!row||!Number.isSafeInteger(row.request_bytes)||!Number.isSafeInteger(row.authorization_bytes)||row.request_bytes<0||row.authorization_bytes<0
    ||row.request_bytes>BASELINE_MAX_BYTES||row.authorization_bytes>BASELINE_MAX_BYTES)fail('payload');
  try {
    const request=canonicalizeManualBaselineRequest(JSON.parse(row.request_payload));
    const parsed=exact(JSON.parse(row.authorization_payload),['verified','authorityRef']),authorityRef=ref(parsed.authorityRef);
    if(parsed.verified!==true||JSON.stringify(authorityRef)!==JSON.stringify(request.authorityRef))fail('integrity');
    const authorization=freezeBaseline({verified:true as const,authorityRef}),requestPayload=JSON.stringify(manualBaselineRequestPayload(request));
    const columns=[row.baseline_id,row.enrollment_id,row.run_id,row.dataset_digest,row.case_id,row.policy_kind,row.policy_id,row.policy_revision,row.policy_digest,
      row.candidate_id,row.candidate_revision,row.candidate_digest,row.metric_digest,row.environment_digest,row.account_limits_digest,row.enrolled_at_ms,
      row.authority_id,row.authority_revision,row.authority_digest];
    const expected=[request.baselineId,request.enrollmentId,request.runId,request.dataset.digest,request.caseId,request.policy.kind,request.policy.policyId,
      request.policy.revision,request.policy.digest,request.candidate.id,request.candidate.revision,request.candidate.digest,request.metric.digest,
      request.environment.digest,request.accountLimits.digest,request.enrolledAtMs,request.authorityRef.id,request.authorityRef.revision,request.authorityRef.digest];
    if(requestPayload!==row.request_payload||baselineHash(requestPayload)!==row.request_digest||JSON.stringify(authorization)!==row.authorization_payload
      ||JSON.stringify(columns)!==JSON.stringify(expected))fail('integrity');
    return freezeBaseline({request,authorization});
  } catch { fail('integrity'); }
}
