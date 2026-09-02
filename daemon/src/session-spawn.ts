import { randomUUID } from 'node:crypto';
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import type { Ledger } from './ledger.js';
import { launchProcess } from './process-launch.js';

export interface SessionOwner { cwd: string; task_id: string; run_id: string }
export interface SessionRecord extends SessionOwner { pid: number; start_time: string; handle: string }

export function recordSession(db: Ledger, record: SessionRecord): void {
  db.prepare('INSERT INTO session_handle(handle,pid,start_time,cwd,task_id,run_id) VALUES(?,?,?,?,?,?)')
    .run(record.handle, record.pid, record.start_time, record.cwd, record.task_id, record.run_id);
}

export function spawnOwned(db: Ledger, owner: SessionOwner, command: string, args: readonly string[], options: SpawnOptions = {}): { child: ChildProcess; session: SessionRecord } {
  if (!owner.task_id || !owner.run_id || !owner.cwd) throw new Error('session owner required');
  const child = launchProcess(command, args, { ...options, cwd: owner.cwd });
  if (!child.pid) throw new Error('spawn returned no pid');
  const session = { ...owner, pid: child.pid, start_time: new Date().toISOString(), handle: randomUUID() };
  try { recordSession(db, session); }
  catch (error) { child.kill(); throw error; }
  return { child, session };
}

export function ledgerSessions(db: Ledger): SessionRecord[] {
  return db.prepare('SELECT pid,start_time,handle,cwd,task_id,run_id FROM session_handle ORDER BY rowid').all() as SessionRecord[];
}
