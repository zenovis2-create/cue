import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type Ledger = Database.Database;

export function openLedger(filename = ':memory:'): Ledger {
  const db = new Database(filename);
  const here = dirname(fileURLToPath(import.meta.url));
  const migration = join(here, '..', 'migrations', '001_init.sql');
  const initialized = db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name='task'").get() as { n: number };
  if (!initialized.n) db.exec(readFileSync(migration, 'utf8'));
  db.exec(readFileSync(join(here, '..', 'migrations', '002_p5.sql'), 'utf8'));
  db.exec(readFileSync(join(here, '..', 'migrations', '003_p6.sql'), 'utf8'));
  db.exec(readFileSync(join(here, '..', 'migrations', '004_p7.sql'), 'utf8'));
  db.exec(readFileSync(join(here, '..', 'migrations', '005_p8.sql'), 'utf8'));
  db.exec(readFileSync(join(here, '..', 'migrations', '006_p10c.sql'), 'utf8'));
  db.exec(readFileSync(join(here, '..', 'migrations', '007_workspace_write_lease.sql'), 'utf8'));
  return db;
}
