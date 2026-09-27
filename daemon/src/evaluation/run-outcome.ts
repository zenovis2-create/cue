import { createHash } from 'node:crypto';
import { types } from 'node:util';
import type { Ledger } from '../ledger.js';
import { readRunPolicyIdentity } from '../selection/run-policy-identity.js';
import { createAttemptDecisionStore } from '../selection/attempt-decision-store.js';
import { validateTaskPlan } from '../orchestration/plan.js';
import { readAcceptanceHistory } from '../verification/acceptance.js';
import { createLocalInvocationBudget } from '../local-invocation-budget.js';
import { createAuthoritativeAccountingStore } from './authoritative-accounting.js';

const INPUT_BYTES = 8 * 1048576, OUTPUT_BYTES = 1048576, MAX_ATTEMPTS = 1024;
const digest = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const id = (v: unknown): string => { if (typeof v !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v)) throw Error('identity'); return v; };
// Plan membership is validated before projection. Namespaced/path-like labels
// are retained by digest without publishing their potentially private text.
const publicPlanId = (v: string) => /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(v) ? v : null;
const integer = (v: unknown): number => { if (!Number.isSafeInteger(v) || (v as number) < 0) throw Error('integer'); return v as number; };
const freeze = <T>(v: T): T => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };
function exact(v: unknown, keys: string[]): Record<string, any> {
  if (!v || typeof v !== 'object' || types.isProxy(v) || Object.getPrototypeOf(v) !== Object.prototype) throw Error('input');
  const d = Object.getOwnPropertyDescriptors(v);
  if (Reflect.ownKeys(d).length !== keys.length || keys.some(k => !d[k]?.enumerable || !Object.hasOwn(d[k], 'value'))) throw Error('input');
  return Object.fromEntries(keys.map(k => [k,d[k]!.value]));
}
/** Preflight validation inputs before any reader can materialize payloads. These
 * are SQL byte/count aggregates, not reads of prompt/auth/environment columns. */
function preflight(db: Ledger, runId: string) {
  let bytes = 0, rows = 0;
  const add = (from: string, expression: string) => {
    const row = db.prepare(`SELECT COUNT(*) n,COALESCE(SUM(${expression}),0) bytes FROM ${from}`).get(runId) as { n: number; bytes: number };
    rows += integer(row.n); bytes += integer(row.bytes);
    if (rows > 4096 || bytes > INPUT_BYTES) throw Error('coverage-limit');
  };
  const length = (s: string) => `COALESCE(length(CAST(${s} AS BLOB)),0)`;
  const attempts = db.prepare('SELECT COUNT(*) n FROM orchestration_attempt WHERE run_id=?').get(runId) as { n: number };
  if (integer(attempts.n) > MAX_ATTEMPTS) throw Error('coverage-limit');
  add('orchestration_step WHERE run_id=?',`${length('task_id')}+${length('state')}`);
  for (const table of ['orchestration_plan','requirement_contract_binding','orchestration_retry_contract','attempt_selection','integration_budget_reservation','integration_budget_receipt','local_invocation_budget','local_invocation_reservation','acceptance_evaluation','acceptance_final']) add(`${table} WHERE run_id=?`,length('payload'));
  add('orchestration_attempt WHERE run_id=?',`${length('claim_payload')}+${length('worktree_realpath')}`);
  for (const table of ['orchestration_receipt','orchestration_activity','orchestration_retry_link']) add(`${table} x JOIN orchestration_attempt a ON a.attempt_id=x.attempt_id WHERE a.run_id=?`,length('x.payload'));
  add('orchestration_stage_envelope WHERE workflow_run_id=?',['parent_json','stage_json','scope_json','request_json'].map(length).join('+'));
  add('generated_output_target WHERE run_id=?',`${length('payload')}+${length('input_bytes')}`);
  add('generated_output_observation WHERE run_id=?',`${length('payload')}+${length('bytes')}`);
  for (const prefix of ['', 'local_']) add(`${prefix}selection_policy_snapshot s JOIN ${prefix}selection_run_policy b ON b.policy_id=s.policy_id AND b.revision=s.revision WHERE b.run_id=?`,length('s.policy_json'));
  add('envelope e JOIN run r ON r.envelope_hash=e.envelope_hash JOIN run parent ON parent.id=? WHERE r.id=parent.id OR r.id IN (SELECT attempt_id FROM orchestration_attempt WHERE run_id=parent.id)',`${length('e.worktree_realpath')}+${length('e.egress_json')}`);
  add('integration_budget WHERE run_id=?',`${length('source')}+${length('currency')}+${length('policy_revision')}`);
  // Invalid JSON fails closed. Counting repeated blob references also bounds
  // repeated strict-reader materialization, not merely distinct blob storage.
  add("acceptance_evaluation e JOIN json_each(e.payload,'$.observations') o LEFT JOIN acceptance_blob b ON b.sha256=json_extract(o.value,'$.sha256') WHERE e.run_id=?",length('b.bytes'));
}

