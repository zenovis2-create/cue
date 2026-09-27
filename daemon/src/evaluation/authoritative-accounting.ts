import { createHash } from 'node:crypto';
import type { Ledger } from '../ledger.js';
import { validateTaskPlan, type ValidatedPlan } from '../orchestration/plan.js';

export type AccountingCutoff = Readonly<{ schema: 'cue-accounting-cutoff-v1'; runId: string; reservationRowid: number; receiptRowid: number;
  localRowid: number; attemptRowid: number; retryRowid: number; attemptRevisionRowid: number; planRevisionRowid: number; digest: string }>;
export type AccountingCostClass = 'base' | 'retry' | 'verification' | 'unclassified';
export type AccountingItem = Readonly<{ requestId: string; attemptId: string; taskId: string; revision: number | null; role: string;
  retryOf: string | null; costClass: AccountingCostClass; upperUnits: number | null; latestAtCutoff: Readonly<{ receiptId: string;
  revision: number; kind: 'actual' | 'estimated' | 'unknown'; units: number | null; providerFinal: boolean; payloadDigest: string }> | null }>;
export type HistoricalAccountingSnapshot = Readonly<{ version: 'cue-authoritative-accounting-snapshot-v1'; runId: string; cutoff: AccountingCutoff;
  kind: 'monetary' | 'local-invocation' | 'unknown'; currency: string | null; unit: string | null; items: readonly AccountingItem[];
  committedUnits: string | null; actualUnits: string | null; totalUnits: string | null; remainingUnits: string | null; debtUnits: string | null;
  localCount: Readonly<{limit:string;committed:string;remaining:string}> | null; completeAtCutoff: boolean;
  unknownReasons: readonly string[]; digest: string }>;
export type AccountingProjection = Readonly<{ historical: HistoricalAccountingSnapshot; currentDisclosure: readonly Readonly<{
  requestId: string; currentLatestRevision: number | null; newerThanCutoff: boolean }>[] }>;
export type HandoffCostCoverage = Readonly<{ version:'cue-handoff-cost-coverage-v1'; accountingDigest:string;
  dispositions:readonly Readonly<{attemptId:string;handoffDigest:string;billability:'unknown'}>[];
  complete:boolean;unknownReasons:readonly string[];digest:string }>;

type Maxima = Omit<AccountingCutoff, 'schema' | 'runId' | 'digest'>;
type MonetaryRow = { rowid: number; request_id: string; attempt_id: string; upper_units: number; payload: string; task_id: string };
type ReceiptRow = { rowid: number; request_id: string; receipt_id: string; revision: number; kind: 'actual'|'estimated'|'unknown'; units: number|null; provider_final: number; payload: string };
type LocalRow = { rowid: number; request_id: string; attempt_id: string; run_id: string; task_id: string; candidate_id: string; kind: 'producer'|'checker'; payload: string; digest: string };
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const canonical = (value: unknown) => JSON.stringify(value);
function fail(why: string): never { throw Error('authoritative_accounting_' + why); }
const id = (value: unknown): string => { if (typeof value !== 'string') fail('invalid_id'); if (Buffer.byteLength(value) > 128 || !value.length) fail('invalid_id'); return value; };
const safe = (value: unknown): number => { if (!Number.isSafeInteger(value) || (value as number) < 0) fail('unsafe_integer'); return value as number; };
const parsed = (payload: unknown, max = 1_048_576): Record<string, unknown> => {
  if (typeof payload !== 'string') fail('payload_limit');
  if (Buffer.byteLength(payload) > max) fail('payload_limit');
  let value: unknown; try { value = JSON.parse(payload); } catch { fail('payload_mismatch'); }
  if (!value || typeof value !== 'object' || Array.isArray(value) || canonical(value) !== payload) fail('payload_mismatch');
  return value as Record<string, unknown>;
};
const max = (db: Ledger, table: string): number => safe((db.prepare(`SELECT coalesce(MAX(rowid),0) n FROM ${table}`).get() as {n:number}).n);
const maxima = (db: Ledger): Maxima => ({ reservationRowid:max(db,'integration_budget_reservation'), receiptRowid:max(db,'integration_budget_receipt'),
  localRowid:max(db,'local_invocation_reservation'), attemptRowid:max(db,'orchestration_attempt'), retryRowid:max(db,'orchestration_retry_link'),
  attemptRevisionRowid:max(db,'orchestration_attempt_revision'), planRevisionRowid:max(db,'orchestration_plan_revision') });
