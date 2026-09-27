'use strict';
const {createHash}=require('node:crypto');
const {types}=require('node:util');
const CONTRACT='cue-goal-proposal-v1', MAX=1048576;
const sha=value=>createHash('sha256').update(value).digest('hex');
const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(value);
const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
function copy(value){
  if(!value||!types.isUint8Array(value)||types.isProxy(value))return null;
  try{const bytes=Buffer.from(value);return bytes.length>0&&bytes.length<=MAX?bytes:null;}catch{return null;}
}
function checkGoalProposal(inputBytes,outputBytes){
  const input=copy(inputBytes),output=copy(outputBytes),inputSha256=input?sha(input):null,outputSha256=output?sha(output):null;
  const verdict=(status,reason,proposalDigest=null)=>Object.freeze({contract:CONTRACT,status,reason,inputSha256,outputSha256,proposalDigest});
  if(!input)return verdict('unknown','input_bytes');
  let approved;
  try{const text=new TextDecoder('utf-8',{fatal:true}).decode(input);approved=JSON.parse(text);if(JSON.stringify(approved)!==text||approved.version!=='cue-planning-input-v1'||!hex(approved.goalSha256)||!hex(approved.executionPolicy?.policyDigest)||!id(approved.executionPolicy?.policyRevision)||!['efficiency','performance','value','speed'].includes(approved.executionPolicy?.mode)||!Array.isArray(approved.allowedCandidateIds)||!Array.isArray(approved.allowedScopeIds)||!Array.isArray(approved.checkerRegistry)||!Number.isSafeInteger(approved.targetLimits?.maxBytes)||approved.targetLimits.maxBytes<1||approved.targetLimits.maxBytes>MAX)throw Error();}catch{return verdict('unknown','input_contract');}
  if(!output||output.length>approved.targetLimits.maxBytes)return verdict('fail','output_bytes');
  let body,text;
  try{text=new TextDecoder('utf-8',{fatal:true}).decode(output);body=JSON.parse(text);}catch{return verdict('fail','output_json');}
  function canonical(value,depth=0,state={nodes:0}){
    if(++state.nodes>8192||depth>16)throw Error();
    if(value===null||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);
    if(typeof value==='number'&&Number.isSafeInteger(value))return JSON.stringify(value);
    if(Array.isArray(value)){if(value.length>256)return null;return '['+value.map(item=>canonical(item,depth+1,state)).join(',')+']';}
    if(!value||typeof value!=='object'||Object.keys(value).length>1024)return null;
    return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key],depth+1,state)).join(',')+'}';
  }
  try{
    if(canonical(body)!==text||body.version!=='cue-goal-proposal-v1'||body.goalSha256!==approved.goalSha256)return verdict('fail','goal_or_canonical');
    const plan=body.plan;
    if(plan?.policyRevision!==approved.executionPolicy.policyRevision||plan.policyDigest!==approved.executionPolicy.policyDigest||!Array.isArray(plan.tasks)||plan.tasks.length<2||plan.tasks.length>256)return verdict('fail','policy_or_plan');
    const candidates=new Set(approved.allowedCandidateIds),scopes=new Set(approved.allowedScopeIds),taskIds=new Set(),owners=new Set();
    for(const task of plan.tasks){
      if(!id(task.id)||taskIds.has(task.id)||!id(task.ownerId)||!['planner','implementation','model-producer','verifier'].includes(task.role)||!Array.isArray(task.candidateIds)||!task.candidateIds.length||task.candidateIds.some(value=>!candidates.has(value))||!Array.isArray(task.scopeIds)||task.scopeIds.some(value=>!scopes.has(value))||!Array.isArray(task.requirementIds)||!Array.isArray(task.dependencyIds))return verdict('fail','task_authority');
      taskIds.add(task.id);owners.add(task.ownerId);
    }
    if(owners.size<2||!Array.isArray(body.requirements)||!body.requirements.length||body.requirements.length>256||!Array.isArray(body.instructions)||body.instructions.length!==plan.tasks.length||!Array.isArray(body.changeTargets)||body.changeTargets.length>approved.targetLimits.maxChangeTargets)return verdict('fail','proposal_bounds');
    const requirementIds=new Set();
    for(const requirement of body.requirements){
      if(!id(requirement.id)||requirementIds.has(requirement.id)||typeof requirement.text!=='string'||!requirement.text.trim()||requirement.required!==true||!Array.isArray(requirement.checks)||!requirement.checks.length)return verdict('fail','requirement');
      requirementIds.add(requirement.id);
      for(const check of requirement.checks){if(!Array.isArray(check.targetIds)||!approved.checkerRegistry.some(trusted=>trusted.checkerId===check.checkerId&&trusted.revision===check.revision&&trusted.kinds.includes(requirement.kind)&&check.parametersDigest===trusted.parametersDigest&&JSON.stringify([...check.targetIds].sort())===JSON.stringify(trusted.targetIds)))return verdict('fail','checker_registry');}
    }
    for(const task of plan.tasks)if(!task.requirementIds.length||task.requirementIds.some(value=>!requirementIds.has(value))||task.dependencyIds.some(value=>!taskIds.has(value)||value===task.id))return verdict('fail','task_graph');
    const taskMap=new Map(plan.tasks.map(task=>[task.id,task])),visiting=new Set(),visited=new Set();
    function visit(taskId){if(visiting.has(taskId))throw Error('cycle');if(visited.has(taskId))return;visiting.add(taskId);for(const dependency of taskMap.get(taskId).dependencyIds)visit(dependency);visiting.delete(taskId);visited.add(taskId);}
    for(const task of plan.tasks)visit(task.id);
    function dependsOn(taskId,makerId,seen=new Set()){
      if(seen.has(taskId))return false;seen.add(taskId);
      const task=taskMap.get(taskId);
      return task.dependencyIds.some(dep=>dep===makerId||dependsOn(dep,makerId,seen));
    }
    for(const requirementId of requirementIds){
      const makers=plan.tasks.filter(task=>task.requirementIds.includes(requirementId)&&['implementation','model-producer'].includes(task.role));
      const verifiers=plan.tasks.filter(task=>task.requirementIds.includes(requirementId)&&task.role==='verifier');
      if(!makers.length||!verifiers.length||verifiers.some(verifier=>makers.some(maker=>verifier.ownerId===maker.ownerId||!dependsOn(verifier.id,maker.id))))return verdict('fail','independent_verification');
    }
    const instructions=new Set();for(const instruction of body.instructions){if(!taskIds.has(instruction.taskId)||instructions.has(instruction.taskId)||typeof instruction.text!=='string'||!instruction.text.trim()||Buffer.byteLength(instruction.text)>16384)return verdict('fail','instruction');instructions.add(instruction.taskId);}
    for(const target of body.changeTargets){const task=plan.tasks.find(t=>t.id===target.taskId);if(task?.role!=='implementation'||!id(target.targetId)||typeof target.relativePath!=='string'||!target.relativePath||target.relativePath.startsWith('/')||/^(?:[A-Za-z]:|\\\\)/.test(target.relativePath)||target.relativePath.split(/[\\/]/).includes('..')||!Number.isSafeInteger(target.maxBackupBytes)||target.maxBackupBytes<1)return verdict('fail','target_scope');}
    return verdict('pass','structural_match',outputSha256);
  }catch{return verdict('fail','malformed_or_unapproved');}
}
module.exports=Object.freeze({checkGoalProposal,CONTRACT,MAX});
