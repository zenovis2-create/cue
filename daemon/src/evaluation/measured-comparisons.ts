import {createHash} from 'node:crypto';
import {types} from 'node:util';
import type {Ledger} from '../ledger.js';
import {createEvaluationEnrollmentStore,type EvaluationEnrollment} from './enrollment.js';
import {createEvaluationStudy,type ComparisonConstraints} from './comparison.js';
import {createMeasuredTrialConverter,measuredExecutionIdentity,measuredTrialData,type MeasuredTrialConversion} from './measured-trial.js';
import type {MeasuredFactHost,EvaluationMeasuredFact} from './measured-facts.js';
import {createMeasurementContractStore} from './measurement-contracts.js';
import {createHandoffAccountingStore} from './handoff-accounting.js';
import {readEvaluationTrialOutcome} from './trials.js';
const MAX=1048576,ID=/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const active=new WeakSet<Ledger>(),hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const KEYS=['mode','baselinePolicyDigest','candidatePolicyDigest','maxPriceAgeMs','minPairsPerSplit','qualityFloor','minSuccessRate','maxUnknownRate','costLimitUnits','costBasisUnits','timeBasisMs','minImprovement'];
function fail(code:string):never{throw Error('evaluation_measured_comparison_'+code);}
function exact(v:unknown,keys:readonly string[]){if(!v||typeof v!=='object'||types.isProxy(v)||Object.getPrototypeOf(v)!==Object.prototype)fail('input');const d=Object.getOwnPropertyDescriptors(v);if(Reflect.ownKeys(d).length!==keys.length||keys.some(k=>!d[k]?.enumerable||!Object.hasOwn(d[k],'value')))fail('input');return Object.fromEntries(keys.map(k=>[k,d[k]!.value]));}
function id(v:unknown):string{if(typeof v!=='string'||!ID.test(v))fail('identity');return v;}
function integer(v:unknown):number{if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0)fail('integer');return v;}
function ids(v:unknown):readonly string[]{if(!Array.isArray(v)||types.isProxy(v)||Object.getPrototypeOf(v)!==Array.prototype||v.length<1||v.length>64||Reflect.ownKeys(v).length!==v.length+1)fail('membership');const out:string[]=[];for(let n=0;n<v.length;n++){const d=Object.getOwnPropertyDescriptor(v,String(n));if(!d?.enumerable||!Object.hasOwn(d,'value'))fail('membership');out.push(id(d.value));}if(new Set(out).size!==out.length)fail('duplicate');return Object.freeze(out.sort());}
function freeze<T>(v:T):T{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
function stamp(db:Ledger){if(!db.open)fail('closed');return JSON.stringify([db.pragma('data_version',{simple:true}),db.pragma('schema_version',{simple:true}),(db.prepare('SELECT total_changes() n').get() as {n:number}).n]);}
export type MeasuredComparisonRequest=Readonly<{snapshotId:string;baselineEnrollmentIds:readonly string[];candidateEnrollmentIds:readonly string[];constraints:Omit<ComparisonConstraints,'nowMs'>}>;
function request(input:unknown):MeasuredComparisonRequest{const f=exact(input,['snapshotId','baselineEnrollmentIds','candidateEnrollmentIds','constraints']),c=exact(f.constraints,KEYS);if(Object.values(c).some(v=>v!==null&&(!['string','number'].includes(typeof v)||typeof v==='number'&&!Number.isFinite(v)||typeof v==='string'&&Buffer.byteLength(v)>128)))fail('constraints');return freeze({snapshotId:id(f.snapshotId),baselineEnrollmentIds:ids(f.baselineEnrollmentIds),candidateEnrollmentIds:ids(f.candidateEnrollmentIds),constraints:c as unknown as MeasuredComparisonRequest['constraints']});}
type Member=Readonly<{enrollmentId:string;enrollmentDigest:string;runId:string;caseId:string;split:'evaluation'|'holdout';arm:EvaluationEnrollment['arm'];metricDigest:string;observationId:string|null;observationDigest:string|null;factId:string|null;factDigest:string|null;outcome:'success'|'fail'|'cancelled'|'unknown'|null;conversion:MeasuredTrialConversion|null;reasons:readonly string[]}>;
function assemble(req:MeasuredComparisonRequest,at:number,dataset:EvaluationEnrollment['dataset'],members:readonly Member[]){
 const study=createEvaluationStudy(dataset),complete=members.length===dataset.cases.length*2&&members.every(m=>m.conversion?.trial!==null&&m.conversion?.trial!==undefined),sameMetric=new Set(members.map(m=>m.metricDigest)).size===1;
 // Never report numeric performance of a selectively convertible subset.
 if(complete&&sameMetric)for(const m of members)study.record(m.conversion!.trial);
 const comparison=study.compare({...req.constraints,nowMs:at});
 const availability=(['evaluation','holdout'] as const).map(split=>{
  const expected=dataset.cases.filter(c=>c.split===split).length;
  const arm=(name:string)=>{const selected=members.filter(m=>m.split===split&&m.arm===name),outcomes={success:0,fail:0,cancelled:0,unknown:0,unavailable:expected-selected.length};for(const m of selected)outcomes[m.outcome??'unavailable']++;return{expectedCaseCount:expected,enrollmentCount:selected.length,outcomeDenominator:expected,outcomes,trialCount:selected.filter(m=>m.conversion?.trial).length,missingEnrollmentCount:expected-selected.length,missingObservationCount:selected.filter(m=>!m.observationId).length,missingFactCount:selected.filter(m=>!m.factId).length,nonConvertibleCount:selected.filter(m=>m.factId&&!m.conversion?.trial).length};};
  return{split,baseline:arm('manual-baseline'),candidate:arm(req.constraints.mode)};
 });
 const reasonCounts=Object.fromEntries([...members.reduce((map,m)=>{for(const reason of new Set(m.reasons))map.set(reason,(map.get(reason)??0)+1);return map;},new Map<string,number>())].sort(([a],[b])=>a<b?-1:a>b?1:0));
 return freeze({version:'cue-measured-comparison-v1' as const,authority:'historical-measured-cohort-descriptive-only' as const,request:req,recordedAtMs:at,dataset,members,availability,reasonCounts,
  numericInputs:complete&&sameMetric?'complete-cohort' as const:'withheld-incomplete-or-incompatible-cohort' as const,incompatibleMetric:!sameMetric,comparison,promotionEligible:false as const,improvementProven:false as const});
}
export type MeasuredComparisonSnapshot=ReturnType<typeof assemble>&Readonly<{digest:string}>;

/** Separate version in the existing immutable snapshot envelope. Old outcome
 * snapshots are neither upgraded nor interpreted as measured snapshots. */
export function createMeasuredComparisonStore(db:Ledger,host?:MeasuredFactHost,allowRun:(runId:string)=>boolean=()=>true){
 const enrollments=createEvaluationEnrollmentStore(db),converter=host?createMeasuredTrialConverter(db,host):null;
 const contracts=createMeasurementContractStore(db,{read(){fail('read-only');},nowMs(){fail('read-only');}});
 function boundary(){if(!db.open||db.inTransaction)fail('read_boundary');}
 function enrollment(enrollmentId:string){const base=enrollments.read(enrollmentId);if(!base||!allowRun(base.runId))fail('scope');return base;}
 function preflight(req:MeasuredComparisonRequest,at:number){
  const bases=[...req.baselineEnrollmentIds,...req.candidateEnrollmentIds].map(enrollment);
  if(new Set(bases.map(b=>b.enrollmentId)).size!==bases.length)fail('duplicate');const dataset=bases[0]!.dataset;
  if(dataset.cases.length>64||bases.some(b=>b.dataset.digest!==dataset.digest||b.enrolledAtMs>at))fail('dataset');
  if(new Set(bases.map(b=>JSON.stringify([b.caseId,b.arm]))).size!==bases.length)fail('duplicate-slot');
  bases.forEach((b,n)=>{if(n<req.baselineEnrollmentIds.length?b.arm!=='manual-baseline'||b.policy.digest!==req.constraints.baselinePolicyDigest:b.arm!==req.constraints.mode||b.policy.digest!==req.constraints.candidatePolicyDigest)fail('arm-policy');});
  createEvaluationStudy(dataset).compare({...req.constraints,nowMs:at});return{bases,dataset};
 }
 function source(table:'evaluation_observation'|'evaluation_measured_fact',key:string,value:string){
  const mapping=table==='evaluation_observation'?{observation_id:'observationId',enrollment_id:'enrollmentId',revision:'revision',supersedes_observation_id:'supersedesObservationId',recorded_at_ms:'recordedAtMs'}:{fact_id:'factId',enrollment_id:'enrollmentId',observation_id:'observationId',run_id:'runId',dataset_digest:'datasetDigest',case_id:'caseId',arm:'arm',policy_digest:'policyDigest',producer_class:'producerClass',producer_revision:'producerRevision',producer_digest:'producerDigest',recorded_at_ms:'recordedAtMs'};
  const row=db.prepare(`SELECT ${Object.keys(mapping).join(',')},payload_digest,length(CAST(payload AS BLOB)) bytes,substr(payload,1,?) payload FROM ${table} WHERE ${key}=?`).get(MAX+1,value) as any;
  if(!row||row.bytes>MAX)fail('source');let parsed:any;try{parsed=JSON.parse(row.payload);}catch{fail('source');}
  if(JSON.stringify(parsed)!==row.payload)fail('source');const body={...parsed};if(table==='evaluation_measured_fact'){delete body.digest;if(parsed.digest!==row.payload_digest)fail('source');}
  if(hash(body)!==row.payload_digest||Object.entries(mapping).some(([column,field])=>row[column]!==parsed[field!]))fail('source');integer(parsed.recordedAtMs);return{data:parsed,digest:row.payload_digest as string};
 }
 function latest(base:EvaluationEnrollment){
  const obs=db.prepare('SELECT observation_id FROM evaluation_observation WHERE enrollment_id=? ORDER BY revision DESC LIMIT 1').get(base.enrollmentId) as {observation_id:string}|undefined;
  const fact=obs?db.prepare('SELECT fact_id FROM evaluation_measured_fact WHERE enrollment_id=? AND observation_id=?').get(base.enrollmentId,obs.observation_id) as {fact_id:string}|undefined:null;
  return{observationId:obs?.observation_id??null,factId:fact?.fact_id??null};
 }
 function validateConversion(c:MeasuredTrialConversion,fact:EvaluationMeasuredFact,base:EvaluationEnrollment,observation:any){
  exact(c,['version','authority','factId','factDigest','enrollmentDigest','observationDigest','runId','datasetDigest','source','outcome','status','reasons','outcomeUncertainty','executionIdentity','contracts','handoffDigest','trial','promotionEligible','digest']);
  const {digest,...body}=c;
  if(hash(body)!==digest||c.version!=='cue-measured-trial-v1'||c.authority!=='derived-measurement-trial-only'||c.factId!==fact.factId||c.factDigest!==fact.digest||c.enrollmentDigest!==base.digest||c.observationDigest!==observation.digest||c.runId!==base.runId||c.datasetDigest!==base.dataset.digest||c.promotionEligible!==false||c.source!==(fact.producerClass==='offline-fixture'?'fixture':'observed')||c.outcome!==(observation.data.outcome?.status==='recorded'?observation.data.outcome.outcome:null))fail('conversion');
  if(JSON.stringify(c.executionIdentity)!==JSON.stringify(measuredExecutionIdentity(fact.executionSubjects))||JSON.stringify(c.contracts)!==JSON.stringify({metricDigest:base.metric.digest,environmentDigest:fact.environmentDigest,accountLimitsDigest:fact.accountLimitsDigest,priceDigest:fact.priceDigest}))fail('conversion');
  if(!Array.isArray(c.reasons)||c.reasons.some(r=>typeof r!=='string')||JSON.stringify([...new Set(c.reasons)].sort())!==JSON.stringify(c.reasons)||JSON.stringify(c.outcomeUncertainty)!==JSON.stringify(observation.data.outcome?.status==='recorded'?observation.data.outcome.uncertaintyReasons:[]))fail('conversion');
  const acc=fact.accounting as any,partition=acc.version==='cue-authoritative-accounting-snapshot-v1'&&acc.kind==='monetary'?createHandoffAccountingStore(db).read(fact.factId,acc):null;
  if(c.handoffDigest!==(partition?.digest??null))fail('conversion');
  if(c.trial===null){if(c.status!=='insufficient'||!c.reasons.length)fail('conversion');return;}
  if(c.status!=='convertible'||c.reasons.length||fact.uncertaintyReasons.length||!partition?.complete||!fact.priceDigest||!c.outcome)fail('conversion');
  const sums={baseUnits:0n,retryUnits:0n,verificationUnits:0n,handoffUnits:0n};for(const item of partition.items)for(const key of Object.keys(sums) as (keyof typeof sums)[])sums[key]+=BigInt(item.components![key]);
  const total=Object.values(sums).reduce((a,b)=>a+b,0n);if(total>BigInt(Number.MAX_SAFE_INTEGER)||String(total)!==acc.totalUnits)fail('cost');
  const price=contracts.readPrice(fact.priceDigest),metric=contracts.readMetric(base.metric.digest),environment=contracts.readEnvironment(base.environment.digest),limits=contracts.readAccountLimits(base.accountLimits.digest);
  if(!price||price.authorityClass!==fact.producerClass||price.observedAtMs>fact.recordedAtMs||price.definition.currency!==acc.currency||price.definition.unit!==acc.unit)fail('price');
  if(!metric||metric.definition.scoreMinimum!==0||metric.definition.scoreMaximum!==1||!environment?.definition.complete||!limits?.definition.complete||(fact.executedInput as any).matches!==true||(fact.timing as any)?.scope!=='execution-queue-cleanup'||(fact.quality as any)?.metricDigest!==base.metric.digest)fail('measurement');
  if([metric,environment,limits].some((contract,n)=>{const ref=[base.metric,base.environment,base.accountLimits][n]!;return contract.id!==ref.id||contract.revision!==ref.revision||contract.authorityClass!==fact.producerClass||contract.observedAtMs>base.enrolledAtMs;}))fail('measurement');
  const known=(v:unknown)=>typeof v==='string'&&ID.test(v)&&!['unknown','unavailable','unmeasured'].includes(v);
  if(!known(fact.producerRevision)||!known((fact.timing as any).clockRevision)||fact.executionSubjects.some((s:any)=>![s.toolId,s.toolRevision,s.modelId,s.modelRevision].every(known)))fail('measurement');
  const expected=measuredTrialData(fact,base,price,c.outcome,{currency:acc.currency,unit:acc.unit,baseUnits:Number(sums.baseUnits),retryUnits:Number(sums.retryUnits),verificationUnits:Number(sums.verificationUnits),handoffUnits:Number(sums.handoffUnits)});
  if(JSON.stringify(expected)!==JSON.stringify(c.trial))fail('trial');createEvaluationStudy(base.dataset).record(expected);
 }
 function member(base:EvaluationEnrollment,obsId:string|null,factId:string|null,conversion:MeasuredTrialConversion|null,at:number):Member{
  const obs=obsId===null?null:source('evaluation_observation','observation_id',id(obsId)),fact=factId===null?null:source('evaluation_measured_fact','fact_id',id(factId));
  if(obs&&(obs.data.observationId!==obsId||obs.data.enrollmentId!==base.enrollmentId||obs.data.enrollmentDigest!==base.digest||obs.data.runId!==base.runId||obs.data.recordedAtMs>at))fail('observation');
  if(fact&&(!obs||fact.data.factId!==factId||fact.data.enrollmentId!==base.enrollmentId||fact.data.observationId!==obsId||fact.data.runId!==base.runId||fact.data.datasetDigest!==base.dataset.digest||fact.data.caseId!==base.caseId||fact.data.arm!==base.arm||fact.data.policyDigest!==base.policy.digest||fact.data.environmentDigest!==base.environment.digest||fact.data.accountLimitsDigest!==base.accountLimits.digest||fact.data.recordedAtMs>at||!['host-observed','offline-fixture'].includes(fact.data.producerClass)))fail('fact');
  if(conversion!==null){if(!fact||!obs)fail('conversion');validateConversion(conversion,fact.data,base,obs);}
  const outcome=obs?.data.outcome?.status==='recorded'?obs.data.outcome.outcome:null;if(outcome!==null&&!['success','fail','cancelled','unknown'].includes(outcome))fail('outcome');
  return freeze({enrollmentId:base.enrollmentId,enrollmentDigest:base.digest,runId:base.runId,caseId:base.caseId,split:base.split,arm:base.arm,metricDigest:base.metric.digest,
    observationId:obsId,observationDigest:obs?.digest??null,factId,factDigest:fact?.digest??null,outcome,conversion,
    reasons:!obs?['observation-missing']:!fact?['fact-missing']:!conversion?['conversion-unavailable']:[...conversion.reasons]});
 }
 function row(snapshotId:string){return db.prepare('SELECT snapshot_id,recorded_at_ms,dataset_digest,membership_digest,constraints_digest,result_digest,request_digest,payload_digest,length(CAST(payload AS BLOB)) bytes,substr(payload,1,?) payload FROM evaluation_comparison_snapshot WHERE snapshot_id=?').get(MAX+1,snapshotId) as any;}
 function decode(saved:any):MeasuredComparisonSnapshot{
  if(!saved||saved.bytes>MAX)fail('payload');let p:any;try{p=JSON.parse(saved.payload);}catch{fail('integrity');}if(p?.version!=='cue-measured-comparison-v1')fail('version');
  const req=request(p.request),at=integer(saved.recorded_at_ms),{bases,dataset}=preflight(req,at);
  if(req.snapshotId!==saved.snapshot_id||!Array.isArray(p.members)||p.members.length!==bases.length)fail('integrity');
  const members=bases.map((b,n)=>{const m=exact(p.members[n],['enrollmentId','enrollmentDigest','runId','caseId','split','arm','metricDigest','observationId','observationDigest','factId','factDigest','outcome','conversion','reasons']);return member(b,m.observationId,m.factId,m.conversion,at);});
  const expected=assemble(req,at,dataset,members),payload=JSON.stringify(expected);
  if(payload!==saved.payload||hash(expected)!==saved.payload_digest||hash(req)!==saved.request_digest||dataset.digest!==saved.dataset_digest||hash(members)!==saved.membership_digest||hash(req.constraints)!==saved.constraints_digest||hash(expected.comparison)!==saved.result_digest)fail('integrity');
  return freeze({...expected,digest:saved.payload_digest});
 }
 function read(snapshotId:string){boundary();return db.transaction(()=>{const saved=row(id(snapshotId));return saved?decode(saved):null;})();}
 return Object.freeze({read,
  list(input:{limit:number;cursor:number|null}){
   boundary();const p=exact(input,['limit','cursor']),limit=integer(p.limit),cursor=p.cursor===null?null:integer(p.cursor);
   if(limit<1||limit>20||cursor===0)fail('page');
   return db.transaction(()=>{
    if(cursor!==null&&!db.prepare('SELECT 1 FROM evaluation_comparison_snapshot WHERE rowid=?').get(cursor))fail('cursor');
    const candidates=db.prepare(`SELECT rowid,snapshot_id FROM evaluation_comparison_snapshot ${cursor===null?'':'WHERE rowid<?'} ORDER BY rowid DESC LIMIT 64`).all(...(cursor===null?[]:[cursor])) as {rowid:number;snapshot_id:string}[];
    const records=[];let scanned:number|null=null;
    for(const candidate of candidates){
     scanned=integer(candidate.rowid);if(scanned<1)fail('cursor');
     try{const saved=decode(row(candidate.snapshot_id));records.push(freeze({snapshotId:saved.request.snapshotId,recordedAtMs:saved.recordedAtMs,dataset:{id:saved.dataset.id,revision:saved.dataset.revision},mode:saved.comparison.mode,status:saved.comparison.status,numericInputs:saved.numericInputs,measurementSource:saved.comparison.measurementSource,promotionEligible:false as const,improvementProven:false as const}));}catch{/* Do not expose foreign, legacy or corrupt records. */}
     if(records.length===limit)break;
    }
    const complete=records.length<limit&&candidates.length<64;
    return freeze({version:'cue-measured-comparison-list-v1' as const,authority:'bounded-workspace-descriptive-index' as const,order:'sqlite-insertion-desc' as const,records,nextCursor:complete?null:scanned,complete});
   })();
  },
  create(input:unknown,recordedAtMs:number):MeasuredComparisonSnapshot{
   boundary();if(active.has(db))fail('reentrant');const req=request(input),at=integer(recordedAtMs),existing=row(req.snapshotId);
   if(existing){if(existing.request_digest!==hash(req))fail('replay-conflict');return read(req.snapshotId)!;}
   if(!converter)fail('host-unavailable');const before=stamp(db);active.add(db);
   try{
    const {bases,dataset}=preflight(req,at);let bytes=0;
    const selections=bases.map(base=>{const selected=latest(base);member(base,selected.observationId,selected.factId,null,at);if(selected.observationId)readEvaluationTrialOutcome(db,{enrollmentId:base.enrollmentId,observationId:selected.observationId});return selected;});
    const members=bases.map((base,index)=>{
      const selected=selections[index]!;
      let conversion:MeasuredTrialConversion|null=null;if(selected.factId){try{conversion=converter.convert({factId:selected.factId});}catch{/* Explicit unavailable slot; never drop a failed conversion. */}}
      const value=member(base,selected.observationId,selected.factId,conversion,at);bytes+=Buffer.byteLength(JSON.stringify(value));if(bytes>MAX)fail('payload');return value;
    });
    const value=assemble(req,at,dataset,members),payload=JSON.stringify(value);if(Buffer.byteLength(payload)>MAX)fail('payload');if(stamp(db)!==before)fail('concurrent-change');
    return db.transaction(()=>{
      if(stamp(db)!==before)fail('concurrent-change');for(const base of bases)if(!allowRun(base.runId))fail('scope');
      const replay=row(req.snapshotId);if(replay)fail('concurrent-change');
      db.prepare('INSERT INTO evaluation_comparison_snapshot VALUES(?,?,?,?,?,?,?,?,?)').run(req.snapshotId,at,dataset.digest,hash(members),hash(req.constraints),hash(value.comparison),hash(req),hash(value),payload);
      return freeze({...value,digest:hash(value)});
    }).immediate();
   }finally{active.delete(db);}
  },
  inspect(snapshotId:string){
    boundary();if(active.has(db))fail('reentrant');const before=stamp(db),historical=read(snapshotId);if(!historical)fail('missing');active.add(db);
    try{
      const members=historical.members.map(m=>{
        const current=latest(enrollment(m.enrollmentId));let status:'unchanged'|'changed'|'unavailable';
        if(current.observationId!==m.observationId||current.factId!==m.factId)status='changed';
        else if(!m.factId)status='unchanged';
        else if(!converter)status='unavailable';
        else{try{status=converter.convert({factId:m.factId}).digest===m.conversion?.digest?'unchanged':'changed';}catch{status='unavailable';}}
        return{enrollmentId:m.enrollmentId,factId:m.factId,status};
      });
      if(stamp(db)!==before)fail('concurrent-change');return freeze({historical,current:{authority:'evidence-revalidation-only' as const,status:members.some(m=>m.status==='unavailable')?'unavailable' as const:members.some(m=>m.status==='changed')?'changed' as const:'unchanged' as const,members},promotionEligible:false as const});
    }finally{active.delete(db);}
  }
 });
}
