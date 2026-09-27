import { types } from 'node:util';
import { measuredComparisonCommand, measuredComparisonProjection } from './measured-comparison-ipc.mjs';
import { projectCommand, projectProjection, userSessionCommand, userSessionProjection, optionalSessionId } from './workspace-management-ipc.mjs';
export const IPC_CHANNELS = Object.freeze(['cue:prepare', 'cue:planning-availability', 'cue:prepare-planning', 'cue:prepare-from-planning', 'cue:approve', 'cue:execute', 'cue:stop', 'cue:selection-preferences', 'cue:report', 'cue:resources', 'cue:prepare-json', 'cue:local-json-setup', 'cue:local-planning-setup', 'cue:retrospective', 'cue:candidate-inventory', 'cue:native-recovery', 'cue:evaluation', 'cue:workspace-sessions', 'cue:projects', 'cue:user-sessions']);

const evaluationId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(value);
const evaluationDigest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function approvalCommand(input) {
  if (!input || typeof input !== 'object' || types.isProxy(input) || Object.getPrototypeOf(input) !== Object.prototype) throw Error('IPC approval input denied');
  const fields = Object.getOwnPropertyDescriptors(input), keys = Reflect.ownKeys(fields);
  if ((keys.length !== 1 && keys.length !== 2) || !fields.runId?.enumerable || !Object.hasOwn(fields.runId, 'value')
      || typeof fields.runId.value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(fields.runId.value)) throw Error('IPC approval input denied');
  if (keys.length === 1) return Object.freeze({ runId: fields.runId.value });
  if (!fields.allowExploration?.enumerable || !Object.hasOwn(fields.allowExploration, 'value') || fields.allowExploration.value !== true) throw Error('IPC approval input denied');
  return Object.freeze({ runId: fields.runId.value, allowExploration: true });
}
function evaluationCommand(input) {
  if (!input || typeof input !== 'object' || types.isProxy(input)) throw Error('IPC evaluation input denied');
  const operation = Object.getOwnPropertyDescriptor(input, 'operation')?.value;
  if(operation==='local-contract-capture')return setupRecord(input,['operation']);
  if(typeof operation==='string'&&operation.startsWith('measured-comparison-'))return measuredComparisonCommand(input);
  const enroll = ['operation','enrollmentId','datasetId','datasetRevision','evaluationCaseId','evaluationInputDigest','holdoutCaseId','holdoutInputDigest','caseKind','caseId','arm','policyKind','policyId','policyRevision','policyDigest','metricId','metricRevision','metricDigest','environmentId','environmentRevision','environmentDigest','accountLimitsId','accountLimitsRevision','accountLimitsDigest'];
  const inputFields=Object.getOwnPropertyDescriptors(input),hasCriteria=operation==='comparison-create'&&Object.hasOwn(inputFields,'criteria');
  const baseline=operation==='baseline';
  const hasDataset=(operation==='enroll'||baseline)&&Object.hasOwn(inputFields,'dataset');
  if(hasDataset)enroll.splice(2,7,'dataset');
  const keys = baseline ? ['operation','baselineId','enrollmentId','dataset','caseId','metricId','metricRevision','metricDigest','environmentId','environmentRevision','environmentDigest','accountLimitsId','accountLimitsRevision','accountLimitsDigest'] : operation === 'enroll' ? enroll : operation === 'comparison-create' ? ['operation','snapshotId','baselineProjectionIds','candidateProjectionIds','mode',...(hasCriteria?['criteria']:[])] : operation === 'observe' ? ['operation','enrollmentId','observationId','expectedPriorRevision'] : operation === 'projection' ? ['operation','enrollmentId','observationId'] : operation === 'coverage' ? ['operation','enrollmentId','cutoffId'] : operation === 'comparison-read' ? ['operation','snapshotId'] : operation === 'measured-fact-read' ? ['operation','factId'] : ['comparison-list','projection-list','measured-fact-list'].includes(operation) ? ['operation','limit','cursor'] : [];
  if (!keys.length) throw Error('IPC evaluation input denied');
  const value = setupRecord(input, keys), ids = keys.filter(key => key !== 'operation' && !key.endsWith('Digest') && !['policyRevision','expectedPriorRevision','limit','cursor','baselineProjectionIds','candidateProjectionIds','mode','criteria','dataset'].includes(key));
  if (ids.some(key => !evaluationId(value[key]))) throw Error('IPC evaluation input denied');
  if (operation === 'comparison-create') {
    const denseIds = input => {
      if (!Array.isArray(input) || types.isProxy(input) || Object.getPrototypeOf(input) !== Array.prototype) throw Error('IPC evaluation input denied');
      const descriptors=Object.getOwnPropertyDescriptors(input),length=descriptors.length;
      if(!length||length.enumerable||!Object.hasOwn(length,'value')||!Number.isSafeInteger(length.value)||length.value<1||length.value>64||Reflect.ownKeys(descriptors).length!==length.value+1)throw Error('IPC evaluation input denied');
      return Array.from({length:length.value},(_,index)=>{const field=descriptors[String(index)];if(!field?.enumerable||!Object.hasOwn(field,'value')||!evaluationId(field.value))throw Error('IPC evaluation input denied');return field.value;});
    };
    const baseline=denseIds(value.baselineProjectionIds),candidate=denseIds(value.candidateProjectionIds);
    if(baseline.length+candidate.length>128||new Set([...baseline,...candidate]).size!==baseline.length+candidate.length||!['efficiency','performance','value','speed'].includes(value.mode))throw Error('IPC evaluation input denied');
    if(hasCriteria){const criteria=setupRecord(value.criteria,['maxPriceAgeMs','minPairsPerSplit','qualityFloor','minSuccessRate','maxUnknownRate','costLimitUnits','costBasisUnits','timeBasisMs','minImprovement']),integer=number=>Number.isSafeInteger(number)&&number>=0,fraction=number=>typeof number==='number'&&Number.isFinite(number)&&number>=0&&number<=1;if(!integer(criteria.maxPriceAgeMs)||!integer(criteria.minPairsPerSplit)||criteria.minPairsPerSplit<2||![criteria.qualityFloor,criteria.minSuccessRate,criteria.maxUnknownRate].every(fraction)||!(criteria.costLimitUnits===null||integer(criteria.costLimitUnits))||!integer(criteria.costBasisUnits)||criteria.costBasisUnits<1||!integer(criteria.timeBasisMs)||criteria.timeBasisMs<1||typeof criteria.minImprovement!=='number'||!Number.isFinite(criteria.minImprovement)||criteria.minImprovement<0||(value.mode==='performance'&&criteria.costLimitUnits===null))throw Error('IPC evaluation input denied');value.criteria=criteria;}
    value.baselineProjectionIds=baseline;value.candidateProjectionIds=candidate;
  } else if (operation === 'enroll'||baseline) {
    for (const key of keys.filter(key => key.endsWith('Digest'))) if (!evaluationDigest(value[key])) throw Error('IPC evaluation input denied');
    if(hasDataset){
      const dataset=setupRecord(value.dataset,['id','revision','cases']);
      if(!evaluationId(dataset.id)||!evaluationId(dataset.revision))throw Error('IPC evaluation input denied');
      const cases=evaluationDtoArray(dataset.cases,64).map(item=>{
        const row=setupRecord(item,['id','kind','inputDigest','split']);
        if(!evaluationId(row.id)||!evaluationDigest(row.inputDigest)||!['code','research','document','external'].includes(row.kind)||!['evaluation','holdout'].includes(row.split))throw Error('IPC evaluation input denied');
        return Object.freeze(row);
      });
      if(cases.length<2||new Set(cases.map(row=>row.id)).size!==cases.length||new Set(cases.map(row=>row.inputDigest)).size!==cases.length
        ||new Set(cases.map(row=>row.split)).size!==2||!cases.some(row=>row.id===value.caseId))throw Error('IPC evaluation input denied');
      value.dataset=Object.freeze({...dataset,cases:Object.freeze(cases)});
    }else if(!['code','research','document','external'].includes(value.caseKind)||value.evaluationCaseId===value.holdoutCaseId
      ||value.evaluationInputDigest===value.holdoutInputDigest||![value.evaluationCaseId,value.holdoutCaseId].includes(value.caseId))throw Error('IPC evaluation input denied');
    if (!baseline&&(!['efficiency','performance','value','speed'].includes(value.arm)
      || !['monetary','local-invocation'].includes(value.policyKind) || !Number.isSafeInteger(value.policyRevision) || value.policyRevision < 0)) throw Error('IPC evaluation input denied');
  } else if (operation === 'observe' && (!Number.isSafeInteger(value.expectedPriorRevision) || value.expectedPriorRevision < 0)) throw Error('IPC evaluation input denied');
  else if (['comparison-list','projection-list','measured-fact-list'].includes(operation) && (!Number.isSafeInteger(value.limit) || value.limit < 1 || value.limit > 20 || (value.cursor !== null && (!Number.isSafeInteger(value.cursor) || value.cursor < 1)))) throw Error('IPC evaluation input denied');
  return value;
}
function evaluationDtoRecord(input, keys) {
  if (!input || typeof input !== 'object' || types.isProxy(input)) throw Error('evaluation unavailable');
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) throw Error('evaluation unavailable');
  const descriptors = Object.getOwnPropertyDescriptors(input), own = Reflect.ownKeys(descriptors);
  if (own.length !== keys.length || keys.some(key => !Object.hasOwn(descriptors,key) || !descriptors[key].enumerable || !Object.hasOwn(descriptors[key],'value'))) throw Error('evaluation unavailable');
  return Object.fromEntries(keys.map(key => [key,descriptors[key].value]));
}
function evaluationDtoArray(input, limit) {
  if (!Array.isArray(input) || types.isProxy(input) || Object.getPrototypeOf(input) !== Array.prototype) throw Error('evaluation unavailable');
  const descriptors = Object.getOwnPropertyDescriptors(input), length = descriptors.length;
  if (!length || length.enumerable || !Object.hasOwn(length,'value') || !Number.isSafeInteger(length.value) || length.value < 0 || length.value > limit
    || Reflect.ownKeys(descriptors).length !== length.value + 1) throw Error('evaluation unavailable');
  const values=[]; for(let i=0;i<length.value;i++){const d=descriptors[String(i)];if(!d?.enumerable||!Object.hasOwn(d,'value'))throw Error('evaluation unavailable');values.push(d.value)} return values;
}
function evaluationDtoDiscriminator(input, key) {
  if (!input || typeof input !== 'object' || types.isProxy(input)) throw Error('evaluation unavailable');
  const prototype=Object.getPrototypeOf(input); if(prototype!==Object.prototype&&prototype!==null)throw Error('evaluation unavailable');
  const descriptor=Object.getOwnPropertyDescriptor(input,key);if(!descriptor?.enumerable||!Object.hasOwn(descriptor,'value'))throw Error('evaluation unavailable');return descriptor.value;
}
function evaluationRef(input) { const v=evaluationDtoRecord(input,['id','revision','digest']); return Object.freeze(v); }
function evaluationOutcome(input) {
  if (input === null) return null;
  const head=evaluationDtoRecord(input,evaluationDtoDiscriminator(input,'status')==='unavailable'
    ? ['status','runId','authority','reason']
    : ['status','version','runId','authority','sourceHashScope','observedTaskState','outcome','outcomeBasis','uncertaintyReasons','policy','planDigest','envelopeHash','attempts','acceptanceRef','accounting','quality','elapsedMs','trialReadiness','sourceDigest']);
  if(head.status==='unavailable') return Object.freeze({status:head.status,outcome:null,quality:null,elapsedMs:null,reason:head.reason});
  evaluationDtoArray(head.uncertaintyReasons,4096);
  evaluationDtoRecord(head.policy,['kind','id','idDigest','revision','digest','mode']);
  for(const item of evaluationDtoArray(head.attempts,1024)){
    const attempt=evaluationDtoRecord(item,['attemptId','taskId','taskIdDigest','candidateId','candidateIdDigest','role','state','cleanup','selection','toolRevision','modelRevision']);
    evaluationDtoRecord(attempt.selection,['status','digest']);
  }
  if(head.acceptanceRef!==null)evaluationDtoRecord(head.acceptanceRef,['evaluationId','verdict','accepted','acceptedAt']);
  const kind=evaluationDtoDiscriminator(head.accounting,'kind');
  const accounting=evaluationDtoRecord(head.accounting,kind==='monetary'?['kind','currency','unit','final','actualUnits','committedUnits','remainingUnits','debtUnits','receipts','breakdown']
    :kind==='local-invocation'?['kind','limit','committed','remaining','semantics','providerBilling']:['kind']);
  if(kind==='monetary'){
    for(const receipt of evaluationDtoArray(accounting.receipts,4096))evaluationDtoRecord(receipt,['receiptId','requestId','revision','kind','units','providerFinal']);
    evaluationDtoRecord(accounting.breakdown,['baseUnits','retryUnits','handoffUnits','verificationUnits']);
  }
  const readiness=evaluationDtoRecord(head.trialReadiness,['status','reasons']); evaluationDtoArray(readiness.reasons,4096);
  return Object.freeze({status:head.status,outcome:head.outcome,quality:head.quality,elapsedMs:head.elapsedMs,reason:null});
}
function evaluationObservationProjection(input) {
  const value=evaluationDtoRecord(input,['version','authority','observationId','enrollmentId','enrollmentDigest','runId','revision','supersedesObservationId','recordedAtMs','outcome','digest']);
  return Object.freeze({version:value.version,authority:value.authority,observationId:value.observationId,enrollmentId:value.enrollmentId,runId:value.runId,revision:value.revision,supersedesObservationId:value.supersedesObservationId,recordedAtMs:value.recordedAtMs,outcome:evaluationOutcome(value.outcome),digest:value.digest});
}
const evaluationComparisonReasons=Object.freeze(['incomplete-paired-coverage','insufficient-sample','mixed-measurement-provenance','policy-revision-conflict','future-trial','unmatched-environment','unknown-quality','unknown-time','unknown-cost','incompatible-cost-units','unverified-or-stale-price','quality-floor','success-rate-floor','unknown-rate-limit','quality-regression','per-trial-budget-limit']);
const evaluationNonConvertibleReasons=Object.freeze(['tool-revision-unavailable','model-revision-unavailable','quality-unavailable','elapsed-unavailable','price-observed-at-unavailable','price-source-unavailable','base-cost-unavailable','retry-cost-unavailable','handoff-cost-unavailable','verification-cost-unavailable','outcome-unavailable','currency-unit-unavailable']);
function evaluationTrialProjection(input) {
  const value=evaluationDtoRecord(input,['version','authority','projectionId','enrollmentId','enrollmentDigest','observationId','observationDigest','runId','dataset','caseId','inputDigest','split','arm','policy','metric','environment','accountLimits','observedAtMs','outcome','outcomeAvailability','nonConvertibleReasons','trial','limitation','digest']);
  const dataset=evaluationDtoRecord(value.dataset,['id','revision','digest']),policy=evaluationDtoRecord(value.policy,['kind','policyId','revision','digest']);
  evaluationRef(value.metric);evaluationRef(value.environment);evaluationRef(value.accountLimits);
  const reasons=evaluationDtoArray(value.nonConvertibleReasons,evaluationNonConvertibleReasons.length);
  if(value.version!=='cue-evaluation-trial-projection-v1'||value.authority!=='stored-enrollment-observation-outcome-only'||![value.projectionId,value.enrollmentId,value.observationId,value.runId,dataset.id,dataset.revision,value.caseId].every(evaluationId)||![value.enrollmentDigest,value.observationDigest,dataset.digest,value.inputDigest,value.digest].every(evaluationDigest)||!['evaluation','holdout'].includes(value.split)||!['efficiency','performance','value','speed','manual-baseline'].includes(value.arm)||!['monetary','local-invocation'].includes(policy.kind)||!evaluationId(policy.policyId)||!Number.isSafeInteger(policy.revision)||policy.revision<0||!evaluationDigest(policy.digest)||!Number.isSafeInteger(value.observedAtMs)||value.observedAtMs<0||![null,'success','fail','cancelled','unknown'].includes(value.outcome)||!['recorded','unavailable'].includes(value.outcomeAvailability)||(value.outcomeAvailability==='recorded')!==(value.outcome!==null)||(value.outcomeAvailability==='unavailable')!==reasons.includes('outcome-unavailable')||value.trial!==null||value.limitation!=='current-outcome-contract-does-not-store-required-trial-measurements'||reasons.some(reason=>typeof reason!=='string'||!evaluationNonConvertibleReasons.includes(reason))||new Set(reasons).size!==reasons.length)throw Error('evaluation unavailable');
  return Object.freeze({version:value.version,authority:value.authority,projectionId:value.projectionId,enrollmentId:value.enrollmentId,observationId:value.observationId,split:value.split,arm:value.arm,observedAtMs:value.observedAtMs,outcome:value.outcome,outcomeAvailability:value.outcomeAvailability,nonConvertibleReasons:Object.freeze(reasons),trial:null,limitation:value.limitation,promotionEligible:false});
}
function evaluationCount(value) { if(!Number.isSafeInteger(value)||value<0)throw Error('evaluation unavailable');return value; }
function evaluationReasonArray(input) {
  const values=evaluationDtoArray(input,evaluationComparisonReasons.length);
  if(values.some(value=>typeof value!=='string'||!evaluationComparisonReasons.includes(value))||new Set(values).size!==values.length)throw Error('evaluation unavailable');
  return Object.freeze(values);
}
function evaluationReasonCounts(input, allowed) {
  if(!input||typeof input!=='object'||types.isProxy(input))throw Error('evaluation unavailable');
  const prototype=Object.getPrototypeOf(input);if(prototype!==Object.prototype&&prototype!==null)throw Error('evaluation unavailable');
  const descriptors=Object.getOwnPropertyDescriptors(input),result={};
  for(const key of Reflect.ownKeys(descriptors)){const descriptor=descriptors[key];if(typeof key!=='string'||!allowed.includes(key)||!descriptor.enumerable||!Object.hasOwn(descriptor,'value'))throw Error('evaluation unavailable');result[key]=evaluationCount(descriptor.value);}
  return Object.freeze(result);
}
function evaluationArmAvailability(input) {
  const value=evaluationDtoRecord(input,['projectionCount','trialCount','missingProjectionCount','missingTrialCount','outcomeDenominator','outcomes']);
  const outcomes=evaluationDtoRecord(value.outcomes,['success','fail','cancelled','unknown','unavailable']);
  for(const key of ['projectionCount','trialCount','missingProjectionCount','missingTrialCount','outcomeDenominator'])evaluationCount(value[key]);
  for(const key of ['success','fail','cancelled','unknown','unavailable'])evaluationCount(outcomes[key]);
  return Object.freeze({...value,outcomes:Object.freeze(outcomes)});
}
function evaluationComparisonProjection(input) {
  const value=evaluationDtoRecord(input,['version','authority','snapshotId','recordedAtMs','dataset','membership','cutoff','constraints','comparison','availability','datasetDigest','membershipDigest','constraintsDigest','resultDigest','promotionEligible','digest']);
  const dataset=evaluationDtoRecord(value.dataset,['id','revision','digest']);
  const comparison=evaluationDtoRecord(value.comparison,['datasetDigest','mode','constraints','measurementSource','qualityMetric','status','splits','promotionEligible','statisticalQualification','numericPrecision']);
  const stored=evaluationDtoRecord(comparison.constraints,['mode','baselinePolicyDigest','candidatePolicyDigest','nowMs','maxPriceAgeMs','minPairsPerSplit','qualityFloor','minSuccessRate','maxUnknownRate','costLimitUnits','costBasisUnits','timeBasisMs','minImprovement']);
  const statuses=['insufficient','observed-improvement','no-observed-improvement'],modes=['efficiency','performance','value','speed'];
  const integer=number=>Number.isSafeInteger(number)&&number>=0,fraction=number=>typeof number==='number'&&Number.isFinite(number)&&number>=0&&number<=1;
  if(value.version!=='cue-evaluation-comparison-snapshot-v1'||value.authority!=='immutable-projection-membership-descriptive-only'||!evaluationId(value.snapshotId)||!Number.isSafeInteger(value.recordedAtMs)||value.recordedAtMs<0||!evaluationId(dataset.id)||!evaluationId(dataset.revision)||!evaluationDigest(dataset.digest)||!modes.includes(comparison.mode)||stored.mode!==comparison.mode||!evaluationDigest(stored.baselinePolicyDigest)||!evaluationDigest(stored.candidatePolicyDigest)||![stored.nowMs,stored.maxPriceAgeMs,stored.minPairsPerSplit,stored.costBasisUnits,stored.timeBasisMs].every(integer)||stored.minPairsPerSplit<2||stored.costBasisUnits<1||stored.timeBasisMs<1||![stored.qualityFloor,stored.minSuccessRate,stored.maxUnknownRate].every(fraction)||!(stored.costLimitUnits===null||integer(stored.costLimitUnits))||(stored.mode==='performance'&&stored.costLimitUnits===null)||typeof stored.minImprovement!=='number'||!Number.isFinite(stored.minImprovement)||stored.minImprovement<0||!statuses.includes(comparison.status)||comparison.promotionEligible!==false||value.promotionEligible!==false||comparison.statisticalQualification!=='not-performed'||!evaluationDigest(value.digest))throw Error('evaluation unavailable');
  const splits=evaluationDtoArray(comparison.splits,2).map(item=>{const split=evaluationDtoRecord(item,['split','baseline','candidate','pairedImprovement','status','reasons']);if(!['evaluation','holdout'].includes(split.split)||!statuses.includes(split.status))throw Error('evaluation unavailable');return Object.freeze({split:split.split,status:split.status,reasons:evaluationReasonArray(split.reasons)});});
  if(splits.length!==2||new Set(splits.map(item=>item.split)).size!==2)throw Error('evaluation unavailable');
  const availability=evaluationDtoRecord(value.availability,['splits','nonConvertibleReasonCounts','comparisonReasonCounts']);
  const availableSplits=evaluationDtoArray(availability.splits,2).map(item=>{const split=evaluationDtoRecord(item,['split','expectedCaseCount','baseline','candidate']);if(!['evaluation','holdout'].includes(split.split))throw Error('evaluation unavailable');return Object.freeze({split:split.split,expectedCaseCount:evaluationCount(split.expectedCaseCount),baseline:evaluationArmAvailability(split.baseline),candidate:evaluationArmAvailability(split.candidate)});});
  if(availableSplits.length!==2||new Set(availableSplits.map(item=>item.split)).size!==2)throw Error('evaluation unavailable');
  const criteria=Object.freeze(Object.fromEntries(['maxPriceAgeMs','minPairsPerSplit','qualityFloor','minSuccessRate','maxUnknownRate','costLimitUnits','costBasisUnits','timeBasisMs','minImprovement'].map(key=>[key,stored[key]])));
  return Object.freeze({version:'cue-evaluation-comparison-view-v1',authority:'immutable-descriptive-replay-only',snapshotId:value.snapshotId,recordedAtMs:value.recordedAtMs,dataset:Object.freeze(dataset),mode:comparison.mode,criteria,status:comparison.status,statisticalQualification:comparison.statisticalQualification,promotionEligible:false,splits:Object.freeze(splits),availability:Object.freeze({splits:Object.freeze(availableSplits),nonConvertibleReasonCounts:evaluationReasonCounts(availability.nonConvertibleReasonCounts,evaluationNonConvertibleReasons),comparisonReasonCounts:evaluationReasonCounts(availability.comparisonReasonCounts,evaluationComparisonReasons)}),digest:value.digest});
}
function evaluationComparisonListProjection(input) {
  const value=evaluationDtoRecord(input,['version','authority','order','records','nextCursor','complete']);
  if(value.version!=='cue-evaluation-comparison-list-v1'||value.authority!=='bounded-workspace-descriptive-index'||value.order!=='sqlite-insertion-desc'||typeof value.complete!=='boolean'||(value.nextCursor!==null&&(!Number.isSafeInteger(value.nextCursor)||value.nextCursor<1)))throw Error('evaluation unavailable');
  const statuses=['insufficient','observed-improvement','no-observed-improvement'],modes=['efficiency','performance','value','speed'];
  const records=evaluationDtoArray(value.records,20).map(input=>{const row=evaluationDtoRecord(input,['snapshotId','recordedAtMs','dataset','mode','status','promotionEligible']),dataset=evaluationDtoRecord(row.dataset,['id','revision']);if(!evaluationId(row.snapshotId)||!Number.isSafeInteger(row.recordedAtMs)||row.recordedAtMs<0||!evaluationId(dataset.id)||!evaluationId(dataset.revision)||!modes.includes(row.mode)||!statuses.includes(row.status)||row.promotionEligible!==false)throw Error('evaluation unavailable');return Object.freeze({...row,dataset:Object.freeze(dataset),promotionEligible:false})});
  if(value.complete!== (value.nextCursor===null))throw Error('evaluation unavailable');
  return Object.freeze({...value,records:Object.freeze(records)});
}
function evaluationProjectionListProjection(input) {
  const value=evaluationDtoRecord(input,['version','authority','order','records','nextCursor','complete']);
  if(value.version!=='cue-evaluation-projection-list-v1'||value.authority!=='bounded-workspace-descriptive-index'||value.order!=='sqlite-insertion-desc'||typeof value.complete!=='boolean'||(value.nextCursor!==null&&(!Number.isSafeInteger(value.nextCursor)||value.nextCursor<1)))throw Error('evaluation unavailable');
  const arms=['manual-baseline','efficiency','performance','value','speed'],outcomes=['success','fail','cancelled','unknown'];
  const records=evaluationDtoArray(value.records,20).map(input=>{const row=evaluationDtoRecord(input,['projectionId','dataset','caseId','split','arm','observedAtMs','outcomeAvailability','outcome','trialReady','promotionEligible']),dataset=evaluationDtoRecord(row.dataset,['id','revision']);if(!evaluationId(row.projectionId)||!evaluationId(dataset.id)||!evaluationId(dataset.revision)||!evaluationId(row.caseId)||!['evaluation','holdout'].includes(row.split)||!arms.includes(row.arm)||!Number.isSafeInteger(row.observedAtMs)||row.observedAtMs<0||!['recorded','unavailable'].includes(row.outcomeAvailability)||(row.outcome!==null&&!outcomes.includes(row.outcome))||(row.outcomeAvailability==='recorded')!==(row.outcome!==null)||row.trialReady!==false||row.promotionEligible!==false)throw Error('evaluation unavailable');return Object.freeze({...row,dataset:Object.freeze(dataset),trialReady:false,promotionEligible:false})});
  if(value.complete!==(value.nextCursor===null))throw Error('evaluation unavailable');return Object.freeze({...value,records:Object.freeze(records)});
}
function evaluationProjection(input, operation) {
  if (operation === 'enroll') {
    const value=evaluationDtoRecord(input,['version','authority','enrollmentId','runId','dataset','caseId','inputDigest','split','arm','policy','metric','environment','accountLimits','enrolledAtMs','inputBinding','digest']);
    const dataset=evaluationDtoRecord(value.dataset,['id','revision','cases','digest']);
    for(const item of evaluationDtoArray(dataset.cases,2048))evaluationDtoRecord(item,['id','kind','inputDigest','split']);
    const policy=evaluationDtoRecord(value.policy,['kind','policyId','revision','digest']);
    return Object.freeze({version:value.version,authority:value.authority,enrollmentId:value.enrollmentId,runId:value.runId,dataset:Object.freeze({id:dataset.id,revision:dataset.revision,digest:dataset.digest}),caseId:value.caseId,inputDigest:value.inputDigest,split:value.split,arm:value.arm,policy:Object.freeze(policy),metric:evaluationRef(value.metric),environment:evaluationRef(value.environment),accountLimits:evaluationRef(value.accountLimits),inputBinding:value.inputBinding,digest:value.digest});
  }
  if (operation === 'observe') return evaluationObservationProjection(input);
  if (operation === 'projection') return evaluationTrialProjection(input);
  if (operation === 'comparison-read' || operation === 'comparison-create') return evaluationComparisonProjection(input);
  if (operation === 'comparison-list') return evaluationComparisonListProjection(input);
  if (operation === 'projection-list') return evaluationProjectionListProjection(input);
  const value=evaluationDtoRecord(input,['version','authority','membershipRelation','datasetDigest','arm','policyDigest','cutoff','expectedCases','enrolledSlotCount','slots']);
  const cutoff=evaluationDtoRecord(value.cutoff,['observationId','recordedAtMs']);
  const expected=evaluationDtoArray(value.expectedCases,4096).map(row=>Object.freeze(evaluationDtoRecord(row,['caseId','split','inputDigest'])));
  const slots=evaluationDtoArray(value.slots,4096).map(row=>{const slot=evaluationDtoRecord(row,['enrollmentId','caseId','runId','observation']);return Object.freeze({enrollmentId:slot.enrollmentId,caseId:slot.caseId,runId:slot.runId,observation:slot.observation===null?null:evaluationObservationProjection(slot.observation)})});
  return Object.freeze({version:value.version,authority:value.authority,membershipRelation:value.membershipRelation,datasetDigest:value.datasetDigest,arm:value.arm,policyDigest:value.policyDigest,cutoff:Object.freeze(cutoff),expectedCases:Object.freeze(expected),enrolledSlotCount:value.enrolledSlotCount,slots:Object.freeze(slots)});
}
function localEvaluationContractProjection(input){
  const v=evaluationDtoRecord(input,['version','authority','metric','environment','missing','qualityMeasured','executedInputVerified','trialReady','promotionEligible']);
  if(v.version!=='cue-local-evaluation-contracts-v1'||v.authority!=='local-contract-registration-only'||[v.qualityMeasured,v.executedInputVerified,v.trialReady,v.promotionEligible].some(x=>x!==false))throw Error('evaluation unavailable');
  const missing=evaluationDtoArray(v.missing,7),expected=['execution-input','execution-sandbox','provider-installation','model-revision','account-limits','price','resource-contention'];
  if(JSON.stringify(missing)!==JSON.stringify(expected))throw Error('evaluation unavailable');
  const contract=(input,kind)=>{
    const c=evaluationDtoRecord(input,['kind','id','revision','digest','authorityClass','sourceRevision','sourceDigest','observedAtMs','definition']);
    if(c.kind!==kind||c.authorityClass!=='host-observed'||![c.id,c.revision,c.sourceRevision].every(evaluationId)||![c.digest,c.sourceDigest].every(evaluationDigest)||!Number.isSafeInteger(c.observedAtMs)||c.observedAtMs<0)throw Error('evaluation unavailable');
    return c;
  };
  const metric=contract(v.metric,'metric'),environment=contract(v.environment,'environment'),m=evaluationDtoRecord(metric.definition,['scoreMinimum','scoreMaximum','algorithmRevision']),e=evaluationDtoRecord(environment.definition,['schemaRevision','complete','fields']);
  if(metric.id!=='cue-exact-artifact-quality'||environment.id!=='cue-local-process-environment'||m.scoreMinimum!==0||m.scoreMaximum!==1||!evaluationId(m.algorithmRevision)||e.complete!==false||e.schemaRevision!=='cue-local-process-environment-v1')throw Error('evaluation unavailable');
  const fields=evaluationDtoRecord(e.fields,['scope','local','checkerId','checkerRevision','checkerCodeDigest','producerCodeDigest','codeObservation','missing']);
  if(fields.scope!=='local-process-at-capture-only'||fields.codeObservation!=='regular-file-bytes-not-loaded-memory'||!evaluationId(fields.checkerId)||!evaluationId(fields.checkerRevision)||![fields.checkerCodeDigest,fields.producerCodeDigest].every(evaluationDigest)||JSON.stringify(evaluationDtoArray(fields.missing,7))!==JSON.stringify(expected))throw Error('evaluation unavailable');
  const local=evaluationDtoRecord(fields.local,['osType','osRelease','osPlatform','osArchitecture','processArchitecture','nodeVersion','v8Version','electronVersion','chromeVersion']);
  if(Object.values(local).some(x=>x!==null&&(typeof x!=='string'||x.length>256)))throw Error('evaluation unavailable');
  const ref=c=>Object.freeze({id:c.id,revision:c.revision,digest:c.digest,observedAtMs:c.observedAtMs});
  return Object.freeze({version:v.version,authority:v.authority,metric:ref(metric),environment:ref(environment),environmentComplete:false,scope:fields.scope,missing:Object.freeze(missing),qualityMeasured:false,executedInputVerified:false,trialReady:false,promotionEligible:false});
}
function evaluationMeasuredFactProjection(input) {
  const value=evaluationDtoRecord(input,['version','authority','factId','factDigest','enrollmentId','observationId','runId','datasetDigest','caseId','arm','policyDigest','producer','executedInput','attempts','measurements','contracts','uncertaintyReasons','trialReady','promotionEligible','digest']);
  const producer=evaluationDtoRecord(value.producer,['class','revision','digest','recordedAtMs']);
  evaluationDtoRecord(value.executedInput,['expectedDigest','actualDigest','matches','evidenceDigest']);
  const attempts=evaluationDtoArray(value.attempts,1024).map(input=>{const row=evaluationDtoRecord(input,['attemptId','role','state','retryOf','candidateDigest','launchIntentDigest','identityDigest','handoffDigest','toolId','toolRevision','modelId','modelRevision']);if(![row.attemptId,row.role,row.state,row.toolId,row.toolRevision].every(evaluationId)||!(row.retryOf===null||evaluationId(row.retryOf))||!(row.modelId===null||evaluationId(row.modelId))||!(row.modelRevision===null||evaluationId(row.modelRevision)))throw Error('evaluation unavailable');return Object.freeze({attemptId:row.attemptId,role:row.role,state:row.state,toolId:row.toolId,toolRevision:row.toolRevision,modelId:row.modelId,modelRevision:row.modelRevision})});
  const measurements=evaluationDtoRecord(value.measurements,['quality','timing','accounting']),quality=evaluationDtoRecord(measurements.quality,evaluationDtoDiscriminator(measurements.quality,'availability')==='available'?['availability','metricDigest','verifierProducerDigest','evidenceDigest']:['availability']),timing=evaluationDtoRecord(measurements.timing,evaluationDtoDiscriminator(measurements.timing,'availability')==='available'?['availability','elapsedMs','clockId','clockRevision','clockDigest','evidenceDigest','scope']:['availability']),accounting=evaluationDtoRecord(measurements.accounting,['availability','kind','priceDigest']);
  evaluationDtoRecord(value.contracts,['environmentDigest','accountLimitsDigest','priceDigest']);const reasons=evaluationDtoArray(value.uncertaintyReasons,256);
  if(value.version!=='cue-evaluation-measured-fact-evidence-v1'||value.authority!=='measured-fact-evidence-only'||!evaluationId(value.factId)||!['host-observed','offline-fixture'].includes(producer.class)||!evaluationId(producer.revision)||!Number.isSafeInteger(producer.recordedAtMs)||producer.recordedAtMs<0||!['available','unavailable'].includes(quality.availability)||!['available','unavailable'].includes(timing.availability)||!['available','unavailable'].includes(accounting.availability)||!['unknown','local-invocation','monetary'].includes(accounting.kind)||accounting.availability!==(accounting.kind==='unknown'?'unavailable':'available')||(timing.availability==='available'&&(!Number.isSafeInteger(timing.elapsedMs)||timing.elapsedMs<0))||reasons.some(reason=>typeof reason!=='string'||reason.length>256)||value.trialReady!==false||value.promotionEligible!==false)throw Error('evaluation unavailable');
  return Object.freeze({version:value.version,authority:value.authority,factId:value.factId,producer:Object.freeze({class:producer.class,revision:producer.revision,recordedAtMs:producer.recordedAtMs}),attempts:Object.freeze(attempts),measurements:Object.freeze({quality:Object.freeze({availability:quality.availability}),timing:Object.freeze(timing.availability==='available'?{availability:'available',elapsedMs:timing.elapsedMs}:{availability:'unavailable'}),accounting:Object.freeze({availability:accounting.availability,kind:accounting.kind})}),uncertaintyCount:reasons.length,trialReady:false,promotionEligible:false});
}
function evaluationMeasuredFactListProjection(input){
  const value=evaluationDtoRecord(input,['version','authority','order','records','nextCursor','complete']);
  if(value.version!=='cue-evaluation-measured-fact-list-v1'||value.authority!=='bounded-workspace-descriptive-index'||value.order!=='sqlite-insertion-desc'||typeof value.complete!=='boolean'||(value.nextCursor!==null&&(!Number.isSafeInteger(value.nextCursor)||value.nextCursor<1))||value.complete!==(value.nextCursor===null))throw Error('evaluation unavailable');
  const records=evaluationDtoArray(value.records,20).map(input=>{const row=evaluationDtoRecord(input,['factId','producer','trialReady','promotionEligible']),producer=evaluationDtoRecord(row.producer,['class','revision','recordedAtMs']);if(!evaluationId(row.factId)||!['host-observed','offline-fixture'].includes(producer.class)||!evaluationId(producer.revision)||!Number.isSafeInteger(producer.recordedAtMs)||producer.recordedAtMs<0||row.trialReady!==false||row.promotionEligible!==false)throw Error('evaluation unavailable');return Object.freeze({factId:row.factId,producer:Object.freeze(producer),trialReady:false,promotionEligible:false});});
  return Object.freeze({...value,records:Object.freeze(records)});
}

