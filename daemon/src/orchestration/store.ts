import { types } from 'node:util';
import { createHash } from 'node:crypto';
import type { Ledger } from '../ledger.js';
import { validateTaskPlan, deriveReadyTasks, type ValidatedPlan, type PlanTask, type HostTaskState } from './plan.js';
import { createRequirementContractStore } from '../verification/requirements.js';
import { createHandoffActivityStore, type ActivityFact, type ArtifactClaim } from './handoff-activity.js';
import { createRequestQueue, type RequestQueueHost } from '../request-queue.js';
import { readHeldRecoveryDisposition } from '../held-recovery.js';

export interface ClaimRequest { runId: string; taskId: string; attemptId: string; candidateId: string; observedAtMs: number; revision?: number; planDigest?: string; recoveryDecisionId?:string }
export interface RetryReference { previousAttemptId: string; receiptId: string; contractDigest: string }
export interface RetryContractInput {
  runId: string; requirementsDigest: string; maxAttemptsPerTask: number; maxAttemptsTotal: number; deadlineMs: number; boundAtMs: number;
}
export interface RetryContract extends Readonly<RetryContractInput> {
  readonly schemaVersion: 'cue-retry-v1'; readonly envelopeHash: string; readonly planDigest: string; readonly policyDigest: string; readonly digest: string;
}
export interface RetryReason { readonly cause: 'transient'; readonly sourceRef: string; readonly sourceDigest: string; readonly observedAtMs: number }
export function snapshotRetryReference(value: RetryReference): Readonly<RetryReference> {
  record(value, ['previousAttemptId', 'receiptId', 'contractDigest']); id(value.previousAttemptId, value.receiptId); hashText(value.contractDigest);
  return Object.freeze({ previousAttemptId: value.previousAttemptId, receiptId: value.receiptId, contractDigest: value.contractDigest });
}
export interface ExecutionReceipt {
  runId: string; taskId: string; attemptId: string; receiptId: string; revision: number;
  outcome: 'succeeded' | 'failed'; cleanup: 'clean' | 'unknown'; evidenceRef: string; observedAtMs: number;
}
export type TypedActivityEvent = ActivityFact;
export interface ClaimContext {
  readonly runId: string; readonly envelopeHash: string; readonly worktreeRealpath: string;
  readonly plan: ValidatedPlan; readonly task: PlanTask; readonly candidateId: string; readonly attemptId: string;
}
export interface ClaimReceipt {
  readonly runId: string; readonly taskId: string; readonly attemptId: string;
  readonly state: 'running' | 'completed' | 'failed' | 'blocked';
  readonly acceptance: 'unverified'; readonly launchRequired: boolean;
}
type AttemptRow = { attempt_id: string; run_id: string; task_id: string; candidate_id: string; state: ClaimReceipt['state'];
  claim_payload: string; worktree_realpath: string; lease_acquired_at: string | null; cleanup_verified: number };
function record(value: unknown, keys: readonly string[]): void {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) throw Error('invalid_store_input');
  if (Reflect.ownKeys(value).length !== keys.length) throw Error('invalid_store_fields');
  for (const key of keys) { const d = Object.getOwnPropertyDescriptor(value, key); if (!d || !Object.hasOwn(d, 'value')) throw Error('invalid_store_fields'); }
}
function id(...values: string[]): void { for (const v of values) if (typeof v !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/u.test(v)) throw Error('invalid_store_id'); }
function count(...values: number[]): void { for (const v of values) if (!Number.isSafeInteger(v) || v < 0) throw Error('invalid_store_number'); }
function payload(value: object): string { return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))); }
function canonical(value:unknown):string {
  if(value===null||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);
  if(typeof value==='number'){if(!Number.isSafeInteger(value))throw Error('invalid_store_number');return JSON.stringify(value);}
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  if(!value||typeof value!=='object'||types.isProxy(value)||Object.getPrototypeOf(value)!==Object.prototype)throw Error('invalid_store_input');
  return `{${Object.keys(value as object).sort().map(key=>`${JSON.stringify(key)}:${canonical((value as Record<string,unknown>)[key])}`).join(',')}}`;
}
function hashText(value: string): void { if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) throw Error('invalid_retry_digest'); }
const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
function dispatch(row:any){return {dispatchId:row.dispatch_id,requestId:row.request_id,responseId:row.response_id,attemptId:row.attempt_id,identityId:row.identity_id,contentRef:row.content_ref,contentSha256:row.content_sha256,contentLength:row.content_length,claimedAtMs:row.claimed_at_ms};}
function result(a: AttemptRow, launchRequired = false): ClaimReceipt { return Object.freeze({ runId: a.run_id, taskId: a.task_id, attemptId: a.attempt_id, state: a.state, acceptance: 'unverified', launchRequired }); }
function verifiedReceipt(value: unknown): { outcomeVerified: boolean; cleanupVerified: boolean; handoff?: { handoffId: string; identityId: string; artifacts: readonly ArtifactClaim[] } } {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) throw Error('invalid_receipt_verification');
  const keys = Object.hasOwn(value, 'handoff') ? ['outcomeVerified','cleanupVerified','handoff'] : ['outcomeVerified','cleanupVerified'];
  record(value, keys); const row=value as Record<string,unknown>;
  if(typeof row.outcomeVerified!=='boolean'||typeof row.cleanupVerified!=='boolean')throw Error('invalid_receipt_verification');
  if(!Object.hasOwn(row,'handoff'))return {outcomeVerified:row.outcomeVerified,cleanupVerified:row.cleanupVerified};
  record(row.handoff,['handoffId','identityId','artifacts']);const handoff=row.handoff as Record<string,unknown>;
  return {outcomeVerified:row.outcomeVerified,cleanupVerified:row.cleanupVerified,handoff:{handoffId:handoff.handoffId as string,identityId:handoff.identityId as string,artifacts:handoff.artifacts as readonly ArtifactClaim[]}};
}

/** Durable scheduling only. Host callbacks supply authority/evidence truth; no tool launch,
 * automatic retry, replacement writer or requirement acceptance is implemented here. */
