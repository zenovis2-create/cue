import type { Ledger } from './ledger.js';
import { runProcessSync } from './process-launch.js';
export type GitStatusReader = (cwd: string) => string;
export const captureGitStatus: GitStatusReader = cwd => runProcessSync('git',['status','--short'],{cwd,encoding:'utf8'}).stdout;
export function reconcileInterruptedWrites(db: Ledger, cwd: string, readGitStatus: GitStatusReader = captureGitStatus): number {
  const rows = db.prepare("SELECT run.id AS run_id, run.task_id FROM run JOIN task ON task.id=run.task_id WHERE run.write_in_progress=1 AND task.state='running'").all() as Array<{run_id:string; task_id:string}>;
  const capture = readGitStatus(cwd);
  const tx = db.transaction(() => {
    for (const row of rows) {
      db.prepare("UPDATE task SET state='blocked', blocked_reason='crash' WHERE id=?").run(row.task_id);
      db.prepare("INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)").run(row.task_id,row.run_id,'git_status',capture,new Date().toISOString());
      db.prepare("INSERT INTO recovery_attempt(run_id,outcome,created_at) VALUES(?,?,?)").run(row.run_id,'blocked_no_auto_resume',new Date().toISOString());
      db.prepare('UPDATE run SET write_in_progress=0 WHERE id=?').run(row.run_id);
    }
  }); tx(); return rows.length;
}
