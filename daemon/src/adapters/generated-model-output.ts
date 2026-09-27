import { createHash } from 'node:crypto';
import type { Ledger } from '../ledger.js';
import type { RuntimeContext, ExecutionOutcome } from '../integration-runtime.js';
import type { SessionRecord } from '../session-spawn.js';
import { createStageEnvelopeBinder, type StageEnvelopeBinding } from '../orchestration/stage-envelope.js';
import { createGeneratedOutputStore, type GeneratedOutputTarget, type GeneratedOutputRecord } from '../verification/generated-output.js';
import type { IsolatedModelExecution, IsolatedModelResult } from './isolated-local-model.js';
import { ISOLATED_LOCAL_ENDPOINT, ISOLATED_LOCAL_MODEL } from './isolated-local-model.js';
import { snapshotModelControlBundle, type ModelControlBundle } from '../model-control-bundle.js';

export interface ApprovedGeneratedInput {
  readonly stage: StageEnvelopeBinding; readonly target: GeneratedOutputTarget; readonly inputText: string;
  readonly controlBundle?: Readonly<ModelControlBundle>;
}
export type GeneratedCapture = Readonly<{ status: 'recorded'; record: GeneratedOutputRecord } | { status: 'unknown'; reason: string }>;
export interface CapturedModelExecution extends IsolatedModelExecution { readonly capture: Promise<GeneratedCapture> }
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const identity = (c: RuntimeContext) => JSON.stringify([c.runId, c.candidateId, c.role, c.subjectDigest]);
const sessionKeys = ['handle', 'pid', 'start_time', 'cwd', 'task_id', 'run_id'] as const;
const outcome = (value: unknown): value is ExecutionOutcome => value === 'succeeded' || value === 'failed' || value === 'unknown';

/** Host-only bridge for one approved target per actual model execution.
 * launch must construct the real executor from supplied stage ownership/input.
 * Only returned answer text encoded as UTF-8 is captured (not provider wire bytes).
 * Compose cleanup OUTSIDE this bridge, so its registry owns the returned object.
 * Historical failed/late responses never imply cleanup, acceptance, or currentness.
 * Capture errors downgrade a successful result AND completion to unknown; capture
 * exposes the storage outcome independently. No public registration/record API. */
