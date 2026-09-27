import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openLedger, type Ledger } from '../src/ledger.js';
import { holdInterruptedJournalRecoveries } from '../src/journal-recovery.js';
import { reconcileInterruptedWrites } from '../src/recovery.js';

const roots: string[] = [];
const ledgers: Ledger[] = [];
afterEach(() => {
  for (const db of ledgers.splice(0)) if (db.open) db.close();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function interruptedFixture() {
  const root = mkdtempSync(join(tmpdir(), 'cue-journal-review-'));
  const worktree = join(root, 'worktree');
  const ledgerPath = join(root, 'ledger.sqlite');
  roots.push(root); mkdirSync(worktree);
  const db = openLedger(ledgerPath); ledgers.push(db);
  db.prepare("INSERT INTO task VALUES('root','running',NULL,'now')").run();
  db.prepare("INSERT INTO envelope VALUES('env',?,'[]','now')").run(worktree);
  db.prepare("INSERT INTO run VALUES('run','root','env',1,'now')").run();
  db.prepare("INSERT INTO orchestration_plan VALUES('run','env','plan','{}')").run();
  db.prepare("INSERT INTO orchestration_step VALUES('run','stage','completed')").run();
  db.prepare("INSERT INTO orchestration_attempt VALUES('attempt','run','stage','candidate','completed','{}',?,'now',1)").run(worktree);
  db.prepare("INSERT INTO workspace_write_lease VALUES(?,'run','now')").run(worktree);
  return { root, worktree, ledgerPath, db };
}

test('cleanup-verified interrupted attempt with no journal is durably held across reopen and retains its exact lease', () => {
  const f = interruptedFixture();
  expect(holdInterruptedJournalRecoveries(f.db, f.worktree, 1)).toHaveLength(1);
  expect(f.db.prepare("SELECT state,reason FROM held_recovery WHERE attempt_id='attempt'").get())
    .toEqual({ state: 'held', reason: 'readonly-attempt-recovery-held' });
  f.db.close();
  const reopened = openLedger(f.ledgerPath); ledgers.push(reopened);
  expect(holdInterruptedJournalRecoveries(reopened, f.worktree, 2)).toHaveLength(1);
  expect(reconcileInterruptedWrites(reopened, f.worktree, () => '')).toBe(1);
  expect(reopened.prepare('SELECT worktree_realpath,run_id,acquired_at FROM workspace_write_lease').get())
    .toEqual({ worktree_realpath: f.worktree, run_id: 'run', acquired_at: 'now' });
  expect(reopened.prepare("SELECT write_in_progress FROM run WHERE id='run'").get()).toEqual({ write_in_progress: 1 });
});

test('real startup callsites persist holds before process fencing, profile cleanup, and write reconciliation', () => {
  const source = readFileSync(join(process.cwd(), 'src', 'daemon-ownership.ts'), 'utf8');
  const blocks = [...source.matchAll(/holdInterruptedJournalRecoveries\([^;]+;[\s\S]*?reconcileInterruptedWrites\([^;]+;/g)].map(match => match[0]);
  expect(blocks).toHaveLength(2);
  for (const block of blocks) {
    expect(block.indexOf('holdInterruptedJournalRecoveries')).toBeLessThan(block.indexOf('fenceInterruptedSessions'));
    expect(block.indexOf('fenceInterruptedSessions')).toBeLessThan(block.indexOf('cleanupInterruptedAppContainerProfiles'));
    expect(block.indexOf('cleanupInterruptedAppContainerProfiles')).toBeLessThan(block.indexOf('reconcileInterruptedWrites'));
  }
  const core = readFileSync(join(process.cwd(), '..', 'app', 'core.mjs'), 'utf8');
  expect(core.indexOf('ownDaemonWorktree(config.worktreeRoot')).toBeGreaterThan(-1);
  expect(core.indexOf('ownDaemonWorktree(config.worktreeRoot')).toBeLessThan(core.indexOf('runtime.nativeRecoveryFactory?.'));
});

test('daemon recovery module exports phase one only; phase two remains private to the protected native host', async () => {
  const recovery = await import('../src/journal-recovery.js');
  expect(Object.keys(recovery).sort()).toEqual(['holdInterruptedJournalRecoveries']);
  const host = readFileSync(join(process.cwd(), '..', 'app', 'native-recovery-host.mjs'), 'utf8');
  expect(host).toContain('async function journalRecovery(');
  expect(host).toContain('const value = await observer.observe(');
  expect(host).not.toContain('createJournalRecoveryCoordinator');
});
