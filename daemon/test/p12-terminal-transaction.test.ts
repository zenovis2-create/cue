import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCueCore, initializeConfig } from '../../app/core.mjs';

const roots: string[] = [];
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

async function until(check: () => boolean, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() >= deadline) throw new Error('terminal transaction quarantine timeout');
    await delay(20);
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
});

const outcomes = [
  {
    name: 'normal completion',
    result: {
      threadId: 'thread-normal', turnId: 'turn-normal', status: 'completed', finalMessage: 'done',
      controllerPid: 52001, workerPids: [52002], successfulToolCalls: 1, controllerStderr: '',
      goalVerification: { passed: true, reason: 'workspace_changed', changedPaths: ['result.txt'] },
    },
  },
  {
    name: 'controller crash',
    result: {
      status: 'failed', finalMessage: '', controllerPid: 52003, workerPids: [], successfulToolCalls: 0,
      controllerStderr: '', failureKind: 'crash', error: 'controller exited',
      goalVerification: { passed: false, reason: 'model_not_completed', changedPaths: [] },
    },
  },
  {
    name: 'worker hard-kill',
    result: {
      status: 'failed', finalMessage: '', controllerPid: 52004, workerPids: [52005], successfulToolCalls: 0,
      controllerStderr: '', error: 'worker exited unexpectedly',
      goalVerification: { passed: false, reason: 'model_not_completed', changedPaths: [] },
    },
  },
] as const;

