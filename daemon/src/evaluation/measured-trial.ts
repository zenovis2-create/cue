import {createHash} from 'node:crypto';
import {types} from 'node:util';
import type {Ledger} from '../ledger.js';
import type {EvaluationEnrollment} from './enrollment.js';
import type {MeasurementContract} from './measurement-contracts.js';
import {createEvaluationMeasuredFactStore,type EvaluationMeasuredFact,type MeasuredFactHost} from './measured-facts.js';
import {createMeasurementContractStore} from './measurement-contracts.js';
import {readEvaluationTrialOutcome} from './trials.js';
import {readRunOutcome} from './run-outcome.js';
import {createAuthoritativeAccountingStore,type HistoricalAccountingSnapshot} from './authoritative-accounting.js';
import {createHandoffAccountingStore} from './handoff-accounting.js';
import {createEvaluationStudy,type EvaluationTrial} from './comparison.js';
import {readRunPolicyIdentity} from '../selection/run-policy-identity.js';
import {validateTaskPlan} from '../orchestration/plan.js';

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const active=new WeakSet<Ledger>();
const ID=/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
function fail(reason:string):never{throw Error('evaluation_measured_trial_'+reason);}
function factId(input:unknown):string{
  if(!input||typeof input!=='object'||types.isProxy(input)||Object.getPrototypeOf(input)!==Object.prototype)fail('input');
  const d=Object.getOwnPropertyDescriptors(input);
  if(Reflect.ownKeys(d).length!==1||!d.factId?.enumerable||!Object.hasOwn(d.factId,'value')||typeof d.factId.value!=='string'||!ID.test(d.factId.value))fail('input');
  return d.factId.value;
}
function freeze<T>(v:T):T{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
function epoch(db:Ledger){
  if(!db.open||db.inTransaction)fail('read_boundary');
  return JSON.stringify([db.pragma('data_version',{simple:true}),db.pragma('schema_version',{simple:true}),(db.prepare('SELECT total_changes() n').get() as {n:number}).n]);
}
function known(value:unknown):value is string{return typeof value==='string'&&ID.test(value)&&!['unknown','unavailable','unmeasured'].includes(value);}
export type MeasuredTrialConversion=Readonly<{
  version:'cue-measured-trial-v1';authority:'derived-measurement-trial-only';
  factId:string;factDigest:string;enrollmentDigest:string;observationDigest:string;runId:string;datasetDigest:string;
  source:'fixture'|'observed';outcome:EvaluationTrial['outcome']|null;status:'convertible'|'insufficient';
  reasons:readonly string[];outcomeUncertainty:readonly string[];
  executionIdentity:Readonly<{scheme:'role-candidate-tool-model-set-v1';digest:string;members:readonly Readonly<{role:string;candidateDigest:string;toolId:string;toolRevision:string;modelId:string|null;modelRevision:string|null}>[]}>;
  contracts:Readonly<{metricDigest:string;environmentDigest:string;accountLimitsDigest:string;priceDigest:string|null}>;
  handoffDigest:string|null;trial:EvaluationTrial|null;promotionEligible:false;digest:string;
}>;

/** Data helpers only. Neither issues measurement authority nor checks eligibility. */
export function measuredExecutionIdentity(subjects:readonly any[]){
  const members=[...new Map(subjects.map(s=>{const member={role:s.role,candidateDigest:s.candidateDigest,toolId:s.toolId,toolRevision:s.toolRevision,modelId:s.modelId,modelRevision:s.modelRevision};return[JSON.stringify(member),member] as const;})).entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,value])=>value);
  return freeze({scheme:'role-candidate-tool-model-set-v1' as const,digest:hash(members),members});
}
export function measuredTrialData(fact:EvaluationMeasuredFact,base:EvaluationEnrollment,price:MeasurementContract,outcome:EvaluationTrial['outcome'],costs:EvaluationTrial['costs']):EvaluationTrial{
  const identity=measuredExecutionIdentity(fact.executionSubjects),quality=fact.quality as any,timing=fact.timing as any;
  return freeze({id:'measured:'+hash([fact.factId,fact.digest]),caseId:fact.caseId,arm:base.arm,policyDigest:fact.policyDigest,policyRevision:String(base.policy.revision),
    toolId:'cue-execution-toolset-v1',toolRevision:identity.digest,modelId:'cue-execution-modelset-v1',modelRevision:identity.digest,
    source:fact.producerClass==='offline-fixture'?'fixture':'observed',environmentDigest:fact.environmentDigest,accountLimitsDigest:fact.accountLimitsDigest,
    observedAtMs:fact.recordedAtMs,priceObservedAtMs:price.observedAtMs,priceSourceDigest:price.sourceDigest,outcome,quality:quality.score,elapsedMs:timing.elapsedMs,costs});
}

