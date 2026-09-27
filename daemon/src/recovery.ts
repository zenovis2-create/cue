import type { Ledger } from './ledger.js';
import { runProcessSync } from './process-launch.js';
import { terminateVerifiedTree, windowsCreationIdentity } from './process-termination.js';
export type GitStatusReader = (cwd: string) => string;
export const captureGitStatus: GitStatusReader = cwd => runProcessSync('git',['status','--short'],{cwd,encoding:'utf8'}).stdout;
export { holdInterruptedJournalRecoveries } from './journal-recovery.js';

export function fenceInterruptedSessions(db: Ledger): number {
  if (process.platform !== 'win32') return 0;
  const rows = db.prepare(`SELECT DISTINCT s.pid,s.start_time,s.task_id,s.run_id
    FROM session_handle s JOIN run ON run.id=s.run_id JOIN task ON task.id=s.task_id
    WHERE run.write_in_progress=1`).all() as Array<{pid:number;start_time:string;task_id:string;run_id:string}>;
  let terminated = 0;
  for (const row of rows) {
    const expected = windowsCreationIdentity(row.start_time);
    if (!Number.isSafeInteger(row.pid) || row.pid <= 0 || row.pid > 0xffff_ffff || expected === undefined) {
      db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)')
        .run(row.task_id, row.run_id, 'startup_fence', 'pid_identity_mismatch_refused', new Date().toISOString());
      continue;
    }
    const query = `$ErrorActionPreference='Stop'; $p=Get-CimInstance Win32_Process -Filter "ProcessId = ${row.pid}" -ErrorAction Stop; if($p){$p.CreationDate.ToUniversalTime().ToString('o')}`;
    const observation = runProcessSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', query], { encoding: 'utf8', timeout: 15_000, windowsHide: true });
    if (observation.status !== 0 || observation.error || observation.stderr.trim()) throw new Error(`startup process query failed for session ${row.pid}`);
    const observed = observation.stdout.trim();
    let content = 'session_not_live';
    if (observed) {
      if (windowsCreationIdentity(observed) === expected) {
        terminateVerifiedTree(row.pid, row.start_time);
        content = 'terminated_verified_session';
        terminated += 1;
      } else content = 'pid_identity_mismatch_refused';
    }
    db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)')
      .run(row.task_id, row.run_id, 'startup_fence', content, new Date().toISOString());
  }
  return terminated;
}

/** Old approval prompts cannot carry execution authority across a host restart. */
export function reconcileInterruptedApprovals(db: Ledger): number {
  return db.prepare(`UPDATE task SET state='blocked',blocked_reason='needs_reapproval'
    WHERE state='awaiting_approval' AND id IN (SELECT task_id FROM run)`).run().changes;
}

export function reconcileInterruptedWrites(db: Ledger, cwd: string, readGitStatus: GitStatusReader = captureGitStatus): number {
  const rows = db.prepare(`SELECT run.id AS run_id, run.task_id
    FROM run
    JOIN task ON task.id=run.task_id
    JOIN envelope ON envelope.envelope_hash=run.envelope_hash
    WHERE envelope.worktree_realpath=? AND (run.write_in_progress=1 OR task.state='queued'
      OR EXISTS (SELECT 1 FROM orchestration_attempt a WHERE a.run_id=run.id AND a.state='running'))`)
    .all(cwd) as Array<{run_id:string; task_id:string}>;
  if (rows.length === 0) return 0;
  const capture = readGitStatus(cwd);
  const tx = db.transaction(() => {
    for (const row of rows) {
      db.prepare("UPDATE task SET state='blocked', blocked_reason='crash' WHERE id=?").run(row.task_id);
      db.prepare("INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)").run(row.task_id,row.run_id,'git_status',capture,new Date().toISOString());
      db.prepare("INSERT INTO recovery_attempt(run_id,outcome,created_at) VALUES(?,?,?)").run(row.run_id,'blocked_no_auto_resume',new Date().toISOString());
      const unresolved = db.prepare('SELECT 1 FROM orchestration_attempt WHERE run_id=? AND cleanup_verified=0 LIMIT 1').get(row.run_id);
      if (unresolved) {
        // Startup fencing alone does not prove every adapter/request or residue is
        // settled. Keep writer ownership until the host verifies cleanup.
        db.prepare("UPDATE orchestration_step SET state='blocked' WHERE run_id=? AND task_id IN (SELECT task_id FROM orchestration_attempt WHERE run_id=? AND state='running')")
          .run(row.run_id, row.run_id);
        db.prepare("UPDATE orchestration_attempt SET state='blocked' WHERE run_id=? AND state='running'").run(row.run_id);
      } else if (!db.prepare("SELECT 1 FROM held_recovery h JOIN orchestration_attempt a ON a.attempt_id=h.attempt_id WHERE a.run_id=? LIMIT 1").get(row.run_id)) {
        db.prepare('UPDATE run SET write_in_progress=0 WHERE id=?').run(row.run_id);
        db.prepare('DELETE FROM workspace_write_lease WHERE run_id=?').run(row.run_id);
      }
    }
  }); tx(); return rows.length;
}
