import type { Ledger } from './ledger.js';
import { runProcessSync } from './process-launch.js';
export type GitStatusReader = (cwd: string) => string;
export const captureGitStatus: GitStatusReader = cwd => runProcessSync('git',['status','--short'],{cwd,encoding:'utf8'}).stdout;

export function fenceInterruptedSessions(db: Ledger): number {
  if (process.platform !== 'win32') return 0;
  const rows = db.prepare(`SELECT DISTINCT s.pid,s.start_time,s.task_id,s.run_id
    FROM session_handle s JOIN run ON run.id=s.run_id JOIN task ON task.id=s.task_id
    WHERE run.write_in_progress=1`).all() as Array<{pid:number;start_time:string;task_id:string;run_id:string}>;
  let terminated = 0;
  for (const row of rows) {
    const query = `$ErrorActionPreference='Stop'; $p=Get-CimInstance Win32_Process -Filter "ProcessId = ${row.pid}" -ErrorAction Stop; if($p){$p.CreationDate.ToUniversalTime().ToString('o')}`;
    const observation = runProcessSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', query], { encoding: 'utf8' });
    if (observation.status !== 0 || observation.error) throw new Error(`startup process query failed for session ${row.pid}`);
    const observed = observation.stdout.trim();
    let content = 'session_not_live';
    if (observed) {
      const expectedMs = Date.parse(row.start_time);
      const observedMs = Date.parse(observed);
      if (Number.isFinite(expectedMs) && Number.isFinite(observedMs) && Math.abs(expectedMs - observedMs) <= 10_000) {
        const killed = runProcessSync('taskkill.exe', ['/PID', String(row.pid), '/T', '/F'], { encoding: 'utf8' });
        const remaining = runProcessSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', query], { encoding: 'utf8' });
        if (remaining.status !== 0 || remaining.stdout.trim()) throw new Error(`startup fence failed for session ${row.pid}; kill exit ${killed.status}`);
        content = 'terminated_verified_session';
        terminated += 1;
      } else content = 'pid_identity_mismatch_refused';
    }
    db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)')
      .run(row.task_id, row.run_id, 'startup_fence', content, new Date().toISOString());
  }
  return terminated;
}

export function reconcileInterruptedWrites(db: Ledger, cwd: string, readGitStatus: GitStatusReader = captureGitStatus): number {
  const rows = db.prepare(`SELECT run.id AS run_id, run.task_id
    FROM run
    JOIN task ON task.id=run.task_id
    JOIN envelope ON envelope.envelope_hash=run.envelope_hash
    WHERE envelope.worktree_realpath=? AND (run.write_in_progress=1 OR task.state='queued')`)
    .all(cwd) as Array<{run_id:string; task_id:string}>;
  if (rows.length === 0) return 0;
  const capture = readGitStatus(cwd);
  const tx = db.transaction(() => {
    for (const row of rows) {
      db.prepare("UPDATE task SET state='blocked', blocked_reason='crash' WHERE id=?").run(row.task_id);
      db.prepare("INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)").run(row.task_id,row.run_id,'git_status',capture,new Date().toISOString());
      db.prepare("INSERT INTO recovery_attempt(run_id,outcome,created_at) VALUES(?,?,?)").run(row.run_id,'blocked_no_auto_resume',new Date().toISOString());
      db.prepare('UPDATE run SET write_in_progress=0 WHERE id=?').run(row.run_id);
      db.prepare('DELETE FROM workspace_write_lease WHERE run_id=?').run(row.run_id);
    }
  }); tx(); return rows.length;
}