const recoveryId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(value);
const recoveryRef = value => typeof value === 'string' && /^cue-native-identity:[a-f0-9]{64}$/.test(value);
function recoveryCommand(input) {
  if (!input || typeof input !== 'object' || types.isProxy(input)) throw Error('IPC recovery input denied');
  const operation = Object.getOwnPropertyDescriptor(input, 'operation')?.value;
  if (operation === 'runs') return setupRecord(input, ['operation']);
  if (!['list','observe'].includes(operation)) throw Error('IPC recovery input denied');
  const value = setupRecord(input, operation === 'list' ? ['operation','runId'] : ['operation','runId','attemptId','identityRef']);
  if (!recoveryId(value.runId) || (operation === 'observe' && (!recoveryId(value.attemptId) || !recoveryRef(value.identityRef)))) throw Error('IPC recovery input denied');
  return value;
}
function recoveryProjection(value, command) {
  if (command.operation === 'runs') {
    const v = setupRecord(value, ['version','authority','records','truncated','scanTruncated']);
    if (v.version !== 'cue-native-recovery-runs-v1' || v.authority !== 'observation-only' || typeof v.truncated !== 'boolean' || typeof v.scanTruncated !== 'boolean'
      || !Array.isArray(v.records) || types.isProxy(v.records) || v.records.length > 50 || Reflect.ownKeys(v.records).length !== v.records.length + 1) throw Error('recovery unavailable');
    const records = [];
    for (let i=0;i<v.records.length;i++) {
      const descriptor = Object.getOwnPropertyDescriptor(v.records, String(i)); if (!descriptor || !Object.hasOwn(descriptor,'value')) throw Error('recovery unavailable');
      const row = setupRecord(descriptor.value, ['runId','state','recordedAttemptCount','identityRecordCount','missingIdentityAttemptCount','missingStageLinkCount','recordStatus']);
      if (typeof row.runId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(row.runId)
        || records.some(r => r.runId === row.runId) || !['awaiting_approval','running','completed','failed','blocked','cancelled','unknown'].includes(row.state)) throw Error('recovery unavailable');
      for (const key of ['recordedAttemptCount','identityRecordCount','missingIdentityAttemptCount','missingStageLinkCount']) if (!Number.isSafeInteger(row[key]) || row[key]<0) throw Error('recovery unavailable');
      if (row.missingIdentityAttemptCount > row.recordedAttemptCount || row.missingStageLinkCount > row.recordedAttemptCount
        || row.recordStatus !== (row.missingStageLinkCount > 0 ? 'lineage-incomplete' : row.identityRecordCount > 0 ? 'recorded-unverified' : 'no-recorded-identities')) throw Error('recovery unavailable');
      records.push(Object.freeze(row));
    }
    return Object.freeze({ ...v, records: Object.freeze(records) });
  }
  if (!value || value.authority !== 'observation-only' || value.runId !== command.runId) throw Error('recovery unavailable');
  if (command.operation === 'list') {
    if (!Array.isArray(value.records) || value.records.length > 64 || typeof value.truncated !== 'boolean') throw Error('recovery unavailable');
    const records = value.records.map(row => {
      if (!recoveryId(row.attemptId) || !recoveryRef(row.identityRef) || typeof row.candidateId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/.test(row.candidateId)) throw Error('recovery unavailable');
      return Object.freeze({ attemptId: row.attemptId, identityRef: row.identityRef, candidateId: row.candidateId });
    });
    return Object.freeze({ authority: 'observation-only', runId: command.runId, records: Object.freeze(records), truncated: value.truncated });
  }
  if (value.attemptId !== command.attemptId || value.identityRef !== command.identityRef || !['native','fixture'].includes(value.sourceKind)
    || typeof value.observedAt !== 'string' || value.observedAt.length > 32 || !Number.isFinite(Date.parse(value.observedAt))) throw Error('recovery unavailable');
  const processes = {}, paths = {};
  for (const key of ['launcher','client','guardian']) {
    const state = value.processes?.[key];
    if (!['matching-alive','matching-exited','pid-reused','absent','unknown'].includes(state)) throw Error('recovery unavailable'); processes[key] = state;
  }
  for (const key of ['taskRoot','profileRoot','profilePath']) {
    const state = value.paths?.[key]; if (!['present','absent','unknown'].includes(state)) throw Error('recovery unavailable'); paths[key] = state;
  }
  if (!['matched','unknown'].includes(value.pathProvenance)) throw Error('recovery unavailable');
  let journal = Object.freeze({ state: 'unavailable' });
  const journalReasonCodes = ['handoff-unavailable','handoff-integrity-unavailable','external-effect-authority-unavailable','cleanup-or-death-unverified','native-journal-observation-unavailable'];
  const journalField = Object.getOwnPropertyDescriptor(value, 'journal');
  const detail = journalField && Object.hasOwn(journalField, 'value') ? journalField.value : null;
  if (detail && typeof detail === 'object' && !types.isProxy(detail) && Object.getPrototypeOf(detail) === Object.prototype) {
    const fields = Object.getOwnPropertyDescriptors(detail);
    const state = fields.state && Object.hasOwn(fields.state, 'value') ? fields.state.value : null;
    const revision = fields.revision && Object.hasOwn(fields.revision, 'value') ? fields.revision.value : null;
    const reasonCode = fields.reasonCode && Object.hasOwn(fields.reasonCode, 'value') && journalReasonCodes.includes(fields.reasonCode.value) ? fields.reasonCode.value : null;
    if (state === 'unavailable') journal = Object.freeze({ state, ...(reasonCode ? { reasonCode } : {}) });
    else if (['held', 'eligible-for-disposition', 'reconciled-stop'].includes(state) && Number.isSafeInteger(revision)
        && (state === 'held' ? revision === 0 : revision > 0)) journal = Object.freeze({ state, revision, ...(state === 'held' && reasonCode ? { reasonCode } : {}) });
  }
  return Object.freeze({ authority: 'observation-only', runId: command.runId, attemptId: command.attemptId, identityRef: command.identityRef,
    sourceKind: value.sourceKind, observedAt: value.observedAt, processes: Object.freeze(processes), paths: Object.freeze(paths), pathProvenance: value.pathProvenance, journal });
}