/** Revalidates stored measurements only; does not capture, authorize, persist,
 * select cohort membership or assert real-world truth beyond the trusted host. */
export function createMeasuredTrialConverter(db:Ledger,host:MeasuredFactHost){
  const facts=createEvaluationMeasuredFactStore(db,host),contracts=createMeasurementContractStore(db,host);
  return Object.freeze({convert(input:unknown):MeasuredTrialConversion{
    const id=factId(input);if(active.has(db))fail('reentrant');const before=epoch(db);active.add(db);
    try{
      const fact=facts.read(id);if(!fact)fail('missing');
      const {enrollment:base,observation,outcome}=readEvaluationTrialOutcome(db,{enrollmentId:fact.enrollmentId,observationId:fact.observationId});
      const recorded=observation.outcome?.status==='recorded'?observation.outcome:null;
      const policy=readRunPolicyIdentity(db,fact.runId);
      if(!policy||policy.kind!==base.policy.kind||policy.policyId!==base.policy.policyId||policy.revision!==base.policy.revision||policy.digest!==base.policy.digest)fail('policy');
      if(recorded&&(recorded.policy.idDigest!==hash(policy.policyId)||recorded.policy.mode!==policy.snapshot.policy.mode))fail('policy');
      const planRow=db.prepare('SELECT envelope_hash,digest,length(CAST(payload AS BLOB)) bytes,substr(payload,1,1048577) payload FROM orchestration_plan WHERE run_id=?').get(fact.runId) as any;
      if(!planRow||planRow.bytes>1048576)fail('plan');
      const raw=JSON.parse(planRow.payload),plan=validateTaskPlan(raw.approval,{revision:raw.revision,policyRevision:raw.approval.policyRevision,policyDigest:raw.approval.policyDigest,tasks:raw.tasks});
      if(plan.digest!==planRow.digest||JSON.stringify(plan)!==planRow.payload||plan.approval.policyDigest!==policy.digest||plan.approval.policyRevision!==`${policy.policyId}:${policy.revision}`
        ||recorded&&(recorded.planDigest!==plan.digest||recorded.envelopeHash!==planRow.envelope_hash))fail('plan');
      const reasons=new Set<string>(fact.uncertaintyReasons.map(reason=>'fact:'+reason));
      if(!recorded||outcome===null)reasons.add('outcome-unavailable');
      const currentOutcome=readRunOutcome(db,{runId:fact.runId});
      if(currentOutcome?.status!=='recorded')reasons.add('outcome-lineage-unavailable');
      else if(recorded&&(currentOutcome.outcome!==recorded.outcome||currentOutcome.outcomeBasis!==recorded.outcomeBasis||JSON.stringify(currentOutcome.attempts)!==JSON.stringify(recorded.attempts)))reasons.add('outcome-superseded');
      if(fact.recordedAtMs<observation.recordedAtMs||observation.recordedAtMs<base.enrolledAtMs)reasons.add('measurement-time-order');
      const subjects=fact.executionSubjects as any[],inputEvidence=fact.executedInput as any;
      if(!inputEvidence.matches)reasons.add('executed-input-mismatch');
      if(subjects.length===0)reasons.add('execution-subjects-unavailable');
      const attempted=db.prepare('SELECT task_id FROM orchestration_attempt WHERE run_id=? LIMIT 1025').all(fact.runId) as {task_id:string}[];
      if(plan.tasks.some(task=>!attempted.some(a=>a.task_id===task.id)))reasons.add('plan-execution-incomplete');
      if(!subjects.some(s=>s.role==='verifier'))reasons.add('verification-execution-unavailable');
      if(!known(fact.producerRevision))reasons.add('producer-revision-unavailable');
      if(subjects.some(s=>!known(s.toolId)||!known(s.toolRevision)||!known(s.modelId)||!known(s.modelRevision)))reasons.add('execution-revision-unavailable');
      if(recorded&&(recorded.attempts.length!==subjects.length||subjects.some(s=>!recorded.attempts.some(a=>a.attemptId===s.attemptId&&a.role===s.role&&a.state===s.state))))reasons.add('observation-attempt-coverage');
      if(recorded?.attempts.some(a=>a.cleanup!=='verified-clean')||subjects.some(s=>s.state==='running')
        ||recorded&&!['completed','failed','blocked'].includes(recorded.observedTaskState)
        ||currentOutcome?.status==='recorded'&&(currentOutcome.uncertaintyReasons.includes('cleanup-unresolved')||!['completed','failed','blocked'].includes(currentOutcome.observedTaskState))
        ||db.prepare('SELECT 1 FROM workspace_write_lease WHERE run_id=?').get(fact.runId))reasons.add('execution-unsettled');
      if(db.prepare('SELECT 1 FROM orchestration_plan_revision WHERE run_id=? AND revision>0').get(fact.runId))reasons.add('replanned-execution-unsupported');
      const identity=measuredExecutionIdentity(subjects);
      const metric=contracts.readMetric(base.metric.digest)!,environment=contracts.readEnvironment(base.environment.digest)!,limits=contracts.readAccountLimits(base.accountLimits.digest)!;
      if(metric.definition.scoreMinimum!==0||metric.definition.scoreMaximum!==1)reasons.add('quality-domain-unsupported');
      if(!known(metric.definition.algorithmRevision)||[metric,environment,limits].some(c=>!known(c.sourceRevision)))reasons.add('contract-revision-unavailable');
      if(environment.definition.complete!==true||limits.definition.complete!==true)reasons.add('measurement-context-incomplete');
      const quality=fact.quality as any,timing=fact.timing as any;
      if(quality===null)reasons.add('quality-unavailable');
      if(timing===null)reasons.add('timing-unavailable');
      else{
        if(timing.scope!=='execution-queue-cleanup')reasons.add('timing-scope-incomplete');
        if(!known(timing.clockId)||!known(timing.clockRevision))reasons.add('clock-revision-unavailable');
      }
      const accounting=fact.accounting as HistoricalAccountingSnapshot;
      let costs:EvaluationTrial['costs']|null=null,handoffDigest:string|null=null;
      const price=fact.priceDigest===null?null:contracts.readPrice(fact.priceDigest);
      if(!price||!known(price.sourceRevision)||price.authorityClass!==fact.producerClass||price.observedAtMs>fact.recordedAtMs||(price.definition.effectiveAtMs as number)>fact.recordedAtMs)reasons.add('price-unavailable-or-incompatible');
      if(accounting.version!=='cue-authoritative-accounting-snapshot-v1'||accounting.kind!=='monetary'||!accounting.completeAtCutoff||accounting.totalUnits===null)reasons.add('final-monetary-accounting-unavailable');
      else{
        const current=createAuthoritativeAccountingStore(db).captureCurrent(fact.runId);
        if(JSON.stringify(current.items)!==JSON.stringify(accounting.items)||current.totalUnits!==accounting.totalUnits||!current.completeAtCutoff)reasons.add('accounting-superseded');
        if(price&&(price.definition.currency!==accounting.currency||price.definition.unit!==accounting.unit))reasons.add('price-unit-mismatch');
        const partition=createHandoffAccountingStore(db).read(id,accounting);handoffDigest=partition?.digest??null;
        if(!partition?.complete||partition.availability!=='known')reasons.add('cost-partition-unavailable');
        else{
          const sums={baseUnits:0n,retryUnits:0n,verificationUnits:0n,handoffUnits:0n};
          for(const item of partition.items)for(const key of Object.keys(sums) as (keyof typeof sums)[])sums[key]+=BigInt(item.components![key]);
          const total=Object.values(sums).reduce((a,b)=>a+b,0n);
          if(total!==BigInt(accounting.totalUnits))fail('cost-total');
          if(total>BigInt(Number.MAX_SAFE_INTEGER))reasons.add('cost-overflow');
          else if(!known(accounting.currency)||!['minor','micro'].includes(accounting.unit??''))reasons.add('cost-unit-unsupported');
          else costs={currency:accounting.currency!,unit:accounting.unit as 'minor'|'micro',baseUnits:Number(sums.baseUnits),retryUnits:Number(sums.retryUnits),verificationUnits:Number(sums.verificationUnits),handoffUnits:Number(sums.handoffUnits)};
        }
      }
      let trial:EvaluationTrial|null=null;
      if(reasons.size===0&&costs&&price&&outcome){
        trial=measuredTrialData(fact,base,price,outcome,costs);
        // Use the existing descriptive evaluator's exact schema and safe sums.
        createEvaluationStudy(base.dataset).record(trial);
      }
      const value={version:'cue-measured-trial-v1' as const,authority:'derived-measurement-trial-only' as const,factId:fact.factId,factDigest:fact.digest,enrollmentDigest:base.digest,observationDigest:observation.digest,runId:fact.runId,datasetDigest:fact.datasetDigest,
        source:fact.producerClass==='offline-fixture'?'fixture' as const:'observed' as const,outcome,status:trial?'convertible' as const:'insufficient' as const,reasons:[...reasons].sort(),outcomeUncertainty:recorded?.uncertaintyReasons??[],executionIdentity:identity,
        contracts:{metricDigest:metric.digest,environmentDigest:environment.digest,accountLimitsDigest:limits.digest,priceDigest:fact.priceDigest},handoffDigest,trial,promotionEligible:false as const};
      if(Buffer.byteLength(JSON.stringify(value))>1048576)fail('payload');
      if(epoch(db)!==before)fail('concurrent-change');
      return freeze({...value,digest:hash(value)});
    }finally{active.delete(db);}
  }});
}
