import type { Ledger } from './ledger.js';

export function closeTask(db: Ledger, taskId: string, runId: string, close: () => boolean, now = new Date()): 'succeeded' | 'still_unsafe' {
  if (!close()) {
    db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)').run(taskId,runId,'still_unsafe','session close failed',now.toISOString());
    db.prepare("UPDATE task SET state='failed' WHERE id=?").run(taskId);
    return 'still_unsafe';
  }
  db.prepare("UPDATE task SET state='completed' WHERE id=?").run(taskId);
  return 'succeeded';
}
