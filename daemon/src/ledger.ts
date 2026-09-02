import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type Ledger = Database.Database;

export function openLedger(filename = ':memory:'): Ledger {
  const db = new Database(filename);
  const here = dirname(fileURLToPath(import.meta.url));
  const migration = join(here, '..', 'migrations', '001_init.sql');
  db.exec(readFileSync(migration, 'utf8'));
  return db;
}
