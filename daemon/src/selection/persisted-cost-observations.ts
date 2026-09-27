import { createHash } from 'node:crypto';
import type { Ledger } from '../ledger.js';
import { readAccountIdentities } from '../orchestration/account-binding.js';
import { snapshotCostCapacityObservation, type CostCapacityObservation, type CostCapacityObservationInput } from './cost-capacity-observation.js';

const SHA=/^[a-f0-9]{64}$/;
const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
const fail=(reason:string):never=>{throw Error(`persisted_cost_observation_${reason}`);};
function canonical(value:unknown):string{if(value===null||typeof value==='boolean'||typeof value==='string'||typeof value==='number')return JSON.stringify(value);if(Array.isArray(value))return`[${value.map(canonical).join(',')}]`;if(!value||typeof value!=='object')fail('integrity');return`{${Object.keys(value as object).sort().map(key=>`${JSON.stringify(key)}:${canonical((value as Record<string,unknown>)[key])}`).join(',')}}`;}

type Lineage=Readonly<{runId:string;attemptId:string;candidateId:string;subjectDigest:string;identityKind:'account'|'local-attempt';identityRef:string;identityDigest:string}>;
type StoredPayload=Readonly<{version:'cue-persisted-cost-observation-v1';lineage:Lineage;observation:CostCapacityObservationInput}>;

function schema(db:Ledger){
  const n=(db.prepare("SELECT count(*) n FROM sqlite_master WHERE (type='table' AND name IN ('cost_observation_migration','orchestration_cost_observation')) OR (type='trigger' AND name IN ('cost_observation_insert_guard','cost_observation_no_update','cost_observation_no_delete','cost_observation_no_replace'))").get() as {n:number}).n;
  if(n!==6||!db.prepare("SELECT 1 FROM cost_observation_migration WHERE singleton=1 AND version='cue-persisted-cost-observation-v1'").get())fail('schema');
}
function inputFrom(value:CostCapacityObservation):CostCapacityObservationInput{return Object.freeze({
  version:value.version,candidateId:value.candidateId,providerId:value.providerId,accountRef:value.accountRef,costDimension:value.costDimension,
  costState:value.costState,units:value.units,currency:value.currency,unit:value.unit,sourceRef:value.sourceRef,sourceDigest:value.sourceDigest,
  observedAtMs:value.observedAtMs,validUntilMs:value.validUntilMs,price:value.price,quota:value.quota,gpu:value.gpu,billing:value.billing,
});}
function currentLineage(db:Ledger,runId:string,attemptId:string,dimension:CostCapacityObservation['costDimension']):Lineage{
  const row=db.prepare(`SELECT a.run_id,a.attempt_id,a.candidate_id,l.expected_subject_digest,l.tool_id,
    i.identity_id,i.subject_digest identity_subject,i.payload_sha256 identity_digest
    FROM orchestration_attempt a JOIN orchestration_launch_intent l ON l.attempt_id=a.attempt_id
    JOIN orchestration_attempt_identity i ON i.attempt_id=a.attempt_id WHERE a.run_id=? AND a.attempt_id=?`).get(runId,attemptId) as {
      run_id:string;attempt_id:string;candidate_id:string;expected_subject_digest:string;tool_id:string;
      identity_id:string;identity_subject:string;identity_digest:string;
    }|undefined;
  if(!row)fail('lineage');const found=row!;
  if(found.identity_subject!==found.expected_subject_digest||!SHA.test(found.expected_subject_digest)||!SHA.test(found.identity_digest))fail('lineage');
  if(dimension==='local-resource')return Object.freeze({runId:found.run_id,attemptId:found.attempt_id,candidateId:found.candidate_id,
    subjectDigest:found.expected_subject_digest,identityKind:'local-attempt',identityRef:found.identity_id,identityDigest:found.identity_digest});
  const identity=readAccountIdentities(db,runId).find(value=>value.candidateId===found.candidate_id);
  if(!identity)fail('identity');const account=identity!;
  if(account.subjectDigest!==found.expected_subject_digest||account.toolId!==found.tool_id)fail('identity');
  return Object.freeze({runId:found.run_id,attemptId:found.attempt_id,candidateId:found.candidate_id,subjectDigest:found.expected_subject_digest,
    identityKind:'account',identityRef:account.authReference,identityDigest:account.digest});
}
function parseStored(row:{payload:Buffer,payload_digest:string}):StoredPayload{
  if(!Buffer.isBuffer(row.payload)||row.payload.length>16384||hash(row.payload)!==row.payload_digest)fail('integrity');
  const text=row.payload.toString('utf8');let value:StoredPayload;try{value=JSON.parse(text) as StoredPayload;}catch{fail('integrity');}
  if(canonical(value!)!==text||value!.version!=='cue-persisted-cost-observation-v1'||Object.keys(value!).length!==3)fail('integrity');return value!;
}