function retrospectiveCommand(input) {
  if (!input || typeof input !== 'object' || types.isProxy(input) || Object.getPrototypeOf(input) !== Object.prototype) throw Error('IPC retrospective input denied');
  const fields = Object.getOwnPropertyDescriptors(input), operation = fields.operation?.value;
  const keys = operation === 'create' ? ['operation', 'draftId', 'runId'] : operation === 'read' ? ['operation', 'draftId'] : [];
  if (!keys.length || Reflect.ownKeys(input).length !== keys.length || keys.some(key => !fields[key]?.enumerable || !Object.hasOwn(fields[key], 'value'))) throw Error('IPC retrospective input denied');
  const value = Object.fromEntries(keys.map(key => [key, fields[key].value]));
  if (keys.slice(1).some(key => typeof value[key] !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(value[key]))) throw Error('IPC retrospective input denied');
  return value;
}

function setupRecord(input, keys) {
  if (!input || typeof input !== 'object' || types.isProxy(input) || Object.getPrototypeOf(input) !== Object.prototype) throw Error('IPC setup input denied');
  const fields = Object.getOwnPropertyDescriptors(input);
  if (Reflect.ownKeys(input).length !== keys.length || keys.some(key => !fields[key]?.enumerable || !Object.hasOwn(fields[key], 'value'))) throw Error('IPC setup input denied');
  return Object.fromEntries(keys.map(key => [key, fields[key].value]));
}
function workspaceSessionCommand(input){
  if(!input||typeof input!=='object'||types.isProxy(input))throw Error('IPC session input denied');
  const operation=Object.getOwnPropertyDescriptor(input,'operation')?.value;
  const value=setupRecord(input,operation==='list'?['operation','limit','cursor']:operation==='read'?['operation','runId']:[]);
  if(operation==='list'&&Number.isSafeInteger(value.limit)&&value.limit>=1&&value.limit<=20
    &&(value.cursor===null||Number.isSafeInteger(value.cursor)&&value.cursor>=1))return value;
  if(operation==='read'&&evaluationId(value.runId))return value;
  throw Error('IPC session input denied');
}
function workspaceSessionProjection(input,operation){
  const v=evaluationDtoRecord(input,operation==='list'?['version','authority','project','records','nextCursor','complete']
    :['version','authority','project','session','limitation']);
  const project=evaluationDtoRecord(v.project,['name','root']);
  if(typeof project.name!=='string'||project.name.length>256||typeof project.root!=='string'||project.root.length>4096)throw Error('session unavailable');
  const record=item=>{const r=evaluationDtoRecord(item,['runId','taskId','state','startedAt','title']);
    if(!evaluationId(r.runId)||!evaluationId(r.taskId)||!['queued','running','awaiting_approval','blocked','completed','failed'].includes(r.state)
      ||typeof r.startedAt!=='string'||r.startedAt.length>128||typeof r.title!=='string'||r.title.length>120)throw Error('session unavailable');
    return Object.freeze(r);};
  if(operation==='list'){
    if(v.version!=='cue-workspace-sessions-v1'||v.authority!=='historical-ledger-index-only'||typeof v.complete!=='boolean'
      ||v.complete!==(v.nextCursor===null)||(v.nextCursor!==null&&(!Number.isSafeInteger(v.nextCursor)||v.nextCursor<1)))throw Error('session unavailable');
    return Object.freeze({...v,project:Object.freeze(project),records:Object.freeze(evaluationDtoArray(v.records,20).map(record))});
  }
  if(v.version!=='cue-workspace-session-v1'||v.authority!=='historical-ledger-read-only'||v.limitation!=='stored-run-only-no-reconnect-or-execution-authority')throw Error('session unavailable');
  const s=evaluationDtoRecord(v.session,['runId','taskId','state','startedAt','title','goal']);
  record({runId:s.runId,taskId:s.taskId,state:s.state,startedAt:s.startedAt,title:s.title});
  if(s.goal!==null&&(typeof s.goal!=='string'||s.goal.length>4096))throw Error('session unavailable');
  return Object.freeze({...v,project:Object.freeze(project),session:Object.freeze(s)});
}
function localSetupInput(input) {
  if (!input || typeof input !== 'object' || types.isProxy(input)) throw Error('IPC setup input denied');
  const operation = Object.getOwnPropertyDescriptor(input, 'operation')?.value;
  if (operation === 'read') return setupRecord(input, ['operation']);
  const value = setupRecord(input, ['operation', 'expectedRevision', 'enabled', 'limits']);
  if (operation !== 'configure' || typeof value.enabled !== 'boolean' || (value.expectedRevision !== null && (!Number.isSafeInteger(value.expectedRevision) || value.expectedRevision < 1))) throw Error('IPC setup input denied');
  const bounds = { maxInvocations: [2, 1000], timeoutMs: [1000, 120000], maxOutputBytes: [1, 1048576], maxOutputTokens: [1, 32768] };
  const limits = setupRecord(value.limits, Object.keys(bounds));
  for (const [key, [min, max]] of Object.entries(bounds)) if (!Number.isSafeInteger(limits[key]) || limits[key] < min || limits[key] > max) throw Error('IPC setup input denied');
  return { ...value, limits };
}

