import { afterEach, expect, test, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import { openLedger, type Ledger } from '../src/ledger.js';
import { ownDaemonWorktree } from '../src/daemon-ownership.js';

const controls = vi.hoisted(() => ({ ledgerPath: '', fenceObservedCommittedHold: false, cleanupCalls: 0 }));

vi.mock('../src/recovery.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/recovery.js')>();
  const sqlite = await import('better-sqlite3');
  return {
    ...actual,
    fenceInterruptedSessions() {
      const probe = new sqlite.default(controls.ledgerPath, { readonly: true });
      try {
        controls.fenceObservedCommittedHold = (probe.prepare("SELECT COUNT(*) n FROM held_recovery WHERE attempt_id='attempt' AND state='held'").get() as { n: number }).n === 1;
      } finally { probe.close(); }
      throw Error('review_injected_fence_failure');
    },
    reconcileInterruptedWrites() { throw Error('write_reconciliation_must_not_run'); },
  };
});

vi.mock('../src/worker-enforcement.js', () => ({
  cleanupInterruptedAppContainerProfiles() { controls.cleanupCalls += 1; throw Error('profile_cleanup_must_not_run'); },
}));

const roots: string[] = [];
const ledgers: Ledger[] = [];
const originalLocalAppData = process.env.LOCALAPPDATA;
afterEach(() => {
  for (const db of ledgers.splice(0)) if (db.open) db.close();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  if (originalLocalAppData === undefined) delete process.env.LOCALAPPDATA;
  else process.env.LOCALAPPDATA = originalLocalAppData;
  controls.ledgerPath = ''; controls.fenceObservedCommittedHold = false; controls.cleanupCalls = 0;
});

test('actual ownership startup commits current-ledger holds before fencing and publishes no owner after fence failure', () => {
  const root = mkdtempSync(join(tmpdir(), 'cue-journal-startup-review-'));
  const worktree = join(root, 'worktree');
  const localData = join(root, 'local-data');
  const ledgerPath = join(root, 'ledger.sqlite');
  roots.push(root); mkdirSync(worktree); mkdirSync(localData);
  process.env.LOCALAPPDATA = localData; controls.ledgerPath = ledgerPath;
  const db = openLedger(ledgerPath); ledgers.push(db);
  db.prepare("INSERT INTO task VALUES('root','running',NULL,'now')").run();
  db.prepare("INSERT INTO envelope VALUES('env',?,'[]','now')").run(worktree);
  db.prepare("INSERT INTO run VALUES('run','root','env',1,'now')").run();
  db.prepare("INSERT INTO orchestration_plan VALUES('run','env','plan','{}')").run();
  db.prepare("INSERT INTO orchestration_step VALUES('run','stage','running')").run();
  db.prepare("INSERT INTO orchestration_attempt VALUES('attempt','run','stage','candidate','running','{}',?,'now',0)").run(worktree);
  db.prepare("INSERT INTO workspace_write_lease VALUES(?,'run','now')").run(worktree);

  expect(() => ownDaemonWorktree(worktree, ledgerPath, db)).toThrow('review_injected_fence_failure');
  expect(controls.fenceObservedCommittedHold).toBe(true);
  expect(controls.cleanupCalls).toBe(0);
  expect(db.prepare("SELECT state FROM held_recovery WHERE attempt_id='attempt'").get()).toEqual({ state: 'held' });
  expect(db.prepare('SELECT worktree_realpath,run_id,acquired_at FROM workspace_write_lease').get())
    .toEqual({ worktree_realpath: worktree, run_id: 'run', acquired_at: 'now' });
  const ownership = new Database(join(localData, 'Cue', 'writer-ownership', 'ownership.sqlite'), { readonly: true });
  try { expect(ownership.prepare('SELECT COUNT(*) n FROM owner').get()).toEqual({ n: 0 }); }
  finally { ownership.close(); }
});
