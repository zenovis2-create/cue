import { types } from 'node:util';

const prefix='measured-comparison-';
const modes=['efficiency','performance','value','speed'];
const statuses=['insufficient','observed-improvement','no-observed-improvement'];
const numericKinds=['complete-cohort','withheld-incomplete-or-incompatible-cohort'];
const sources=['fixture','observed','mixed-or-empty'];
const criteriaKeys=['mode','baselinePolicyDigest','candidatePolicyDigest','maxPriceAgeMs','minPairsPerSplit','qualityFloor','minSuccessRate','maxUnknownRate','costLimitUnits','costBasisUnits','timeBasisMs','minImprovement'];
const reasonNames=new Set(('observation-missing fact-missing conversion-unavailable outcome-unavailable outcome-lineage-unavailable outcome-superseded measurement-time-order executed-input-mismatch execution-subjects-unavailable plan-execution-incomplete verification-execution-unavailable producer-revision-unavailable execution-revision-unavailable observation-attempt-coverage execution-unsettled replanned-execution-unsupported quality-domain-unsupported contract-revision-unavailable measurement-context-incomplete quality-unavailable timing-unavailable timing-scope-incomplete clock-revision-unavailable price-unavailable-or-incompatible final-monetary-accounting-unavailable accounting-superseded price-unit-mismatch cost-partition-unavailable cost-overflow cost-unit-unsupported incomplete-paired-coverage insufficient-sample mixed-measurement-provenance policy-revision-conflict future-trial unmatched-environment unknown-quality unknown-time unknown-cost incompatible-cost-units unverified-or-stale-price quality-floor success-rate-floor unknown-rate-limit quality-regression per-trial-budget-limit').split(' '));
function fail(){throw Error('IPC evaluation input denied');}
function check(ok){if(!ok)fail();}
const id=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(v);
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const fraction=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1;
function exact(v,keys){check(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k)));return v;}
// Descriptor-only bounded copy: no getters, proxies, toJSON or thenable assimilation.
// Full source is validated before projecting; no evidence references/paths are returned.
function safeCopy(input){
  let nodes=0,bytes=0;const active=new Set();
  function copy(v,depth){
    check(++nodes<=100000&&depth<=32);
    if(typeof v==='string'){bytes+=Buffer.byteLength(v);check(bytes<=2097152&&v.length<=65536);return v;}
    if(v===null||typeof v==='boolean')return v;
    if(typeof v==='number'){check(Number.isFinite(v));return v;}
    check(v&&typeof v==='object'&&!types.isProxy(v)&&!active.has(v));
    const array=Array.isArray(v),proto=Object.getPrototypeOf(v);check(array?proto===Array.prototype:proto===Object.prototype||proto===null);
    const ds=Object.getOwnPropertyDescriptors(v),keys=Reflect.ownKeys(ds);check(keys.length<=8193);active.add(v);
    let out;
    if(array){const length=ds.length;check(length&&!length.enumerable&&Object.hasOwn(length,'value')&&integer(length.value)&&length.value<=8192&&keys.length===length.value+1);out=[];for(let n=0;n<length.value;n++){const d=ds[n];check(d?.enumerable&&Object.hasOwn(d,'value'));out.push(copy(d.value,depth+1));}}
    else{out={};for(const key of keys){const d=ds[key];check(typeof key==='string'&&d.enumerable&&Object.hasOwn(d,'value'));bytes+=Buffer.byteLength(key);check(bytes<=2097152);Object.defineProperty(out,key,{value:copy(d.value,depth+1),enumerable:true});}}
    active.delete(v);return Object.freeze(out);
  }
  return copy(input,0);
}
function constraints(v){
  exact(v,criteriaKeys);check(modes.includes(v.mode)&&digest(v.baselinePolicyDigest)&&digest(v.candidatePolicyDigest));
  check(['maxPriceAgeMs','minPairsPerSplit','costBasisUnits','timeBasisMs'].every(k=>integer(v[k]))&&v.minPairsPerSplit>=2&&v.costBasisUnits>=1&&v.timeBasisMs>=1);
  check(['qualityFloor','minSuccessRate','maxUnknownRate'].every(k=>fraction(v[k]))&&(v.costLimitUnits===null||integer(v.costLimitUnits))&&(v.mode!=='performance'||v.costLimitUnits!==null)&&typeof v.minImprovement==='number'&&Number.isFinite(v.minImprovement)&&v.minImprovement>=0);return v;
}
export function measuredComparisonCommand(input){
  const v=safeCopy(input),op=v?.operation;check(typeof op==='string'&&op.startsWith(prefix));
  if(op===prefix+'create'){
    exact(v,['operation','snapshotId','baselineEnrollmentIds','candidateEnrollmentIds','constraints']);check(id(v.snapshotId));
    for(const ids of [v.baselineEnrollmentIds,v.candidateEnrollmentIds])check(Array.isArray(ids)&&ids.length>=1&&ids.length<=64&&ids.every(id));
    const ids=[...v.baselineEnrollmentIds,...v.candidateEnrollmentIds];check(new Set(ids).size===ids.length);constraints(v.constraints);
  }else if(op===prefix+'list'){exact(v,['operation','limit','cursor']);check(integer(v.limit)&&v.limit>=1&&v.limit<=20&&(v.cursor===null||integer(v.cursor)&&v.cursor>=1));}
  else{check([prefix+'read',prefix+'inspect'].includes(op));exact(v,['operation','snapshotId']);check(id(v.snapshotId));}
  return v;
}
function labels(values){check(Array.isArray(values)&&values.length<=4096);return [...new Set(values.map(v=>{check(typeof v==='string');return reasonNames.has(v)?v:'other-measurement-uncertainty';}))];}
function arm(v){
  const keys=['expectedCaseCount','enrollmentCount','outcomeDenominator','trialCount','missingEnrollmentCount','missingObservationCount','missingFactCount','nonConvertibleCount'];
  exact(v,[...keys,'outcomes']);check(keys.every(k=>integer(v[k])&&v[k]<=64));exact(v.outcomes,['success','fail','cancelled','unknown','unavailable']);check(Object.values(v.outcomes).every(integer));
  check(v.expectedCaseCount===v.outcomeDenominator&&Object.values(v.outcomes).reduce((a,b)=>a+b,0)===v.outcomeDenominator&&v.enrollmentCount+v.missingEnrollmentCount===v.expectedCaseCount&&v.trialCount<=v.enrollmentCount);return v;
}
function mean(v){if(v===null)return null;exact(v,['n','mean','sampleVariance']);check(integer(v.n)&&(v.mean===null||typeof v.mean==='number'&&Number.isFinite(v.mean))&&(v.sampleVariance===null||typeof v.sampleVariance==='number'&&Number.isFinite(v.sampleVariance)&&v.sampleVariance>=0));return v.mean;}
function numbers(v){
  check(integer(v.n)&&(v.currency===null||id(v.currency))&&(v.unit===null||['minor','micro'].includes(v.unit)));
  return {n:v.n,qualityMean:mean(v.quality),elapsedMeanMs:mean(v.elapsed),costMeanUnits:mean(v.cost),currency:v.currency,unit:v.unit};
}
function historical(v){
  check(v?.version==='cue-measured-comparison-v1'&&v.authority==='historical-measured-cohort-descriptive-only'&&v.promotionEligible===false&&v.improvementProven===false&&digest(v.digest));
  const req=measuredComparisonCommand({operation:prefix+'create',...v.request}),c=v.comparison;
  check(integer(v.recordedAtMs)&&id(v.dataset.id)&&id(v.dataset.revision)&&numericKinds.includes(v.numericInputs)&&typeof v.incompatibleMetric==='boolean');
  check(c&&statuses.includes(c.status)&&c.mode===req.constraints.mode&&sources.includes(c.measurementSource)&&c.promotionEligible===false&&c.statisticalQualification==='not-performed'&&c.qualityMetric==='non-success-scored-zero');
  check(Array.isArray(v.availability)&&v.availability.length===2&&Array.isArray(c.splits)&&c.splits.length===2);
  const splits=['evaluation','holdout'].map(name=>{
    const available=v.availability.filter(s=>s.split===name),comp=c.splits.filter(s=>s.split===name);check(available.length===1&&comp.length===1);const a=available[0],s=comp[0];check(statuses.includes(s.status));
    return {split:name,baseline:arm(a.baseline),candidate:arm(a.candidate),status:s.status,reasons:labels(s.reasons),numbers:v.numericInputs==='complete-cohort'?{baseline:numbers(s.baseline),candidate:numbers(s.candidate),pairedImprovementMean:mean(s.pairedImprovement)}:null};
  });
  check(Array.isArray(v.members)&&v.members.length<=128);
  const provenance={fixture:0,observed:0,unavailable:0};for(const member of v.members){const source=member.conversion?.source??'unavailable';check(Object.hasOwn(provenance,source));provenance[source]++;}
  check(v.reasonCounts&&typeof v.reasonCounts==='object'&&!Array.isArray(v.reasonCounts));const reasonCounts={};for(const [reason,count] of Object.entries(v.reasonCounts)){check(integer(count)&&count<=128);const key=reasonNames.has(reason)?reason:'other-measurement-uncertainty';reasonCounts[key]=(reasonCounts[key]??0)+count;}
  return {version:'cue-measured-comparison-view-v1',authority:v.authority,snapshotId:req.snapshotId,recordedAtMs:v.recordedAtMs,dataset:{id:v.dataset.id,revision:v.dataset.revision},constraints:req.constraints,status:c.status,numericInputs:v.numericInputs,incompatibleMetric:v.incompatibleMetric,measurementSource:c.measurementSource,provenance,splits,reasonCounts,promotionEligible:false,improvementProven:false,statisticalQualification:'not-performed'};
}
export function measuredComparisonProjection(input,command){
  const v=safeCopy(input),op=command.operation;let result;
  if(op===prefix+'list'){
    exact(v,['version','authority','order','records','nextCursor','complete']);check(v.version==='cue-measured-comparison-list-v1'&&v.authority==='bounded-workspace-descriptive-index'&&v.order==='sqlite-insertion-desc'&&Array.isArray(v.records)&&v.records.length<=command.limit&&typeof v.complete==='boolean'&&v.complete===(v.nextCursor===null)&&(v.nextCursor===null||integer(v.nextCursor)&&v.nextCursor>=1));
    const records=v.records.map(r=>{exact(r,['snapshotId','recordedAtMs','dataset','mode','status','numericInputs','measurementSource','promotionEligible','improvementProven']);exact(r.dataset,['id','revision']);check(id(r.snapshotId)&&integer(r.recordedAtMs)&&id(r.dataset.id)&&id(r.dataset.revision)&&modes.includes(r.mode)&&statuses.includes(r.status)&&numericKinds.includes(r.numericInputs)&&sources.includes(r.measurementSource)&&r.promotionEligible===false&&r.improvementProven===false);return r;});result={...v,records};
  }else if(op===prefix+'inspect'){
    exact(v,['historical','current','promotionEligible']);check(v.promotionEligible===false);const h=historical(v.historical);exact(v.current,['authority','status','members']);check(v.current.authority==='evidence-revalidation-only'&&['unchanged','changed','unavailable'].includes(v.current.status)&&Array.isArray(v.current.members)&&v.current.members.length===v.historical.members.length);
    const counts={unchanged:0,changed:0,unavailable:0};v.current.members.forEach((m,n)=>{exact(m,['enrollmentId','factId','status']);check(m.enrollmentId===v.historical.members[n].enrollmentId&&m.factId===v.historical.members[n].factId&&Object.hasOwn(counts,m.status));counts[m.status]++;});
    check(v.current.status===(counts.unavailable?'unavailable':counts.changed?'changed':'unchanged'));result={historical:h,current:{authority:v.current.authority,status:v.current.status,counts},promotionEligible:false,improvementProven:false};
  }else result=historical(v);
  if(op!==prefix+'list')check((result.historical??result).snapshotId===command.snapshotId);
  return safeCopy(result);
}