function jsonTemplateInput(input) {
  if (!input || typeof input !== 'object' || types.isProxy(input) || Object.getPrototypeOf(input) !== Object.prototype) throw Error('IPC JSON input denied');
  const fields = Object.getOwnPropertyDescriptors(input);
  const keys = ['templateId', 'inputText', 'autonomy', 'selectionMode', ...(Object.hasOwn(fields,'sessionId')?['sessionId']:[])];
  if (Reflect.ownKeys(input).length !== keys.length || keys.some(key => !fields[key]?.enumerable || !Object.hasOwn(fields[key], 'value'))) throw Error('IPC JSON input denied');
  const value = Object.fromEntries(keys.map(key => [key, fields[key].value]));
  if (value.templateId !== 'generated-json-v1' || typeof value.inputText !== 'string' || Buffer.byteLength(value.inputText, 'utf8') < 1 || Buffer.byteLength(value.inputText, 'utf8') > 1048576 ||
      ![1, 2, 3].includes(value.autonomy) || !['efficiency', 'performance', 'value', 'speed'].includes(value.selectionMode)) throw Error('IPC JSON input denied');
  if(Object.hasOwn(value,'sessionId'))optionalSessionId(value);
  return Object.freeze(value);
}

function planningInput(input, fromRun = false) {
  if (!input || typeof input !== 'object' || types.isProxy(input) || Object.getPrototypeOf(input) !== Object.prototype) throw Error('IPC planning input denied');
  const descriptors = Object.getOwnPropertyDescriptors(input), keys = [fromRun ? 'planningRunId' : 'goal', 'autonomy', 'selectionMode', ...(Object.hasOwn(descriptors,'sessionId')?['sessionId']:[])];
  if (Reflect.ownKeys(descriptors).length !== keys.length || keys.some(key => !descriptors[key]?.enumerable || !Object.hasOwn(descriptors[key], 'value'))) throw Error('IPC planning input denied');
  const value = Object.fromEntries(keys.map(key => [key, descriptors[key].value]));
  if (![1, 2, 3].includes(value.autonomy) || !['efficiency', 'performance', 'value', 'speed'].includes(value.selectionMode)) throw Error('IPC planning input denied');
  if (fromRun ? typeof value.planningRunId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value.planningRunId)
    : typeof value.goal !== 'string' || Buffer.byteLength(value.goal, 'utf8') < 1 || Buffer.byteLength(value.goal, 'utf8') > 4096) throw Error('IPC planning input denied');
  if(Object.hasOwn(value,'sessionId'))optionalSessionId(value);
  return Object.freeze(value);
}