function bounded(db:Ledger,countSql:string,params:unknown[],payloadSql?:string):void{
  const n=safe((db.prepare(countSql).get(...params) as {n:number}).n);if(n>4096)fail('inventory_limit');
  if(payloadSql){const bytes=(db.prepare(payloadSql).get(...params) as {bytes:number|null}).bytes;if(bytes!==null&&safe(bytes)>1_048_576)fail('payload_limit');}
}
function dependencies(db:Ledger,runId:string,c:Maxima):unknown{
  bounded(db,'SELECT count(*) n FROM orchestration_attempt WHERE run_id=? AND rowid<=?',[runId,c.attemptRowid],'SELECT max(length(claim_payload)) bytes FROM orchestration_attempt WHERE run_id=? AND rowid<=?');
  const byteGate=(sql:string,params:unknown[],limit=1_048_576)=>{const row=db.prepare(sql).get(...params) as {bytes:number|null}|undefined,bytes=row?.bytes??null;if(bytes!==null&&safe(bytes)>limit)fail('payload_limit');};
  byteGate('SELECT length(payload) bytes FROM orchestration_plan WHERE run_id=?',[runId]);
  byteGate('SELECT length(payload) bytes FROM local_invocation_budget WHERE run_id=?',[runId],4096);
  byteGate(`SELECT max(length(l.payload)) bytes FROM orchestration_retry_link l JOIN orchestration_attempt a ON a.attempt_id=l.attempt_id WHERE a.run_id=? AND l.rowid<=?`,[runId,c.retryRowid]);
  byteGate('SELECT length(payload) bytes FROM orchestration_retry_contract WHERE run_id=?',[runId]);
  byteGate(`SELECT max(length(o.payload)) bytes FROM orchestration_receipt o JOIN orchestration_retry_link l ON l.receipt_id=o.receipt_id JOIN orchestration_attempt a ON a.attempt_id=l.attempt_id WHERE a.run_id=? AND l.rowid<=?`,[runId,c.retryRowid]);
  byteGate('SELECT max(length(payload)) bytes FROM orchestration_plan_revision WHERE run_id=? AND rowid<=?',[runId,c.planRevisionRowid]);
  byteGate(`SELECT max(length(s.payload)) bytes FROM orchestration_revision_step s JOIN orchestration_plan_revision p ON p.run_id=s.run_id AND p.revision=s.revision WHERE s.run_id=? AND p.rowid<=?`,[runId,c.planRevisionRowid],262144);
  const plan=db.prepare('SELECT envelope_hash,digest,payload FROM orchestration_plan WHERE run_id=?').get(runId) as Record<string,unknown>|undefined;
  const budget=db.prepare('SELECT * FROM integration_budget WHERE run_id=?').get(runId) as Record<string,unknown>|undefined;
  const localBudget=db.prepare('SELECT * FROM local_invocation_budget WHERE run_id=?').get(runId) as Record<string,unknown>|undefined;
  const attempts=db.prepare('SELECT rowid,* FROM orchestration_attempt WHERE run_id=? AND rowid<=? ORDER BY rowid LIMIT 4097').all(runId,c.attemptRowid) as Record<string,unknown>[];
  const retries=db.prepare(`SELECT l.rowid,l.* FROM orchestration_retry_link l JOIN orchestration_attempt a ON a.attempt_id=l.attempt_id
    WHERE a.run_id=? AND l.rowid<=? ORDER BY l.rowid LIMIT 4097`).all(runId,c.retryRowid) as Record<string,unknown>[];
  const retryContract=db.prepare('SELECT * FROM orchestration_retry_contract WHERE run_id=?').get(runId) as Record<string,unknown>|undefined;
  const retryReceipts=db.prepare(`SELECT o.* FROM orchestration_receipt o JOIN orchestration_retry_link l ON l.receipt_id=o.receipt_id
    JOIN orchestration_attempt a ON a.attempt_id=l.attempt_id WHERE a.run_id=? AND l.rowid<=? ORDER BY o.receipt_id LIMIT 4097`).all(runId,c.retryRowid) as Record<string,unknown>[];
  const attemptRevisions=db.prepare(`SELECT ar.rowid,ar.* FROM orchestration_attempt_revision ar JOIN orchestration_attempt a ON a.attempt_id=ar.attempt_id
    WHERE a.run_id=? AND ar.rowid<=? ORDER BY ar.rowid LIMIT 4097`).all(runId,c.attemptRevisionRowid) as Record<string,unknown>[];
  const revisionPlans=db.prepare('SELECT rowid,* FROM orchestration_plan_revision WHERE run_id=? AND rowid<=? ORDER BY rowid LIMIT 4097').all(runId,c.planRevisionRowid) as Record<string,unknown>[];
  const revisionSteps=db.prepare(`SELECT s.* FROM orchestration_revision_step s JOIN orchestration_plan_revision p ON p.run_id=s.run_id AND p.revision=s.revision
    WHERE s.run_id=? AND p.rowid<=? ORDER BY s.revision,s.task_id LIMIT 4097`).all(runId,c.planRevisionRowid) as Record<string,unknown>[];
  for(const rows of [attempts,retries,retryReceipts,attemptRevisions,revisionPlans,revisionSteps])if(rows.length>4096)fail('inventory_limit');
  const normalized=(rows:Record<string,unknown>[])=>rows.map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,Buffer.isBuffer(v)?Buffer.from(v).toString('base64'):v])));
  return {plan,budget,localBudget,attempts:normalized(attempts),retries:normalized(retries),retryContract,retryReceipts:normalized(retryReceipts),attemptRevisions:normalized(attemptRevisions),revisionPlans:normalized(revisionPlans),revisionSteps:normalized(revisionSteps)};
}

