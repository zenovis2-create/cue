import { createHash } from 'node:crypto';
import type { Ledger } from './ledger.js';
import { createHeldRecovery, readHeldRecovery } from './held-recovery.js';

const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const same = (a: string, b: string) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;

/** Durable phase one. This is deliberately synchronous so the ownership caller can
 * commit every hold before it performs process fencing or profile cleanup. */
export function holdInterruptedJournalRecoveries(db: Ledger, worktree: string, nowMs = Date.now()) {
  return db.transaction(() => {
    const attempts = db.prepare(`SELECT a.attempt_id,a.run_id,c.change_set_id,
      EXISTS(SELECT 1 FROM change_root_contract root WHERE root.run_id=a.run_id AND root.task_id=a.task_id) journal_required
    FROM orchestration_attempt a
    JOIN run r ON r.id=a.run_id JOIN envelope e ON e.envelope_hash=r.envelope_hash
    LEFT JOIN change_set c ON c.attempt_id=a.attempt_id
    WHERE lower(e.worktree_realpath)=lower(?) AND (r.write_in_progress=1
      OR EXISTS(SELECT 1 FROM workspace_write_lease w WHERE w.run_id=r.id AND lower(w.worktree_realpath)=lower(e.worktree_realpath))
      OR EXISTS(SELECT 1 FROM orchestration_attempt interrupted WHERE interrupted.run_id=r.id AND interrupted.state='running'))
    ORDER BY a.run_id COLLATE BINARY,a.attempt_id COLLATE BINARY LIMIT 4097`).all(worktree) as Array<{ attempt_id: string; run_id: string; change_set_id: string | null; journal_required: number }>;
    if (attempts.length > 4096) throw Error('held_recovery_inventory_limit');
    return Object.freeze(attempts.map(row => {
    const existing = readHeldRecovery(db, row.attempt_id);
    if (existing) {
      if (existing.changeSetId !== row.change_set_id) throw Error('held_recovery_replay_mismatch');
      return existing;
    }
    const legacy = db.prepare('SELECT reason FROM native_change_journal_legacy WHERE attempt_id=?').get(row.attempt_id) as { reason: string } | undefined;
    const reason = legacy ? legacy.reason : row.change_set_id ? 'interrupted-native-journal' : row.journal_required ? 'native-journal-missing' : 'readonly-attempt-recovery-held';
    createHeldRecovery(db, { caseId: `held-${digest(`${row.run_id}\0${row.attempt_id}`).slice(0, 48)}`, attemptId: row.attempt_id,
      changeSetId: row.change_set_id, reason, nowMs });
    return readHeldRecovery(db,row.attempt_id)!;
    }));
  }).immediate();
}