/** Host-only historical observation. Not an EvaluationTrial or a measurement of
 * numeric quality, latency, real provider calls or current execution authority.
 * Reject outer transactions so uncommitted writer state cannot escape as data. */
export function readRunOutcome(db: Ledger, input: { runId: string }) {
  const runId = id(exact(input,['runId']).runId);
  if (!db.open || db.inTransaction) throw Error('outcome_read_boundary');
  return db.transaction(() => {
    const row = db.prepare(`SELECT r.task_id,r.envelope_hash,r.write_in_progress,t.state,
      CASE WHEN t.blocked_reason='cancelled' THEN 1 ELSE 0 END cancel_requested
      FROM run r LEFT JOIN task t ON t.id=r.task_id WHERE r.id=?`).get(runId) as any;
    if (!row) return null;
    try {
      preflight(db,runId);
      const uncertainty = new Set<string>();
      const policy = readRunPolicyIdentity(db,runId);
      if (!policy) throw Error('policy');
      const p = db.prepare('SELECT payload,digest,envelope_hash FROM orchestration_plan WHERE run_id=?').get(runId) as any;
      if (!p) throw Error('plan');
      const raw = JSON.parse(p.payload), plan = validateTaskPlan(raw.approval,{revision:raw.revision,policyRevision:raw.approval.policyRevision,policyDigest:raw.approval.policyDigest,tasks:raw.tasks});
      if (plan.digest !== p.digest || p.payload !== JSON.stringify(plan) || p.envelope_hash !== row.envelope_hash || policy.digest !== plan.approval.policyDigest || `${policy.policyId}:${policy.revision}` !== plan.approval.policyRevision) throw Error('lineage');
      if (!['queued','awaiting_approval','running','completed','failed','blocked'].includes(row.state) || ![0,1].includes(row.write_in_progress)) throw Error('state');
      const decisions = createAttemptDecisionStore(db);
      const attempts = (db.prepare('SELECT attempt_id,task_id,candidate_id,state,cleanup_verified FROM orchestration_attempt WHERE run_id=? ORDER BY attempt_id').all(runId) as any[]).map(a => {
        const task = plan.tasks.find(t => t.id===a.task_id);
        if (!task || !task.candidateIds.includes(a.candidate_id) || !['running','completed','failed','blocked'].includes(a.state) || ![0,1].includes(a.cleanup_verified)) throw Error('attempt');
        let selection: {status:string;digest:string|null};
        try { const saved=decisions.read(a.attempt_id); selection={status:saved.availability,digest:saved.snapshot?.digest??null}; }
        catch { selection={status:'invalid-or-missing',digest:null}; }
        if(selection.status!=='recorded') uncertainty.add('selection-history-unavailable');
        return {attemptId:id(a.attempt_id),taskId:publicPlanId(a.task_id),taskIdDigest:digest(a.task_id),candidateId:publicPlanId(a.candidate_id),candidateIdDigest:digest(a.candidate_id),role:task.role,state:a.state as string,
          cleanup:a.cleanup_verified===1?'verified-clean' as const:'unknown' as const,selection,toolRevision:null,modelRevision:null};
      });
      if(attempts.some(a=>a.cleanup==='unknown') || row.write_in_progress===1) uncertainty.add('cleanup-unresolved');
      const history=readAcceptanceHistory(db,runId);
      if(history?.receipt && (row.state!=='completed' || row.cancel_requested===1)) throw Error('contradictory-acceptance');
      const outcome = history?.receipt ? 'success' as const : row.cancel_requested===1 ? 'cancelled' as const : row.state==='failed' ? 'fail' as const : 'unknown' as const;
      const outcomeBasis=history?.receipt?'historical-acceptance':row.cancel_requested===1?'stored-cancel-request':row.state==='failed'?'stored-task-failure':'insufficient-terminal-evidence';
      if(!history?.receipt) uncertainty.add('verified-acceptance-absent');
      if(outcome==='cancelled' && uncertainty.has('cleanup-unresolved')) uncertainty.add('cancellation-not-clean');
      const accounting = collectAccounting(db,runId,policy.kind,plan.approval.policyRevision,attempts.map(a=>a.attemptId));
      if(accounting.kind==='monetary' && !accounting.final) uncertainty.add('billing-unresolved');
      if(accounting.kind==='unknown') uncertainty.add('accounting-unavailable');
      const value={status:'recorded' as const,version:'cue-run-outcome-v1' as const,runId,authority:'evaluation-input-only' as const,
        sourceHashScope:'safe-column-projection' as const,observedTaskState:row.state as string,outcome,outcomeBasis,
        uncertaintyReasons:[...uncertainty].sort(),policy:{kind:policy.kind,id:publicPlanId(policy.policyId),idDigest:digest(policy.policyId),revision:policy.revision,digest:policy.digest,mode:policy.snapshot.policy.mode},
        planDigest:plan.digest,envelopeHash:row.envelope_hash as string,attempts,
        acceptanceRef:history?{evaluationId:history.evaluationId,verdict:history.verdict,accepted:!!history.receipt,acceptedAt:history.receipt?.acceptedAt??null}:null,
        accounting,quality:null,elapsedMs:null,trialReadiness:{status:'not-convertible' as const,reasons:['cohort-not-enrolled','unmeasured-quality-time','unbound-environment-revisions','unverified-cost-breakdown']}};
      if(Buffer.byteLength(JSON.stringify(value))>OUTPUT_BYTES) throw Error('coverage-limit');
      return freeze({...value,sourceDigest:digest(value)});
    } catch(error) {
      return Object.freeze({status:'unavailable' as const,runId,authority:'evaluation-input-only' as const,reason:error instanceof Error && error.message==='coverage-limit'?'coverage-limit':'stored-evidence-unavailable'});
    }
  })();
}

