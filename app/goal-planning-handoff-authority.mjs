import { createGeneratedOutputStore } from '../daemon/dist/src/verification/generated-output.js';
import { createCleanupObservationStore } from '../daemon/dist/src/cleanup-observation-store.js';
import { createHash } from 'node:crypto';

const sha = value => createHash('sha256').update(value).digest('hex');
function canonical(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) throw Error('goal_planning_handoff_plain_data');
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

/** Reconstructs handoff bytes solely from immutable persisted generated-output
 * lineage. It does not depend on current qualification, settings, or execution. */
export function createGoalPlanningHandoffAuthority({ db }) {
  if (!db?.open || db.inTransaction) throw Error('goal_planning_handoff_authority_unavailable');
  const generatedOutputs=createGeneratedOutputStore(db,{now:()=>Date.now(),authorizeObservation:()=>false});
  const cleanupObservations=createCleanupObservationStore(db);
  function resolveCleanupObservation(sourceRef,attemptId) {
    const bytes=cleanupObservations.read(sourceRef.replace(/^cleanup-observation:/,'cue-cleanup:'));
    if(!bytes||sourceRef!==`cleanup-observation:${sha(bytes)}`)return null;
    try {
      const payloadText=Buffer.from(bytes).toString('utf8'),cleanup=JSON.parse(payloadText);
      if(canonical(cleanup)!==payloadText||cleanup.runId!==attemptId||cleanup.role!=='model'||cleanup.result!=='verified-clean'
        ||cleanup.providerStopped!=='unknown'||cleanup.billing!=='unknown'||!cleanup.session||typeof cleanup.session!=='object')return null;
      const attempt=db.prepare('SELECT run_id,task_id,candidate_id,state FROM orchestration_attempt WHERE attempt_id=?').get(attemptId);
      const intent=db.prepare('SELECT *,payload intent_payload FROM orchestration_launch_intent WHERE attempt_id=?').get(attemptId);
      const identity=db.prepare('SELECT *,payload identity_payload FROM orchestration_attempt_identity WHERE attempt_id=?').get(attemptId);
      if(!attempt||attempt.task_id!=='produce-plan'||!intent||!identity||!['running','blocked','failed'].includes(attempt.state)||cleanup.candidateId!==attempt.candidate_id
        ||cleanup.subjectDigest!==intent.expected_subject_digest||cleanup.subjectDigest!==identity.subject_digest)return null;
      const intentText=Buffer.from(intent.intent_payload).toString('utf8'),intentValue=JSON.parse(intentText);
      const identityText=Buffer.from(identity.identity_payload).toString('utf8'),identityValue=JSON.parse(identityText);
      if(sha(intentText)!==intent.payload_sha256||canonical(intentValue)!==intentText||intentValue.attemptId!==attemptId
        ||intentValue.runId!==intent.run_id||intentValue.taskId!==intent.task_id||intentValue.candidateId!==intent.candidate_id
        ||intentValue.expectedSubjectDigest!==intent.expected_subject_digest||intent.run_id!==attempt.run_id||intent.task_id!==attempt.task_id||intent.candidate_id!==attempt.candidate_id
        ||sha(identityText)!==identity.payload_sha256||canonical(identityValue)!==identityText||identityValue.identityId!==identity.identity_id
        ||identityValue.attemptId!==attemptId||identityValue.subjectDigest!==identity.subject_digest||identityValue.durableRef!==identity.durable_ref
        ||identityValue.observedAtMs!==identity.observed_at_ms)return null;
      const handle=typeof identity.durable_ref==='string'&&identity.durable_ref.startsWith('session:')?identity.durable_ref.slice(8):null;
      const session=handle&&db.prepare('SELECT handle,pid,start_time,cwd,task_id,run_id FROM session_handle WHERE handle=?').get(handle);
      const sessionKeys=['handle','pid','start_time','cwd','task_id','run_id'];
      if(!session||session.run_id!==attemptId||cleanup.session.handle!==handle||Object.keys(cleanup.session).sort().join(',')!==sessionKeys.sort().join(',')
        ||sessionKeys.some(key=>cleanup.session[key]!==session[key]))return null;
      const outputCount=db.prepare("SELECT count(*) n FROM orchestration_activity WHERE attempt_id=? AND json_extract(payload,'$.kind')='output'").get(attemptId).n;
      const terminalRows=db.prepare("SELECT payload FROM orchestration_activity WHERE attempt_id=? AND json_extract(payload,'$.kind')='terminal' ORDER BY ordinal").all(attemptId);
      if(outputCount!==0||terminalRows.length!==1)return null;
      const terminalText=Buffer.from(terminalRows[0].payload).toString('utf8'),terminal=JSON.parse(terminalText);
      if(canonical(terminal)!==terminalText||terminal.runId!==attempt.run_id||terminal.taskId!==attempt.task_id||terminal.attemptId!==attemptId
        ||terminal.kind!=='terminal'||terminal.data?.status!=='failed')return null;
      const receipts=db.prepare('SELECT receipt_id,revision,payload FROM orchestration_receipt WHERE attempt_id=? ORDER BY revision').all(attemptId);
      if(receipts.length) {
        if(receipts.length!==1)return null;
        const latest=receipts.at(-1),receipt=JSON.parse(latest.payload);
        if(receipt.attemptId!==attemptId||receipt.runId!==attempt.run_id||receipt.taskId!==attempt.task_id||receipt.receiptId!==latest.receipt_id
          ||receipt.revision!==latest.revision||receipt.outcome!=='failed'||receipt.cleanup!=='clean'
          ||receipt.evidenceRef!==sourceRef.replace(/^cleanup-observation:/,'cue-cleanup:'))return null;
      }
      const handoffs=db.prepare('SELECT handoff_id,receipt_id,receipt_revision,outcome,cleanup,payload,payload_sha256 FROM orchestration_handoff WHERE attempt_id=?').all(attemptId);
      if(handoffs.length) {
        if(handoffs.length!==1)return null;const handoff=handoffs[0],handoffText=Buffer.from(handoff.payload).toString('utf8'),value=JSON.parse(handoffText);
        const members=db.prepare('SELECT ordinal,attempt_id,kind,source_ref,sha256,byte_length FROM orchestration_handoff_artifact WHERE handoff_id=? ORDER BY ordinal').all(handoff.handoff_id);
        const expectedArtifact={kind:'cleanup-evidence',sourceRef,sha256:sha(bytes),byteLength:Buffer.from(bytes).byteLength};
        if(sha(handoffText)!==handoff.payload_sha256||canonical(value)!==handoffText||value.attemptId!==attemptId||value.handoffId!==handoff.handoff_id
          ||value.receiptId!==handoff.receipt_id||value.receiptRevision!==handoff.receipt_revision||value.outcome!=='failed'||handoff.outcome!=='failed'
          ||value.cleanup!=='clean'||handoff.cleanup!=='clean'||!Array.isArray(value.artifacts)||value.artifacts.length!==1
          ||canonical(value.artifacts[0])!==canonical(expectedArtifact)||members.length!==1||members[0].ordinal!==0||members[0].attempt_id!==attemptId
          ||members[0].kind!==expectedArtifact.kind||members[0].source_ref!==sourceRef||members[0].sha256!==expectedArtifact.sha256||members[0].byte_length!==expectedArtifact.byteLength)return null;
      }
      return Buffer.from(bytes);
    } catch { return null; }
  }
  function resolveHandoffArtifact(sourceRef,attemptId){
    if(typeof sourceRef!=='string'||typeof attemptId!=='string')return null;const split=sourceRef.indexOf(':');if(split<1)return null;
    if(sourceRef.startsWith('cleanup-observation:'))return resolveCleanupObservation(sourceRef,attemptId);
    const prefix=sourceRef.slice(0,split),observationId=sourceRef.slice(split+1),attempt=db.prepare('SELECT run_id,task_id FROM orchestration_attempt WHERE attempt_id=?').get(attemptId),row=db.prepare('SELECT run_id,target_id,attempt_id,payload,bytes FROM generated_output_observation WHERE observation_id=?').get(observationId);
    if(!attempt||!row||row.run_id!==attempt.run_id||row.target_id!=='goal-proposal')return null;
    if(prefix==='generated-output'&&row.attempt_id!==attemptId)return null;
    if(prefix==='verified-input'&&(attempt.task_id!=='verify-plan'||!db.prepare(`SELECT 1 FROM orchestration_handoff h JOIN orchestration_handoff_artifact x ON x.handoff_id=h.handoff_id
      WHERE h.attempt_id=? AND x.attempt_id=h.attempt_id AND x.kind='generated-output' AND x.source_ref=?
        AND x.sha256=json_extract(?,'$.sha256') AND x.byte_length=json_extract(?,'$.byteLength') AND x.byte_length=?`).get(row.attempt_id,`generated-output:${observationId}`,row.payload,row.payload,Buffer.from(row.bytes).byteLength)))return null;
    if(!['generated-output','verified-input'].includes(prefix))return null;
    try{const verified=generatedOutputs.read(row.run_id,row.target_id,row.attempt_id);return verified&&Buffer.from(verified.bytes).equals(Buffer.from(row.bytes))?Buffer.from(verified.bytes):null;}catch{return null;}
  }
  return Object.freeze({authorizeHandoffArtifact(sourceRef,attemptId){return resolveHandoffArtifact(sourceRef,attemptId)!==null;},resolveHandoffArtifact});
}
