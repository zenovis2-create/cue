import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppDaemon, initializeConfig } from '../../app/core.mjs';

const roots: string[] = [];
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const repoFile = (...parts: string[]) => join(repoRoot, ...parts);
const temp = () => { const value = mkdtempSync(join(tmpdir(), 'cue-p13-')); roots.push(value); return value; };
afterEach(() => { while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true }); });

const tick = (ms = 60) => new Promise(resolve => setTimeout(resolve, ms));

function pendingRuntime() {
  let settle: () => void = () => {};
  let cleanupRan = false;
  const done = new Promise<{ status: string }>(resolve => {
    settle = () => { cleanupRan = true; resolve({ status: 'completed' }); };
  });
  let stopCalls = 0;
  return {
    handle: { session: { pid: process.pid }, done, stop() { stopCalls += 1; } },
    settle,
    get cleanupRan() { return cleanupRan; },
    get stopCalls() { return stopCalls; },
  };
}

describe('P13 runtime lifecycle barrier', () => {
  it('P13-L1 close does not resolve until every owned runtime has settled its teardown', async () => {
    const config = initializeConfig(join(temp(), 'data'), { worktreeRoot: temp() });
    const daemon = new AppDaemon(config);
    const runtime = pendingRuntime();
    daemon.own('run-barrier', runtime.handle);

    let closed = false;
    const closing = Promise.resolve(daemon.close()).then(() => { closed = true; });

    await tick();
    expect(runtime.stopCalls).toBeGreaterThan(0);
    expect(runtime.cleanupRan).toBe(false);
    expect(closed).toBe(false);

    runtime.settle();
    await closing;
    expect(runtime.cleanupRan).toBe(true);
    expect(closed).toBe(true);
    expect(daemon.status).toBe('closed');
  }, 20_000);

  it('P13-L2 stop retains the runtime handle until its teardown settles', async () => {
    const config = initializeConfig(join(temp(), 'data'), { worktreeRoot: temp() });
    const daemon = new AppDaemon(config);
    const runtime = pendingRuntime();
    daemon.own('run-retain', runtime.handle);

    expect(daemon.stop('run-retain', 'cancelled')).toBe(true);
    await tick();
    expect(daemon.settlingRunIds).toContain('run-retain');

    runtime.settle();
    await daemon.settled();
    expect(daemon.settlingRunIds).not.toContain('run-retain');
    await daemon.close();
  }, 20_000);

  it('P13-L3 the runtime stop path signals termination without deleting the credential home', () => {
    const source = readFileSync(repoFile('daemon', 'src', 'host-codex-runtime.ts'), 'utf8');
    const stopBody = source.slice(source.indexOf('stop(): void {'));
    expect(stopBody).not.toMatch(/safeCleanupCodexHome/u);
    const teardownBody = source.slice(source.indexOf('settleHostRuntimeTeardown({'), source.indexOf('stop(): void {'));
    expect(teardownBody).toMatch(/cleanup:\s*\(\)\s*=>\s*safeCleanupCodexHome/u);
  });

  it('P13-L4 the Electron quit path blocks the first quit and awaits the close barrier', async () => {
    const quitGuardModule = new URL('../../app/quit-guard.mjs', import.meta.url).href;
    const { registerQuitGuard } = await import(/* @vite-ignore */ quitGuardModule) as {
      registerQuitGuard: (app: unknown, resolveCore: () => { close(): Promise<void> }) => { state: string };
    };
    const listeners = new Map<string, (event: { preventDefault(): void }) => void>();
    let prevented = 0;
    let quits = 0;
    const fakeApp = {
      on(name: string, handler: (event: { preventDefault(): void }) => void) { listeners.set(name, handler); },
      quit() { quits += 1; listeners.get('before-quit')?.({ preventDefault() { prevented += 1; } }); },
    };
    let releaseClose: () => void = () => {};
    let closeCalls = 0;
    const closed = new Promise<void>(resolve => { releaseClose = resolve; });
    const guard = registerQuitGuard(fakeApp, () => ({ close() { closeCalls += 1; return closed; } }));

    listeners.get('before-quit')!({ preventDefault() { prevented += 1; } });
    await tick();
    expect(prevented).toBe(1);
    expect(closeCalls).toBe(1);
    expect(quits).toBe(0);
    expect(guard.state).toBe('closing');

    releaseClose();
    await tick();
    expect(quits).toBe(1);
    expect(closeCalls).toBe(1);
    expect(guard.state).toBe('done');
  }, 20_000);

  it('P13-L6 a failed stop makes close reject and preserves the handle, db and ownership', async () => {
    const config = initializeConfig(join(temp(), 'data'), { worktreeRoot: temp() });
    const daemon = new AppDaemon(config);
    daemon.own('run-badstop', {
      session: { pid: process.pid },
      done: new Promise(() => {}),
      stop() { throw new Error('synthetic stop failure'); },
    });

    let outcome = 'pending';
    await Promise.resolve(daemon.close()).then(() => { outcome = 'resolved'; }, () => { outcome = 'rejected'; });

    // A close that cannot tear down must not report success: the ledger handle
    // is still open and the runtime is still owned.
    expect(outcome).toBe('rejected');
    expect(daemon.status).not.toBe('closed');
    expect(daemon.db.open).toBe(true);
    // The assertion above is exactly why the handle is still open; release it
    // here so afterEach can delete the root. Never weaken the assertion to make
    // cleanup easier.
    daemon.db.close();
  }, 20_000);

  it('P13-L7 a failing close never reaches app.quit and surfaces the failure', async () => {
    const quitGuardModule = new URL('../../app/quit-guard.mjs', import.meta.url).href;
    const { registerQuitGuard } = await import(/* @vite-ignore */ quitGuardModule) as {
      registerQuitGuard: (app: unknown, resolveCore: () => { close(): Promise<void> }) => { state: string; error?: string };
    };
    const listeners = new Map<string, (event: { preventDefault(): void }) => void>();
    let quits = 0;
    const fakeApp = {
      on(name: string, handler: (event: { preventDefault(): void }) => void) { listeners.set(name, handler); },
      quit() { quits += 1; },
    };
    const guard = registerQuitGuard(fakeApp, () => ({
      close: () => Promise.reject(new Error('synthetic close failure')),
    }));

    listeners.get('before-quit')!({ preventDefault() {} });
    await tick(120);
    expect(quits).toBe(0);
    expect(guard.state).toBe('failed');
    expect(guard.error).toMatch(/synthetic close failure/u);
  }, 20_000);

  it('P13-L5 main.mjs delegates quit to the guarded barrier instead of a fire-and-forget close', () => {
    const main = readFileSync(repoFile('app', 'main.mjs'), 'utf8');
    expect(main).toMatch(/registerQuitGuard/u);
    expect(main).not.toMatch(/on\('before-quit',\s*\(\)\s*=>\s*\{\s*core\?\.close\(\);\s*\}\)/u);
  });
});