function resourceCommand(input) {
  if (!input || typeof input !== 'object' || types.isProxy(input) || Object.getPrototypeOf(input) !== Object.prototype) throw Error('IPC resource input denied');
  const descriptors = Object.getOwnPropertyDescriptors(input), operation = descriptors.operation?.value;
  const keys = operation === 'list' || operation === 'import' ? ['operation'] : operation === 'remove' ? ['operation','id']
    : operation === 'pin' ? ['operation','runId'] : operation === 'search' ? ['operation','runId','query','limit'] : [];
  if (!keys.length || Reflect.ownKeys(input).length !== keys.length || keys.some(k => !descriptors[k]?.enumerable || !Object.hasOwn(descriptors[k],'value'))) throw Error('IPC resource input denied');
  if (operation === 'remove' && (typeof input.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(input.id))) throw Error('IPC resource input denied');
  if (['pin','search'].includes(operation) && (typeof input.runId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(input.runId))) throw Error('IPC resource input denied');
  if (operation === 'search' && (typeof input.query !== 'string' || input.query.length > 256 || !Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 10)) throw Error('IPC resource input denied');
  return input;
}

function preferenceInput(input) {
  if (!input || typeof input !== 'object' || types.isProxy(input) || Object.getPrototypeOf(input) !== Object.prototype) throw Error('IPC preference input denied');
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const operation = descriptors.operation?.value;
  const keys = operation === 'read' ? ['operation'] : operation === 'write' ? ['operation', 'mode', 'expectedRevision'] : [];
  if (!keys.length || Reflect.ownKeys(input).length !== keys.length || keys.some(key => !descriptors[key]?.enumerable || !Object.hasOwn(descriptors[key], 'value'))) throw Error('IPC preference input denied');
  if (operation === 'write' && (!['efficiency', 'performance', 'value', 'speed'].includes(descriptors.mode.value) ||
      !Number.isSafeInteger(descriptors.expectedRevision.value) || descriptors.expectedRevision.value < 0)) throw Error('IPC preference input denied');
  return operation === 'read' ? { operation } : { operation, mode: descriptors.mode.value, expectedRevision: descriptors.expectedRevision.value };
}

