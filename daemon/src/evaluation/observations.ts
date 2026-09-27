import { createHash } from 'node:crypto';
import { types } from 'node:util';
import type { Ledger } from '../ledger.js';
import { createEvaluationEnrollmentStore, type EvaluationEnrollment } from './enrollment.js';
import { readRunOutcome } from './run-outcome.js';
import { freezeEvaluationDataset } from './comparison.js';
import { validateTaskPlan, type PlanRole } from '../orchestration/plan.js';

const MAX_BYTES=1048576, MAX_ROWS=4096;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/, SHA=/^[a-f0-9]{64}$/;
const PLAN_ROLES:Readonly<Record<PlanRole,true>>={planner:true,implementation:true,'model-producer':true,verifier:true};
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
const fail=(code:string):never=>{throw Error(`evaluation_observation_${code}`)};
function exact(v:unknown,keys:readonly string[]){
  if(!v||typeof v!=='object'||types.isProxy(v)||Object.getPrototypeOf(v)!==Object.prototype)fail('input');
  const d=Object.getOwnPropertyDescriptors(v);if(Reflect.ownKeys(d).length!==keys.length||keys.some(k=>!d[k]?.enumerable||!Object.hasOwn(d[k],'value')))fail('input');
  return Object.fromEntries(keys.map(k=>[k,d[k]!.value]));
}
function id(v:unknown):string{if(typeof v!=='string'||!ID.test(v))fail('identity');return v as string}
function sha(v:unknown):string{if(typeof v!=='string'||!SHA.test(v))fail('digest');return v as string}
function integer(v:unknown){if(!Number.isSafeInteger(v)||(v as number)<0)fail('integer');return v as number}
function decimal(v:unknown):v is string{return typeof v==='string'&&/^(?:0|[1-9][0-9]{0,31})$/.test(v)}
function freeze<T>(v:T):T{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v)}return v}
function strings(v:unknown){if(!Array.isArray(v)||types.isProxy(v)||Reflect.ownKeys(v).length!==v.length+1||v.some(x=>typeof x!=='string'))fail('outcome_integrity')}
function validateOutcome(v:unknown,runId:string,recordedAtMs:number,db:Ledger){
  if(v===null)return;
  const head=exact(v,(v as any)?.status==='unavailable'?['status','runId','authority','reason']:['status','version','runId','authority','sourceHashScope','observedTaskState','outcome','outcomeBasis','uncertaintyReasons','policy','planDigest','envelopeHash','attempts','acceptanceRef','accounting','quality','elapsedMs','trialReadiness','sourceDigest']);
  if(head.runId!==runId||head.authority!=='evaluation-input-only')fail('outcome_integrity');
  if(head.status==='unavailable'){if(!['coverage-limit','stored-evidence-unavailable'].includes(head.reason as string))fail('outcome_integrity');return}
  if(head.status!=='recorded'||head.version!=='cue-run-outcome-v1'||head.sourceHashScope!=='safe-column-projection'||!['queued','awaiting_approval','running','completed','failed','blocked'].includes(head.observedTaskState as string)||!['success','fail','cancelled','unknown'].includes(head.outcome as string)||!['historical-acceptance','stored-cancel-request','stored-task-failure','insufficient-terminal-evidence'].includes(head.outcomeBasis as string)||head.quality!==null||head.elapsedMs!==null)fail('outcome_integrity');
  strings(head.uncertaintyReasons);sha(head.planDigest);if(typeof head.envelopeHash!=='string'||!(head.envelopeHash as string).length)fail('outcome_integrity');
  const p=exact(head.policy,['kind','id','idDigest','revision','digest','mode']);if(!['monetary','local-invocation'].includes(p.kind as string)||(p.id!==null&&typeof p.id!=='string')||!Number.isSafeInteger(p.revision)||!['efficiency','performance','value','speed'].includes(p.mode as string))fail('outcome_integrity');sha(p.idDigest);sha(p.digest);
  if(!Array.isArray(head.attempts)||types.isProxy(head.attempts)||head.attempts.length>1024)fail('outcome_integrity');for(const item of head.attempts){const a=exact(item,['attemptId','taskId','taskIdDigest','candidateId','candidateIdDigest','role','state','cleanup','selection','toolRevision','modelRevision']);id(a.attemptId);sha(a.taskIdDigest);sha(a.candidateIdDigest);if((a.taskId!==null&&typeof a.taskId!=='string')||(a.candidateId!==null&&typeof a.candidateId!=='string')||typeof a.role!=='string'||!Object.hasOwn(PLAN_ROLES,a.role)||!['running','completed','failed','blocked'].includes(a.state as string)||!['verified-clean','unknown'].includes(a.cleanup as string)||a.toolRevision!==null||a.modelRevision!==null)fail('outcome_integrity');const s=exact(a.selection,['status','digest']);if(typeof s.status!=='string'||(s.digest!==null&&typeof s.digest!=='string'))fail('outcome_integrity')}
  if(head.acceptanceRef!==null){const a=exact(head.acceptanceRef,['evaluationId','verdict','accepted','acceptedAt']);if(typeof a.evaluationId!=='string'||!['pass','fail','unknown'].includes(a.verdict as string)||typeof a.accepted!=='boolean'||(a.acceptedAt!==null&&!Number.isSafeInteger(a.acceptedAt)))fail('outcome_integrity')}
  const acc=exact(head.accounting,(head.accounting as any)?.kind==='monetary'?['kind','currency','unit','final','actualUnits','committedUnits','remainingUnits','debtUnits','receipts','breakdown']:(head.accounting as any)?.kind==='local-invocation'?['kind','limit','committed','remaining','semantics','providerBilling']:['kind']);if(!['monetary','local-invocation','unknown'].includes(acc.kind as string))fail('outcome_integrity');
  if(acc.kind==='local-invocation'&&(![acc.limit,acc.committed,acc.remaining].every(Number.isSafeInteger)||acc.semantics!=='committed-dispatch-intent'||acc.providerBilling!=='not-measured'))fail('outcome_integrity');
  if(acc.kind==='monetary'){
    if(typeof acc.currency!=='string'||!['minor','micro'].includes(acc.unit as string)||typeof acc.final!=='boolean'||![acc.actualUnits,acc.committedUnits,acc.remainingUnits,acc.debtUnits].every(x=>x===null||decimal(x))||!Array.isArray(acc.receipts)||types.isProxy(acc.receipts)||acc.receipts.length>4096)fail('outcome_integrity');
    const receiptKeys=new Set<string>(),receiptIds=new Set<string>(),receipts:any[]=[];
    for(const receipt of acc.receipts){
      const r=exact(receipt,['receiptId','requestId','revision','kind','units','providerFinal']),receiptId=id(r.receiptId),requestId=id(r.requestId);
      if(!Number.isSafeInteger(r.revision)||r.revision<1||!['actual','estimated','unknown'].includes(r.kind as string)||(r.units!==null&&(!Number.isSafeInteger(r.units)||r.units<0))||typeof r.providerFinal!=='boolean'||r.kind==='unknown'&&(r.units!==null||r.providerFinal)||r.kind!=='unknown'&&r.units===null||r.providerFinal&&r.kind!=='actual'||receiptIds.has(receiptId)||receiptKeys.has(`${requestId}:${r.revision}`))fail('outcome_integrity');
      receiptIds.add(receiptId);receiptKeys.add(`${requestId}:${r.revision}`);
      const stored=db.prepare('SELECT kind,units,provider_final,payload FROM integration_budget_receipt WHERE run_id=? AND request_id=? AND receipt_id=? AND revision=?').get(runId,requestId,receiptId,r.revision) as any;
      if(!stored||stored.kind!==r.kind||stored.units!==r.units||stored.provider_final!==Number(r.providerFinal))fail('outcome_integrity');
      let payload:any;try{payload=JSON.parse(stored.payload)}catch{fail('outcome_integrity')}if(payload.observedAtMs>recordedAtMs)fail('outcome_integrity');receipts.push({...r,receiptId,requestId});
    }
    const b=exact(acc.breakdown,['baseUnits','retryUnits','handoffUnits','verificationUnits']),classified=[b.baseUnits,b.retryUnits,b.verificationUnits];
    if(b.handoffUnits!==null||!acc.final&&classified.some(x=>x!==null)||acc.final&&acc.actualUnits===null||classified.some(x=>x!==null)&&(!classified.every(decimal)||BigInt(b.baseUnits as string)+BigInt(b.retryUnits as string)+BigInt(b.verificationUnits as string)!==BigInt(acc.actualUnits as string)))fail('outcome_integrity');
    if(acc.final){
      const reservations=db.prepare('SELECT request_id,attempt_id,payload FROM integration_budget_reservation WHERE run_id=?').all(runId) as any[],eligible=reservations.filter(row=>{let payload:any;try{payload=JSON.parse(row.payload)}catch{fail('outcome_integrity')}if(payload.requestId!==row.request_id||payload.attemptId!==row.attempt_id)fail('outcome_integrity');return payload.observedAtMs<=recordedAtMs}),latest=new Map<string,any>();
      for(const receipt of receipts){const prior=latest.get(receipt.requestId);if(!prior||receipt.revision>prior.revision)latest.set(receipt.requestId,receipt)}
      if(eligible.length!==latest.size||eligible.some(row=>!latest.has(row.request_id))||[...latest.values()].some(r=>r.kind!=='actual'||r.providerFinal!==true)||[...latest.values()].reduce((sum,r)=>sum+BigInt(r.units),0n)!==BigInt(acc.actualUnits as string))fail('outcome_integrity');
      for(const reservation of eligible){
        const persisted=(db.prepare('SELECT receipt_id,revision,kind,units,provider_final,payload FROM integration_budget_receipt WHERE run_id=? AND request_id=? ORDER BY revision,rowid').all(runId,reservation.request_id) as any[]).filter(row=>{let payload:any;try{payload=JSON.parse(row.payload)}catch{fail('outcome_integrity')}return payload.observedAtMs<=recordedAtMs}),max=persisted.at(-1),provided=latest.get(reservation.request_id);
        if(!max||persisted.filter(row=>row.revision===max.revision).length!==1||provided.receiptId!==max.receipt_id||provided.revision!==max.revision||provided.kind!==max.kind||provided.units!==max.units||provided.providerFinal!==Boolean(max.provider_final))fail('outcome_integrity');
      }
      const planRow=db.prepare('SELECT payload,digest FROM orchestration_plan WHERE run_id=?').get(runId) as any;let raw:any;try{raw=JSON.parse(planRow?.payload)}catch{fail('outcome_integrity')}const plan=validateTaskPlan(raw.approval,{revision:raw.revision,policyRevision:raw.approval.policyRevision,policyDigest:raw.approval.policyDigest,tasks:raw.tasks});if(JSON.stringify(plan)!==planRow.payload||plan.digest!==planRow.digest)fail('outcome_integrity');
      const expected={base:0n,retry:0n,verification:0n},unclassified=eligible.some(row=>{const attempt=db.prepare('SELECT task_id FROM orchestration_attempt WHERE attempt_id=? AND run_id=?').get(row.attempt_id,runId) as any,units=BigInt(latest.get(row.request_id).units);if(!attempt||db.prepare('SELECT 1 FROM orchestration_attempt_revision WHERE attempt_id=?').get(row.attempt_id))return true;if(db.prepare('SELECT 1 FROM orchestration_retry_link WHERE attempt_id=?').get(row.attempt_id)){expected.retry+=units;return false}const role=plan.tasks.find(task=>task.id===attempt.task_id)?.role;if(role==='verifier'){expected.verification+=units;return false}if(role==='implementation'||role==='model-producer'){expected.base+=units;return false}return true});
      if(unclassified?classified.some(x=>x!==null):b.baseUnits!==String(expected.base)||b.retryUnits!==String(expected.retry)||b.verificationUnits!==String(expected.verification))fail('outcome_integrity');
    }
  }
  const tr=exact(head.trialReadiness,['status','reasons']);if(tr.status!=='not-convertible')fail('outcome_integrity');strings(tr.reasons);
  const source=head.sourceDigest;const copy={...(v as any)};delete copy.sourceDigest;if(source!==createHash('sha256').update(JSON.stringify(copy)).digest('hex'))fail('outcome_integrity');
}

