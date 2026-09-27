import { createHash } from 'node:crypto';
import { isHostFailureDiagnosticCode } from '../daemon/dist/src/orchestration/failure-diagnostic.js';
import { createHandoffActivityStore } from '../daemon/dist/src/orchestration/handoff-activity.js';
import { createGeneratedJsonHandoffAuthority } from './generated-json-handoff-authority.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const REF = /^generated-recovery:([a-f0-9]{64})$/;
function canonical(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) throw Error('generated_recovery_plain_data');
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

/** Read-only recovery authority for generated JSON attempts. A persisted host
 * diagnostic is evidence that a failure happened, but it does not establish a
 * retryable cause, candidate eligibility, quota state, or external effects. */
export function createGeneratedJsonRecoveryAuthority({ db, now }) {
  if (!db?.open || db.inTransaction || typeof now !== 'function') throw Error('generated_recovery_authority_unavailable');
  const handoffs = createGeneratedJsonHandoffAuthority({ db });
  const activityStore = createHandoffActivityStore(db, {
    resolveArtifact: handoffs.resolveHandoffArtifact,
    authorizeArtifact: handoffs.authorizeHandoffArtifact,
  });

  function derive(attemptId, expected = null) {
    if (typeof attemptId !== 'string' || !attemptId) return null;
    try {
      const row = db.prepare(`SELECT a.run_id,a.task_id,a.candidate_id,a.state,a.cleanup_verified,
        r.receipt_id,r.revision,r.payload receipt_payload,h.handoff_id,h.receipt_id handoff_receipt_id,
        h.receipt_revision,h.outcome handoff_outcome,h.cleanup handoff_cleanup
        FROM orchestration_attempt a
        JOIN orchestration_receipt r ON r.attempt_id=a.attempt_id
        JOIN orchestration_handoff h ON h.attempt_id=a.attempt_id
        WHERE a.attempt_id=? ORDER BY r.revision DESC`).all(attemptId);
      if (row.length !== 1) return null;
      const terminal = row[0], receiptText = Buffer.from(terminal.receipt_payload).toString('utf8'), receipt = JSON.parse(receiptText);
      if (terminal.task_id !== 'produce-json' || terminal.state !== 'failed' || terminal.cleanup_verified !== 1
        || receipt.runId !== terminal.run_id || receipt.taskId !== terminal.task_id || receipt.attemptId !== attemptId
        || receipt.receiptId !== terminal.receipt_id || receipt.revision !== terminal.revision || receipt.outcome !== 'failed' || receipt.cleanup !== 'clean'
        || terminal.handoff_receipt_id !== terminal.receipt_id || terminal.receipt_revision !== terminal.revision
        || terminal.handoff_outcome !== 'failed' || terminal.handoff_cleanup !== 'clean') return null;
      if (expected && (expected.runId !== terminal.run_id || expected.receiptId !== terminal.receipt_id
        || expected.handoffId !== terminal.handoff_id || expected.candidateId !== terminal.candidate_id)) return null;
      if (activityStore.readTerminalIntegrity(attemptId).status !== 'verified') return null;
      const artifacts = db.prepare('SELECT source_ref FROM orchestration_handoff_artifact WHERE handoff_id=? ORDER BY ordinal').all(terminal.handoff_id);
      if (artifacts.length !== 1 || !handoffs.authorizeHandoffArtifact(artifacts[0].source_ref, attemptId)) return null;
      const activities = db.prepare("SELECT event_id,ordinal,payload FROM orchestration_activity WHERE attempt_id=? AND json_extract(payload,'$.kind')='terminal' ORDER BY ordinal").all(attemptId);
      if (activities.length !== 1) return null;
      const activityBytes = Buffer.from(activities[0].payload), activityText = activityBytes.toString('utf8'), activity = JSON.parse(activityText);
      if (activity.runId !== terminal.run_id || activity.taskId !== terminal.task_id || activity.attemptId !== attemptId
        || activity.eventId !== activities[0].event_id || activity.ordinal !== activities[0].ordinal || activity.kind !== 'terminal' || activity.data?.status !== 'failed'
        || !isHostFailureDiagnosticCode(activity.data?.diagnosticCode)
        || !Number.isSafeInteger(activity.observedAtMs) || activity.observedAtMs < 0) return null;
      if (canonical(activity) !== activityText
        || Object.keys(activity).sort().join(',') !== 'attemptId,data,eventId,kind,observedAtMs,ordinal,runId,taskId'
        || Object.keys(activity.data).sort().join(',') !== 'diagnosticCode,handoffRef,status') return null;
      const binding = JSON.stringify({ attemptId, ordinal: activities[0].ordinal, payloadSha256: sha(activityBytes), receiptId: terminal.receipt_id, handoffId: terminal.handoff_id });
      return Object.freeze({ sourceRef: `generated-recovery:${sha(binding)}`, bytes: activityBytes, observedAtMs: activity.observedAtMs });
    } catch { return null; }
  }

  return Object.freeze({
    observeFailure(context) {
      const observed = derive(context?.attemptId, context);
      const observedNow = now();
      if (!observed || !Number.isSafeInteger(observedNow) || observedNow < 0 || observed.observedAtMs > observedNow) return null;
      return Object.freeze({ cause: 'unknown', sourceRef: observed.sourceRef, observedAtMs: observed.observedAtMs,
        externalEffects: 'unknown', retryableHostCode: false, quotaResetAtMs: null,
        independentQualityFailure: false, priorCandidateEligible: false });
    },
    readObservation(sourceRef, attemptId) {
      if (typeof sourceRef !== 'string' || !REF.test(sourceRef)) return null;
      const observed = derive(attemptId);
      return observed?.sourceRef === sourceRef ? Buffer.from(observed.bytes) : null;
    },
    observeCandidate() { return null; },
  });
}
