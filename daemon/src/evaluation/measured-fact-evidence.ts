import { createHash } from 'node:crypto';
import { types } from 'node:util';
import type { Ledger } from '../ledger.js';
import {
  createEvaluationMeasuredFactStore,
  createOfflineFixtureEvaluationMeasuredFactStore,
  type EvaluationMeasuredFact,
  type MeasuredFactHost,
} from './measured-facts.js';

const ID=/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const fail=(code:string):never=>{throw Error(`evaluation_measured_fact_evidence_${code}`)};
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
function exact(value:unknown,keys:readonly string[]){
  if(!value||typeof value!=='object'||types.isProxy(value)||Object.getPrototypeOf(value)!==Object.prototype)fail('input');
  const descriptors=Object.getOwnPropertyDescriptors(value);
  if(Reflect.ownKeys(descriptors).length!==keys.length||keys.some(key=>!descriptors[key]?.enumerable||!Object.hasOwn(descriptors[key],'value')))fail('input');
  return Object.fromEntries(keys.map(key=>[key,descriptors[key]!.value]));
}
function id(value:unknown):string{if(typeof value!=='string'||!ID.test(value))fail('identity');return value as string}
function freeze<T>(value:T):T{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value)}return value}

export type EvaluationMeasuredFactEvidence=Readonly<{
  version:'cue-evaluation-measured-fact-evidence-v1';
  authority:'measured-fact-evidence-only';
  factId:string; factDigest:string; enrollmentId:string; observationId:string; runId:string;
  datasetDigest:string; caseId:string; arm:string; policyDigest:string;
  producer:Readonly<{class:'host-observed'|'offline-fixture';revision:string;digest:string;recordedAtMs:number}>;
  executedInput:Readonly<{expectedDigest:string;actualDigest:string;matches:boolean;evidenceDigest:string}>;
  attempts:readonly Readonly<{attemptId:string;role:string;state:string;retryOf:string|null;candidateDigest:string;launchIntentDigest:string;identityDigest:string;handoffDigest:string;toolId:string;toolRevision:string;modelId:string|null;modelRevision:string|null}>[];
  measurements:Readonly<{
    quality:Readonly<{availability:'available';metricDigest:string;verifierProducerDigest:string;evidenceDigest:string}>|Readonly<{availability:'unavailable'}>;
    timing:Readonly<{availability:'available';elapsedMs:number;clockId:string;clockRevision:string;clockDigest:string;evidenceDigest:string;scope:string}>|Readonly<{availability:'unavailable'}>;
    accounting:Readonly<{availability:'available'|'unavailable';kind:string;priceDigest:string|null}>;
  }>;
  contracts:Readonly<{environmentDigest:string;accountLimitsDigest:string;priceDigest:string|null}>;
  uncertaintyReasons:readonly string[];
  trialReady:false; promotionEligible:false; digest:string;
}>;

function project(fact:EvaluationMeasuredFact):EvaluationMeasuredFactEvidence{
  const input=fact.executedInput as any,quality=fact.quality as any,timing=fact.timing as any,accounting=fact.accounting as any;
  const value={
    version:'cue-evaluation-measured-fact-evidence-v1' as const,authority:'measured-fact-evidence-only' as const,
    factId:fact.factId,factDigest:fact.digest,enrollmentId:fact.enrollmentId,observationId:fact.observationId,runId:fact.runId,
    datasetDigest:fact.datasetDigest,caseId:fact.caseId,arm:fact.arm,policyDigest:fact.policyDigest,
    producer:{class:fact.producerClass,revision:fact.producerRevision,digest:fact.producerDigest,recordedAtMs:fact.recordedAtMs},
    executedInput:{expectedDigest:input.expectedDigest,actualDigest:input.actualDigest,matches:input.matches,evidenceDigest:input.evidenceDigest},
    attempts:(fact.executionSubjects as any[]).map(subject=>({attemptId:subject.attemptId,role:subject.role,state:subject.state,retryOf:subject.retryOf,candidateDigest:subject.candidateDigest,launchIntentDigest:subject.launchIntentDigest,identityDigest:subject.identityDigest,handoffDigest:subject.handoffDigest,toolId:subject.toolId,toolRevision:subject.toolRevision,modelId:subject.modelId,modelRevision:subject.modelRevision})),
    measurements:{
      quality:quality===null?{availability:'unavailable' as const}:{availability:'available' as const,metricDigest:quality.metricDigest,verifierProducerDigest:quality.verifierProducerDigest,evidenceDigest:quality.evidenceDigest},
      timing:timing===null?{availability:'unavailable' as const}:{availability:'available' as const,elapsedMs:timing.elapsedMs,clockId:timing.clockId,clockRevision:timing.clockRevision,clockDigest:timing.clockDigest,evidenceDigest:timing.evidenceDigest,scope:timing.scope},
      accounting:{availability:accounting.kind==='unknown'?'unavailable' as const:'available' as const,kind:accounting.kind,priceDigest:fact.priceDigest},
    },
    contracts:{environmentDigest:fact.environmentDigest,accountLimitsDigest:fact.accountLimitsDigest,priceDigest:fact.priceDigest},
    uncertaintyReasons:[...fact.uncertaintyReasons],trialReady:false as const,promotionEligible:false as const,
  };
  const encoded=JSON.stringify(value);
  return freeze({...value,digest:hash(encoded)});
}

function factory(db:Ledger,host:MeasuredFactHost,offline:boolean){
  const facts=offline?createOfflineFixtureEvaluationMeasuredFactStore(db,host):createEvaluationMeasuredFactStore(db,host);
  const read=(input:unknown)=>{
    if(!db.open||db.inTransaction)fail('outer_transaction');
    const factId=id(exact(input,['factId']).factId),fact=facts.read(factId);
    return fact?project(fact):null;
  };
  return Object.freeze({read,project(input:unknown):EvaluationMeasuredFactEvidence{const value=read(input);return value??fail('unavailable')}});
}

export function createEvaluationMeasuredFactEvidenceStore(db:Ledger,host:MeasuredFactHost){return factory(db,host,false)}
export function createOfflineFixtureEvaluationMeasuredFactEvidenceStore(db:Ledger,host:MeasuredFactHost){return factory(db,host,true)}
