import {createHash} from 'node:crypto';
import type {Ledger} from '../ledger.js';
import {validateTaskPlan} from '../orchestration/plan.js';
import {readRunPolicyIdentity} from '../selection/run-policy-identity.js';
import type {ManualBaselineAuthorityRequest} from './baseline-contract.js';
function fail():never{throw Error('evaluation_baseline_fixed_plan');}
/** This pins task selection, not provider code, authorization or quality. */
export function readFixedBaselinePlan(db:Ledger,runId:string){
  if(typeof runId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(runId))fail();
  const row=db.prepare(`SELECT p.digest,p.envelope_hash,substr(p.payload,1,1048577) payload,length(CAST(p.payload AS BLOB)) bytes,r.envelope_hash run_envelope
    FROM orchestration_plan p JOIN run r ON r.id=p.run_id WHERE p.run_id=?`).get(runId) as any;
  if(!row||row.bytes>1048576)fail();
  const raw=JSON.parse(row.payload),plan=validateTaskPlan(raw.approval,{revision:raw.revision,policyRevision:raw.approval.policyRevision,policyDigest:raw.approval.policyDigest,tasks:raw.tasks});
  const policy=readRunPolicyIdentity(db,runId);
  if(!policy||policy.kind!=='monetary'||policy.snapshot.policy.pinnedCandidateId!==null||row.digest!==plan.digest||row.envelope_hash!==row.run_envelope
    ||JSON.stringify(plan)!==row.payload||plan.approval.policyDigest!==policy.digest||plan.approval.policyRevision!==`${policy.policyId}:${policy.revision}`)fail();
  const writers=plan.tasks.filter(t=>t.role==='implementation'),verifiers=plan.tasks.filter(t=>t.role==='verifier');
  if(plan.tasks.length>16||writers.length<1||verifiers.length!==1||writers.length+1!==plan.tasks.length||plan.tasks.some(t=>t.candidateIds.length!==1))fail();
  const writerId=writers[0]!.candidateIds[0]!,verifier=verifiers[0]!;
  if(writers.some(t=>t.candidateIds[0]!==writerId||t.ownerId===verifier.ownerId||!verifier.dependencyIds.includes(t.id))||verifier.candidateIds[0]===writerId||verifier.scopeIds.length!==0)fail();
  // A repaired/replanned execution is not the original manually fixed cohort.
  if(db.prepare('SELECT 1 FROM orchestration_plan_revision WHERE run_id=? AND revision>0').get(runId))fail();
  const attempts=db.prepare('SELECT task_id,candidate_id FROM orchestration_attempt WHERE run_id=? LIMIT 1025').all(runId) as {task_id:string;candidate_id:string}[];
  if(attempts.length>1024||attempts.some(a=>!plan.tasks.some(t=>t.id===a.task_id&&t.candidateIds[0]===a.candidate_id)))fail();
  const tasks=Object.freeze(plan.tasks.map(t=>Object.freeze({taskId:t.id,role:t.role,candidateId:t.candidateIds[0]!,ownerId:t.ownerId})));
  const candidate=Object.freeze({id:writerId,revision:'fixed-task-plan-v1',digest:createHash('sha256').update(JSON.stringify({planDigest:plan.digest,tasks})).digest('hex')});
  return Object.freeze({planDigest:plan.digest,tasks,candidate,policy:Object.freeze({kind:policy.kind,policyId:policy.policyId,revision:policy.revision,digest:policy.digest}),mode:policy.snapshot.policy.mode});
}
export function validateBaselineCandidateBinding(db:Ledger,request:ManualBaselineAuthorityRequest){
  if(request.planDigest!==undefined){
    const plan=readFixedBaselinePlan(db,request.runId);
    if(plan.planDigest!==request.planDigest||JSON.stringify(plan.candidate)!==JSON.stringify(request.candidate)||JSON.stringify(plan.policy)!==JSON.stringify(request.policy))fail();
  }else{
    const policy=readRunPolicyIdentity(db,request.runId);
    if(!policy||!('pinnedCandidateId' in policy.snapshot.policy)||policy.snapshot.policy.pinnedCandidateId!==request.candidate.id)throw Error('evaluation_baseline_candidate_mismatch');
  }
}
