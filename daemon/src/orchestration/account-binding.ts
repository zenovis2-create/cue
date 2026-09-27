import { createHash } from 'node:crypto';
import { types } from 'node:util';
import type { Ledger } from '../ledger.js';
export interface AccountIdentity {
  runId:string; candidateId:string; authReference:string; toolId:string; sourceVersion:string;
  subjectDigest:string; modelId:string|null; endpointId:string|null; planDigest:string; policyDigest:string; envelopeHash:string;
}
const fields=['runId','candidateId','authReference','toolId','sourceVersion','subjectDigest','modelId','endpointId','planDigest','policyDigest','envelopeHash'] as const;
const sha=(text:string)=>createHash('sha256').update(text).digest('hex');
const fail=(reason:string):never=>{throw Error('account_identity_'+reason);};
const id=(v:unknown)=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/.test(v);
const ref=(v:unknown)=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(v);
function snapshot(input:unknown):Readonly<AccountIdentity>{
  if(!input||typeof input!=='object'||types.isProxy(input)||Object.getPrototypeOf(input)!==Object.prototype)fail('invalid');
  const ds=Object.getOwnPropertyDescriptors(input),v:Record<string,unknown>={};
  if(Reflect.ownKeys(ds).length!==fields.length)fail('invalid_fields');
  for(const key of fields){const d=ds[key];if(!d||!d.enumerable||!Object.hasOwn(d,'value'))fail('invalid_fields');v[key]=d.value;}
  if(!id(v.runId)||!id(v.candidateId)||!id(v.toolId)||!ref(v.authReference)
    ||typeof v.sourceVersion!=='string'||!v.sourceVersion.trim()||Buffer.byteLength(v.sourceVersion)>1024||/[\u0000-\u001f]/.test(v.sourceVersion))fail('invalid');
  for(const key of ['subjectDigest','planDigest','policyDigest','envelopeHash'])if(typeof v[key]!=='string'||!/^[a-f0-9]{64}$/.test(v[key] as string))fail('invalid_digest');
  if((v.modelId===null)!==(v.endpointId===null)|| (v.modelId!==null&&(typeof v.modelId!=='string'||!v.modelId.trim()||Buffer.byteLength(v.modelId)>1024||/[\u0000-\u001f]/.test(v.modelId)||!ref(v.endpointId))))fail('invalid_model');
  return Object.freeze(v as unknown as AccountIdentity);
}
function migration(db:Ledger){
  const n=(db.prepare("SELECT count(*) n FROM sqlite_master WHERE (type='table' AND name IN ('account_identity_migration','orchestration_account_identity')) OR (type='trigger' AND name IN ('account_identity_no_update','account_identity_no_delete','account_identity_no_replace','account_identity_insert_guard'))").get() as {n:number}).n;
  if(n!==6||!db.prepare("SELECT 1 FROM account_identity_migration WHERE singleton=1 AND version='cue-account-identity-v1'").get())fail('migration_partial');
}
export function readAccountIdentities(db:Ledger,runId:string):Readonly<AccountIdentity & {digest:string}>[]{
  migration(db);if(!id(runId))fail('invalid');
  const rows=db.prepare('SELECT run_id,candidate_id,digest,payload FROM orchestration_account_identity WHERE run_id=? ORDER BY candidate_id LIMIT 1025').all(runId) as {run_id:string;candidate_id:string;digest:string;payload:Buffer}[];
  if(rows.length>1024)fail('limit');
  return rows.map(row=>{if(!Buffer.isBuffer(row.payload)||row.payload.length>16384)fail('integrity');
    const text=row.payload.toString('utf8'),value=snapshot(JSON.parse(text));
    if(JSON.stringify(value)!==text||sha(text)!==row.digest||value.runId!==row.run_id||value.candidateId!==row.candidate_id)fail('integrity');
    return Object.freeze({...value,digest:row.digest});});
}
export function bindAccountIdentities(db:Ledger,input:readonly AccountIdentity[]){
  migration(db);if(!db.inTransaction)fail('transaction_required');
  if(!Array.isArray(input)||types.isProxy(input)||Object.getPrototypeOf(input)!==Array.prototype||input.length<1||input.length>1024||Reflect.ownKeys(input).length!==input.length+1)fail('invalid_batch');
  const values:Readonly<AccountIdentity>[]=[];
  for(let i=0;i<input.length;i++){const d=Object.getOwnPropertyDescriptor(input,String(i));if(!d||!d.enumerable||!Object.hasOwn(d,'value'))fail('invalid_batch');values.push(snapshot(d!.value));}
  const first=values[0]!;
  if(new Set(values.map(v=>v.candidateId)).size!==values.length||values.some(v=>v.runId!==first.runId||v.planDigest!==first.planDigest||v.policyDigest!==first.policyDigest||v.envelopeHash!==first.envelopeHash))fail('invalid_batch');
  values.sort((a,b)=>a.candidateId<b.candidateId?-1:a.candidateId>b.candidateId?1:0);
  // A savepoint makes the whole batch atomic even if the outer caller catches errors.
  return db.transaction(()=>{
    const old=readAccountIdentities(db,first.runId);
    if(old.length){if(old.length!==values.length||old.some((v,i)=>v.digest!==sha(JSON.stringify(values[i]))))fail('conflict');return old;}
    if(db.prepare('SELECT 1 FROM approval_event WHERE run_id=?').get(first.runId)||db.prepare('SELECT 1 FROM orchestration_attempt WHERE run_id=?').get(first.runId))fail('legacy_approved');
    for(const value of values){const text=JSON.stringify(value);db.prepare('INSERT INTO orchestration_account_identity VALUES(?,?,?,?)').run(value.runId,value.candidateId,sha(text),Buffer.from(text));}
    return readAccountIdentities(db,first.runId);
  })();
}
