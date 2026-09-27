import {createHash} from 'node:crypto';
import {captureGoalProposal} from './goal-proposal.mjs';
import {validateTaskPlan} from '../daemon/dist/src/orchestration/plan.js';

const sha=value=>createHash('sha256').update(value).digest('hex');
const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/u.test(value);
const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
const fail=()=>{throw Error('goal_planning_contract');};
const sorted=value=>[...value].sort();

/** Snapshots only trusted host authority before the first approval. */
export function capturePlanningInput({goal,selectionMode,executionPolicy,allowedCandidateIds,allowedScopeIds,checkerRegistry,targetLimits}) {
  if(typeof goal!=='string'||!goal.trim()||Buffer.byteLength(goal)>16384||!['efficiency','performance','value','speed'].includes(selectionMode)
    ||!id(executionPolicy?.policyRevision)||!hex(executionPolicy?.policyDigest)||executionPolicy.mode!==selectionMode
    ||!Array.isArray(allowedCandidateIds)||!allowedCandidateIds.length||allowedCandidateIds.length>64||allowedCandidateIds.some(value=>!id(value))
    ||!Array.isArray(allowedScopeIds)||allowedScopeIds.length>64||allowedScopeIds.some(value=>!id(value))
    ||!Array.isArray(checkerRegistry)||!checkerRegistry.length||checkerRegistry.length>64
    ||checkerRegistry.some(value=>!id(value?.checkerId)||!id(value?.revision)||!hex(value?.parametersDigest)||!Array.isArray(value?.targetIds)||!value.targetIds.length||value.targetIds.some(target=>!id(target))||!Array.isArray(value?.kinds)||value.kinds.some(kind=>!['code','research','document','external'].includes(kind)))
    ||!Number.isSafeInteger(targetLimits?.maxBytes)||targetLimits.maxBytes<1||targetLimits.maxBytes>1048576
    ||!Number.isSafeInteger(targetLimits?.maxChangeTargets)||targetLimits.maxChangeTargets<0||targetLimits.maxChangeTargets>64)fail();
  for(const values of [allowedCandidateIds,allowedScopeIds,checkerRegistry.map(c=>JSON.stringify([c.checkerId,c.revision,c.parametersDigest,sorted(c.targetIds),sorted(c.kinds)]))])if(new Set(values).size!==values.length)fail();
  const body={version:'cue-planning-input-v1',goalSha256:sha(goal),executionPolicy:{policyRevision:executionPolicy.policyRevision,policyDigest:executionPolicy.policyDigest,mode:selectionMode},
    allowedCandidateIds:sorted(allowedCandidateIds),allowedScopeIds:sorted(allowedScopeIds),checkerRegistry:checkerRegistry.map(c=>({checkerId:c.checkerId,revision:c.revision,kinds:sorted(c.kinds),parametersDigest:c.parametersDigest,targetIds:sorted(c.targetIds)})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),
    targetLimits:{maxBytes:targetLimits.maxBytes,maxChangeTargets:targetLimits.maxChangeTargets}};
  return JSON.stringify(body);
}

/** Checks model bytes against the exact preapproved planning contract; verdict is structural only. */
export function checkGoalPlanningProposal({goal,inputText,outputBytes}) {
  try {
    if(typeof inputText!=='string'||!Buffer.isBuffer(outputBytes)||outputBytes.length<1||outputBytes.length>1048576)return Object.freeze({status:'unknown',reason:'invalid-input'});
    const input=JSON.parse(inputText);
    if(JSON.stringify(input)!==inputText||input.version!=='cue-planning-input-v1'||input.goalSha256!==sha(goal)||outputBytes.length>input.targetLimits.maxBytes)return Object.freeze({status:'fail',reason:'approval-mismatch'});
    const text=new TextDecoder('utf-8',{fatal:true}).decode(outputBytes),body=JSON.parse(text);
    const captured=captureGoalProposal(goal,`goal-proposal:${sha(text)}`,body);
    if(captured.bytes!==text||captured.proposedPlan.policyRevision!==input.executionPolicy.policyRevision||captured.proposedPlan.policyDigest!==input.executionPolicy.policyDigest)return Object.freeze({status:'fail',reason:'proposal-policy'});
    validateTaskPlan({policyRevision:input.executionPolicy.policyRevision,policyDigest:input.executionPolicy.policyDigest,requirementIds:captured.requirementIds,
      allowedCandidateIds:input.allowedCandidateIds,allowedScopeIds:input.allowedScopeIds},captured.proposedPlan);
    for(const requirement of captured.requirements){
      if(!requirement.required||!['code','research','document','external'].includes(requirement.kind)||!Array.isArray(requirement.checks)||!requirement.checks.length)return Object.freeze({status:'fail',reason:'requirement-check'});
      for(const check of requirement.checks){if(!Array.isArray(check.targetIds)||!input.checkerRegistry.some(approved=>approved.checkerId===check.checkerId&&approved.revision===check.revision&&approved.kinds.includes(requirement.kind)&&approved.parametersDigest===check.parametersDigest&&JSON.stringify(sorted(check.targetIds))===JSON.stringify(approved.targetIds)))return Object.freeze({status:'fail',reason:'checker-registry'});}
    }
    if(captured.changeTargets.length>input.targetLimits.maxChangeTargets)return Object.freeze({status:'fail',reason:'targets'});
    for(const target of captured.changeTargets){
      if(!captured.proposedPlan.tasks.some(task=>task.id===target.taskId&&task.role==='implementation')||!id(target.targetId)||typeof target.relativePath!=='string'||!target.relativePath||target.relativePath.startsWith('/')||/^(?:[A-Za-z]:|\\\\)/u.test(target.relativePath)||target.relativePath.split(/[\\/]/u).includes('..')||!Number.isSafeInteger(target.maxBackupBytes)||target.maxBackupBytes<1)return Object.freeze({status:'fail',reason:'target-scope'});
    }
    return Object.freeze({status:'pass',reason:'structural-match',proposalRef:captured.ref,proposalDigest:captured.digest});
  }catch{return Object.freeze({status:'fail',reason:'malformed-or-unapproved'});}
}
