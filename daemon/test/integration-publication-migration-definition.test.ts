import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { openLedger, type Ledger } from '../src/ledger.js';

const roots: string[] = [], connections: Ledger[] = [];
afterEach(() => {
  for (const db of connections.splice(0)) if (db.open) db.close();
  for (const root of roots.splice(0)) {
    if (dirname(resolve(root)) !== resolve(tmpdir()) || !basename(root).startsWith('cue-publication-schema-')) throw Error('unsafe_cleanup');
    rmSync(root, { recursive: true, force: true });
  }
});
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'cue-publication-schema-')); roots.push(root);
  const path = join(root, 'ledger.db'), db = openLedger(path); connections.push(db);
  return { path, db };
}
test('unchanged publication definitions reopen with persisted application rows', () => {
  const { path, db } = fixture();
  db.prepare("INSERT INTO task VALUES('preserved','running',NULL,'now')").run(); db.close();
  const reopened = openLedger(path); connections.push(reopened);
  expect(reopened.prepare("SELECT state FROM task WHERE id='preserved'").get()).toEqual({ state: 'running' });
});
test('same-name no-op lease guard cannot pass startup', () => {
  const { path, db } = fixture();
  db.exec('DROP TRIGGER change_publication_lease_no_unsafe_delete; CREATE TRIGGER change_publication_lease_no_unsafe_delete BEFORE DELETE ON workspace_write_lease BEGIN SELECT 1; END');
  db.close(); expect(() => openLedger(path)).toThrow('change_publication_migration_definition');
});
test('altered publication table definition cannot pass startup', () => {
  const { path, db } = fixture();
  db.exec('ALTER TABLE change_publication_result ADD COLUMN unreviewed TEXT');
  db.close(); expect(() => openLedger(path)).toThrow('change_publication_migration_definition');
});