describe.skipIf(process.platform !== 'win32')('P12 terminal transaction fail-closed lifecycle', () => {
  it('releases the settled runtime handle after an unexpected recovery exception commits', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cue-p12-unexpected-terminal-'));
    roots.push(root);
    const worktree = join(root, 'worktree');
    const sourceHome = join(root, 'source-home');
    mkdirSync(worktree);
    mkdirSync(sourceHome);
    writeFileSync(join(sourceHome, 'auth.json'), '{}');
    const stop = vi.fn();
    let settle!: (value: unknown) => void;
    const done = new Promise(resolve => { settle = resolve; });
    const launchHost = vi.fn(() => ({
      session: { pid: 51993 }, child: { pid: 51993 }, stop,
      done,
    }));
    const core = createCueCore(
      initializeConfig(join(root, 'state'), { worktreeRoot: worktree }),
      undefined,
      { binary: process.execPath, codexHome: sourceHome, launchHost } as any,
    );
    try {
      const active = core.prepareGoal('Create active.txt', 1);
      core.approve(active.runId);
      core.execute(active.runId);
      const realPrepare = core.daemon.db.prepare.bind(core.daemon.db);
      (vi.spyOn(core.daemon.db, 'prepare') as any).mockImplementation((sql: string) => {
        if (sql.includes("kind='enforcement_violation'")) throw new Error('forced post-worker exception');
        return realPrepare(sql) as any;
      });
      settle({
        status: 'failed', finalMessage: '', controllerPid: 51993, workerPids: [], successfulToolCalls: 0,
        controllerStderr: '', error: 'worker failed',
        goalVerification: { passed: false, reason: 'model_not_completed', changedPaths: [] },
      });
      await until(() => core.completion(active.taskId).state === 'blocked');
      expect(core.completion(active.taskId)).toMatchObject({ blockedReason: 'human_required' });
      expect(core.daemon.status).toBe('ready');
      expect(core.daemon.stop(active.runId, 'probe')).toBe(false);
      expect(stop).not.toHaveBeenCalled();
    } finally {
      core.close();
    }
  });

  it('quarantines launch-configuration terminalization when lease release aborts', () => {
    const root = mkdtempSync(join(tmpdir(), 'cue-p12-launch-config-tx-'));
    roots.push(root);
    const worktree = join(root, 'worktree');
    const sourceHome = join(root, 'source-home');
    mkdirSync(worktree);
    mkdirSync(sourceHome);
    writeFileSync(join(sourceHome, 'auth.json'), '{}');
    const launchHost = vi.fn();
    const core = createCueCore(
      initializeConfig(join(root, 'state'), { worktreeRoot: worktree }),
      undefined,
      { binary: process.execPath, binarySha256: '0'.repeat(64), codexHome: sourceHome, launchHost } as any,
    );
    try {
      const active = core.prepareGoal('Create active.txt', 1);
      core.approve(active.runId);
      core.daemon.db.exec("CREATE TRIGGER p12_abort_release BEFORE DELETE ON workspace_write_lease BEGIN SELECT RAISE(ABORT,'forced launch-config release failure'); END");
      let card;
      expect(() => { card = core.execute(active.runId); }).not.toThrow();
      expect(card).toMatchObject({ state: 'blocked', blockedReason: 'crash' });
      expect(core.daemon.status).toBe('blocked/crash');
      expect(core.daemon.db.prepare('SELECT count(*) AS n FROM workspace_write_lease WHERE run_id=?').get(active.runId)).toEqual({ n: 1 });
      expect(launchHost).not.toHaveBeenCalled();
    } finally {
      core.daemon.db.exec('DROP TRIGGER IF EXISTS p12_abort_release');
      if (core.daemon.db.open) core.daemon.db.close();
    }
  });

  it('quarantines a queued stop when its terminal transaction aborts', () => {
    const root = mkdtempSync(join(tmpdir(), 'cue-p12-queued-stop-tx-'));
    roots.push(root);
    const worktree = join(root, 'worktree');
    const sourceHome = join(root, 'source-home');
    mkdirSync(worktree);
    mkdirSync(sourceHome);
    writeFileSync(join(sourceHome, 'auth.json'), '{}');
    const launchHost = vi.fn(() => ({
      session: { pid: 51992 }, child: { pid: 51992 }, stop: vi.fn(),
      done: new Promise(() => {}),
    }));
    const core = createCueCore(
      initializeConfig(join(root, 'state'), { worktreeRoot: worktree }),
      undefined,
      { binary: process.execPath, codexHome: sourceHome, launchHost } as any,
    );
    try {
      const active = core.prepareGoal('Create active.txt', 1);
      core.approve(active.runId);
      core.execute(active.runId);
      const queued = core.prepareGoal('Create queued.txt', 1);
      core.approve(queued.runId);
      expect(core.execute(queued.runId).state).toBe('queued');
      core.daemon.db.exec(`CREATE TRIGGER p12_abort_queued_stop BEFORE UPDATE OF write_in_progress ON run WHEN OLD.id='${queued.runId}' BEGIN SELECT RAISE(ABORT,'forced queued-stop transaction failure'); END`);

      let stopped;
      expect(() => { stopped = core.stop(queued.runId); }).not.toThrow();
      expect(stopped).toBe(false);
      expect(core.daemon.status).toBe('blocked/crash');
      expect(core.completion(queued.taskId)).toMatchObject({ state: 'blocked', blockedReason: 'crash' });
      expect(launchHost).toHaveBeenCalledTimes(1);
    } finally {
      core.daemon.db.exec('DROP TRIGGER IF EXISTS p12_abort_queued_stop');
      if (core.daemon.db.open) core.daemon.db.close();
    }
  });

  it('quarantines a user stop when its lease-release transaction aborts', () => {
    const root = mkdtempSync(join(tmpdir(), 'cue-p12-stop-tx-'));
    roots.push(root);
    const worktree = join(root, 'worktree');
    const sourceHome = join(root, 'source-home');
    mkdirSync(worktree);
    mkdirSync(sourceHome);
    writeFileSync(join(sourceHome, 'auth.json'), '{}');
    const stop = vi.fn();
    const launchHost = vi.fn(() => ({
      session: { pid: 51991 }, child: { pid: 51991 }, stop,
      done: new Promise(() => {}),
    }));
    const core = createCueCore(
      initializeConfig(join(root, 'state'), { worktreeRoot: worktree }),
      undefined,
      { binary: process.execPath, codexHome: sourceHome, launchHost } as any,
    );
    try {
      const active = core.prepareGoal('Create active.txt', 1);
      core.approve(active.runId);
      core.execute(active.runId);
      core.daemon.db.exec(`CREATE TRIGGER p12_abort_release BEFORE UPDATE OF write_in_progress ON run WHEN OLD.id='${active.runId}' BEGIN SELECT RAISE(ABORT,'forced stop release failure'); END`);

      let stopped;
      expect(() => { stopped = core.stop(active.runId); }).not.toThrow();
      expect(stopped).toBe(false);
      expect(core.daemon.status).toBe('blocked/crash');
      expect(core.completion(active.taskId)).toMatchObject({ state: 'blocked', blockedReason: 'crash' });
      expect(core.daemon.db.prepare('SELECT count(*) AS n FROM workspace_write_lease WHERE run_id=?').get(active.runId)).toEqual({ n: 1 });
      expect(stop).toHaveBeenCalled();
    } finally {
      core.daemon.db.exec('DROP TRIGGER IF EXISTS p12_abort_release');
      if (core.daemon.db.open) core.daemon.db.close();
    }
  });

  it.each(outcomes)('$name quarantines the writer and terminalizes its queue when lease release aborts', async ({ result }) => {
    const root = mkdtempSync(join(tmpdir(), 'cue-p12-terminal-tx-'));
    roots.push(root);
    const worktree = join(root, 'worktree');
    const sourceHome = join(root, 'source-home');
    mkdirSync(worktree);
    mkdirSync(sourceHome);
    writeFileSync(join(sourceHome, 'auth.json'), '{}');

    let settle!: (value: unknown) => void;
    const done = new Promise(resolve => { settle = resolve; });
    const stop = vi.fn();
    const launchHost = vi.fn(() => ({ session: { pid: result.controllerPid }, child: { pid: result.controllerPid }, stop, done }));
    const core = createCueCore(
      initializeConfig(join(root, 'state'), { worktreeRoot: worktree }),
      undefined,
      { binary: process.execPath, codexHome: sourceHome, launchHost } as any,
    );

    try {
      const active = core.prepareGoal('Create active.txt', 1);
      core.approve(active.runId);
      expect(core.execute(active.runId).state).toBe('running');
      const queued = core.prepareGoal('Create queued.txt', 1);
      core.approve(queued.runId);
      expect(core.execute(queued.runId).state).toBe('queued');
      core.daemon.db.exec("CREATE TRIGGER p12_abort_release BEFORE DELETE ON workspace_write_lease BEGIN SELECT RAISE(ABORT,'forced terminal release failure'); END");

      settle(result);
      await until(() => core.daemon.status === 'blocked/crash');

      expect(core.completion(active.taskId)).toMatchObject({ state: 'blocked', blockedReason: 'crash' });
      expect(core.completion(queued.taskId)).toMatchObject({ state: 'blocked', blockedReason: 'crash' });
      expect(core.daemon.db.prepare('SELECT count(*) AS n FROM workspace_write_lease WHERE run_id=?').get(active.runId)).toEqual({ n: 1 });
      expect(core.daemon.db.prepare("SELECT count(*) AS n FROM task WHERE state='queued'").get()).toEqual({ n: 0 });
      expect(launchHost).toHaveBeenCalledTimes(1);
      expect(() => core.execute(queued.runId)).toThrow('daemon blocked/crash');
      expect(core.daemon.stop(active.runId, 'cleanup')).toBe(false);
      expect(stop).toHaveBeenCalled();
    } finally {
      core.daemon.db.exec('DROP TRIGGER IF EXISTS p12_abort_release');
      core.close();
      if (core.daemon.db.open) core.daemon.db.close();
    }
  });
});