export function createPersistedCostObservationStore(db:Ledger){
  schema(db);
  function record(input:{runId:string;attemptId:string;observation:unknown;resolveSource:(ref:string)=>Uint8Array|null}){
    if(!db.inTransaction)fail('transaction');
    // The validator snapshots hostile host data and enforces dimension-specific units.
    const first=snapshotCostCapacityObservation(input.observation,Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER);
    const observation=inputFrom(first),lineage=currentLineage(db,input.runId,input.attemptId,first.costDimension);
    if(first.candidateId!==lineage.candidateId)fail('candidate');
    const launch=db.prepare('SELECT tool_id FROM orchestration_launch_intent WHERE attempt_id=?').get(input.attemptId) as {tool_id:string};
    if(first.providerId!==launch.tool_id||first.accountRef!==lineage.identityRef)fail('identity');
    if(lineage.identityKind==='account'&&first.costDimension==='local-resource'||lineage.identityKind==='local-attempt'&&first.costDimension!=='local-resource')fail('dimension');
    const evidence=input.resolveSource(first.sourceRef);if(!(evidence instanceof Uint8Array))fail('source');const source=evidence!;if(hash(source)!==first.sourceDigest)fail('source');
    const payload:StoredPayload=Object.freeze({version:'cue-persisted-cost-observation-v1',lineage,observation});
    const bytes=Buffer.from(canonical(payload)),payloadDigest=hash(bytes),observationId=`cost:${hash(bytes).slice(0,64)}`;
    const old=db.prepare('SELECT payload,payload_digest,source_evidence FROM orchestration_cost_observation WHERE attempt_id=? OR observation_id=?').get(input.attemptId,observationId) as {payload:Buffer;payload_digest:string;source_evidence:Buffer}|undefined;
    if(old){if(!old.payload.equals(bytes)||old.payload_digest!==payloadDigest||!old.source_evidence.equals(source))fail('replay');return readAttempt(input.runId,input.attemptId,first.observedAtMs,Number.MAX_SAFE_INTEGER);}
    db.prepare('INSERT INTO orchestration_cost_observation VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(observationId,lineage.runId,lineage.attemptId,lineage.candidateId,lineage.subjectDigest,lineage.identityKind,lineage.identityRef,lineage.identityDigest,first.costDimension,first.costState,first.observedAtMs,first.validUntilMs,first.sourceRef,first.sourceDigest,bytes,payloadDigest,Buffer.from(source));
    return readAttempt(input.runId,input.attemptId,first.observedAtMs,Number.MAX_SAFE_INTEGER);
  }
  function readAttempt(runId:string,attemptId:string,nowMs:number,maxAgeMs:number):CostCapacityObservation|null{
    const row=db.prepare('SELECT * FROM orchestration_cost_observation WHERE run_id=? AND attempt_id=?').get(runId,attemptId) as any;if(!row)return null;
    const stored=parseStored(row),lineage=currentLineage(db,runId,attemptId,stored.observation.costDimension);
    if(canonical(stored.lineage)!==canonical(lineage)||row.run_id!==lineage.runId||row.attempt_id!==lineage.attemptId||row.candidate_id!==lineage.candidateId||row.subject_digest!==lineage.subjectDigest||row.identity_kind!==lineage.identityKind||row.identity_ref!==lineage.identityRef||row.identity_digest!==lineage.identityDigest||row.cost_dimension!==stored.observation.costDimension||row.cost_state!==stored.observation.costState||row.observed_at_ms!==stored.observation.observedAtMs||row.valid_until_ms!==stored.observation.validUntilMs||row.source_ref!==stored.observation.sourceRef||row.source_digest!==stored.observation.sourceDigest||!Buffer.isBuffer(row.source_evidence)||hash(row.source_evidence)!==row.source_digest)fail('integrity');
    const value=snapshotCostCapacityObservation(stored.observation,nowMs,maxAgeMs);
    if(value.candidateId!==lineage.candidateId||value.accountRef!==lineage.identityRef)fail('integrity');return value;
  }
  return Object.freeze({record,readAttempt});
}
