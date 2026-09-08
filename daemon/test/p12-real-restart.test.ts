import { afterEach, describe, expect, it, vi } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { createCueCore, initializeConfig } from '../../app/core.mjs';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

async function readyLine(child: ReturnType<typeof spawn>): Promise<any> {
  const lines = createInterface({ input: child.stdout! });
  for await (const line of lines) {
    const parsed = JSON.parse(line);
    if (parsed.ready) { lines.close(); return parsed; }
  }
  throw new Error('crash child closed before readiness');
}

describe.skipIf(process.platform !== 'win32')('P12 real daemon crash restart', () => {
  it('hard-kills an active+queued daemon process and terminalizes both on restart', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cue-p12-real-restart-'));
    roots.push(root);
    const state = join(root, 'state');
    const worktree = join(root, 'worktree');
    const home = join(root, 'home');
    mkdirSync(worktree, { recursive: true });
    const child = spawn(process.execPath, [
      join(process.cwd(), 'test', 'fixtures', 'p12-daemon-crash-child.mjs'), state, worktree, home,
    ], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'test' }, stdio: ['ignore', 'pipe', 'pipe'] });
    const closed = once(child, 'close');
    const ready = await readyLine(child);
    const killed = spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { encoding: 'utf8' });
    expect(killed.status, killed.stderr).toBe(0);
    await closed;

    const launchHost = vi.fn();
    const restarted = createCueCore(
      initializeConfig(state, { worktreeRoot: worktree }),
      undefined,
      { binary: process.execPath, codexHome: home, launchHost } as any,
    );
    try {
      expect(restarted.completion(ready.active.taskId)).toMatchObject({ state: 'blocked', blockedReason: 'crash' });
      expect(restarted.completion(ready.queued.taskId)).toMatchObject({ state: 'blocked', blockedReason: 'crash' });
      expect(restarted.daemon.db.prepare("SELECT count(*) AS n FROM task WHERE state IN ('running','queued')").get()).toEqual({ n: 0 });
      expect(restarted.daemon.db.prepare('SELECT count(*) AS n FROM workspace_write_lease').get()).toEqual({ n: 0 });
      expect(restarted.daemon.db.prepare('SELECT count(*) AS n FROM run WHERE write_in_progress<>0').get()).toEqual({ n: 0 });
      expect(launchHost).not.toHaveBeenCalled();
    } finally {
      restarted.close();
    }
  }, 30_000);
});