export function createOrchestrationStore(db: Ledger, host: {
  authorizePlan: (runId: string, envelopeHash: string, plan: ValidatedPlan) => boolean;
  authorizeClaim: (context: ClaimContext) => boolean;
  verifyReceipt: (context: ClaimContext, receipt: Readonly<ExecutionReceipt>) => { outcomeVerified: boolean; cleanupVerified: boolean;
    handoff?: { handoffId: string; identityId: string; artifacts: readonly ArtifactClaim[] } };
  resolveHandoffArtifact?: (sourceRef: string, attemptId: string) => Uint8Array | null;
  authorizeHandoffArtifact?: (sourceRef: string, attemptId: string) => boolean;
  retry?: {
    now(): number;
    authorizeContract(contract: RetryContract): boolean;
    classifyFailure(context: ClaimContext, receipt: Readonly<ExecutionReceipt>): RetryReason | null;
  };
  wait?: RequestQueueHost;
}) {
  const handoffs = createHandoffActivityStore(db, {
    resolveArtifact: (sourceRef, attemptId) => host.resolveHandoffArtifact?.(sourceRef, attemptId) ?? null,
    authorizeArtifact: (sourceRef, attemptId) => host.authorizeHandoffArtifact?.(sourceRef, attemptId) === true,
  });
  const retryInstalled = () => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='orchestration_retry_contract'").get());
  const recoveryInstalled = () => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='orchestration_recovery_scope'").get());
  const handoffIntegrityInstalled = () => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='orchestration_handoff'").get());
  const criteria = createRequirementContractStore(db, { now: () => 0, resolveChecker: () => undefined });
  const requestQueue = host.wait ? createRequestQueue(db, host.wait) : null;
  function binding(runId: string) {
    id(runId);
    const row = db.prepare('SELECT r.envelope_hash,e.worktree_realpath,t.state FROM run r JOIN envelope e ON e.envelope_hash=r.envelope_hash JOIN task t ON t.id=r.task_id WHERE r.id=?').get(runId) as { envelope_hash: string; worktree_realpath: string; state: string } | undefined;
    if (!row) throw Error('run_binding_missing'); return row;
  }
  function load(runId: string): ValidatedPlan {
    const row = db.prepare('SELECT envelope_hash,digest,payload FROM orchestration_plan WHERE run_id=?').get(runId) as { envelope_hash: string; digest: string; payload: string } | undefined;
    if (!row || row.envelope_hash !== binding(runId).envelope_hash) throw Error('plan_binding_missing');
    const saved = JSON.parse(row.payload) as ValidatedPlan;
    const plan = validateTaskPlan(saved.approval, { revision: saved.revision, policyRevision: saved.approval.policyRevision, policyDigest: saved.approval.policyDigest, tasks: saved.tasks });
    if (plan.digest !== row.digest) throw Error('plan_digest_mismatch'); return plan;
  }
  function revisionPlan(runId:string,revision:number,planDigest:string):ValidatedPlan{
    if(!Number.isSafeInteger(revision)||revision<0||!/^[a-f0-9]{64}$/.test(planDigest))throw Error('explicit_revision_invalid');
    if(revision===0&&(!recoveryInstalled()||!db.prepare('SELECT 1 FROM orchestration_recovery_scope WHERE run_id=?').get(runId))){const plan=load(runId);if(plan.digest!==planDigest)throw Error('explicit_revision_mismatch');return plan;}
    const row=db.prepare('SELECT payload,plan_digest FROM orchestration_plan_revision WHERE run_id=? AND revision=? AND plan_digest=?').get(runId,revision,planDigest) as {payload:Buffer;plan_digest:string}|undefined;
    if(!row)throw Error('explicit_revision_missing');const p=JSON.parse(Buffer.from(row.payload).toString()) as ValidatedPlan;const plan=validateTaskPlan(p.approval,{revision:p.revision,policyRevision:p.approval.policyRevision,policyDigest:p.approval.policyDigest,tasks:p.tasks});if(plan.digest!==row.plan_digest)throw Error('explicit_revision_integrity');return plan;
  }
  function states(runId: string, revision?:number): HostTaskState[] {
    if(revision!==undefined){
      const rows=db.prepare(`SELECT s.task_id taskId,s.state status,(SELECT ar.attempt_id FROM orchestration_attempt_revision ar JOIN orchestration_attempt a ON a.attempt_id=ar.attempt_id WHERE ar.run_id=s.run_id AND ar.revision=s.revision AND ar.task_id=s.task_id AND a.state=s.state ORDER BY a.rowid DESC LIMIT 1) attempt_id
        FROM orchestration_revision_step s WHERE s.run_id=? AND s.revision=? ORDER BY s.task_id`).all(runId,revision) as (HostTaskState&{attempt_id:string|null})[];
      return rows.map(row=>row.status!=='completed'&&row.status!=='failed'?{taskId:row.taskId,status:row.status}:!row.attempt_id||handoffs.readTerminalIntegrity(row.attempt_id).status!=='verified'?{taskId:row.taskId,status:'blocked'}:{taskId:row.taskId,status:row.status});
    }
    if(!handoffIntegrityInstalled())return db.prepare('SELECT task_id taskId,state status FROM orchestration_step WHERE run_id=? ORDER BY task_id').all(runId) as HostTaskState[];
    const rows = db.prepare(`SELECT s.task_id AS taskId,s.state AS status,
      (SELECT a.attempt_id FROM orchestration_attempt a WHERE a.run_id=s.run_id AND a.task_id=s.task_id AND a.state=s.state ORDER BY a.rowid DESC LIMIT 1) attempt_id,
      EXISTS(SELECT 1 FROM orchestration_attempt a JOIN orchestration_handoff h ON h.attempt_id=a.attempt_id WHERE a.run_id=s.run_id AND a.task_id=s.task_id AND a.state=s.state) has_handoff
      FROM orchestration_step s
      WHERE s.run_id=? ORDER BY s.task_id`).all(runId) as (HostTaskState & { attempt_id: string | null; has_intent: number; has_handoff: number })[];
    return rows.map(row => {
      if(row.status!=='completed'&&row.status!=='failed')return {taskId:row.taskId,status:row.status};
      if(!row.attempt_id||!row.has_handoff)return {taskId:row.taskId,status:'blocked'};
      return handoffs.readTerminalIntegrity(row.attempt_id).status==='verified'?{taskId:row.taskId,status:row.status}:{taskId:row.taskId,status:'blocked'};
    });
  }
  function attempt(attemptId: string): AttemptRow {
    const row = db.prepare('SELECT * FROM orchestration_attempt WHERE attempt_id=?').get(attemptId) as AttemptRow | undefined;
    if (!row) throw Error('attempt_missing'); return row;
  }
  function context(a: AttemptRow): ClaimContext {
    const b = binding(a.run_id), ref=db.prepare('SELECT revision FROM orchestration_attempt_revision WHERE attempt_id=?').get(a.attempt_id) as {revision:number}|undefined;
    const digestRow=ref&&db.prepare('SELECT plan_digest FROM orchestration_plan_revision WHERE run_id=? AND revision=?').get(a.run_id,ref.revision) as {plan_digest:string}|undefined;
    const plan = ref&&digestRow?revisionPlan(a.run_id,ref.revision,digestRow.plan_digest):load(a.run_id), task = plan.tasks.find(t => t.id === a.task_id);
    if (!task || b.worktree_realpath !== a.worktree_realpath) throw Error('attempt_binding_mismatch');
    return Object.freeze({ runId: a.run_id, envelopeHash: b.envelope_hash, worktreeRealpath: b.worktree_realpath, plan, task, candidateId: a.candidate_id, attemptId: a.attempt_id });
  }
  function lineage(input: { runId: string; taskId: string; attemptId: string }): AttemptRow {
    const a = attempt(input.attemptId);
    if (a.run_id !== input.runId || a.task_id !== input.taskId) throw Error('attempt_lineage_mismatch'); return a;
  }
  function contractData(input: RetryContractInput): Omit<RetryContract, 'digest'> {
    record(input, ['runId', 'requirementsDigest', 'maxAttemptsPerTask', 'maxAttemptsTotal', 'deadlineMs', 'boundAtMs']);
    id(input.runId); hashText(input.requirementsDigest); count(input.maxAttemptsPerTask, input.maxAttemptsTotal, input.deadlineMs, input.boundAtMs);
    const current = criteria.read(input.runId), plan = load(input.runId);
    if (!current || current.requirements.digest !== input.requirementsDigest) throw Error('retry_criteria_mismatch');
    if (input.maxAttemptsPerTask < 1 || input.maxAttemptsPerTask > 8 || input.maxAttemptsTotal < plan.tasks.length || input.maxAttemptsTotal > 2048
        || input.deadlineMs <= input.boundAtMs || !Number.isFinite(new Date(input.deadlineMs).getTime())) throw Error('invalid_retry_limits');
    return Object.freeze({ ...input, schemaVersion: 'cue-retry-v1', envelopeHash: current.envelopeHash,
      planDigest: current.requirements.planDigest, policyDigest: current.requirements.policyDigest });
  }
  function readRetryContract(runId: string): RetryContract | null {
    id(runId); if (!retryInstalled()) return null;
    const row = db.prepare('SELECT payload,digest FROM orchestration_retry_contract WHERE run_id=?').get(runId) as { payload: string; digest: string } | undefined;
    if (!row) return null;
    const raw = JSON.parse(row.payload);
    const data = contractData({ runId, requirementsDigest: raw.requirementsDigest, maxAttemptsPerTask: raw.maxAttemptsPerTask,
      maxAttemptsTotal: raw.maxAttemptsTotal, deadlineMs: raw.deadlineMs, boundAtMs: raw.boundAtMs });
    if (payload(data) !== row.payload || digest(row.payload) !== row.digest) throw Error('retry_contract_integrity');
    return Object.freeze({ ...data, digest: row.digest });
  }
  function retryClock(): number {
    if (!host.retry) throw Error('retry_host_missing'); const now = host.retry.now(); count(now); return now;
  }
  function caps(contract: RetryContract, taskId: string, now: number): void {
    if (now < contract.boundAtMs || now >= contract.deadlineMs) throw Error('retry_deadline_exceeded');
    const total = db.prepare('SELECT COUNT(*) n FROM orchestration_attempt WHERE run_id=?').get(contract.runId) as { n: number };
    const task = db.prepare('SELECT COUNT(*) n FROM orchestration_attempt WHERE run_id=? AND task_id=?').get(contract.runId, taskId) as { n: number };
    if (total.n >= contract.maxAttemptsTotal || task.n >= contract.maxAttemptsPerTask) throw Error('retry_attempt_limit');
    if (!db.prepare("SELECT 1 FROM approval_event WHERE run_id=? AND envelope_hash=? AND decision='accept'").get(contract.runId, contract.envelopeHash)) throw Error('retry_approval_missing');
  }
  function claim(input: ClaimRequest, retry?: Readonly<RetryReference>): ClaimReceipt {
    const revised=Object.hasOwn(input,'revision')||Object.hasOwn(input,'planDigest');
    const recovery=Object.hasOwn(input,'recoveryDecisionId');
    record(input, revised?['runId', 'taskId', 'attemptId', 'candidateId', 'observedAtMs','revision','planDigest',...(recovery?['recoveryDecisionId']:[])]:['runId', 'taskId', 'attemptId', 'candidateId', 'observedAtMs']); id(input.runId, input.taskId, input.attemptId, input.candidateId); count(input.observedAtMs);
    if(recovery){id(input.recoveryDecisionId!);if(!revised)throw Error('recovery_revision_required');}
    const revision=revised?input.revision!:0,planDigest=revised?input.planDigest!:load(input.runId).digest;
    if(recoveryInstalled()&&Boolean(db.prepare('SELECT 1 FROM orchestration_recovery_scope WHERE run_id=?').get(input.runId))&&!revised)throw Error('explicit_revision_required');
    if(recoveryInstalled()&&db.prepare("SELECT 1 FROM orchestration_recovery_decision WHERE run_id=? AND action='stop'").get(input.runId))throw Error('recovery_run_sealed');
    const currentRevision=recoveryInstalled()?db.prepare('SELECT MAX(revision) revision FROM orchestration_plan_revision WHERE run_id=?').get(input.runId) as {revision:number|null}:null;
    if(currentRevision?.revision!==null&&currentRevision?.revision!==undefined&&revision!==currentRevision.revision)throw Error('recovery_revision_not_current');
    const encoded = payload(input);
    return db.transaction(() => {
      const existing = db.prepare('SELECT * FROM orchestration_attempt WHERE attempt_id=?').get(input.attemptId) as AttemptRow | undefined;
      if (existing) {
        if (existing.claim_payload !== encoded) throw Error('claim_replay_mismatch');
        if (retry) {
          const link = db.prepare('SELECT payload FROM orchestration_retry_link WHERE attempt_id=?').get(input.attemptId) as { payload: string } | undefined;
          if (!link || payload(JSON.parse(link.payload).request) !== payload(retry)) throw Error('retry_replay_mismatch');
        }
        return result(existing);
      }
      const b = binding(input.runId), plan = revisionPlan(input.runId,revision,planDigest), contract = readRetryContract(input.runId);
      if (b.state !== 'running') throw Error('run_not_running');
      const task = plan.tasks.find(t => t.id === input.taskId);
      if (!task || !task.candidateIds.includes(input.candidateId)) throw Error('candidate_not_allowed');
      const recoveryDecision=recovery?db.prepare(`SELECT d.decision_id,d.run_id,d.prior_attempt_id,d.action,d.destination_revision,d.selected_candidate_id,d.digest,d.payload,a.task_id,a.candidate_id prior_candidate
        FROM orchestration_recovery_decision d JOIN orchestration_attempt a ON a.attempt_id=d.prior_attempt_id
        WHERE d.decision_id=? AND d.run_id=?`).get(input.recoveryDecisionId,input.runId) as any:null;
      if(recovery&&(!recoveryDecision||recoveryDecision.action==='stop'||recoveryDecision.destination_revision!==revision||recoveryDecision.task_id!==input.taskId
        ||recoveryDecision.action==='retry'&&input.candidateId!==recoveryDecision.prior_candidate
        ||recoveryDecision.action==='switch'&&input.candidateId!==recoveryDecision.selected_candidate_id))throw Error('recovery_decision_lineage');
      if(recoveryDecision){const body=JSON.parse(Buffer.from(recoveryDecision.payload).toString());if(digest(recoveryDecision.payload)!==recoveryDecision.digest||body.decisionId!==recoveryDecision.decision_id||body.runId!==recoveryDecision.run_id||body.priorAttemptId!==recoveryDecision.prior_attempt_id||body.action!==recoveryDecision.action||body.destinationRevision!==recoveryDecision.destination_revision||body.selectedCandidateId!==recoveryDecision.selected_candidate_id)throw Error('recovery_decision_integrity');}
      if(recoveryDecision?.action==='retry'){
        const body=JSON.parse(Buffer.from(recoveryDecision.payload).toString());
        if(body.facts?.cause==='quota'&&(!Number.isSafeInteger(body.facts.quotaResetAtMs)||retryClock()<body.facts.quotaResetAtMs))throw Error('quota_reset_not_reached');
      }
      const ctx: ClaimContext = Object.freeze({ runId: input.runId, envelopeHash: b.envelope_hash, worktreeRealpath: b.worktree_realpath, plan, task, candidateId: input.candidateId, attemptId: input.attemptId });
      let reason: RetryReason | undefined;
      const checkPrevious = () => {
        if (!retry || !contract || contract.digest !== retry.contractDigest || retry.previousAttemptId === input.attemptId) throw Error('retry_contract_missing_or_changed');
        const old = lineage({ ...input, attemptId: retry.previousAttemptId });
        if (old.state !== 'failed' || old.cleanup_verified !== 1) throw Error('retry_previous_not_clean_failed');
        if (db.prepare('SELECT 1 FROM orchestration_retry_link WHERE previous_attempt_id=?').get(old.attempt_id)) throw Error('retry_previous_consumed');
        const latest = db.prepare('SELECT receipt_id,payload FROM orchestration_receipt WHERE attempt_id=? ORDER BY revision DESC LIMIT 1').get(old.attempt_id) as { receipt_id: string; payload: string } | undefined;
        if (!latest || latest.receipt_id !== retry.receiptId) throw Error('retry_receipt_mismatch');
        const receipt = JSON.parse(latest.payload) as ExecutionReceipt;
        if (receipt.runId !== input.runId || receipt.taskId !== input.taskId || receipt.attemptId !== old.attempt_id || receipt.outcome !== 'failed' || receipt.cleanup !== 'clean') throw Error('retry_receipt_mismatch');
        if (states(input.runId,revised?revision:undefined).find(s => s.taskId === task.id)?.status !== 'failed'
            || task.dependencyIds.some(dep => states(input.runId,revised?revision:undefined).find(s => s.taskId === dep)?.status !== 'completed')) throw Error('retry_task_not_ready');
        return { old, receipt: Object.freeze(receipt) };
      };
      if (retry) {
        const previous = checkPrevious();
        const classified = host.retry?.classifyFailure(context(previous.old), previous.receipt);
        if (!classified) throw Error('retry_not_classified');
        record(classified, ['cause', 'sourceRef', 'sourceDigest', 'observedAtMs']);
        id(classified.sourceRef); hashText(classified.sourceDigest); count(classified.observedAtMs);
        if (classified.cause !== 'transient' || classified.observedAtMs < previous.receipt.observedAtMs || classified.observedAtMs > retryClock()) throw Error('retry_not_transient');
        reason = Object.freeze({ ...classified });
      } else if(!recovery) {
        if (!deriveReadyTasks(plan, states(input.runId,revised?revision:undefined)).readyTaskIds.includes(input.taskId)) throw Error('task_not_ready');
        if (db.prepare('SELECT 1 FROM orchestration_attempt WHERE run_id=? AND task_id=?').get(input.runId, input.taskId)) throw Error('explicit_retry_required');
      }
      if (host.authorizeClaim(ctx) !== true) throw Error('claim_not_authorized');
      // Finish host callbacks before taking the final transactional admission snapshot.
      const claimNow = contract ? retryClock() : null;
      if (retry) checkPrevious();
      if (contract) { caps(contract, input.taskId, claimNow!); if (input.observedAtMs > claimNow!) throw Error('retry_future_claim'); }
      if (recoveryInstalled()) {
        if (db.prepare("SELECT 1 FROM orchestration_recovery_decision WHERE run_id=? AND action='stop'").get(input.runId)) throw Error('recovery_run_sealed');
        const latest = db.prepare('SELECT MAX(revision) revision FROM orchestration_plan_revision WHERE run_id=?').get(input.runId) as { revision: number | null };
        if (latest.revision !== null && latest.revision !== revision) throw Error('recovery_revision_not_current');
      }
      if (binding(input.runId).state !== 'running') throw Error('run_not_running');
      const recoveryPriorAttempts=new Set<string>();if(retry)recoveryPriorAttempts.add(retry.previousAttemptId);if(recoveryDecision)recoveryPriorAttempts.add(recoveryDecision.prior_attempt_id);
      for(const priorAttemptId of recoveryPriorAttempts){const disposition=readHeldRecoveryDisposition(db,priorAttemptId);if(disposition==='stop')throw Error('recovery_held_reconciled_stop');}
      let acquired: string | null = null;
      // Artifact responsibility (model-producer) is not workspace write authority.
      if (task.role === 'implementation') {
        if (db.prepare('SELECT 1 FROM workspace_write_lease WHERE worktree_realpath=? OR run_id=?').get(b.worktree_realpath, input.runId)) throw Error('writer_lease_busy');
        acquired = new Date(input.observedAtMs).toISOString();
        db.prepare('INSERT INTO workspace_write_lease VALUES(?,?,?)').run(b.worktree_realpath, input.runId, acquired);
      }
      if(revised){db.prepare("INSERT INTO orchestration_step(run_id,task_id,state) VALUES(?,?,'pending') ON CONFLICT(run_id,task_id) DO UPDATE SET state='pending'").run(input.runId,input.taskId);db.prepare("UPDATE orchestration_revision_step SET state='running' WHERE run_id=? AND revision=? AND task_id=? AND state IN('pending','failed')").run(input.runId,revision,input.taskId);}
      db.prepare("INSERT INTO orchestration_attempt VALUES(?,?,?,?,'running',?,?,?,0)").run(input.attemptId, input.runId, input.taskId, input.candidateId, encoded, b.worktree_realpath, acquired);
      if(revised)db.prepare('INSERT INTO orchestration_attempt_revision VALUES(?,?,?,?)').run(input.attemptId,input.runId,revision,input.taskId);
      if(recovery)db.prepare('INSERT INTO orchestration_recovery_activation VALUES(?,?,?,?,?,?)').run(input.recoveryDecisionId,input.attemptId,input.runId,revision,input.taskId,input.candidateId);
      if (retry) db.prepare('INSERT INTO orchestration_retry_link VALUES(?,?,?,?,?)').run(input.attemptId, retry.previousAttemptId, retry.receiptId, retry.contractDigest, payload({ request: retry, reason }));
      db.prepare("UPDATE orchestration_step SET state='running' WHERE run_id=? AND task_id=?").run(input.runId, input.taskId);
      if (acquired !== null) db.prepare('UPDATE run SET write_in_progress=1 WHERE id=?').run(input.runId);
      return result(attempt(input.attemptId), true);
    }).immediate();
  }
  return Object.freeze({
    readRetryContract(runId: string) { return db.transaction(() => readRetryContract(runId))(); },
    bindRetryContract(input: RetryContractInput): RetryContract {
      if (!retryInstalled()) throw Error('retry_migration_missing');
      return db.transaction(() => {
        const data = contractData(input), encoded = payload(data), value = Object.freeze({ ...data, digest: digest(encoded) });
        const previous = readRetryContract(input.runId);
        if (previous) { if (previous.digest !== value.digest) throw Error('retry_contract_replay_mismatch'); return previous; }
        const now = retryClock();
        if (binding(input.runId).state !== 'awaiting_approval' || input.boundAtMs > now || now >= input.deadlineMs
            || host.retry?.authorizeContract(value) !== true) throw Error('retry_contract_not_authorized');
        db.prepare('INSERT INTO orchestration_retry_contract VALUES(?,?,?)').run(input.runId, encoded, value.digest);
        return value;
      }).immediate();
    },
    claimRetry(input: ClaimRequest & { retry: RetryReference }): ClaimReceipt {
      const revised=Object.hasOwn(input,'revision')||Object.hasOwn(input,'planDigest');
      const recovery=Object.hasOwn(input,'recoveryDecisionId');
      record(input, revised?['runId', 'taskId', 'attemptId', 'candidateId', 'observedAtMs','revision','planDigest',...(recovery?['recoveryDecisionId']:[]),'retry']:['runId', 'taskId', 'attemptId', 'candidateId', 'observedAtMs', 'retry']);
      const retry = snapshotRetryReference(input.retry);
      return claim({ runId: input.runId, taskId: input.taskId, attemptId: input.attemptId, candidateId: input.candidateId, observedAtMs: input.observedAtMs,...(revised?{revision:input.revision,planDigest:input.planDigest}:{}),...(recovery?{recoveryDecisionId:input.recoveryDecisionId}:{}) }, retry);
    },
    install(runId: string, plan: ValidatedPlan): void {
      // This checks the in-process validation brand, not just caller-owned digest text.
      deriveReadyTasks(plan, plan.tasks.map(t => ({ taskId: t.id, status: 'pending' })));
      db.transaction(() => {
        const b = binding(runId);
        const previous = db.prepare('SELECT digest,envelope_hash FROM orchestration_plan WHERE run_id=?').get(runId) as { digest: string; envelope_hash: string } | undefined;
        if (previous) { if (previous.digest !== plan.digest || previous.envelope_hash !== b.envelope_hash) throw Error('plan_replay_mismatch'); return; }
        if (host.authorizePlan(runId, b.envelope_hash, plan) !== true) throw Error('plan_not_authorized');
        db.prepare('INSERT INTO orchestration_plan VALUES(?,?,?,?)').run(runId, b.envelope_hash, plan.digest, JSON.stringify(plan));
        for (const task of plan.tasks) db.prepare("INSERT INTO orchestration_step VALUES(?,?,'pending')").run(runId, task.id);
      }).immediate();
    },
    readiness(runId: string) { return db.transaction(() => deriveReadyTasks(load(runId), states(runId)))(); },
    readinessRevision(runId:string,revision:number,planDigest:string){return db.transaction(()=>deriveReadyTasks(revisionPlan(runId,revision,planDigest),states(runId,revision)))();},
    claim(input: ClaimRequest): ClaimReceipt { return claim(input); },
    requestQueue,
    claimWaitResponse(input: { requestId:string; responseId:string; claimedAtMs:number }) {
      record(input,['requestId','responseId','claimedAtMs']);id(input.requestId,input.responseId);count(input.claimedAtMs);
      if(!host.wait)throw Error('wait_delivery_unsupported');
      const wait=host.wait;
      return db.transaction(()=>{
        const prior=db.prepare('SELECT * FROM orchestration_wait_dispatch_claim WHERE request_id=? OR response_id=?').get(input.requestId,input.responseId) as any;
        if(prior){if(prior.request_id!==input.requestId||prior.response_id!==input.responseId)throw Error('wait_already_claimed');return Object.freeze({...dispatch(prior),newlyClaimed:false});}
        const row=db.prepare(`SELECT q.*,x.status,x.event_id,e.response_id,e.response_ordinal,e.responder_id inbox_responder_id,e.responder_revision inbox_responder_revision,
          e.content_ref,e.content_sha256,e.content_length,e.observed_at_ms,e.payload response_payload,e.payload_sha256 response_payload_sha256,
          a.state,a.claim_payload,i.payload identity_payload,i.payload_sha256 identity_payload_sha256,i.durable_ref,l.payload intent_payload,l.payload_sha256 intent_payload_sha256
          FROM orchestration_wait_request q JOIN orchestration_wait_resolution x ON x.request_id=q.request_id JOIN orchestration_wait_inbox e ON e.event_id=x.event_id
          JOIN orchestration_attempt a ON a.attempt_id=q.attempt_id JOIN orchestration_attempt_identity i ON i.identity_id=q.identity_id AND i.attempt_id=q.attempt_id
          JOIN orchestration_launch_intent l ON l.attempt_id=q.attempt_id WHERE q.request_id=? AND e.response_id=?`).get(input.requestId,input.responseId) as any;
        if(!row||row.status!=='responded'||row.state!=='running'||row.response_ordinal!==row.request_ordinal||row.inbox_responder_id!==row.responder_id||row.inbox_responder_revision!==row.responder_revision)throw Error('wait_response_not_dispatchable');
        if(digest(row.payload)!==row.payload_sha256||digest(row.response_payload)!==row.response_payload_sha256||digest(row.identity_payload)!==row.identity_payload_sha256||digest(row.intent_payload)!==row.intent_payload_sha256)throw Error('wait_dispatch_integrity');
        const cursor=(db.prepare("SELECT MAX(ordinal)n FROM orchestration_inbox_cursor WHERE scope='wait' AND scope_id=?").get(row.attempt_id) as {n:number|null}).n??0;
        if(row.request_ordinal!==cursor+1)throw Error('wait_response_not_next');
        const req=Object.freeze({requestId:row.request_id,runId:row.run_id,taskId:row.task_id,attemptId:row.attempt_id,identityId:row.identity_id,requestOrdinal:row.request_ordinal,streamId:row.stream_id,reason:'external-response' as const,responseSchema:'cue-wait-response-v1' as const,createdAtMs:row.created_at_ms,deadlineAtMs:row.deadline_at_ms,expectedResponder:Object.freeze({id:row.responder_id,revision:row.responder_revision})});
        const rsp=Object.freeze({eventId:row.event_id,requestId:row.request_id,responseId:row.response_id,responseOrdinal:row.response_ordinal,responder:Object.freeze({id:row.inbox_responder_id,revision:row.inbox_responder_revision}),contentRef:row.content_ref,observedAtMs:row.observed_at_ms});
        if(!Buffer.from(row.response_payload).equals(Buffer.from(JSON.stringify(rsp))))throw Error('wait_response_integrity');
        const ctx=context(attempt(row.attempt_id));
        const waitCtx=Object.freeze({runId:row.run_id,taskId:row.task_id,attemptId:row.attempt_id,identityId:row.identity_id});
        if(wait.authorizeResponder?.(waitCtx,req,rsp)!==true||wait.authorizeResponseContent?.(row.content_ref,row.request_id,row.attempt_id)!==true||host.authorizeClaim(ctx)!==true)throw Error('wait_dispatch_denied');
        const content=wait.resolveResponseContent?.(row.content_ref,row.request_id,row.attempt_id);if(!(content instanceof Uint8Array)||content.byteLength!==row.content_length||digest(Buffer.from(content))!==row.content_sha256)throw Error('wait_dispatch_content_changed');
        const dispatchId=digest(`cue-wait-dispatch-v1\0${row.request_id}\0${row.response_id}\0${row.attempt_id}\0${row.identity_id}`);
        db.prepare('INSERT INTO orchestration_wait_dispatch_claim VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(dispatchId,row.request_id,row.response_id,row.attempt_id,row.identity_id,row.intent_payload_sha256,digest(row.claim_payload),row.content_ref,row.content_sha256,row.content_length,input.claimedAtMs);
        db.prepare("INSERT INTO orchestration_inbox_cursor VALUES('wait',?,?,?,?,?,?)").run(row.attempt_id,row.request_ordinal,cursor,row.event_id,row.request_id,'responded');
        return Object.freeze({...dispatch({...row,dispatch_id:dispatchId,launch_intent_sha256:row.intent_payload_sha256,claim_payload_sha256:digest(row.claim_payload),claimed_at_ms:input.claimedAtMs}),contentBytes:Uint8Array.from(content),durableRef:row.durable_ref,newlyClaimed:true});
      }).immediate();
    },
    observeWaitDelivery(input:{dispatchId:string;status:'delivered'|'failed'|'unknown';observedAtMs:number;acknowledgement?:object}){
      record(input,Object.hasOwn(input,'acknowledgement')?['dispatchId','status','observedAtMs','acknowledgement']:['dispatchId','status','observedAtMs']);id(input.dispatchId);count(input.observedAtMs);if(!['delivered','failed','unknown'].includes(input.status))throw Error('invalid_delivery_observation');
      if(input.status==='delivered'){record(input.acknowledgement,['dispatchId','attemptId','identityId','durableRef','contentSha256']);const a=input.acknowledgement as any;id(a.dispatchId,a.attemptId,a.identityId,a.durableRef);hashText(a.contentSha256);}else if(Object.hasOwn(input,'acknowledgement'))throw Error('invalid_delivery_observation');
      const p=Buffer.from(JSON.stringify({dispatchId:input.dispatchId,status:input.status,observedAtMs:input.observedAtMs,...(input.acknowledgement?{acknowledgement:input.acknowledgement}:{})}));return db.transaction(()=>{const claimRow=db.prepare('SELECT * FROM orchestration_wait_dispatch_claim WHERE dispatch_id=?').get(input.dispatchId) as any;if(!claimRow)throw Error('wait_dispatch_missing');if(input.status==='delivered'){const a=input.acknowledgement as any,durable=db.prepare('SELECT durable_ref FROM orchestration_attempt_identity WHERE identity_id=?').get(claimRow.identity_id) as any;if(a.dispatchId!==claimRow.dispatch_id||a.attemptId!==claimRow.attempt_id||a.identityId!==claimRow.identity_id||a.durableRef!==durable?.durable_ref||a.contentSha256!==claimRow.content_sha256)throw Error('wait_delivery_ack_mismatch');}const old=db.prepare('SELECT payload FROM orchestration_wait_delivery_observation WHERE dispatch_id=?').get(input.dispatchId) as {payload:Buffer}|undefined;if(old){if(!old.payload.equals(p))throw Error('wait_delivery_observation_conflict');return;}db.prepare('INSERT INTO orchestration_wait_delivery_observation VALUES(?,?,?,?,?)').run(input.dispatchId,input.status,input.observedAtMs,digest(p),p);}).immediate();},
    activity(input: TypedActivityEvent | object): void { handoffs.activity(input as TypedActivityEvent); },
    prepareFinish(input:ExecutionReceipt):void {
      record(input,['runId','taskId','attemptId','receiptId','revision','outcome','cleanup','evidenceRef','observedAtMs']);id(input.runId,input.taskId,input.attemptId,input.receiptId,input.evidenceRef);count(input.revision,input.observedAtMs);
      if(input.outcome!=='failed'||input.cleanup!=='clean')throw Error('discard_receipt_invalid');
      const frozen=Object.freeze({...input}),encoded=payload(frozen);
      db.transaction(()=>{
        const a=lineage(frozen),ctx=context(a);
        if(db.prepare('SELECT 1 FROM orchestration_receipt WHERE receipt_id=?').get(frozen.receiptId))throw Error('finish_replay_mismatch');
        const latest=db.prepare('SELECT MAX(revision) AS n FROM orchestration_receipt WHERE attempt_id=?').get(a.attempt_id) as {n:number|null};
        if(latest.n!==null&&frozen.revision<=latest.n)throw Error('receipt_out_of_order');
        if(a.state!=='running'||a.cleanup_verified)throw Error('attempt_terminal');
        const receiptSha256=digest(encoded);
        const prior=db.prepare('SELECT receipt_id,receipt_revision,receipt_sha256 FROM attempt_staging_discard_authorization WHERE attempt_id=?').get(a.attempt_id) as {receipt_id:string;receipt_revision:number;receipt_sha256:string}|undefined;
        if(prior){if(prior.receipt_id!==frozen.receiptId||prior.receipt_revision!==frozen.revision||prior.receipt_sha256!==receiptSha256)throw Error('discard_authorization_mismatch');return;}
        const verified=verifiedReceipt(host.verifyReceipt(ctx,frozen));
        const hasIntent=Boolean(db.prepare('SELECT 1 FROM orchestration_launch_intent WHERE attempt_id=?').get(a.attempt_id));
        if(!verified.outcomeVerified||!verified.cleanupVerified||!hasIntent)throw Error('discard_receipt_unverified');
        const identity=db.prepare('SELECT identity_id FROM orchestration_attempt_identity WHERE attempt_id=?').get(a.attempt_id) as {identity_id:string}|undefined;
        if(!identity||!verified.handoff||verified.handoff.identityId!==identity.identity_id||verified.handoff.artifacts.length<1)throw Error('verified_handoff_required');
        handoffs.prepareHandoff({handoffId:verified.handoff.handoffId,attemptId:a.attempt_id,receiptId:frozen.receiptId,receiptRevision:frozen.revision,identityId:verified.handoff.identityId,outcome:frozen.outcome,cleanup:'clean',artifacts:verified.handoff.artifacts});
        const verification=JSON.parse(canonical(verified)),verificationSha256=digest(canonical(verification));
        const authorization={schemaVersion:'cue-attempt-staging-discard-authorization-v1',attemptId:a.attempt_id,runId:a.run_id,taskId:a.task_id,receiptId:frozen.receiptId,receiptRevision:frozen.revision,receiptSha256,outcome:'failed',cleanup:'clean',verification,verificationSha256};
        const body=canonical(authorization);
        db.prepare('INSERT INTO attempt_staging_discard_authorization VALUES(?,?,?,?,?,?,?)').run(a.attempt_id,frozen.receiptId,frozen.revision,receiptSha256,verificationSha256,digest(body),Buffer.from(body));
      }).immediate();
    },
    finish(input: ExecutionReceipt): ClaimReceipt {
      record(input, ['runId', 'taskId', 'attemptId', 'receiptId', 'revision', 'outcome', 'cleanup', 'evidenceRef', 'observedAtMs']); id(input.runId, input.taskId, input.attemptId, input.receiptId, input.evidenceRef); count(input.revision, input.observedAtMs);
      if (!['succeeded', 'failed'].includes(input.outcome) || !['clean', 'unknown'].includes(input.cleanup)) throw Error('invalid_execution_receipt');
      const frozen = Object.freeze({ ...input }), encoded = payload(frozen);
      return db.transaction(() => {
        const a = lineage(frozen), ctx = context(a);
        const replay = db.prepare('SELECT payload FROM orchestration_receipt WHERE receipt_id=?').get(frozen.receiptId) as { payload: string } | undefined;
        if (replay) {
          if (replay.payload !== encoded) throw Error('finish_replay_mismatch');
          if (a.state === 'completed' || a.state === 'failed') handoffs.validateTerminal(a.attempt_id,frozen.receiptId,frozen.revision,frozen.outcome,encoded);
          return result(a);
        }
        const latest = db.prepare('SELECT MAX(revision) AS n FROM orchestration_receipt WHERE attempt_id=?').get(a.attempt_id) as { n: number | null };
        if (latest.n !== null && frozen.revision <= latest.n) throw Error('receipt_out_of_order');
        if (a.state === 'completed' || a.state === 'failed' || a.cleanup_verified) throw Error('attempt_terminal');
        const authorization=db.prepare('SELECT receipt_id,receipt_revision,receipt_sha256,payload FROM attempt_staging_discard_authorization WHERE attempt_id=?').get(a.attempt_id) as {receipt_id:string;receipt_revision:number;receipt_sha256:string;payload:Buffer}|undefined;
        let verified;
        if(authorization){
          if(authorization.receipt_id!==frozen.receiptId||authorization.receipt_revision!==frozen.revision||authorization.receipt_sha256!==digest(encoded))throw Error('discard_authorization_mismatch');
          const body=JSON.parse(authorization.payload.toString('utf8')) as {verification:unknown};verified=verifiedReceipt(body.verification);
        }else verified=verifiedReceipt(host.verifyReceipt(ctx, frozen));
        const clean = frozen.cleanup === 'clean' && verified.cleanupVerified === true;
        const hasIntent = Boolean(db.prepare('SELECT 1 FROM orchestration_launch_intent WHERE attempt_id=?').get(a.attempt_id));
        let prepared: ReturnType<typeof handoffs.prepareHandoff> | null = null;
        if (clean && verified.outcomeVerified === true && hasIntent) {
          const identity = db.prepare('SELECT identity_id FROM orchestration_attempt_identity WHERE attempt_id=?').get(a.attempt_id) as { identity_id: string } | undefined;
          if (!identity) throw Error('verified_attempt_identity_required');
          const supplied = verified.handoff;
          if (!supplied || supplied.identityId !== identity.identity_id || supplied.artifacts.length < 1) throw Error('verified_handoff_required');
          prepared = handoffs.prepareHandoff({ handoffId: supplied.handoffId, attemptId: a.attempt_id, receiptId: frozen.receiptId,
            receiptRevision: frozen.revision, identityId: supplied.identityId, outcome: frozen.outcome, cleanup: 'clean', artifacts: supplied.artifacts });
          const streams=db.prepare('SELECT DISTINCT stream_id FROM orchestration_wait_request WHERE attempt_id=?').all(a.attempt_id) as {stream_id:string}[];
          for(const stream of streams){const seal=db.prepare('SELECT content_ref,content_sha256,content_length FROM orchestration_checkpoint_final_seal WHERE stream_id=?').get(stream.stream_id) as any;if(!seal||!prepared.artifacts.some(x=>x.sourceRef===seal.content_ref&&x.sha256===seal.content_sha256&&x.byteLength===seal.content_length))throw Error('terminal_checkpoint_seal_required');}
        }
        const state = a.state === 'blocked' && !prepared || !clean || verified.outcomeVerified !== true || !prepared ? 'blocked' : frozen.outcome === 'succeeded' ? 'completed' : 'failed';
        db.prepare('INSERT INTO orchestration_receipt VALUES(?,?,?,?)').run(frozen.receiptId, a.attempt_id, frozen.revision, encoded);
        if (prepared) handoffs.commitHandoff(prepared);
        if(state==='completed'||state==='failed'){
          handoffs.commitTerminalState(a.attempt_id,state);
        }else db.prepare('UPDATE orchestration_attempt SET state=?,cleanup_verified=? WHERE attempt_id=?').run(state,Number(clean),a.attempt_id);
        db.prepare('UPDATE orchestration_step SET state=? WHERE run_id=? AND task_id=?').run(state, a.run_id, a.task_id);
        const revision=db.prepare('SELECT revision FROM orchestration_attempt_revision WHERE attempt_id=?').get(a.attempt_id) as {revision:number}|undefined;
        if(revision)db.prepare('UPDATE orchestration_revision_step SET state=? WHERE run_id=? AND revision=? AND task_id=?').run(state,a.run_id,revision.revision,a.task_id);
        if (clean && a.lease_acquired_at !== null) {
          db.prepare('DELETE FROM workspace_write_lease WHERE worktree_realpath=? AND run_id=? AND acquired_at=?').run(a.worktree_realpath, a.run_id, a.lease_acquired_at);
          db.prepare('UPDATE run SET write_in_progress=0 WHERE id=?').run(a.run_id);
        }
        return result(attempt(a.attempt_id));
      }).immediate();
    },
    recover(runId: string): number {
      return db.transaction(() => {
        binding(runId);
        const rows = db.prepare("SELECT attempt_id,task_id FROM orchestration_attempt WHERE run_id=? AND state='running'").all(runId) as { attempt_id: string; task_id: string }[];
        for (const row of rows) {
          db.prepare("UPDATE orchestration_attempt SET state='blocked' WHERE attempt_id=?").run(row.attempt_id);
          db.prepare("UPDATE orchestration_step SET state='blocked' WHERE run_id=? AND task_id=?").run(runId, row.task_id);
          db.prepare("UPDATE orchestration_revision_step SET state='blocked' WHERE run_id=? AND task_id=? AND revision=(SELECT revision FROM orchestration_attempt_revision WHERE attempt_id=?)").run(runId,row.task_id,row.attempt_id);
        }
        if (rows.length) db.prepare("UPDATE task SET state='blocked',blocked_reason='orchestration_crash' WHERE id=(SELECT task_id FROM run WHERE id=?)").run(runId);
        return rows.length;
      }).immediate();
    },
    handoffActivity: handoffs,
    readTerminalIntegrity(attemptId: string) { return handoffs.readTerminalIntegrity(attemptId); },
  });
}
