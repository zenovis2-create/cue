import type { Ledger } from '../ledger.js';

export const ledgerTaskStates = ['queued', 'running', 'awaiting_approval', 'blocked', 'completed', 'failed'] as const;
export type LedgerTaskState = typeof ledgerTaskStates[number];
export type DisplayStatus = '유휴' | '작업 중' | '막힘' | '완료';

const statusLabels: Record<LedgerTaskState, DisplayStatus> = {
  queued: '유휴',
  running: '작업 중',
  awaiting_approval: '작업 중',
  blocked: '막힘',
  completed: '완료',
  failed: '막힘',
};

const stageLabels: Record<LedgerTaskState, string> = {
  queued: '대기',
  running: '실행',
  awaiting_approval: '승인 대기',
  blocked: '중단됨',
  completed: '마침',
  failed: '실패',
};

function assertTaskState(value: string): asserts value is LedgerTaskState {
  if (!(ledgerTaskStates as readonly string[]).includes(value)) throw new Error(`unknown ledger task state: ${value}`);
}

export function displayStatus(value: string): DisplayStatus {
  assertTaskState(value);
  return statusLabels[value];
}

export function displayStage(value: string): string {
  assertTaskState(value);
  return stageLabels[value];
}

export interface TaskCardModel {
  taskId: string;
  state: LedgerTaskState;
  status: DisplayStatus;
  stage: string;
  runId: string | null;
  accepted: number;
  declined: number;
  autonomyLevel: number | null;
  recoveryAttempts: number;
  orphanCount: number;
}

export function readTaskCard(db: Ledger, taskId: string): TaskCardModel {
  const task = db.prepare('SELECT id,state FROM task WHERE id=?').get(taskId) as { id: string; state: string } | undefined;
  if (!task) throw new Error(`task not found: ${taskId}`);
  assertTaskState(task.state);
  const run = db.prepare('SELECT id FROM run WHERE task_id=? ORDER BY started_at DESC,id DESC LIMIT 1').get(taskId) as { id: string } | undefined;
  const approvals = db.prepare(`SELECT
    coalesce(sum(approval_event.decision='accept'),0) AS accepted,
    coalesce(sum(approval_event.decision='decline'),0) AS declined
    FROM approval_event JOIN run ON run.id=approval_event.run_id WHERE run.task_id=?`).get(taskId) as { accepted: number; declined: number };
  const autonomy = run
    ? db.prepare('SELECT level FROM run_autonomy WHERE run_id=?').get(run.id) as { level: number } | undefined
    : undefined;
  const recovery = run
    ? db.prepare('SELECT count(*) AS count FROM recovery_attempt_v2 WHERE run_id=?').get(run.id) as { count: number }
    : { count: 0 };
  const orphans = db.prepare('SELECT count(*) AS count FROM orphan_session_observation').get() as { count: number };
  return {
    taskId: task.id,
    state: task.state,
    status: statusLabels[task.state],
    stage: stageLabels[task.state],
    runId: run?.id ?? null,
    accepted: approvals.accepted,
    declined: approvals.declined,
    autonomyLevel: autonomy?.level ?? null,
    recoveryAttempts: recovery.count,
    orphanCount: orphans.count,
  };
}
