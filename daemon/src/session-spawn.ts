import type { Ledger } from './ledger.js';
export { spawnOwned } from './process-launch.js';

export interface SessionOwner { cwd: string; task_id: string; run_id: string }
export interface SessionRecord extends SessionOwner { pid: number; start_time: string; handle: string }

export function recordSession(db: Ledger, record: SessionRecord): void {
  db.prepare('INSERT INTO session_handle(handle,pid,start_time,cwd,task_id,run_id) VALUES(?,?,?,?,?,?)')
    .run(record.handle, record.pid, record.start_time, record.cwd, record.task_id, record.run_id);
}

export function ledgerSessions(db: Ledger): SessionRecord[] {
  return db.prepare('SELECT pid,start_time,handle,cwd,task_id,run_id FROM session_handle ORDER BY rowid').all() as SessionRecord[];
}