function originalRole(db: Ledger, runId: string, taskId: string): string {
  const row=db.prepare('SELECT payload,digest FROM orchestration_plan WHERE run_id=?').get(runId) as {payload:string;digest:string}|undefined;
  if(!row)fail('plan_lineage'); if(Buffer.byteLength(row.payload)>1_048_576)fail('plan_lineage');
  let raw:ValidatedPlan; try { raw=JSON.parse(row.payload) as ValidatedPlan; } catch { fail('plan_lineage'); }
  const saved=validateTaskPlan(raw.approval,{revision:raw.revision,policyRevision:raw.approval.policyRevision,policyDigest:raw.approval.policyDigest,tasks:raw.tasks});
  if(canonical(saved)!==row.payload||saved.digest!==row.digest)fail('plan_lineage');
  const task=saved.tasks.find(candidate=>candidate.id===taskId); if(!task)fail('plan_lineage'); return task.role;
}
function roleAndClass(db:Ledger, runId:string, attemptId:string, taskId:string, c:AccountingCutoff): Pick<AccountingItem,'role'|'retryOf'|'costClass'|'revision'> {
  const attempt=db.prepare('SELECT rowid,run_id,task_id FROM orchestration_attempt WHERE attempt_id=?').get(attemptId) as {rowid:number;run_id:string;task_id:string}|undefined;
  if(!attempt||attempt.run_id!==runId||attempt.task_id!==taskId||safe(attempt.rowid)>c.attemptRowid)fail('attempt_lineage');
  const ar=db.prepare('SELECT rowid,revision FROM orchestration_attempt_revision WHERE attempt_id=?').get(attemptId) as {rowid:number;revision:number}|undefined;
  const link=db.prepare('SELECT rowid,previous_attempt_id,receipt_id,contract_digest,payload FROM orchestration_retry_link WHERE attempt_id=?').get(attemptId) as {rowid:number;previous_attempt_id:string;receipt_id:string;contract_digest:string;payload:string}|undefined;
  let retryOf:string|null=null;
  if(link&&safe(link.rowid)<=c.retryRowid){ retryOf=id(link.previous_attempt_id);id(link.receipt_id);const contract=db.prepare('SELECT payload,digest FROM orchestration_retry_contract WHERE run_id=?').get(runId) as {payload:string;digest:string}|undefined;
    if(!contract||contract.digest!==link.contract_digest||sha(contract.payload)!==contract.digest)fail('retry_contract');const contractBody=parsed(contract.payload);
    if(contractBody.runId!==runId||contractBody.schemaVersion!=='cue-retry-v1')fail('retry_contract');
    const body=parsed(link.payload),request=body.request as Record<string,unknown>|undefined;
    if(!request||request.previousAttemptId!==retryOf||request.receiptId!==link.receipt_id||request.contractDigest!==link.contract_digest)fail('retry_lineage');
    const authority=db.prepare('SELECT attempt_id,payload FROM orchestration_receipt WHERE receipt_id=?').get(link.receipt_id) as {attempt_id:string;payload:string}|undefined;
    if(!authority||authority.attempt_id!==retryOf)fail('retry_lineage');const receipt=parsed(authority.payload);
    if(receipt.runId!==runId||receipt.taskId!==taskId||receipt.attemptId!==retryOf||receipt.outcome!=='failed'||receipt.cleanup!=='clean')fail('retry_lineage');
    let cursor=retryOf;const seen=new Set([attemptId]);
    for(let depth=0;depth<=4096;depth++){if(seen.has(cursor))fail('retry_lineage');seen.add(cursor);
      const prior=db.prepare('SELECT run_id FROM orchestration_attempt WHERE attempt_id=?').get(cursor) as {run_id:string}|undefined;if(!prior||prior.run_id!==runId)fail('retry_lineage');
      const priorLink=db.prepare('SELECT rowid,previous_attempt_id FROM orchestration_retry_link WHERE attempt_id=?').get(cursor) as {rowid:number;previous_attempt_id:string}|undefined;
      if(!priorLink||safe(priorLink.rowid)>c.retryRowid)break;cursor=id(priorLink.previous_attempt_id);if(depth===4096)fail('retry_lineage');} }
  if(ar){
    if(safe(ar.rowid)>c.attemptRevisionRowid)return {role:'lineage-unavailable:s4-revision-unverified',retryOf,costClass:'unclassified',revision:null};
    return {role:'lineage-unavailable:s4-revision-unverified',retryOf,costClass:'unclassified',revision:safe(ar.revision)};
  }
  const role=originalRole(db,runId,taskId);
  return {role,retryOf,costClass:retryOf?'retry':role==='verifier'?'verification':(['implementation','model-producer'].includes(role)?'base':'unclassified'),revision:null};
}
function cutoffDigest(runId:string,m:Maxima,inventory:unknown):string{return sha(canonical({schema:'cue-accounting-cutoff-v1',runId,...m,inventory}));}