function collectAccounting(db: Ledger,runId:string,kind:'monetary'|'local-invocation',policyRevision:string,attemptIds:string[]) {
  const money=db.prepare('SELECT currency,unit,policy_revision FROM integration_budget WHERE run_id=?').get(runId) as any;
  const local=db.prepare('SELECT 1 FROM local_invocation_budget WHERE run_id=?').get(runId);
  if(money&&local || money&&kind!=='monetary' || local&&kind!=='local-invocation') throw Error('accounting-conflict');
  if(local){const s=createLocalInvocationBudget(db).summary(runId);if(s.policyRevision!==policyRevision)throw Error('accounting-policy');
    const authoritative=createAuthoritativeAccountingStore(db).captureCurrent(runId);if(authoritative.kind!=='local-invocation'||!authoritative.localCount)throw Error('accounting-authority');
    return {kind:'local-invocation' as const,limit:s.limit,committed:s.committed,remaining:s.remaining,semantics:'committed-dispatch-intent' as const,providerBilling:'not-measured' as const};}
  if(!money)return {kind:'unknown' as const};
  if(money.policy_revision!==policyRevision || !['minor','micro'].includes(money.unit))throw Error('accounting-policy');id(money.currency);
  const reservations=db.prepare('SELECT request_id,attempt_id,upper_units,payload FROM integration_budget_reservation WHERE run_id=? ORDER BY request_id').all(runId) as any[];
  const receipts=db.prepare('SELECT request_id,receipt_id,revision,kind,units,provider_final,payload FROM integration_budget_receipt WHERE run_id=? ORDER BY request_id,revision').all(runId) as any[];
  for(const r of reservations){const p=exact(JSON.parse(r.payload),['runId','requestId','attemptId','currency','unit','upperUnits','source','observedAtMs','scope']);integer(p.observedAtMs);integer(r.upper_units);if(p.scope!=='verified-completion-attempt-total'||typeof p.source!=='string'||p.source.length>256||p.runId!==runId||p.requestId!==r.request_id||p.attemptId!==r.attempt_id||p.upperUnits!==r.upper_units||p.currency!==money.currency||p.unit!==money.unit||!attemptIds.includes(r.attempt_id))throw Error('reservation');}
  for(const r of receipts){const p=exact(JSON.parse(r.payload),['runId','requestId','receiptId','revision','currency','unit','kind','units','providerFinal','source','observedAtMs']);integer(p.observedAtMs);integer(r.revision);if(r.units!==null)integer(r.units);
    const previous=receipts.filter(x=>x.request_id===r.request_id&&x.revision<r.revision).at(-1);
    if(r.revision<1||typeof p.source!=='string'||p.source.length>256||previous&&(previous.provider_final===1&&r.provider_final!==1||previous.kind==='actual'&&r.kind!=='actual'))throw Error('receipt-regression');
    if(!reservations.some(s=>s.request_id===r.request_id)||p.runId!==runId||p.requestId!==r.request_id||p.receiptId!==r.receipt_id||p.revision!==r.revision||p.kind!==r.kind||p.units!==r.units||Number(p.providerFinal)!==r.provider_final||typeof p.providerFinal!=='boolean'||p.currency!==money.currency||p.unit!==money.unit||!['actual','estimated','unknown'].includes(r.kind)||![0,1].includes(r.provider_final)||r.kind==='unknown'&&(r.units!==null||r.provider_final!==0)||r.kind!=='unknown'&&r.units===null||r.provider_final===1&&r.kind!=='actual')throw Error('receipt');}
  const latest=reservations.map(r=>receipts.filter(x=>x.request_id===r.request_id).at(-1));
  const authoritative=createAuthoritativeAccountingStore(db).captureCurrent(runId);
  if(authoritative.kind!=='monetary'||authoritative.currency!==money.currency||authoritative.unit!==money.unit||authoritative.items.length!==reservations.length)throw Error('accounting-authority');
  const coveredAttempts=new Set(authoritative.items.map(item=>item.attemptId));
  const final=authoritative.items.length>0&&attemptIds.every(attemptId=>coveredAttempts.has(attemptId))&&authoritative.items.every(item=>item.latestAtCutoff?.kind==='actual'&&item.latestAtCutoff.providerFinal);
  const classified=final&&authoritative.items.every(item=>item.costClass!=='unclassified');
  const classUnits=(costClass:'base'|'retry'|'verification')=>classified?authoritative.items.reduce((sum,item)=>sum+(item.costClass===costClass?BigInt(item.latestAtCutoff!.units!):0n),0n).toString():null;
  return {kind:'monetary' as const,currency:money.currency as string,unit:money.unit as 'minor'|'micro',final,
    actualUnits:latest.some(r=>r?.kind==='actual')?authoritative.actualUnits:null,committedUnits:authoritative.committedUnits!,remainingUnits:authoritative.remainingUnits!,debtUnits:authoritative.debtUnits!,
    receipts:receipts.map(r=>({receiptId:id(r.receipt_id),requestId:id(r.request_id),revision:r.revision as number,kind:r.kind as string,units:r.units as number|null,providerFinal:r.provider_final===1})),
    breakdown:{baseUnits:classUnits('base'),retryUnits:classUnits('retry'),handoffUnits:null,verificationUnits:classUnits('verification')}};
}