export type EvaluationObservation=Readonly<{version:'cue-evaluation-observation-v1';authority:'historical-separate-committed-read';observationId:string;enrollmentId:string;enrollmentDigest:string;runId:string;revision:number;supersedesObservationId:string|null;recordedAtMs:number;outcome:ReturnType<typeof readRunOutcome>;digest:string}>;

export function createEvaluationObservationStore(db:Ledger){
  const enrollments=createEvaluationEnrollmentStore(db);
  function readRow(row:any):EvaluationObservation{
    if(!row||integer(row.bytes)>MAX_BYTES)fail('payload');
    let p:any;try{p=JSON.parse(row.bounded_payload)}catch{fail('integrity')}
    const expected={version:'cue-evaluation-observation-v1',authority:'historical-separate-committed-read',observationId:id(row.observation_id),enrollmentId:id(row.enrollment_id),enrollmentDigest:sha(p.enrollmentDigest),runId:id(p.runId),revision:integer(row.revision),supersedesObservationId:row.supersedes_observation_id===null?null:id(row.supersedes_observation_id),recordedAtMs:integer(row.recorded_at_ms),outcome:p.outcome} as const;
    validateOutcome(expected.outcome,expected.runId,expected.recordedAtMs,db);
    const payload=JSON.stringify(expected);if(payload!==row.bounded_payload||hash(payload)!==row.payload_digest)fail('integrity');
    const enrollment=enrollments.read(expected.enrollmentId);if(!enrollment||enrollment.digest!==expected.enrollmentDigest||enrollment.runId!==expected.runId)fail('enrollment_integrity');
    if(expected.revision===1?(expected.supersedesObservationId!==null):(expected.supersedesObservationId===null))fail('chain');
    if(expected.supersedesObservationId){const prior=db.prepare('SELECT enrollment_id,revision FROM evaluation_observation WHERE observation_id=?').get(expected.supersedesObservationId) as any;if(!prior||prior.enrollment_id!==expected.enrollmentId||prior.revision!==expected.revision-1)fail('chain')}
    return freeze({...expected,digest:row.payload_digest});
  }
  function rowById(observationId:string){return db.prepare('SELECT observation_id,enrollment_id,revision,supersedes_observation_id,recorded_at_ms,payload_digest,length(CAST(payload AS BLOB)) bytes,substr(payload,1,?) bounded_payload FROM evaluation_observation INDEXED BY sqlite_autoindex_evaluation_observation_1 WHERE observation_id=?').get(MAX_BYTES+1,observationId) as any}
  function read(observationId:string){const row=rowById(id(observationId));return row?readRow(row):null}
  return Object.freeze({
    read(observationId:string){if(db.inTransaction)fail('outer_transaction');return db.transaction(()=>read(observationId))()},
    observe(input:unknown,recordedAtMs:number):EvaluationObservation{
      if(!db.open||db.inTransaction)fail('outer_transaction');
      const f=exact(input,['enrollmentId','observationId','expectedPriorRevision']), enrollmentId=id(f.enrollmentId), observationId=id(f.observationId), expected=integer(f.expectedPriorRevision), at=integer(recordedAtMs);
      const replay=rowById(observationId);if(replay){const saved=db.transaction(()=>readRow(replay))();if(saved.enrollmentId!==enrollmentId||saved.revision-1!==expected)fail('replay_conflict');return saved}
      const enrollment=enrollments.read(enrollmentId);if(!enrollment)throw Error('evaluation_observation_enrollment_missing');
      const outcome=readRunOutcome(db,{runId:enrollment.runId});
      return db.transaction(()=>{
        const again=rowById(observationId);if(again){const saved=readRow(again);if(saved.enrollmentId!==enrollmentId||saved.revision-1!==expected)fail('replay_conflict');return saved}
        const prior=db.prepare('SELECT observation_id,revision FROM evaluation_observation WHERE enrollment_id=? ORDER BY revision DESC LIMIT 1').get(enrollmentId) as any;
        const current=prior?integer(prior.revision):0;if(current!==expected)fail('revision_conflict');
        const value={version:'cue-evaluation-observation-v1',authority:'historical-separate-committed-read',observationId,enrollmentId,enrollmentDigest:enrollment.digest,runId:enrollment.runId,revision:current+1,supersedesObservationId:prior?.observation_id??null,recordedAtMs:at,outcome} as const;
        const payload=JSON.stringify(value);if(Buffer.byteLength(payload)>MAX_BYTES)fail('payload');const digest=hash(payload);
        db.prepare('INSERT INTO evaluation_observation(observation_id,enrollment_id,revision,supersedes_observation_id,recorded_at_ms,payload_digest,payload) VALUES(?,?,?,?,?,?,?)').run(observationId,enrollmentId,current+1,value.supersedesObservationId,at,digest,payload);
        return read(observationId)!;
      })();
    },
    coverage(input:unknown){
      if(!db.open||db.inTransaction)fail('outer_transaction');const f=exact(input,['datasetDigest','arm','policyDigest','cutoffId']);const datasetDigest=sha(f.datasetDigest),arm=id(f.arm),policyDigest=sha(f.policyDigest),cutoffId=id(f.cutoffId);
      return db.transaction(()=>{
        const cutoff=db.prepare(`SELECT o.sequence,o.recorded_at_ms FROM evaluation_observation o JOIN evaluation_enrollment e ON e.enrollment_id=o.enrollment_id WHERE o.observation_id=? AND e.dataset_digest=? AND e.arm=? AND e.policy_digest=?`).get(cutoffId,datasetDigest,arm,policyDigest) as any;if(!cutoff)fail('cutoff_scope');
        const count=(db.prepare('SELECT count(*) n FROM evaluation_enrollment WHERE dataset_digest=? AND arm=? AND policy_digest=?').get(datasetDigest,arm,policyDigest) as any).n;if(integer(count)>MAX_ROWS)fail('coverage_limit');
        const rows=db.prepare(`SELECT e.enrollment_id,e.case_id,e.run_id,(SELECT o.observation_id FROM evaluation_observation o WHERE o.enrollment_id=e.enrollment_id AND o.sequence<=? ORDER BY o.revision DESC LIMIT 1) observation_id FROM evaluation_enrollment e WHERE e.dataset_digest=? AND e.arm=? AND e.policy_digest=? ORDER BY e.case_id,e.enrollment_id`).all(cutoff.sequence,datasetDigest,arm,policyDigest) as any[];
        const dataset=enrollments.read(rows[0]?.enrollment_id)?.dataset??(()=>{const r=db.prepare('SELECT dataset_id,revision,payload FROM evaluation_dataset WHERE digest=?').get(datasetDigest) as any;if(!r)fail('dataset_missing');let parsed;try{parsed=JSON.parse(r.payload)}catch{fail('dataset_integrity')}const saved=freezeEvaluationDataset(parsed);if(saved.digest!==datasetDigest||saved.id!==r.dataset_id||saved.revision!==r.revision||JSON.stringify({id:saved.id,revision:saved.revision,cases:saved.cases})!==r.payload)fail('dataset_integrity');return saved})();
        const slots=rows.map(r=>freeze({enrollmentId:id(r.enrollment_id),caseId:id(r.case_id),runId:id(r.run_id),observation:r.observation_id?read(id(r.observation_id)):null}));
        const value=freeze({version:'cue-evaluation-coverage-v1' as const,authority:'historical-recorded-cutoff' as const,membershipRelation:'current-enrollments-at-read' as const,datasetDigest,arm,policyDigest,cutoff:Object.freeze({observationId:cutoffId,recordedAtMs:integer(cutoff.recorded_at_ms)}),expectedCases:dataset.cases.map(c=>Object.freeze({caseId:c.id,split:c.split,inputDigest:c.inputDigest})),enrolledSlotCount:slots.length,slots});
        if(Buffer.byteLength(JSON.stringify(value))>MAX_BYTES)fail('coverage_limit');return value;
      })();
    }
  });
}