export function createAuthoritativeAccountingStore(db: Ledger) {
  function build(runId:string, supplied?:AccountingCutoff):HistoricalAccountingSnapshot {
    id(runId); const kinds=db.prepare(`SELECT (SELECT count(*) FROM integration_budget WHERE run_id=?) monetary,
      (SELECT count(*) FROM local_invocation_budget WHERE run_id=?) local`).get(runId,runId) as {monetary:number;local:number};
    if(kinds.monetary+kinds.local>1)fail('mixed_budget');
    const current=maxima(db), m:Maxima=supplied?{reservationRowid:safe(supplied.reservationRowid),receiptRowid:safe(supplied.receiptRowid),localRowid:safe(supplied.localRowid),
      attemptRowid:safe(supplied.attemptRowid),retryRowid:safe(supplied.retryRowid),attemptRevisionRowid:safe(supplied.attemptRevisionRowid),planRevisionRowid:safe(supplied.planRevisionRowid)}:current;
    if(supplied&&(supplied.schema!=='cue-accounting-cutoff-v1'||supplied.runId!==runId||Object.keys(m).some(k=>m[k as keyof Maxima]>current[k as keyof Maxima])))fail('invalid_cutoff');
    bounded(db,'SELECT count(*) n FROM integration_budget_reservation WHERE run_id=? AND rowid<=?',[runId,m.reservationRowid],'SELECT max(length(payload)) bytes FROM integration_budget_reservation WHERE run_id=? AND rowid<=?');
    bounded(db,'SELECT count(*) n FROM integration_budget_receipt WHERE run_id=? AND rowid<=?',[runId,m.receiptRowid],'SELECT max(length(payload)) bytes FROM integration_budget_receipt WHERE run_id=? AND rowid<=?');
    bounded(db,'SELECT count(*) n FROM local_invocation_reservation WHERE run_id=? AND rowid<=?',[runId,m.localRowid],'SELECT max(length(payload)) bytes FROM local_invocation_reservation WHERE run_id=? AND rowid<=?');
    const monetary=db.prepare(`SELECT r.rowid,r.request_id,r.attempt_id,r.upper_units,r.payload,a.task_id FROM integration_budget_reservation r
      JOIN orchestration_attempt a ON a.attempt_id=r.attempt_id AND a.run_id=r.run_id WHERE r.run_id=? AND r.rowid<=? ORDER BY r.request_id LIMIT 4097`).all(runId,m.reservationRowid) as MonetaryRow[];
    const receipts=db.prepare('SELECT rowid,request_id,receipt_id,revision,kind,units,provider_final,payload FROM integration_budget_receipt WHERE run_id=? AND rowid<=? ORDER BY request_id,revision,rowid LIMIT 4097').all(runId,m.receiptRowid) as ReceiptRow[];
    const local=db.prepare(`SELECT l.rowid,l.* FROM local_invocation_reservation l JOIN orchestration_attempt a ON a.attempt_id=l.attempt_id AND a.run_id=l.run_id
      AND a.task_id=l.task_id AND a.candidate_id=l.candidate_id WHERE l.run_id=? AND l.rowid<=? ORDER BY l.request_id LIMIT 4097`).all(runId,m.localRowid) as LocalRow[];
    const rawMonetary=(db.prepare('SELECT count(*) n FROM integration_budget_reservation WHERE run_id=? AND rowid<=?').get(runId,m.reservationRowid) as {n:number}).n;
    const rawLocal=(db.prepare('SELECT count(*) n FROM local_invocation_reservation WHERE run_id=? AND rowid<=?').get(runId,m.localRowid) as {n:number}).n;
    if(rawMonetary!==monetary.length||rawLocal!==local.length)fail('orphan_attempt');
    if(monetary.length>4096||receipts.length>4096||local.length>4096)fail('inventory_limit');
    const inventory={monetary:monetary.map(r=>[r.rowid,r.request_id,r.attempt_id,r.upper_units,sha(r.payload)]),receipts:receipts.map(r=>[r.rowid,r.request_id,r.receipt_id,r.revision,sha(r.payload)]),
      local:local.map(r=>[r.rowid,r.request_id,r.attempt_id,sha(r.payload),r.digest]),dependencies:dependencies(db,runId,m)};
    const digest=cutoffDigest(runId,m,inventory); if(supplied&&supplied.digest!==digest)fail('cutoff_integrity');
    const cutoff=Object.freeze({schema:'cue-accounting-cutoff-v1' as const,runId,...m,digest});
    let kind:'monetary'|'local-invocation'|'unknown'=kinds.monetary?'monetary':kinds.local?'local-invocation':'unknown';
    let currency:string|null=null,unit:string|null=null,committed:bigint|null=null,actual:bigint|null=null,total:bigint|null=null,remaining:bigint|null=null,debt:bigint|null=null;
    let localCount:Readonly<{limit:string;committed:string;remaining:string}>|null=null;
    const reasons=new Set<string>(), items:AccountingItem[]=[];
    if(kind==='monetary'){
      const policy=db.prepare('SELECT * FROM integration_budget WHERE run_id=?').get(runId) as {run_id:string;currency:string;unit:string;limit_units:number;policy_revision:string;source:string;observed_at_ms:number};
      if(policy.run_id!==runId||!['minor','micro'].includes(policy.unit))fail('budget_policy');currency=id(policy.currency);unit=policy.unit;safe(policy.limit_units);id(policy.policy_revision);id(policy.source);safe(policy.observed_at_ms);committed=0n;actual=0n;
      const requestIds=new Set(monetary.map(r=>r.request_id)); if(receipts.some(r=>!requestIds.has(r.request_id)))fail('orphan_receipt');
      for(const r of monetary){ id(r.request_id);id(r.attempt_id);safe(r.upper_units);const p=parsed(r.payload);
        if(p.runId!==runId||p.requestId!==r.request_id||p.attemptId!==r.attempt_id||p.upperUnits!==r.upper_units||p.currency!==currency||p.unit!==unit)fail('reservation_payload');
        const all=receipts.filter(x=>x.request_id===r.request_id); for(const x of all){safe(x.rowid);safe(x.revision);id(x.receipt_id);if(!['actual','estimated','unknown'].includes(x.kind)||![0,1].includes(x.provider_final))fail('receipt_scalar');
          if(x.kind==='unknown'?(x.units!==null||x.provider_final!==0):(x.units===null||x.provider_final===1&&x.kind!=='actual'))fail('receipt_scalar');if(x.units!==null)safe(x.units);const q=parsed(x.payload);
          if(q.runId!==runId||q.requestId!==x.request_id||q.receiptId!==x.receipt_id||q.revision!==x.revision||q.kind!==x.kind||q.units!==x.units||q.providerFinal!==(x.provider_final===1)||q.currency!==currency||q.unit!==unit)fail('receipt_payload');}
        const latest=all.reduce<ReceiptRow|undefined>((a,x)=>!a||x.revision>a.revision||(x.revision===a.revision&&x.rowid>a.rowid)?x:a,undefined);
        if(latest&&all.filter(x=>x.revision===latest.revision).length!==1)fail('duplicate_latest');
        const maxObserved=all.reduce((n,x)=>x.units!==null&&BigInt(x.units)>n?BigInt(x.units):n,0n), upper=BigInt(r.upper_units);
        if(latest?.kind==='actual')actual!+=BigInt(latest.units!); committed!+=latest?.kind==='actual'&&latest.provider_final===1?BigInt(latest.units!):(maxObserved>upper?maxObserved:upper);
        if(!latest)reasons.add('missing-receipt'); else if(latest.kind!=='actual')reasons.add('non-actual-receipt'); else if(latest.provider_final!==1)reasons.add('non-final-receipt');
        const lineage=roleAndClass(db,runId,r.attempt_id,r.task_id,cutoff);if(lineage.costClass==='unclassified')reasons.add(lineage.role);
        items.push(Object.freeze({requestId:r.request_id,attemptId:r.attempt_id,taskId:r.task_id,...lineage,upperUnits:r.upper_units,latestAtCutoff:latest?Object.freeze({receiptId:latest.receipt_id,
          revision:latest.revision,kind:latest.kind,units:latest.units,providerFinal:latest.provider_final===1,payloadDigest:sha(latest.payload)}):null}));
      } const limit=BigInt(policy.limit_units),used=committed!;remaining=limit>used?limit-used:0n;debt=used>limit?used-limit:0n;if(debt>0n)reasons.add('budget-debt');total=reasons.size===0?actual:null;
    } else if(kind==='local-invocation'){
      const policy=db.prepare('SELECT limit_count,payload,digest FROM local_invocation_budget WHERE run_id=?').get(runId) as {limit_count:number;payload:string;digest:string};safe(policy.limit_count);
      const p=parsed(policy.payload,4096);if(p.runId!==runId||p.limit!==policy.limit_count||sha('cue-local-invocation-v1\n'+policy.payload)!==policy.digest)fail('local_policy');
      if(local.length>policy.limit_count)fail('local_over_limit');committed=null;actual=null;total=null;
      for(const r of local){const p=parsed(r.payload,4096);if(p.runId!==runId||p.requestId!==r.request_id||p.attemptId!==r.attempt_id||p.taskId!==r.task_id||p.candidateId!==r.candidate_id||p.kind!==r.kind||sha('cue-local-invocation-v1\n'+r.payload)!==r.digest)fail('local_reservation');
        const lineage=roleAndClass(db,runId,r.attempt_id,r.task_id,cutoff);if(lineage.costClass==='unclassified')reasons.add(lineage.role);
        items.push(Object.freeze({requestId:r.request_id,attemptId:r.attempt_id,taskId:r.task_id,...lineage,upperUnits:null,latestAtCutoff:null}));}
      localCount=Object.freeze({limit:String(policy.limit_count),committed:String(local.length),remaining:String(policy.limit_count-local.length)});
    } else reasons.add('budget-missing');
    items.sort((a,b)=>a.requestId.localeCompare(b.requestId));const unknownReasons=Object.freeze([...reasons].sort());
    const body={version:'cue-authoritative-accounting-snapshot-v1' as const,runId,cutoff,kind,currency,unit,items:Object.freeze(items),committedUnits:committed?.toString()??null,
      actualUnits:actual?.toString()??null,totalUnits:total?.toString()??null,remainingUnits:remaining?.toString()??null,debtUnits:debt?.toString()??null,localCount,completeAtCutoff:reasons.size===0,unknownReasons};
    const encoded=canonical(body);if(Buffer.byteLength(encoded)>2_097_152)fail('output_limit');return Object.freeze({...body,digest:sha(encoded)});
  }
  return Object.freeze({
    captureCurrent(runId:string):HistoricalAccountingSnapshot{return db.transaction(()=>build(runId))();},
    inspectHandoffCostCoverage(snapshot:HistoricalAccountingSnapshot):HandoffCostCoverage{
      if(!snapshot||typeof snapshot!=='object'||snapshot.version!=='cue-authoritative-accounting-snapshot-v1')fail('coverage_input');
      const historical=db.transaction(()=>build(id(snapshot.runId),snapshot.cutoff))();if(canonical(historical)!==canonical(snapshot))fail('coverage_input');
      if(historical.items.length>4096)fail('inventory_limit');const dispositions:Readonly<{attemptId:string;handoffDigest:string;billability:'unknown'}>[]=[];
      const reasons:string[]=[];
      for(const item of historical.items){
        const attempt=db.prepare('SELECT state FROM orchestration_attempt WHERE attempt_id=? AND run_id=?').get(item.attemptId,historical.runId) as {state:string}|undefined;
        if(!attempt)fail('attempt_lineage');
        const rows=db.prepare('SELECT h.attempt_id,h.receipt_id,h.payload_sha256,h.payload,r.attempt_id receipt_attempt FROM orchestration_handoff h JOIN orchestration_receipt r ON r.receipt_id=h.receipt_id WHERE h.attempt_id=? ORDER BY h.handoff_id LIMIT 2').all(item.attemptId) as {attempt_id:string;receipt_id:string;payload_sha256:string;payload:Buffer;receipt_attempt:string}[];
        if(rows.length>1)fail('handoff_lineage');
        if(rows.length===0){if(['completed','failed'].includes(attempt.state))reasons.push(`handoff-lineage-unavailable:${item.attemptId}`);continue;}
        const row=rows[0],payload=Buffer.isBuffer(row.payload)?row.payload:Buffer.from(row.payload);id(row.receipt_id);
        if(row.attempt_id!==item.attemptId||row.receipt_attempt!==item.attemptId||typeof row.payload_sha256!=='string'||sha(payload)!==row.payload_sha256)fail('handoff_lineage');
        dispositions.push(Object.freeze({attemptId:item.attemptId,handoffDigest:row.payload_sha256,billability:'unknown' as const}));
        reasons.push(`handoff-cost-disposition-unavailable:${item.attemptId}`);
      }
      dispositions.sort((a,b)=>a.attemptId.localeCompare(b.attemptId));reasons.sort();
      const body={version:'cue-handoff-cost-coverage-v1' as const,accountingDigest:historical.digest,dispositions:Object.freeze(dispositions),complete:reasons.length===0,unknownReasons:Object.freeze(reasons)};
      return Object.freeze({...body,digest:sha(canonical(body))});
    },
    projectAt(runId:string,cutoff:AccountingCutoff):AccountingProjection{const historical=db.transaction(()=>build(runId,cutoff))();
      const disclosureCount=safe((db.prepare(`SELECT count(*) n FROM (SELECT request_id FROM integration_budget_reservation WHERE run_id=? UNION SELECT request_id FROM local_invocation_reservation WHERE run_id=?)`).get(runId,runId) as {n:number}).n);
      if(disclosureCount>4096)fail('inventory_limit');
      const requests=db.prepare(`SELECT request_id FROM integration_budget_reservation WHERE run_id=? UNION SELECT request_id FROM local_invocation_reservation WHERE run_id=? ORDER BY request_id LIMIT 4097`).all(runId,runId) as {request_id:string}[];
      const historicalById=new Map(historical.items.map(item=>[item.requestId,item]));const current=requests.map(({request_id})=>{id(request_id);const item=historicalById.get(request_id);
        const row=db.prepare('SELECT MAX(revision) revision FROM integration_budget_receipt WHERE run_id=? AND request_id=?').get(runId,request_id) as {revision:number|null};
        const currentLatestRevision=row.revision===null?null:safe(row.revision);return Object.freeze({requestId:request_id,currentLatestRevision,newerThanCutoff:!item||currentLatestRevision!==null&&(item.latestAtCutoff===null||currentLatestRevision>item.latestAtCutoff.revision)});});
      const result=Object.freeze({historical,currentDisclosure:Object.freeze(current)});if(Buffer.byteLength(canonical(result))>2_097_152)fail('output_limit');return result;}
  });
}
