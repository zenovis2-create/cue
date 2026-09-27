import { createHash } from 'node:crypto';
import { readAcceptanceHistory } from '../daemon/dist/src/verification/acceptance.js';
import { createGeneratedOutputStore } from '../daemon/dist/src/verification/generated-output.js';
import { captureGoalProposal } from './goal-proposal.mjs';
import { checkGoalPlanningProposal } from './goal-planning-contract.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const fail=()=>{throw Error('planning_output_unavailable')};

/** Read only the accepted producer response that the final manifest named. */
export function readAcceptedGoalPlanningOutput(db,planningRunId) {
  if(typeof planningRunId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(planningRunId))fail();
  return db.transaction(()=>{
    const phase=db.prepare("SELECT content FROM artifact WHERE run_id=? AND kind='run_phase'").all(planningRunId);
    const goals=db.prepare("SELECT content FROM artifact WHERE run_id=? AND kind='goal'").all(planningRunId);
    const inputs=db.prepare("SELECT content FROM artifact WHERE run_id=? AND kind='planning_input_v1'").all(planningRunId);
    const task=db.prepare('SELECT t.state,r.write_in_progress FROM run r JOIN task t ON t.id=r.task_id WHERE r.id=?').get(planningRunId);
    if(phase.length!==1||phase[0].content!=='planning'||goals.length!==1||inputs.length!==1||task?.state!=='completed'||task.write_in_progress!==0)fail();
    const goal=goals[0].content, contract=JSON.parse(inputs[0].content);
    if(contract?.version!=='cue-planning-input-v1'||contract.goalSha256!==sha(goal)
      ||typeof contract.executionPolicy?.policyRevision!=='string'||typeof contract.executionPolicy?.policyDigest!=='string'
      ||!['efficiency','performance','value','speed'].includes(contract.executionPolicy?.mode))fail();
    const history=readAcceptanceHistory(db,planningRunId);
    if(!history?.receipt||history.verdict!=='pass'||history.receipt.status!=='accepted')fail();
    const final=db.prepare('SELECT evaluation_id,payload,payload_sha256 FROM acceptance_final WHERE run_id=?').get(planningRunId);
    const evaluation=db.prepare('SELECT payload FROM acceptance_evaluation WHERE id=? AND run_id=?').get(final?.evaluation_id,planningRunId);
    if(!final||sha(final.payload)!==final.payload_sha256||!evaluation||history.receipt.evaluationId!==final.evaluation_id)fail();
    const manifest=JSON.parse(evaluation.payload).manifest;
    const artifacts=manifest?.artifacts;
    if(!Array.isArray(artifacts)||artifacts.length!==1||artifacts[0].targetId!=='goal-proposal'||artifacts[0].kind!=='generated-output')fail();
    const target=createGeneratedOutputStore(db,{now:()=>0,authorizeObservation:()=>false}).readTarget(planningRunId,'goal-proposal');
    if(!target||target.producerTaskId!=='produce-plan')fail();
    const originalInput=db.prepare('SELECT input_bytes FROM generated_output_target WHERE run_id=? AND target_id=?').get(planningRunId,'goal-proposal');
    if(!Buffer.isBuffer(originalInput?.input_bytes)||originalInput.input_bytes.toString('utf8')!==inputs[0].content)fail();
    const planRow=db.prepare('SELECT payload FROM orchestration_plan WHERE run_id=?').get(planningRunId),plan=planRow&&JSON.parse(planRow.payload);
    if(!plan||plan.tasks.length!==2||!plan.tasks.some(x=>x.id==='produce-plan'&&x.role==='model-producer')
      ||!plan.tasks.some(x=>x.id==='verify-plan'&&x.role==='verifier'&&x.dependencyIds.includes('produce-plan')))fail();
    const attempts=db.prepare('SELECT attempt_id,task_id,state,cleanup_verified FROM orchestration_attempt WHERE run_id=?').all(planningRunId);
    if(attempts.length!==2||attempts.some(x=>x.state!=='completed'||x.cleanup_verified!==1))fail();
    const producer=attempts.find(x=>x.task_id==='produce-plan'),verifier=attempts.find(x=>x.task_id==='verify-plan');
    if(!producer||!verifier||producer.attempt_id===verifier.attempt_id)fail();
    const output=createGeneratedOutputStore(db,{now:()=>0,authorizeObservation:()=>false}).read(planningRunId,'goal-proposal',producer.attempt_id);
    if(!output||artifacts[0].sourceRef!==`cue-generated-output:${output.record.digest}`
      ||artifacts[0].digest!==output.record.sha256||artifacts[0].sizeBytes!==output.record.byteLength)fail();
    const bytes=Buffer.from(output.bytes),ref=`goal-proposal:${sha(bytes)}`;
    const validation=checkGoalPlanningProposal({goal,inputText:inputs[0].content,outputBytes:bytes});
    if(validation.status!=='pass'||validation.proposalRef!==ref)fail();
    const captured=captureGoalProposal(goal,ref,JSON.parse(bytes.toString('utf8')));
    if(captured.bytes!==bytes.toString('utf8')||captured.proposedPlan.policyRevision!==contract.executionPolicy.policyRevision
      ||captured.proposedPlan.policyDigest!==contract.executionPolicy.policyDigest)fail();
    return Object.freeze({goal,mode:contract.executionPolicy.mode,ref,body:captured.body,source:Object.freeze({planningRunId,
      producerAttemptId:producer.attempt_id,verifierAttemptId:verifier.attempt_id,outputDigest:output.record.digest,
      acceptanceEvaluationId:history.receipt.evaluationId,acceptanceManifestDigest:history.receipt.manifestDigest})});
  })();
}
