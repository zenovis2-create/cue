import type { Ledger } from '../ledger.js';
import { readRunSelectionPolicy } from '../selection/policy-store.js';
import { readRunLocalSelectionPolicy } from '../selection/local-policy-store.js';
import { createLocalInvocationBudget } from '../local-invocation-budget.js';
import { createBudgetManager } from '../budget.js';
import { readAcceptanceHistory } from '../verification/acceptance.js';
import { createAttemptDecisionStore } from '../selection/attempt-decision-store.js';
import type { SelectionDecision } from '../selection/policy.js';
import type { LocalSelectionDecision } from '../selection/local-policy-store.js';
import type { CostCapacityObservation } from '../selection/cost-capacity-observation.js';
import { createPersistedCostObservationStore } from '../selection/persisted-cost-observations.js';
import type { TerminalIntegrityResult } from '../orchestration/handoff-activity.js';

export interface SelectionExplanation {
  readonly status: 'recorded' | 'legacy-not-recorded' | 'invalid' | 'not-started';
  readonly authority: 'historical-explanation-only';
  readonly kind: 'monetary' | 'local-invocation' | null;
  readonly mode: string | null; readonly selectedId: string | null; readonly reason: string | null;
  readonly ranking: 'scored' | 'not-performed' | null;
  readonly assessments: readonly Readonly<{ id: string | null; score: number | null; exclusions: readonly string[] }>[];
  readonly totalAssessments: number; readonly truncated: boolean;
}
const selectionId = (v: string | null) => v !== null && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(v) ? v : null;

const STAGE_LIMIT = 256;
const ACTIVITY_LIMIT = 20;
const ATTEMPT_HISTORY_LIMIT = 50;
const identifier = (value: unknown): string | null => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/.test(value) ? value : null;
const hash = (value: unknown): string | null => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value) ? value : null;
const parse = (value: unknown): Record<string, unknown> => {
  try { const decoded = typeof value === 'string' ? JSON.parse(value) : null;
    return decoded && typeof decoded === 'object' && !Array.isArray(decoded) ? decoded : {}; } catch { return {}; }
};

/** Read-only projection of the existing ledger. Never returns raw payloads,
 * worktree paths, auth material or free-form activity detail. Task success is
 * not requirement acceptance; only verified historical acceptance receipts are
 * projected. Reading a receipt never reruns a checker or proves current files.
 */