export function createGeneratedModelOutput(host: {
  db: Ledger; now(): number;
  /** Pins used by the configured isolated executor. Missing pins disable principal attestation. */
  producerControlBundle?: ModelControlBundle;
  launch(context: RuntimeContext, approved: ApprovedGeneratedInput): Promise<IsolatedModelExecution>;
}) {
  const { db } = host;
  const pins = host.producerControlBundle ? snapshotModelControlBundle(host.producerControlBundle, 'model', host.producerControlBundle.nodeSha256) : undefined;
  const principal = 'local-model:' + sha(JSON.stringify([ISOLATED_LOCAL_ENDPOINT, ISOLATED_LOCAL_MODEL]));
  const ownedPrincipals = new Map<string, () => string | null>();
  const clock = () => { const n = host.now(); if (!Number.isSafeInteger(n) || n < 0) throw Error('capture_clock'); return n; };
  const stages = createStageEnvelopeBinder(db, { now: clock, resolveScope: () => { throw Error('capture_no_grants'); }, authorizeStage: () => false });
  let authorized: { targetDigest: string; attemptId: string; session: SessionRecord; bytesHash: string; observationId: string; stageHash: string } | null = null;
  function sessionMatches(session: SessionRecord) {
    const row = db.prepare('SELECT handle,pid,start_time,cwd,task_id,run_id FROM session_handle WHERE handle=?').get(session.handle) as SessionRecord | undefined;
    return Boolean(row && sessionKeys.every(key => row[key] === session[key]));
  }
  const outputs = createGeneratedOutputStore(db, { now: clock, authorizeObservation(context) {
    const a = authorized;
    return Boolean(a && a.attemptId === context.record.attemptId && a.observationId === context.record.observationId
      && a.targetDigest === context.target.targetDigest && a.stageHash === context.stage.envelopeHash
      && a.bytesHash === sha(context.bytes) && sessionMatches(a.session));
  } });
  const launched = new Set<string>(), executions = new WeakSet<object>();
  function approved(context: RuntimeContext): ApprovedGeneratedInput {
    if (context.role !== 'model' || !/^[a-f0-9]{64}$/.test(context.subjectDigest)) throw Error('capture_model_context');
    const stage = stages.read(context.runId);
    const attempt = db.prepare('SELECT run_id,task_id,candidate_id,state FROM orchestration_attempt WHERE attempt_id=?').get(context.runId) as
      { run_id: string; task_id: string; candidate_id: string; state: string } | undefined;
    if (!stage || !attempt || attempt.state !== 'running' || attempt.candidate_id !== context.candidateId
      || attempt.run_id !== stage.workflowRunId || attempt.task_id !== stage.taskId) throw Error('capture_attempt');
    const latest = db.prepare('SELECT attempt_id FROM orchestration_attempt WHERE run_id=? AND task_id=? ORDER BY rowid DESC LIMIT 1').get(attempt.run_id, attempt.task_id) as { attempt_id: string };
    if (latest.attempt_id !== context.runId || Date.parse(stage.envelope.expires_at) <= clock()) throw Error('capture_inactive_attempt');
    const rows = db.prepare('SELECT target_id FROM generated_output_target WHERE run_id=? ORDER BY target_id').all(stage.workflowRunId) as { target_id: string }[];
    const targets = rows.map(row => outputs.readTarget(stage.workflowRunId, row.target_id)!).filter(target => target.producerTaskId === stage.taskId);
    if (targets.length !== 1) throw Error('capture_requires_one_target');
    const input = outputs.readInput(stage.workflowRunId, targets[0].targetId)!;
    const inputText = Buffer.from(input.bytes).toString('utf8');
    if (!Buffer.from(inputText).equals(Buffer.from(input.bytes))) throw Error('capture_input_encoding');
    return Object.freeze({ stage, target: targets[0], inputText, ...(pins ? { controlBundle: pins } : {}) });
  }
  return Object.freeze({
    /** Historical ownership only; never current execution/cleanup authorization. */
    principalForAttempt(stage: StageEnvelopeBinding): string | null {
      if (!pins) return null;
      try {
        const current = stages.read(stage.attemptId);
        if (current?.envelopeHash !== stage.envelopeHash || current.workflowRunId !== stage.workflowRunId || current.taskId !== stage.taskId) return null;
        return ownedPrincipals.get(stage.attemptId)?.() ?? null;
      } catch { return null; }
    },
    async launch(context: RuntimeContext): Promise<CapturedModelExecution> {
      context.signal.throwIfAborted();
      const contextIdentity = identity(context), input = approved(context);
      context.signal.throwIfAborted();
      if (identity(context) !== contextIdentity) throw Error('capture_context_drift');
      if (launched.has(context.runId)) throw Error('capture_duplicate_launch');
      launched.add(context.runId);
      const execution = await host.launch(context, input);
      // Consume original promises even if the returned ownership is invalid.
      if (execution?.result instanceof Promise) void execution.result.catch(() => {});
      if (execution?.completion instanceof Promise) void execution.completion.catch(() => {});
      if (!execution || executions.has(execution) || !(execution.result instanceof Promise)
        || !(execution.completion instanceof Promise) || typeof execution.cancel !== 'function') throw Error('capture_execution');
      executions.add(execution);
      const session = Object.freeze(Object.fromEntries(sessionKeys.map(key => [key, execution.session?.[key]]))) as unknown as Readonly<SessionRecord>;
      function unchanged() {
        if (identity(context) !== contextIdentity || sessionKeys.some(key => execution.session?.[key] !== session[key])
          || !Number.isSafeInteger(session.pid) || session.pid < 1 || session.run_id !== context.runId
          || session.task_id !== input.stage.owner.task_id || session.cwd !== input.stage.owner.cwd || !sessionMatches(session)) throw Error('capture_session_identity');
        const current = stages.read(context.runId), target = outputs.readTarget(input.target.runId, input.target.targetId);
        const attempt = db.prepare('SELECT candidate_id FROM orchestration_attempt WHERE attempt_id=?').get(context.runId) as { candidate_id: string } | undefined;
        if (current?.envelopeHash !== input.stage.envelopeHash || target?.targetDigest !== input.target.targetDigest
          || attempt?.candidate_id !== context.candidateId) throw Error('capture_lineage_drift');
      }
      if (pins) ownedPrincipals.set(context.runId, () => { try { unchanged(); return principal; } catch { return null; } });
      // After this await the stage may already be cancelled/failed. Retain its
      // immutable ownership for historical capture, never reauthorize execution.
      const control = execution.cancel.bind(execution);
      let resolveCapture!: (value: GeneratedCapture) => void;
      const capture = new Promise<GeneratedCapture>(resolve => { resolveCapture = resolve; });
      const result: Promise<IsolatedModelResult> = Promise.all([execution.result, execution.completion]).then(([raw, completed]) => {
        let stored = false;
        try {
          unchanged();
          if (!raw || raw.attemptId !== context.runId || typeof raw.requestId !== 'string' || !/^[a-zA-Z0-9:_-]{1,128}$/.test(raw.requestId)
            || typeof raw.text !== 'string' || !outcome(raw.outcome) || !outcome(completed)) throw Error('capture_response_identity');
          const bytes = Buffer.from(raw.text, 'utf8');
          if (!bytes.length || bytes.length > input.target.maxBytes || bytes.toString('utf8') !== raw.text) throw Error('capture_response_bytes');
          const observationId = 'response-' + sha(JSON.stringify([contextIdentity, session, raw.requestId, input.target.targetDigest]));
          authorized = { targetDigest: input.target.targetDigest, attemptId: context.runId, session, bytesHash: sha(bytes), observationId, stageHash: input.stage.envelopeHash };
          try {
            const record = outputs.record({ runId: input.target.runId, targetId: input.target.targetId, attemptId: context.runId,
              observationId, observedAtMs: clock(), bytes });
            stored = true; resolveCapture(Object.freeze({ status: 'recorded', record }));
          } finally { authorized = null; }
        } catch { resolveCapture(Object.freeze({ status: 'unknown', reason: 'capture_not_verified' })); }
        const finalOutcome: ExecutionOutcome = !outcome(raw?.outcome) || raw.outcome !== completed ? 'unknown'
          : raw.outcome === 'succeeded' && !stored ? 'unknown' : raw.outcome;
        return Object.freeze({ ...raw, outcome: finalOutcome });
      }, error => { resolveCapture(Object.freeze({ status: 'unknown', reason: 'execution_rejected' })); throw error; });
      const completion = result.then(value => value.outcome, () => 'unknown' as const);
      return Object.freeze({ session, result, capture, completion, cancel: () => control() });
    },
  });
}
