import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openLedger } from '../src/ledger.js';
import { reconcileInterruptedWrites } from '../src/recovery.js';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe('P12 restart-safe queued writer lifecycle', () => {
  it('terminalizes queued successors with the interrupted active writer', () => {
    const root = mkdtempSync(join(tmpdir(), 'cue-p12-restart-queue-'));
    roots.push(root);
    const worktree = join(root, 'worktree');
    mkdirSync(worktree);
    const db = openLedger();
    const now = new Date().toISOString();
    db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('active-task', 'running', null, now);
    db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('queued-task', 'queued', null, now);
    db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run('env', worktree, '[]', now);
    db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('active-run', 'active-task', 'env', 1, now);
    db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('queued-run', 'queued-task', 'env', 0, now);
    db.prepare('INSERT INTO workspace_write_lease VALUES(?,?,?)').run(worktree, 'active-run', now);

    expect(reconcileInterruptedWrites(db, worktree, () => '')).toBe(2);
    expect(db.prepare('SELECT id,state,blocked_reason FROM task ORDER BY id').all()).toEqual([
      { id: 'active-task', state: 'blocked', blocked_reason: 'crash' },
      { id: 'queued-task', state: 'blocked', blocked_reason: 'crash' },
    ]);
    expect(db.prepare('SELECT run_id,outcome FROM recovery_attempt ORDER BY run_id').all()).toEqual([
      { run_id: 'active-run', outcome: 'blocked_no_auto_resume' },
      { run_id: 'queued-run', outcome: 'blocked_no_auto_resume' },
    ]);
    expect(db.prepare('SELECT count(*) AS n FROM workspace_write_lease').get()).toEqual({ n: 0 });
    db.close();
  });
});
