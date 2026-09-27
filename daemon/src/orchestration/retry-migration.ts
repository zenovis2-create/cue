import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Ledger } from '../ledger.js';

/** Call outside any transaction, after migrations 001–015. Preserves referenced
 * attempt IDs and legacy history; never enables retry for an existing run. */
export function applyOrchestrationRetryMigration(db: Ledger): void {
  if (db.inTransaction) throw Error('retry_migration_requires_outer_boundary');
  const installed = () => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='orchestration_retry_schema'").get());
  if (installed()) return;
  const foreignKeys = db.pragma('foreign_keys', { simple: true }) as number;
  const legacy = db.pragma('legacy_alter_table', { simple: true }) as number;
  try {
    db.pragma('foreign_keys = OFF'); db.pragma('legacy_alter_table = ON');
    db.transaction(() => {
      if (installed()) return;
      if ((db.pragma('foreign_key_check') as unknown[]).length) throw Error('retry_migration_existing_fk_violation');
      db.exec(readFileSync(fileURLToPath(new URL('../../migrations/016_orchestration_retry.sql', import.meta.url)), 'utf8'));
      if ((db.pragma('foreign_key_check') as unknown[]).length) throw Error('retry_migration_fk_violation');
    }).exclusive();
  } finally { db.pragma(`legacy_alter_table = ${legacy}`); db.pragma(`foreign_keys = ${foreignKeys}`); }
}
