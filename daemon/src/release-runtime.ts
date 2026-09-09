import { appendFileSync, writeFileSync } from 'node:fs';
import { openLedger } from './ledger.js';
import { reconcileInterruptedWrites } from './recovery.js';

const [mode, dbPath, worktree, marker] = process.argv.slice(2);
if (!mode || !dbPath || !worktree) throw new Error('mode, db path, and worktree required');

if (mode === 'work') {
  const db=openLedger(dbPath);
  db.prepare("UPDATE run SET write_in_progress=1 WHERE id='r-crash'").run();
  if (marker) writeFileSync(marker,`writer_pid=${process.pid}\n`);
  process.stdout.write(`DAEMON_WORKING pid=${process.pid}\n`);
  setInterval(()=>{ if(marker) appendFileSync(marker,'tick\n'); },50);
} else if (mode === 'restart') {
  const db=openLedger(dbPath);
  const reconciled=reconcileInterruptedWrites(db,worktree);
  const task=db.prepare("SELECT state,blocked_reason FROM task WHERE id='t-crash'").get();
  const status=db.prepare("SELECT content FROM artifact WHERE run_id='r-crash' AND kind='git_status' ORDER BY id DESC LIMIT 1").get();
  process.stdout.write(`${JSON.stringify({pid:process.pid,reconciled,task,status})}\n`);
  db.close();
} else {
  throw new Error(`unknown mode: ${mode}`);
}
