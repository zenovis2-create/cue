import { createHash } from 'node:crypto';
import { types } from 'node:util';
import type { Ledger } from '../ledger.js';

export interface ExplorationAuthorizationInput { runId:string; policyId:string; policyRevision:number; policyDigest:string; candidateId:string; currency:string; unit:'minor'|'micro'; limitUnits:number; authorizedAt:string; sourceVersion:string }
export interface ExplorationReservationInput { runId:string; requestId:string; attemptId:string; candidateId:string; upperUnits:number }
export interface ExplorationAuthorization extends Readonly<ExplorationAuthorizationInput> { readonly payloadSha256:string }
export interface ExplorationBudgetSummary { readonly runId:string; readonly candidateId:string; readonly currency:string; readonly unit:'minor'|'micro'; readonly limitUnits:bigint; readonly committedUnits:bigint; readonly actualUnits:bigint; readonly remainingUnits:bigint; readonly debtUnits:bigint }
type AuthorizationRow={run_id:string;policy_id:string;policy_revision:number;policy_digest:string;candidate_id:string;currency:string;unit:'minor'|'micro';limit_units:number;authorized_at:string;source_version:string;payload:string;payload_sha256:string};
type ReservationRow={request_id:string;attempt_id:string;candidate_id:string;upper_units:number;payload:string;payload_sha256:string};
const authKeys=['runId','policyId','policyRevision','policyDigest','candidateId','currency','unit','limitUnits','authorizedAt','sourceVersion'] as const;
const reserveKeys=['runId','requestId','attemptId','candidateId','upperUnits'] as const;
function fail(reason:string):never{throw Error(`exploration_budget_${reason}`)}
function record(value:unknown,keys:readonly string[]):Record<string,unknown>{
  if(!value||typeof value!=='object'||types.isProxy(value)||Object.getPrototypeOf(value)!==Object.prototype)fail('invalid_input');
  const descriptors=Object.getOwnPropertyDescriptors(value), own=Reflect.ownKeys(descriptors);
  if(own.length!==keys.length||own.some(k=>typeof k!=='string'||!keys.includes(k)))fail('invalid_fields');
  const result:Record<string,unknown>={}; for(const key of keys){const d=descriptors[key];if(!d||!Object.hasOwn(d,'value')||!d.enumerable)fail('accessor');result[key]=d.value;} return result;
}
function text(value:unknown):string{if(typeof value!=='string'||!value.trim()||value.length>256||/[\u0000-\u001f\u007f]/u.test(value))fail('invalid_text');return value;}
function integer(value:unknown,positive=false):number{if(typeof value!=='number'||!Number.isSafeInteger(value)||value<(positive?1:0))fail('invalid_units');return value;}
function digest(value:unknown):string{if(typeof value!=='string'||!/^[0-9a-f]{64}$/u.test(value))fail('invalid_digest');return value;}
function timestamp(value:unknown):string{if(typeof value!=='string'||value.length!==24||!Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value)fail('invalid_timestamp');return value;}
function canonical(value:Record<string,unknown>):string{return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0)));}
function sha(value:string):string{return createHash('sha256').update(value).digest('hex');}
function decode(row:AuthorizationRow):ExplorationAuthorization{
  const value={runId:text(row.run_id),policyId:text(row.policy_id),policyRevision:integer(row.policy_revision,true),policyDigest:digest(row.policy_digest),candidateId:text(row.candidate_id),currency:text(row.currency),unit:row.unit,limitUnits:integer(row.limit_units,true),authorizedAt:timestamp(row.authorized_at),sourceVersion:text(row.source_version)};
  if(!['minor','micro'].includes(value.unit)||canonical(value)!==row.payload||sha(row.payload)!==digest(row.payload_sha256))fail('corrupt_authorization');
  return Object.freeze({...value,payloadSha256:row.payload_sha256});
}
export function createExplorationBudgetStore(db:Ledger){
  function readAuthorization(runId:string):ExplorationAuthorization|null{text(runId);const row=db.prepare('SELECT * FROM exploration_budget_authorization WHERE run_id=?').get(runId) as AuthorizationRow|undefined;if(!row)return null;const value=decode(row);
    const linked=db.prepare(`SELECT 1 FROM selection_run_policy rp JOIN selection_policy_snapshot ps ON ps.policy_id=rp.policy_id AND ps.revision=rp.revision AND ps.digest=rp.digest JOIN integration_budget b ON b.run_id=rp.run_id
      WHERE rp.run_id=? AND rp.policy_id=? AND rp.revision=? AND rp.digest=? AND b.policy_revision=rp.policy_id||':'||rp.revision AND b.currency=? AND b.unit=? AND ?>0 AND ?<=b.limit_units
      AND EXISTS(SELECT 1 FROM json_each(ps.policy_json,'$.allowedCandidateIds') WHERE value=?)`).get(value.runId,value.policyId,value.policyRevision,value.policyDigest,value.currency,value.unit,value.limitUnits,value.limitUnits,value.candidateId);
    if(!linked)fail('corrupt_authorization');return value;}
  function summary(runId:string):ExplorationBudgetSummary{
    const authorization=readAuthorization(runId);if(!authorization)fail('authorization_missing');
    const reservations=db.prepare('SELECT request_id,attempt_id,candidate_id,upper_units,payload,payload_sha256 FROM exploration_budget_reservation WHERE run_id=?').all(runId) as ReservationRow[];
    let committed=0n,actual=0n;
    for(const reservation of reservations){
      const stored={runId,requestId:text(reservation.request_id),attemptId:text(reservation.attempt_id),candidateId:text(reservation.candidate_id),upperUnits:integer(reservation.upper_units)};
      if(canonical(stored)!==reservation.payload||sha(reservation.payload)!==digest(reservation.payload_sha256)||stored.candidateId!==authorization.candidateId)fail('corrupt_reservation');
      if(!db.prepare('SELECT 1 FROM integration_budget_reservation WHERE run_id=? AND request_id=? AND attempt_id=? AND upper_units=?').get(runId,stored.requestId,stored.attemptId,stored.upperUnits))fail('corrupt_reservation');
      const latest=db.prepare('SELECT kind,units,provider_final FROM integration_budget_receipt WHERE run_id=? AND request_id=? ORDER BY revision DESC LIMIT 1').get(runId,stored.requestId) as {kind:'actual'|'estimated'|'unknown';units:number|null;provider_final:number}|undefined;
      const observed=db.prepare('SELECT MAX(units) units FROM integration_budget_receipt WHERE run_id=? AND request_id=?').get(runId,stored.requestId) as {units:number|null};
      const amount=BigInt(latest?.units??0), upper=BigInt(stored.upperUnits), maxObserved=BigInt(observed.units??0);
      if(latest?.kind==='actual')actual+=amount;
      committed+=latest?.kind==='actual'&&latest.provider_final===1?amount:(maxObserved>upper?maxObserved:upper);
    }
    const limit=BigInt(authorization.limitUnits);return Object.freeze({runId,candidateId:authorization.candidateId,currency:authorization.currency,unit:authorization.unit,limitUnits:limit,committedUnits:committed,actualUnits:actual,remainingUnits:limit>committed?limit-committed:0n,debtUnits:committed>limit?committed-limit:0n});
  }
  return Object.freeze({readAuthorization,
    preauthorize(input:ExplorationAuthorizationInput):ExplorationAuthorization{
      const data=record(input,authKeys), value={runId:text(data.runId),policyId:text(data.policyId),policyRevision:integer(data.policyRevision,true),policyDigest:digest(data.policyDigest),candidateId:text(data.candidateId),currency:text(data.currency),unit:data.unit as 'minor'|'micro',limitUnits:integer(data.limitUnits,true),authorizedAt:timestamp(data.authorizedAt),sourceVersion:text(data.sourceVersion)};
      if(!['minor','micro'].includes(value.unit))fail('invalid_unit'); const payload=canonical(value), payloadSha256=sha(payload);
      return db.transaction(()=>{const existing=readAuthorization(value.runId);if(existing){if(existing.payloadSha256!==payloadSha256)fail('authorization_mismatch');return existing;}
        db.prepare('INSERT INTO exploration_budget_authorization VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(value.runId,value.policyId,value.policyRevision,value.policyDigest,value.candidateId,value.currency,value.unit,value.limitUnits,value.authorizedAt,value.sourceVersion,payload,payloadSha256);return decode(db.prepare('SELECT * FROM exploration_budget_authorization WHERE run_id=?').get(value.runId) as AuthorizationRow);}).immediate();
    },
    reserve(input:ExplorationReservationInput):ExplorationBudgetSummary{
      const data=record(input,reserveKeys), value={runId:text(data.runId),requestId:text(data.requestId),attemptId:text(data.attemptId),candidateId:text(data.candidateId),upperUnits:integer(data.upperUnits)};
      if(!db.inTransaction)fail('transaction_required'); const authorization=readAuthorization(value.runId);if(!authorization)fail('authorization_missing');if(value.candidateId!==authorization.candidateId)fail('candidate_mismatch');
      const payload=canonical(value), payloadSha256=sha(payload);const replay=db.prepare('SELECT payload,payload_sha256 FROM exploration_budget_reservation WHERE run_id=? AND request_id=?').get(value.runId,value.requestId) as {payload:string;payload_sha256:string}|undefined;
      if(replay){if(replay.payload!==payload||replay.payload_sha256!==payloadSha256)fail('request_mismatch');return summary(value.runId);}
      const state=summary(value.runId);if(state.debtUnits>0n||BigInt(value.upperUnits)>state.remainingUnits)fail('limit_exceeded');
      db.prepare('INSERT INTO exploration_budget_reservation VALUES(?,?,?,?,?,?,?)').run(value.runId,value.requestId,value.attemptId,value.candidateId,value.upperUnits,payload,payloadSha256);return summary(value.runId);
    },summary});
}