export function readOrchestrationSnapshot(db: Ledger, runId: string, integrityReader?: (attemptId: string) => TerminalIntegrityResult, observationNowMs: number = Date.now()) {
  return db.transaction(() => {
    const planRow = db.prepare('SELECT digest, CASE WHEN length(payload)<=1048576 THEN payload ELSE NULL END payload FROM orchestration_plan WHERE run_id=?').get(runId) as { digest: string; payload: string | null } | undefined;
    if (!planRow) return null;
    const plan = parse(planRow.payload);
    const roles = new Map<string, string>();
    if (Array.isArray(plan.tasks)) for (const task of plan.tasks.slice(0, STAGE_LIMIT)) {
      if (task && identifier(task.id) && ['planner', 'implementation', 'verifier', 'model-producer'].includes(task.role)) roles.set(task.id, task.role);
    }
    let policy: Readonly<{ mode: string; revision: number; digest: string }> | null = null;
    let observationMaxAgeMs: number | null = null;
    try {
      const binding = readRunSelectionPolicy(db, runId);
      const local = readRunLocalSelectionPolicy(db, runId);
      if (binding && local) throw Error('ambiguous_policy');
      const snapshot = (binding ?? local)?.snapshot;
      if (binding) observationMaxAgeMs = binding.snapshot.policy.maxEstimateAgeMs;
      else if (local) observationMaxAgeMs = Number.MAX_SAFE_INTEGER;
      if (snapshot) policy = Object.freeze({ mode: snapshot.policy.mode, revision: snapshot.revision, digest: snapshot.digest });
    } catch { /* Invalid stored policy is displayed as unverified, never guessed. */ }
    const decisionStore = createAttemptDecisionStore(db), decisions = new Map<string, SelectionExplanation>();
    const selection = (attemptId: string | null): SelectionExplanation => {
      if (attemptId !== null && decisions.has(attemptId)) return decisions.get(attemptId)!;
      const empty = (status: SelectionExplanation['status']): SelectionExplanation => Object.freeze({ status,
        authority: 'historical-explanation-only', kind: null, mode: null, selectedId: null, reason: null, ranking: null,
        assessments: Object.freeze([]), totalAssessments: 0, truncated: false });
      if (attemptId === null) return empty('not-started');
      let result: SelectionExplanation;
      try {
        const saved = decisionStore.read(attemptId);
        if (!saved.snapshot) result = empty('legacy-not-recorded');
        else {
          const snapshot = saved.snapshot;
          if (snapshot.runId !== runId) throw Error('selection_run_mismatch');
          const monetary = snapshot.policy.kind === 'monetary';
          const scored = monetary ? snapshot.decision as SelectionDecision : null;
          const fixed = !monetary ? snapshot.decision as LocalSelectionDecision : null;
          result = Object.freeze({ status: 'recorded', authority: 'historical-explanation-only', kind: snapshot.policy.kind,
            mode: scored?.mode ?? policy?.mode ?? null, selectedId: selectionId(scored?.selectedId ?? fixed?.candidateId ?? null),
            reason: scored?.reason ?? 'fixed-pair-eligible', ranking: monetary ? 'scored' : 'not-performed',
            assessments: Object.freeze((scored?.assessments ?? []).slice(0, 50).map(a => Object.freeze({ id: selectionId(a.id), score: a.score, exclusions: Object.freeze([...a.exclusions]) }))),
            totalAssessments: scored?.assessments.length ?? 0, truncated: (scored?.assessments.length ?? 0) > 50 });
        }
      } catch { result = empty('invalid'); }
      decisions.set(attemptId, result); return result;
    };
    // Per-attempt observations are descriptive. Never expose identity/source
    // references, convert dimensions, infer free service, or grant settlement.
    type CostView = Readonly<{ status: 'unavailable'; authority: 'observation-only' }> | Readonly<{
      status: 'observed'; authority: 'observation-only'; costState: CostCapacityObservation['costState'];
      costDimension: CostCapacityObservation['costDimension'];
      units: number | null; currency: string | null; unit: CostCapacityObservation['unit'];
      freshness: CostCapacityObservation['freshness']; observedAtMs: number; billing: CostCapacityObservation['billing'];
    }>;
    const unavailableCost: CostView = Object.freeze({ status: 'unavailable', authority: 'observation-only' });
    const costs = new Map<string, CostView>();
    const observationBudget = createBudgetManager(db, { verifyFinalReceipt: () => false });
    function costObservation(attemptId: string | null): CostView {
      if (attemptId === null || observationMaxAgeMs === null || !Number.isSafeInteger(observationNowMs) || observationNowMs < 0) return unavailableCost;
      if (costs.has(attemptId)) return costs.get(attemptId)!;
      let result = unavailableCost;
      try {
        const persisted=createPersistedCostObservationStore(db).readAttempt(runId,attemptId,observationNowMs,observationMaxAgeMs);
        if(persisted)result=Object.freeze({status:'observed',authority:'observation-only',costDimension:persisted.costDimension,costState:persisted.costState,
          units:persisted.units,currency:persisted.currency,unit:persisted.unit,freshness:persisted.freshness,observedAtMs:persisted.observedAtMs,billing:persisted.billing});
        const requests = db.prepare('SELECT request_id FROM integration_budget_reservation WHERE run_id=? AND attempt_id=? LIMIT 2')
          .all(runId, attemptId) as { request_id: string }[];
        if (!persisted&&requests.length === 1) {
          const value = observationBudget.costObservation(runId, requests[0].request_id, observationNowMs, observationMaxAgeMs);
          if (value) result = Object.freeze({ status: 'observed', authority: 'observation-only', costDimension: 'api', costState: value.costState,
            units: value.units, currency: value.currency, unit: value.unit, freshness: value.freshness,
            observedAtMs: value.observedAtMs, billing: value.billing });
        }
      } catch { /* Invalid lineage is unavailable; other attempts still render. */ }
      costs.set(attemptId, result); return result;
    }
    const stageRows = db.prepare(`SELECT s.task_id,s.state,a.attempt_id,a.candidate_id,a.cleanup_verified,a.state attempt_state,
      i.tool_id,i.tool_revision,i.model_id,i.model_revision,
      EXISTS(SELECT 1 FROM orchestration_handoff h WHERE h.attempt_id=a.attempt_id) has_handoff,
      EXISTS(SELECT 1 FROM orchestration_handoff_legacy l WHERE l.attempt_id=a.attempt_id) legacy_handoff,
      (SELECT COUNT(*) FROM orchestration_attempt h WHERE h.run_id=s.run_id AND h.task_id=s.task_id) attempt_count,
      (SELECT COUNT(*) FROM orchestration_attempt h WHERE h.run_id=s.run_id AND h.task_id=s.task_id AND h.state='failed') failed_count
      FROM orchestration_step s LEFT JOIN orchestration_attempt a ON a.rowid=(SELECT MAX(h.rowid) FROM orchestration_attempt h WHERE h.run_id=s.run_id AND h.task_id=s.task_id)
      LEFT JOIN orchestration_launch_intent i ON i.attempt_id=a.attempt_id
      WHERE s.run_id=? ORDER BY s.task_id LIMIT ?`).all(runId, STAGE_LIMIT) as { task_id: string; state: string; attempt_id: string | null; candidate_id: string | null; cleanup_verified: number | null; attempt_state: string | null; attempt_count: number; failed_count: number }[];
    const integrity = (attemptId: string | null): TerminalIntegrityResult | null => attemptId === null ? null
      : integrityReader ? integrityReader(attemptId) : Object.freeze({status:'integrity-unavailable',attemptId});
    const stages = stageRows.map(row => { const terminal=integrity(row.attempt_id), verified=terminal?.status==='verified'; return Object.freeze({ taskId: identifier(row.task_id),
      role: roles.get(row.task_id) ?? null,
      state: ['completed','failed'].includes(row.state) && !verified ? 'blocked' : ['pending', 'running', 'completed', 'failed', 'blocked'].includes(row.state) ? row.state : 'unknown',
      attemptId: identifier(row.attempt_id), candidateId: identifier(row.candidate_id),
      selection: selection(row.attempt_id), costObservation: costObservation(row.attempt_id),
      attemptState: row.attempt_state, attemptCount: row.attempt_count, failedAttemptCount: row.failed_count,
      toolId: identifier((row as any).tool_id), toolRevision: identifier((row as any).tool_revision),
      modelId: identifier((row as any).model_id), modelRevision: identifier((row as any).model_revision),
      handoffStatus: row.attempt_id === null ? 'not-started' : terminal?.status ?? 'integrity-unavailable',
      cleanup: row.attempt_id === null ? 'not-started' : verified && row.cleanup_verified === 1 ? 'verified-clean' : 'unknown',
      acceptance: 'unverified' as const,
    }); });
    const totalStages = (db.prepare('SELECT COUNT(*) n FROM orchestration_step WHERE run_id=?').get(runId) as { n: number }).n;
    const attemptCount = (db.prepare('SELECT COUNT(*) n FROM orchestration_attempt WHERE run_id=?').get(runId) as { n: number }).n;
    const historyRows = db.prepare('SELECT attempt_id,task_id,candidate_id,state,cleanup_verified FROM orchestration_attempt WHERE run_id=? ORDER BY rowid DESC LIMIT ?').all(runId, ATTEMPT_HISTORY_LIMIT) as { attempt_id: string; task_id: string; candidate_id: string; state: string; cleanup_verified: number }[];
    const attemptHistory = historyRows.map(row => { const terminal=integrity(row.attempt_id),verified=terminal?.status==='verified';return Object.freeze({ attemptId: identifier(row.attempt_id), taskId: identifier(row.task_id),
      candidateId: identifier(row.candidate_id), persistedState: row.state, state: ['completed','failed'].includes(row.state)&&!verified?'blocked':row.state,
      handoffStatus: terminal?.status??'integrity-unavailable', cleanup: verified&&row.cleanup_verified === 1 ? 'verified-clean' : 'unknown', selection: selection(row.attempt_id), costObservation: costObservation(row.attempt_id) }); });
    const activityRows = db.prepare(`SELECT e.event_id,e.ordinal,e.attempt_id,CASE WHEN length(e.payload)<=4096 THEN e.payload ELSE NULL END payload
      FROM orchestration_activity e JOIN orchestration_attempt a ON a.attempt_id=e.attempt_id WHERE a.run_id=?
      ORDER BY e.rowid DESC LIMIT ?`).all(runId, ACTIVITY_LIMIT) as { event_id: string; ordinal: number; attempt_id: string; payload: string | null }[];
    const activity = activityRows.map(row => {
      const event = parse(row.payload);
      const typed = event.data && typeof event.data === 'object' && !Array.isArray(event.data);
      return Object.freeze({ eventId: identifier(row.event_id), attemptId: identifier(row.attempt_id), ordinal: row.ordinal,
        kind: typed && ['heartbeat', 'progress', 'output', 'tool', 'artifact', 'usage', 'cancel', 'terminal'].includes(event.kind as string) ? event.kind as string : 'legacy-activity-unavailable',
        availability: typed ? 'recorded' : 'legacy-activity-unavailable',
        data: typed ? Object.freeze({
          contentRef: identifier((event.data as any).contentRef), sourceRef: identifier((event.data as any).sourceRef),
          sha256: hash((event.data as any).sha256), byteLength: Number.isSafeInteger((event.data as any).byteLength) ? (event.data as any).byteLength : null,
          status: identifier((event.data as any).status), toolId: identifier((event.data as any).toolId), toolRevision: identifier((event.data as any).toolRevision),
        }) : null,
        observedAtMs: typeof event.observedAtMs === 'number' && Number.isSafeInteger(event.observedAtMs) && event.observedAtMs >= 0 ? event.observedAtMs : null });
    });
    const totalActivity = (db.prepare('SELECT COUNT(*) n FROM orchestration_activity e JOIN orchestration_attempt a ON a.attempt_id=e.attempt_id WHERE a.run_id=?').get(runId) as { n: number }).n;
    let budget: { status: 'recorded' | 'unknown'; currency: string | null; unit: string | null;
      remainingUnits: string | null; debtUnits: string | null; committedUnits: string | null;
      actualUnits: string | null; costStatus: 'final' | 'unknown' } = {
      status: 'unknown', currency: null, unit: null, remainingUnits: null, debtUnits: null, committedUnits: null, actualUnits: null, costStatus: 'unknown',
    };
    if (db.prepare('SELECT 1 FROM integration_budget WHERE run_id=?').get(runId)) {
      // summary() is a read-only transaction; the verifier cannot grant anything.
      const summary = createBudgetManager(db, { verifyFinalReceipt: () => false }).summary(runId);
      const reservations = db.prepare(`SELECT r.attempt_id,(SELECT kind FROM integration_budget_receipt b WHERE b.run_id=r.run_id AND b.request_id=r.request_id ORDER BY revision DESC LIMIT 1) kind,
        (SELECT provider_final FROM integration_budget_receipt b WHERE b.run_id=r.run_id AND b.request_id=r.request_id ORDER BY revision DESC LIMIT 1) final
        FROM integration_budget_reservation r WHERE r.run_id=?`).all(runId) as { attempt_id: string; kind: string | null; final: number | null }[];
      const covered = (db.prepare('SELECT COUNT(*) n FROM orchestration_attempt a JOIN integration_budget_reservation r ON r.run_id=a.run_id AND r.attempt_id=a.attempt_id WHERE a.run_id=?').get(runId) as { n: number }).n;
      const settled = (db.prepare("SELECT COUNT(*) n FROM orchestration_attempt WHERE run_id=? AND state IN ('completed','failed','blocked') AND cleanup_verified=1").get(runId) as { n: number }).n;
      const plannedIds = Array.isArray(plan.tasks) ? plan.tasks.map(task => identifier(task?.id)) : [];
      const planComplete = plannedIds.length > 0 && plannedIds.length === totalStages && totalStages <= STAGE_LIMIT &&
        new Set(plannedIds).size === plannedIds.length && plannedIds.every(id => id !== null && stages.some(stage => stage.taskId === id && stage.state === 'completed' && stage.attemptState === 'completed'));
      // A final receipt for today's attempts does not cover a future verifier.
      // Require every planned stage, settled attempt and reservation to match.
      const final = planComplete && attemptCount >= totalStages && settled === attemptCount &&
        covered === attemptCount && reservations.length === attemptCount &&
        reservations.every(row => row.kind === 'actual' && row.final === 1);
      budget = { status: 'recorded', currency: identifier(summary.currency), unit: summary.unit,
        remainingUnits: summary.remainingUnits.toString(), debtUnits: summary.debtUnits.toString(), committedUnits: summary.committedUnits.toString(),
        actualUnits: final ? summary.actualUnits.toString() : null, costStatus: final ? 'final' : 'unknown' };
    }
    // Keep the legacy monetary projection unchanged. Counts are a separate
    // dimension and never imply provider requests, final billing or cleanup.
    let localAccounting: Readonly<{ kind: 'local-invocation'; status: 'recorded' | 'unknown';
      limit: number | null; committed: number | null; remaining: number | null;
      semantics: 'committed-dispatch-intent'; providerBilling: 'not-measured' }> | undefined;
    if (db.prepare('SELECT 1 FROM local_invocation_budget WHERE run_id=?').get(runId)) {
      localAccounting = Object.freeze({ kind: 'local-invocation', status: 'unknown', limit: null, committed: null, remaining: null,
        semantics: 'committed-dispatch-intent', providerBilling: 'not-measured' });
      try {
        const binding = readRunLocalSelectionPolicy(db, runId);
        const summary = createLocalInvocationBudget(db).summary(runId);
        const approved = parse(JSON.stringify(plan.approval));
        if (!binding || readRunSelectionPolicy(db, runId)
          || summary.policyRevision !== `${binding.snapshot.policyId}:${binding.snapshot.revision}`
          || approved.policyRevision !== summary.policyRevision || approved.policyDigest !== binding.snapshot.digest
          || summary.limit > binding.snapshot.policy.limitAttempts) throw Error('local_accounting_lineage');
        localAccounting = Object.freeze({ kind: 'local-invocation', status: 'recorded', limit: summary.limit,
          committed: summary.committed, remaining: summary.remaining, semantics: 'committed-dispatch-intent', providerBilling: 'not-measured' });
      } catch { /* Corrupt/unbound counts remain unknown; never guess a balance. */ }
    }
    let acceptanceRecord: Readonly<{ acceptedAt: number; evaluationId: string }> | null = null;
    let requirementEvaluation: Readonly<{ id: string; verdict: 'pass' | 'fail' | 'unknown';
      outcomes: readonly Readonly<{ requirementId: string; required: boolean; verdict: 'pass' | 'fail' | 'unknown' }>[] }> | null = null;
    try {
      const history = readAcceptanceHistory(db, runId);
      if (history) requirementEvaluation = Object.freeze({ id: history.evaluationId, verdict: history.verdict,
        outcomes: Object.freeze(history.outcomes.map(outcome => Object.freeze({ requirementId: outcome.requirementId,
          required: outcome.required, verdict: outcome.verdict }))),
      });
      if (history?.receipt && history.receipt.planDigest === planRow.digest) acceptanceRecord = Object.freeze({
        acceptedAt: history.receipt.acceptedAt, evaluationId: history.receipt.evaluationId,
      });
    } catch { /* Missing/corrupt history cannot grant acceptance in the UI. */ }
    const waitInstalled=Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='orchestration_wait_request'").get());
    const waitRows=waitInstalled?db.prepare(`SELECT a.attempt_id,
      CASE WHEN l.attempt_id IS NOT NULL THEN 'legacy-wait-unavailable' ELSE 'recorded' END availability,
      (SELECT COUNT(*) FROM orchestration_wait_request q WHERE q.attempt_id=a.attempt_id) request_count,
      COALESCE((SELECT MAX(ordinal) FROM orchestration_inbox_cursor c WHERE c.scope='wait' AND c.scope_id=a.attempt_id),0) wait_cursor,
      (SELECT COUNT(*) FROM orchestration_wait_resolution x JOIN orchestration_wait_request q ON q.request_id=x.request_id WHERE q.attempt_id=a.attempt_id AND q.request_ordinal>COALESCE((SELECT MAX(ordinal) FROM orchestration_inbox_cursor c WHERE c.scope='wait' AND c.scope_id=a.attempt_id),0)) pending_count,
      (SELECT COUNT(*) FROM orchestration_wait_dispatch_claim d WHERE d.attempt_id=a.attempt_id) dispatch_count,
      (SELECT COUNT(*) FROM orchestration_wait_delivery_observation o JOIN orchestration_wait_dispatch_claim d ON d.dispatch_id=o.dispatch_id WHERE d.attempt_id=a.attempt_id AND o.status='delivered') delivered_count,
      (SELECT COALESCE(MAX(c.ordinal),0) FROM orchestration_inbox_cursor c JOIN orchestration_wait_request q ON q.stream_id=c.scope_id WHERE c.scope='checkpoint' AND q.attempt_id=a.attempt_id) checkpoint_cursor,
      EXISTS(SELECT 1 FROM orchestration_checkpoint_final_seal s JOIN orchestration_wait_request q ON q.stream_id=s.stream_id WHERE q.attempt_id=a.attempt_id) sealed
      FROM orchestration_attempt a LEFT JOIN orchestration_wait_legacy l ON l.attempt_id=a.attempt_id WHERE a.run_id=? ORDER BY a.rowid DESC LIMIT 50`).all(runId) as any[]:[];
    const wait=Object.freeze(waitRows.map(row=>Object.freeze({attemptId:identifier(row.attempt_id),availability:row.availability,requestCount:row.request_count,waitCursor:row.wait_cursor,pendingCount:row.pending_count,
      dispatchState:row.dispatch_count===0?'not-claimed':row.delivered_count===row.dispatch_count?'delivered-observed':'claimed-unresolved',checkpointCursor:row.checkpoint_cursor,finalSeal:row.sealed===1?'sealed':'not-sealed'})));
    return Object.freeze({ runId: identifier(runId), planRevision: identifier(plan.revision), planDigest: hash(planRow.digest), policy,
      acceptance: acceptanceRecord ? 'verified' as const : 'unverified' as const, acceptanceRecord, requirementEvaluation,
      stages: Object.freeze(stages), stagesTruncated: totalStages > STAGE_LIMIT,
      attemptCount, attemptHistory: Object.freeze(attemptHistory), attemptHistoryTruncated: attemptCount > ATTEMPT_HISTORY_LIMIT,
      activity: Object.freeze(activity), activityTruncated: totalActivity > ACTIVITY_LIMIT, budget: Object.freeze(budget),
      wait, waitTruncated: attemptCount>50, ...(localAccounting ? { localAccounting } : {}) });
  })();
}
