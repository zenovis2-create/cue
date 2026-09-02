import type { Ledger } from './ledger.js';

export interface ExecutionIdentity { run_id: string; thread_id: string; item_id: string | null; approval_id: string | null; execution_id: string; execution_ordinal: number }

export function recordExecution(db: Ledger, event: ExecutionIdentity, now = new Date()): void {
  db.prepare('INSERT INTO execution_event(run_id,thread_id,item_id,approval_id,execution_id,execution_ordinal,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(event.run_id,event.thread_id,event.item_id,event.approval_id,event.execution_id,event.execution_ordinal,now.toISOString());
  const approvals = db.prepare("SELECT count(*) n FROM approval_event WHERE run_id=? AND decision='accept'").get(event.run_id) as {n:number};
  const executions = db.prepare('SELECT count(*) n FROM execution_event WHERE run_id=?').get(event.run_id) as {n:number};
  if (executions.n > approvals.n) {
    const run = db.prepare('SELECT task_id FROM run WHERE id=?').get(event.run_id) as {task_id:string};
    db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)')
      .run(run.task_id,event.run_id,'execution_over_approval',JSON.stringify({approvals:approvals.n,executions:executions.n}),now.toISOString());
  }
}

export function completionApprovalLabel(db: Ledger, taskId: string): string {
  const counts = db.prepare("SELECT sum(decision='accept') accepted,sum(decision='decline') declined FROM approval_event JOIN run ON run.id=approval_event.run_id WHERE run.task_id=?").get(taskId) as {accepted:number|null;declined:number|null};
  return `자동 승인 ${counts.accepted ?? 0}건 · 거부 ${counts.declined ?? 0}건`;
}