export function assertAllowedChannel(channel) {
  if (!IPC_CHANNELS.includes(channel)) throw new Error(`IPC channel denied: ${channel}`);
  return channel;
}

export function registerIpcHandlers(ipcMain, core, host = {}) {
  let evaluationRun = null, evaluationLocked = true, evaluationGeneration=0;
  const requireSession = sessionId => {
    if(sessionId && (typeof host.sessionManagement?.assertOpenSession!=='function'||host.sessionManagement.assertOpenSession(sessionId)!==true))throw Error('session_attach_denied');
    return sessionId;
  };
  const trackPrepared = (value,sessionId=null) => {
    evaluationGeneration++;
    const save = prepared => {
      if(sessionId){
        if(typeof host.sessionManagement?.attachRun!=='function'||!evaluationId(prepared?.runId))throw Error('session_attach_denied');
        const link=host.sessionManagement.attachRun({sessionId,runId:prepared.runId});
        if(link.authority!=='link-only-no-execution'||link.runId!==prepared.runId||link.sessionId!==sessionId)throw Error('session_attach_denied');
      }
      evaluationRun = evaluationId(prepared?.runId) ? prepared.runId : null; evaluationLocked = !evaluationRun; return prepared; };
    return value && typeof value.then === 'function' ? value.then(save) : save(value);
  };
  const handlers = Object.freeze({
    'cue:projects': async (_event,...args)=>{
      if(args.length!==1||!host.projectManagement)throw Error('project IPC denied');
      const command=projectCommand(args[0]),manager=host.projectManagement;
      if(command.operation==='switch'){
        if(typeof host.switchProject!=='function')throw Error('project switch unavailable');
        await host.switchProject(command.projectId);
        return Object.freeze({status:'restarting'});
      }
      if(command.operation==='add'){
        if(typeof host.chooseProjectDirectory!=='function')throw Error('project chooser unavailable');
        const root=await host.chooseProjectDirectory();
        return root===null?Object.freeze({status:'cancelled'}):projectProjection(manager.register(root),'add');
      }
      return projectProjection(manager.projects(),command.operation);
    },
    'cue:user-sessions': (_event,...args)=>{
      if(args.length!==1||!host.sessionManagement)throw Error('session IPC denied');
      const command=userSessionCommand(args[0]),manager=host.sessionManagement;
      const value=command.operation==='create'?manager.createSession():command.operation==='list'?manager.listSessions({limit:command.limit,cursor:command.cursor,archived:command.archived})
        :command.operation==='search'?manager.searchSessions({limit:command.limit,cursor:command.cursor,archived:command.archived,query:command.query})
        :command.operation==='read'?manager.readSession({sessionId:command.sessionId,limit:command.limit,cursor:command.cursor})
        :command.operation==='rename'?manager.renameSession({sessionId:command.sessionId,expectedTitle:command.expectedTitle,title:command.title}):manager.archiveSession(command.sessionId);
      const projection=userSessionProjection(value,command.operation);
      if('sessionId'in command&&projection.sessionId!==command.sessionId)throw Error('session response denied');
      return projection;
    },
    'cue:workspace-sessions': (_event,...args)=>{
      if(args.length!==1)throw Error('IPC session input denied');
      const command=workspaceSessionCommand(args[0]);
      const value=command.operation==='list'?core.listWorkspaceSessions({limit:command.limit,cursor:command.cursor})
        :core.readWorkspaceSession({runId:command.runId});
      const projected=workspaceSessionProjection(value,command.operation);
      if(command.operation==='read'&&projected.session.runId!==command.runId)throw Error('session unavailable');
      return projected;
    },
    'cue:evaluation': (_event, ...args) => {
      if (args.length !== 1) throw Error('IPC evaluation input denied');
      const command = evaluationCommand(args[0]);
      if (!['comparison-read','comparison-list','comparison-create','projection-list','measured-fact-read','measured-fact-list','measured-comparison-create','measured-comparison-read','measured-comparison-list','measured-comparison-inspect','local-contract-capture'].includes(command.operation) && (!evaluationRun || (['enroll','baseline'].includes(command.operation) && evaluationLocked))) return Object.freeze({available:false,reason:'evaluation-unavailable'});
      try {
        if(command.operation==='local-contract-capture')return Object.freeze({available:true,operation:command.operation,value:localEvaluationContractProjection(core.captureLocalEvaluationContracts())});
        if(command.operation.startsWith('measured-comparison-')){
          const {operation,...input}=command;
          const value=operation==='measured-comparison-create'?core.createEvaluationMeasuredComparison(input)
            :operation==='measured-comparison-list'?core.listEvaluationMeasuredComparisons(input)
            :operation==='measured-comparison-inspect'?core.inspectEvaluationMeasuredComparison(input.snapshotId)
            :core.readEvaluationMeasuredComparison(input.snapshotId);
          return Object.freeze({available:true,operation,value:measuredComparisonProjection(value,command)});
        }
        if (command.operation === 'measured-fact-read') {
          const value=core.projectEvaluationMeasuredFactEvidence({factId:command.factId});
          const projected=evaluationMeasuredFactProjection(value);if(projected.factId!==command.factId)throw Error('unavailable');
          return Object.freeze({available:true,operation:command.operation,value:projected});
        }
        if(command.operation==='measured-fact-list'){
          const value=core.listEvaluationMeasuredFacts({limit:command.limit,cursor:command.cursor});
          return Object.freeze({available:true,operation:command.operation,value:evaluationMeasuredFactListProjection(value)});
        }
        if (command.operation === 'comparison-read') {
          const value=core.readEvaluationComparison(command.snapshotId);
          return Object.freeze({available:true,operation:command.operation,value:evaluationProjection(value,command.operation)});
        }
        if (command.operation === 'comparison-list') {
          const value=core.listEvaluationComparisons({limit:command.limit,cursor:command.cursor});
          return Object.freeze({available:true,operation:command.operation,value:evaluationProjection(value,command.operation)});
        }
        if (command.operation === 'projection-list') {
          const value=core.listEvaluationProjections({limit:command.limit,cursor:command.cursor});
          return Object.freeze({available:true,operation:command.operation,value:evaluationProjection(value,command.operation)});
        }
        if (command.operation === 'comparison-create') {
          const value=core.createEvaluationComparisonFromRecords({snapshotId:command.snapshotId,baselineProjectionIds:command.baselineProjectionIds,candidateProjectionIds:command.candidateProjectionIds,mode:command.mode,...(Object.hasOwn(command,'criteria')?{criteria:command.criteria}:{})});
          return Object.freeze({available:true,operation:command.operation,value:evaluationProjection(value,command.operation)});
        }
        if(command.operation==='baseline'){
          if(typeof host.confirmManualBaseline!=='function'||typeof core.requestManualEvaluationBaseline!=='function')throw Error('unavailable');
          const runId=evaluationRun,generation=evaluationGeneration;
          const current=()=>runId===evaluationRun&&generation===evaluationGeneration&&!evaluationLocked;
          return core.requestManualEvaluationBaseline({baselineId:command.baselineId,enrollmentId:command.enrollmentId,runId,dataset:command.dataset,caseId:command.caseId,
            metric:{id:command.metricId,revision:command.metricRevision,digest:command.metricDigest},environment:{id:command.environmentId,revision:command.environmentRevision,digest:command.environmentDigest},accountLimits:{id:command.accountLimitsId,revision:command.accountLimitsRevision,digest:command.accountLimitsDigest}},
            async view=>current()&&await host.confirmManualBaseline(view)===true&&current())
            .then(saved=>{if(!current())throw Error('unavailable');return Object.freeze({available:true,operation:'baseline',value:evaluationProjection(saved.enrollment,'enroll')});})
            .catch(()=>Object.freeze({available:false,reason:'evaluation-unavailable'}));
        }
        if (command.operation === 'enroll') {
          // UI retries do not carry a clock. Reuse the stored host timestamp;
          // the enrollment store still compares every submitted binding field.
          let enrolledAtMs=Date.now();
          try{
            const prior=core.readEvaluationEnrollment(command.enrollmentId),view=evaluationProjection(prior,'enroll');
            const time=Object.getOwnPropertyDescriptor(prior,'enrolledAtMs');
            if(view.enrollmentId===command.enrollmentId&&view.runId===evaluationRun&&time&&Object.hasOwn(time,'value')&&Number.isSafeInteger(time.value)&&time.value>=0)enrolledAtMs=time.value;
          }catch{ /* Missing/unreadable prior is revalidated by the store below. */ }
          const cases = [{id:command.evaluationCaseId,kind:command.caseKind,inputDigest:command.evaluationInputDigest,split:'evaluation'}, {id:command.holdoutCaseId,kind:command.caseKind,inputDigest:command.holdoutInputDigest,split:'holdout'}];
          const value = core.enrollEvaluation({enrollmentId:command.enrollmentId,runId:evaluationRun,dataset:command.dataset??{id:command.datasetId,revision:command.datasetRevision,cases},caseId:command.caseId,arm:command.arm,policy:{kind:command.policyKind,policyId:command.policyId,revision:command.policyRevision,digest:command.policyDigest},metric:{id:command.metricId,revision:command.metricRevision,digest:command.metricDigest},environment:{id:command.environmentId,revision:command.environmentRevision,digest:command.environmentDigest},accountLimits:{id:command.accountLimitsId,revision:command.accountLimitsRevision,digest:command.accountLimitsDigest},enrolledAtMs});
          return Object.freeze({available:true,operation:command.operation,value:evaluationProjection(value,command.operation)});
        }
        const enrollment = evaluationProjection(core.readEvaluationEnrollment(command.enrollmentId),'enroll');
        if (enrollment.runId !== evaluationRun) throw Error('unavailable');
        const value = command.operation === 'observe' ? core.observeEvaluation({enrollmentId:command.enrollmentId,observationId:command.observationId,expectedPriorRevision:command.expectedPriorRevision})
          : command.operation === 'projection' ? core.projectEvaluationObservation({enrollmentId:command.enrollmentId,observationId:command.observationId})
          : core.evaluationCoverage({datasetDigest:enrollment.dataset.digest,arm:enrollment.arm,policyDigest:enrollment.policy.digest,cutoffId:command.cutoffId});
        return Object.freeze({available:true,operation:command.operation,value:evaluationProjection(value,command.operation)});
      } catch { return Object.freeze({available:false,reason:'evaluation-unavailable'}); }
    },
    'cue:native-recovery': async (_event, ...args) => {
      if (args.length !== 1) throw Error('IPC recovery input denied');
      const command = recoveryCommand(args[0]);
      try {
        const value = command.operation === 'runs' ? await core.listRecoveryRuns({}) : command.operation === 'list' ? await core.listNativeIdentities({ runId: command.runId })
          : await core.observeNativeRecovery({ runId: command.runId, attemptId: command.attemptId, identityRef: command.identityRef });
        return Object.freeze({ available: true, operation: command.operation, value: recoveryProjection(value, command) });
      } catch { return Object.freeze({ available: false, reason: 'native-recovery-unavailable' }); }
    },
    'cue:candidate-inventory': (_event, ...args) => {
      if (args.length !== 1 || !args[0] || typeof args[0] !== 'object' || types.isProxy(args[0]) || Object.getPrototypeOf(args[0]) !== Object.prototype) throw Error('IPC inventory input denied');
      const fields = Object.getOwnPropertyDescriptors(args[0]);
      if (Reflect.ownKeys(fields).length !== 1 || !fields.operation?.enumerable || !Object.hasOwn(fields.operation, 'value') || fields.operation.value !== 'read') throw Error('IPC inventory input denied');
      return core.candidateInventory();
    },
    'cue:retrospective': (_event, ...args) => {
      if (args.length !== 1) throw Error('IPC retrospective input denied');
      const input = retrospectiveCommand(args[0]);
      return input.operation === 'read' ? core.readRetrospective(input.draftId) : core.createRetrospective({ draftId: input.draftId, runId: input.runId });
    },
    'cue:local-json-setup': (_event, ...args) => {
      if (args.length !== 1) throw Error('IPC setup input denied');
      const value = localSetupInput(args[0]);
      if (typeof core.localJsonSetup !== 'function' || typeof core.configureLocalJson !== 'function') throw Error('local JSON setup unavailable');
      if (value.operation === 'read') return core.localJsonSetup();
      const { operation, ...command } = value;
      return core.configureLocalJson(command);
    },
    'cue:local-planning-setup': (_event, ...args) => {
      if (args.length !== 1) throw Error('IPC planning setup input denied');
      const value = localSetupInput(args[0]);
      if (typeof core.localPlanningSetup !== 'function' || typeof core.configureLocalPlanning !== 'function') throw Error('local planning setup unavailable');
      if (value.operation === 'read') return core.localPlanningSetup();
      const { operation, ...command } = value;
      return core.configureLocalPlanning(command);
    },
    'cue:prepare-json': (_event, ...args) => {
      if (args.length !== 1) throw Error('IPC JSON input denied');
      const input = jsonTemplateInput(args[0]);
      if (typeof core.prepareJsonTemplate !== 'function') throw Error('JSON template unavailable');
      const {sessionId,...preparedInput}=input;
      requireSession(sessionId??null);
      return trackPrepared(core.prepareJsonTemplate(preparedInput),sessionId??null);
    },
    'cue:resources': async (_event, ...args) => {
      if (args.length !== 1) throw Error('IPC resource input denied');
      const input = args[0];
      const command = resourceCommand(input);
      if (command.operation === 'list') return core.listResourcePackages();
      if (command.operation === 'remove') return { removed: core.removeResourcePackage(command.id) };
      if (command.operation === 'pin') return core.readResourcePin(command.runId);
      if (command.operation === 'search') return core.searchResources({ runId: command.runId, query: command.query, limit: command.limit });
      if (typeof host.chooseResourcePackage !== 'function') throw Error('resource_import_unavailable');
      const selected = await host.chooseResourcePackage();
      if (selected === null) return { status: 'cancelled' };
      return { status: 'imported', package: core.importResourcePackage(selected) };
    },
    'cue:report': async (_event, input) => {
      if (!input || typeof input !== 'object' || types.isProxy(input) || Object.getPrototypeOf(input) !== Object.prototype) throw Error('IPC report input denied');
      const fields = Object.getOwnPropertyDescriptors(input);
      if (Reflect.ownKeys(fields).length !== 1 || !fields.runId?.enumerable || !Object.hasOwn(fields.runId, 'value') ||
        typeof fields.runId.value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(fields.runId.value) || typeof host.openReport !== 'function') throw Error('IPC report input denied');
      const artifact = core.exportRunReport(fields.runId.value);
      await host.openReport(artifact);
      return Object.freeze({ status: 'opened', artifactSha256: artifact.receipt.artifactSha256 });
    },
    'cue:prepare': (_event, input) => {
      const sessionId=requireSession(optionalSessionId(input));
      return trackPrepared(input?.selectionMode === undefined
        ? core.prepareGoal(String(input?.goal ?? ''), Number(input?.autonomy ?? 3))
        : core.prepareGoal(String(input?.goal ?? ''), Number(input?.autonomy ?? 3), input.selectionMode),sessionId);
    },
    'cue:planning-availability': (_event, ...args) => {
      if (args.length) throw Error('IPC planning input denied');
      if (typeof core.planningAvailability !== 'function') return Object.freeze({available:false,reasons:Object.freeze(['planning-unavailable'])});
      return core.planningAvailability();
    },
    'cue:prepare-planning': (_event, ...args) => {
      if (args.length !== 1 || typeof core.preparePlanningGoal !== 'function') throw Error('IPC planning input denied');
      const {sessionId,...input}=planningInput(args[0]);
      requireSession(sessionId??null);
      return trackPrepared(core.preparePlanningGoal(input),sessionId??null);
    },
    'cue:prepare-from-planning': (_event, ...args) => {
      if (args.length !== 1 || typeof core.prepareGoalFromPlanningRun !== 'function') throw Error('IPC planning input denied');
      const {sessionId,...input}=planningInput(args[0], true);
      requireSession(sessionId??null);
      return trackPrepared(core.prepareGoalFromPlanningRun(input),sessionId??null);
    },
    'cue:approve': (_event, input) => {
      const command = approvalCommand(input);
      evaluationLocked = true;evaluationGeneration++;
      return command.allowExploration === true ? core.approve(command.runId, { allowExploration: true }) : core.approve(command.runId);
    },
    'cue:execute': (_event, input) => {
      if (input?.operation === 'status') return core.completion(String(input?.taskId ?? ''));
      if (input?.operation !== undefined) throw new Error('IPC operation denied');
      evaluationLocked = true;evaluationGeneration++;
      return core.execute(String(input?.runId ?? ''));
    },
    'cue:stop': (_event, input) => {evaluationGeneration++;return core.stop(String(input?.runId ?? ''));},
    'cue:selection-preferences': (_event, input) => {
      const command = preferenceInput(input);
      return command.operation === 'read' ? core.selectionPreferences()
        : core.setSelectionPreference({ mode: command.mode, expectedRevision: command.expectedRevision });
    },
  });
  let inFlight=0;
  for (const channel of IPC_CHANNELS) ipcMain.handle(channel, (event, ...args) => {
    if (!event || typeof host.isTrustedSender !== 'function' || !host.isTrustedSender(event)) throw Error('IPC sender denied');
    const value=handlers[channel](event,...args);
    if(value&&typeof value.then==='function'){
      inFlight++;return Promise.resolve(value).finally(()=>{inFlight--;});
    }
    return value;
  });
  return Object.freeze({ pendingRequests(){return inFlight;},invoke(channel, ...args) { return handlers[assertAllowedChannel(channel)](null, ...args); } });
}
