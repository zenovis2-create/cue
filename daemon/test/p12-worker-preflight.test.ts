import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openLedger } from '../src/ledger.js';
import { normalizeEnvelope } from '../src/envelope.js';
import { launchAppContainerWorker } from '../src/worker-enforcement.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const worktree = mkdtempSync(join(tmpdir(), 'cue-p12-preflight-'));
  roots.push(worktree);
  const db = openLedger();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('task-preflight', 'running', null, now);
  db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run('envelope-preflight', worktree, '[]', now);
  db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('run-preflight', 'task-preflight', 'envelope-preflight', 1, now);
  const envelope = normalizeEnvelope({
    run_id: 'run-preflight',
    worktree_realpath: worktree,
    egress: [],
    expires_at: '2099-01-01T00:00:00Z',
    autonomy_level: 'bounded',
    allowed_actions: ['command', 'file_change'],
  });
  return { worktree, db, envelope };
}

describe('P12 typed worker boundary violations', () => {
  it('classifies an outside-worktree absolute path as a terminal filesystem violation', async () => {
    const { worktree, db, envelope } = fixture();
    try {
      await expect(Promise.resolve().then(() => launchAppContainerWorker(
        db,
        envelope,
        { cwd: worktree, task_id: 'task-preflight', run_id: 'run-preflight' },
        {
          executable: 'powershell.exe',
          args: ['-NoProfile', '-Command', "Set-Content -LiteralPath 'C:\\cue-p12-outside.txt' -Value x"],
          cwd: worktree,
        },
      ))).rejects.toMatchObject({
        code: 'CUE_WORKER_ENFORCEMENT_VIOLATION',
        violation: 'filesystem',
      });
      expect(db.prepare("SELECT kind,content FROM artifact WHERE run_id=? ORDER BY rowid").all('run-preflight')).toContainEqual({
        kind: 'enforcement_violation',
        content: 'filesystem',
      });
    } finally {
      db.close();
    }
  });

  it('classifies a network preflight denial as a terminal network violation', async () => {
    const { worktree, db, envelope } = fixture();
    try {
      await expect(Promise.resolve().then(() => launchAppContainerWorker(
        db,
        envelope,
        { cwd: worktree, task_id: 'task-preflight', run_id: 'run-preflight' },
        {
          executable: 'powershell.exe',
          args: ['-NoProfile', '-Command', "Invoke-WebRequest -Uri 'https://example.invalid'"],
          cwd: worktree,
        },
      ))).rejects.toMatchObject({
        code: 'CUE_WORKER_ENFORCEMENT_VIOLATION',
        violation: 'network_gate',
      });
      expect(db.prepare("SELECT kind,content FROM artifact WHERE run_id=? ORDER BY rowid").all('run-preflight')).toContainEqual({
        kind: 'enforcement_violation',
        content: 'network_gate',
      });
    } finally {
      db.close();
    }
  });

  it('classifies a worktree-local executable denial as terminal executable sealing', async () => {
    const { worktree, db, envelope } = fixture();
    const mutableExecutable = join(worktree, 'mutable.exe');
    writeFileSync(mutableExecutable, 'not executable');
    try {
      await expect(Promise.resolve().then(() => launchAppContainerWorker(
        db,
        envelope,
        { cwd: worktree, task_id: 'task-preflight', run_id: 'run-preflight' },
        { executable: mutableExecutable, args: [], cwd: worktree },
      ))).rejects.toMatchObject({
        code: 'CUE_WORKER_ENFORCEMENT_VIOLATION',
        violation: 'executable_sealing',
      });
    } finally {
      db.close();
    }
  });
});
