import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppDaemon, createCueCore, initializeConfig } from '../../app/core.mjs';
import { fenceInterruptedSessions } from '../src/recovery.js';
import * as processLaunch from '../src/process-launch.js';

const roots: string[] = [];
const daemons: AppDaemon[] = [];
const restore: Array<() => void> = [];
function temp() { const root = mkdtempSync(join(tmpdir(), 'cue-p11-corrective-')); roots.push(root); return root; }
afterEach(() => {
  vi.restoreAllMocks();
  for (const fn of restore.splice(0)) fn();
  for (const daemon of daemons.splice(0)) {
    if (!daemon.db.open) continue;
    // These daemons are deliberately quarantined, so close() rejects instead of
    // reporting a clean teardown. Release the handle explicitly here; never
    // relax close() into succeeding just to make afterEach simpler.
    void Promise.resolve(daemon.close()).catch(() => {});
    if (daemon.db.open) daemon.db.close();
  }
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
});
function seed() {
  const root = temp(); const worktree = join(root, 'worktree'); mkdirSync(worktree);
  const config = initializeConfig(join(root, 'state'), { worktreeRoot: worktree });
  const daemon = new AppDaemon(config); daemons.push(daemon); const now = new Date().toISOString();
  daemon.db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('t', 'running', null, now);
  daemon.db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run('e', worktree, '[]', now);
  daemon.db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('r', 't', 'e', 1, now);
  daemon.db.prepare('INSERT INTO workspace_write_lease VALUES(?,?,?)').run(worktree, 'r', now);
  return { root, worktree, config, daemon };
}
function unverified() { return Object.assign(new Error('tree termination could not be verified'), { code: 'CUE_TERMINATION_UNVERIFIED' }); }
function retained(daemon: AppDaemon, runId = 'r') {
  expect(daemon.db.prepare('SELECT run_id FROM workspace_write_lease').all()).toEqual([{ run_id: runId }]);
  expect(daemon.db.prepare('SELECT write_in_progress FROM run WHERE id=?').get(runId)).toEqual({ write_in_progress: 1 });
}

