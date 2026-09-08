import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCueCore, initializeConfig } from '../../app/core.mjs';

const roots: string[] = [];
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
});

describe.skipIf(process.platform !== 'win32')('P12 crash-safe queued writer lifecycle', () => {
  it('retains daemon ownership when crash-state persistence aborts', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cue-p12-crash-persistence-'));
    roots.push(root);
    const worktree = join(root, 'worktree');
    const sourceHome = join(root, 'source-home');
    mkdirSync(worktree);
    mkdirSync(sourceHome);
    writeFileSync(join(sourceHome, 'auth.json'), '{}');
    let settle!: (value: unknown) => void;
    const done = new Promise(resolve => { settle = resolve; });
    const launchHost = vi.fn(() => ({ session: { pid: 51000 }, child: { pid: 51000 }, stop: vi.fn(), done }));
    const config = initializeConfig(join(root, 'state'), { worktreeRoot: worktree });
    const core = createCueCore(config, undefined, { binary: process.execPath, codexHome: sourceHome, launchHost } as any);
    try {
      const active = core.prepareGoal('Create first.txt', 1);
      core.approve(active.runId);
      core.execute(active.runId);
      const queued = core.prepareGoal('Create second.txt', 1);
      core.approve(queued.runId);
      core.execute(queued.runId);
      core.daemon.db.exec("CREATE TRIGGER p12_abort_crash_state BEFORE UPDATE OF state ON task WHEN OLD.state='queued' BEGIN SELECT RAISE(ABORT,'forced crash persistence failure'); END");

      let crashed;
      expect(() => { crashed = core.daemon.crash('crash'); }).not.toThrow();
      expect(crashed).toBe(false);
      expect(core.daemon.status).toBe('blocked/crash');
      expect(() => createCueCore(config, undefined, { binary: process.execPath, codexHome: sourceHome, launchHost } as any))
        .toThrow('already owned');
    } finally {
      core.daemon.db.exec('DROP TRIGGER IF EXISTS p12_abort_crash_state');
      settle({ status: 'failed', finalMessage: '', controllerPid: 51000, workerPids: [], successfulToolCalls: 0 });
      await delay(20);
      if (core.daemon.db.open) core.daemon.db.close();
    }
  });

  it('terminalizes queued approvals and never promotes them after the active controller settles', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cue-p12-crash-queue-'));
    roots.push(root);
    const worktree = join(root, 'worktree');
    const sourceHome = join(root, 'source-home');
    mkdirSync(worktree);
    mkdirSync(sourceHome);
    writeFileSync(join(sourceHome, 'auth.json'), '{}');

    let settle!: (value: unknown) => void;
    const done = new Promise(resolve => { settle = resolve; });
    const launchHost = vi.fn(() => ({
      session: { pid: 51001 },
      child: { pid: 51001 },
      stop() {},
      done,
    }));
    const core = createCueCore(
      initializeConfig(join(root, 'state'), { worktreeRoot: worktree }),
      undefined,
      { binary: process.execPath, codexHome: sourceHome, launchHost } as any,
    );

    try {
      const active = core.prepareGoal('Create first.txt', 1);
      core.approve(active.runId);
      expect(core.execute(active.runId).state).toBe('running');
      const queued = core.prepareGoal('Create second.txt', 1);
      core.approve(queued.runId);
      expect(core.execute(queued.runId).state).toBe('queued');

      core.daemon.crash('crash');

      expect(core.completion(active.taskId)).toMatchObject({ state: 'blocked', blockedReason: 'crash' });
      expect(core.completion(queued.taskId)).toMatchObject({ state: 'blocked', blockedReason: 'crash' });
      expect(launchHost).toHaveBeenCalledTimes(1);
      expect(core.daemon.db.prepare("SELECT count(*) AS n FROM task WHERE state='queued'").get()).toEqual({ n: 0 });
      expect(core.daemon.db.prepare("SELECT kind,content FROM artifact WHERE run_id=? AND kind='worker_stopped'").get(queued.runId))
        .toEqual({ kind: 'worker_stopped', content: 'crash:queued' });

      settle({
        status: 'failed', finalMessage: '', controllerPid: 51001, workerPids: [], successfulToolCalls: 0,
        controllerStderr: '', failureKind: 'crash', error: 'late controller close',
        goalVerification: { passed: false, reason: 'model_not_completed', changedPaths: [] },
      });
      await delay(100);
      expect(launchHost).toHaveBeenCalledTimes(1);
    } finally {
      settle({ status: 'failed', finalMessage: '', controllerPid: 51001, workerPids: [], successfulToolCalls: 0 });
      await delay(20);
      core.close();
    }
  });
});