describe.skipIf(process.platform !== 'win32')('P11 corrective writer security', () => {
  for (const direction of ['parent then child', 'child then parent', 'junction child alias', 'dotdot-named child']) {
    it(`refuses overlapping worktrees across ledgers: ${direction}`, () => {
      const root = temp(); const parent = join(root, 'parent'); const child = join(parent, direction === 'dotdot-named child' ? '..child' : 'child'); mkdirSync(child, { recursive: true });
      const alias = join(root, 'alias'); symlinkSync(parent, alias, 'junction');
      const firstRoot = direction === 'child then parent' ? child : parent;
      const secondRoot = direction === 'child then parent' ? parent : direction === 'junction child alias' ? join(alias, 'child').toUpperCase() : child;
      const first = new AppDaemon(initializeConfig(join(root, 'first-state'), { worktreeRoot: firstRoot })); daemons.push(first);
      let second: AppDaemon | undefined;
      try { expect(() => { second = new AppDaemon(initializeConfig(join(root, 'second-state'), { worktreeRoot: secondRoot })); }).toThrow(/worktree.*owned/i); }
      finally { second?.close(); }
    });
  }
  it('failed stop quarantines the daemon and retains the writer lease', () => {
    const { daemon } = seed(); const runtime = { session: { pid: 999999 }, stop(): void { throw unverified(); } };
    (daemon as any).own('r', runtime); restore.push(() => { runtime.stop = () => {}; });
    expect(() => daemon.stop('r')).not.toThrow();
    expect(daemon.status).toBe('blocked/crash'); retained(daemon);
    expect(daemon.db.prepare("SELECT state,blocked_reason FROM task WHERE id='t'").get()).toEqual({ state: 'blocked', blocked_reason: 'crash' });
    daemon.crash(); retained(daemon);
    daemon.close(); expect(daemon.db.open).toBe(true); retained(daemon);
  });
  for (const finish of ['late completion after stop failure', 'termination rejection', 'termination result']) {
    it(`retains ownership through ${finish}`, async () => {
      const root = temp(); const worktree = join(root, 'worktree'); const source = join(root, 'source'); mkdirSync(worktree); mkdirSync(source); writeFileSync(join(source, 'auth.json'), '{}');
      let resolveDone!: (value: any) => void; let rejectDone!: (error: any) => void;
      const runtime = { session: { pid: 999999 }, child: { pid: 999999 }, stop(): void { throw unverified(); }, done: new Promise((yes, no) => { resolveDone = yes; rejectDone = no; }) };
      const core = createCueCore(initializeConfig(join(root, 'state'), { worktreeRoot: worktree }), undefined, { binary: process.execPath, codexHome: source, launchHost: () => runtime } as any);
      daemons.push(core.daemon); restore.push(() => { runtime.stop = () => {}; });
      const run = core.prepareGoal('Create result.txt', 1); core.approve(run.runId); core.execute(run.runId);
      if (finish === 'late completion after stop failure') {
        try { core.stop(run.runId); } catch { /* assertions below require quarantine even after the runtime throws */ }
        resolveDone({ status: 'completed', successfulToolCalls: 1, goalVerification: { passed: true }, finalMessage: 'done' });
      } else if (finish === 'termination rejection') rejectDone(unverified());
      else resolveDone({ status: 'failed', failureKind: 'termination', error: 'tree termination could not be verified' });
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(core.daemon.status).toBe('blocked/crash'); retained(core.daemon, run.runId);
      expect(core.completion(run.taskId)).toMatchObject({ state: 'blocked', blockedReason: 'crash' });
      const next = core.prepareGoal('Create next.txt', 1); core.approve(next.runId);
      expect(() => core.execute(next.runId)).toThrow(/daemon blocked\/crash/);
    });
  }
  it('failed initial process query cannot be mistaken for a dead session', () => {
    const { daemon, worktree } = seed(); const now = new Date().toISOString();
    daemon.db.prepare('INSERT INTO session_handle VALUES(?,?,?,?,?,?)').run('h', 999999, now, worktree, 't', 'r');
    vi.spyOn(processLaunch, 'runProcessSync').mockReturnValue({ status: 1, stdout: '', stderr: '', pid: 1, signal: null, output: [] } as any);
    expect(() => fenceInterruptedSessions(daemon.db)).toThrow(/query.*failed|failed.*query/i);
    retained(daemon);
    expect(daemon.db.prepare("SELECT count(*) n FROM artifact WHERE kind='startup_fence' AND content='session_not_live'").get()).toEqual({ n: 0 });
  });
  for (const kind of ['state', 'sourceHome', 'homeRoot', 'missing homeRoot under junction', 'homeRoot named ..homes']) {
    it(`refuses a worktree overlapping protected ${kind}`, () => {
      const root = temp(); const worktree = join(root, 'worktree'); mkdirSync(worktree);
      const state = kind === 'state' ? join(worktree, 'state') : join(root, 'state');
      const runtime: any = {};
      if (kind === 'sourceHome') { runtime.codexHome = join(worktree, 'source'); mkdirSync(runtime.codexHome); }
      if (kind === 'homeRoot') runtime.homeRoot = join(worktree, 'homes');
      if (kind === 'homeRoot named ..homes') runtime.homeRoot = join(worktree, '..homes');
      if (kind === 'missing homeRoot under junction') { const alias = join(root, 'alias'); symlinkSync(worktree, alias, 'junction'); runtime.homeRoot = join(alias, 'missing', 'homes'); }
      let core: ReturnType<typeof createCueCore> | undefined;
      try { expect(() => { core = createCueCore(initializeConfig(state, { worktreeRoot: worktree }), undefined, runtime); }).toThrow(/worktree overlaps protected/); }
      finally { core?.close(); }
    });
  }
  it('a protected-path refusal permits a corrected core for the same workspace immediately', () => {
    const root = temp(); const worktree = join(root, 'worktree'); mkdirSync(worktree);
    const config = initializeConfig(join(root, 'state'), { worktreeRoot: worktree });
    expect(() => createCueCore(config, undefined, { homeRoot: join(worktree, 'unsafe-homes') })).toThrow(/worktree overlaps protected/);
    const core = createCueCore(config, undefined, { homeRoot: join(root, 'safe-homes') }); daemons.push(core.daemon);
    expect(core.daemon.status).toBe('ready');
  });
});

