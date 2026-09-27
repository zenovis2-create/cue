import { beforeEach, expect, test, vi } from 'vitest';
import { resolve } from 'node:path';

const mocks = vi.hoisted(() => ({ compose: vi.fn(), localSettings: vi.fn(), fetch: vi.fn() }));
vi.mock('../../app/installation-identity.mjs', () => ({ isInstallationGeneration: (value: any) => value?.fixture === true }));
vi.mock('../../app/native-existing-file-authorities.mjs', () => ({ createNativeExistingFileAuthorities: mocks.compose }));
vi.mock('../../daemon/dist/src/selection/local-host-settings.js', () => ({ readLatestLocalHostSettings: mocks.localSettings }));
import { createStartupOrchestrationFactory } from '../../app/protected-installation.mjs';

function fixture() {
  return { guard: { fixture: true, assertCurrent: vi.fn(), snapshot: { root: resolve('..'), dependencyRoot: resolve('node_modules') } },
    daemon: { db: {}, status: 'ready' }, nativeConfiguration: JSON.stringify({ fixture: 'native' }) } as any;
}
beforeEach(() => {
  vi.restoreAllMocks(); vi.unstubAllGlobals();
  mocks.compose.mockReset(); mocks.localSettings.mockReset(); mocks.fetch.mockReset();
  vi.stubGlobal('fetch', mocks.fetch);
});

test('explicit native setup reaches its composer and guarded same-ledger factory without local discovery', async () => {
  const f = fixture(), readiness = { executionStagingSupport: 'git-worktree-v1' }, inner = vi.fn(() => readiness);
  mocks.compose.mockResolvedValue(inner);
  const factory = await createStartupOrchestrationFactory(f), context = { db: f.daemon.db, worktree: 'fixture' } as any;
  expect(factory(context)).toBe(readiness);
  expect(mocks.compose).toHaveBeenCalledExactlyOnceWith({ db: f.daemon.db, now: Date.now, configuration: { fixture: 'native' } });
  expect(inner).toHaveBeenCalledExactlyOnceWith(context);
  expect(factory({ db: {} } as any)).toEqual({ available: false, reasons: ['native-startup-ledger-mismatch'] });
  f.daemon.status = 'blocked/crash';
  expect(factory(context)).toEqual({ available: false, reasons: ['native-startup-daemon-unavailable'] });
  expect(inner).toHaveBeenCalledTimes(1);
  expect(mocks.localSettings).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled();
});

test.each(['', '{', 'null', '[]', 'true', '"string"', ' '.repeat(65537)])('malformed native selection refuses without local fallback (%#)', async nativeConfiguration => {
  const f = fixture(), factory = await createStartupOrchestrationFactory({ ...f, nativeConfiguration });
  expect(factory({ db: f.daemon.db } as any)).toEqual({ available: false, reasons: ['native-startup-config-invalid'] });
  expect(mocks.compose).not.toHaveBeenCalled(); expect(mocks.localSettings).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled();
});

test('missing composer readiness and asynchronous refusal stay unavailable without exposing errors', async () => {
  for (const result of [undefined, { available: false }]) {
    mocks.compose.mockResolvedValue(result);
    const f = fixture(), factory = await createStartupOrchestrationFactory(f);
    expect(factory({ db: f.daemon.db } as any)).toEqual({ available: false, reasons: ['native-startup-composer-unavailable'] });
  }
  mocks.compose.mockRejectedValue(Error('private profile details'));
  const f = fixture(), factory = await createStartupOrchestrationFactory(f);
  expect(factory({ db: f.daemon.db } as any)).toEqual({ available: false, reasons: ['native-startup-composer-unavailable'] });
  expect(mocks.localSettings).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled();
});

test('guard drift during async composition and before factory use refuses', async () => {
  const f = fixture(), inner = vi.fn(() => ({ available: true }));
  mocks.compose.mockImplementation(async () => { f.guard.assertCurrent.mockImplementation(() => { throw Error('drift'); }); return inner; });
  const refused = await createStartupOrchestrationFactory(f);
  expect(refused({ db: f.daemon.db } as any)).toMatchObject({ available: false }); expect(inner).not.toHaveBeenCalled();
  const current = fixture(); mocks.compose.mockResolvedValue(inner);
  const factory = await createStartupOrchestrationFactory(current);
  current.guard.assertCurrent.mockImplementation(() => { throw Error('drift'); });
  expect(() => factory({ db: current.daemon.db } as any)).toThrow('drift'); expect(inner).not.toHaveBeenCalled();
});

test('an unavailable daemon refuses before service composition', async () => {
  const f = fixture(); f.daemon.status = 'blocked/crash';
  const factory = await createStartupOrchestrationFactory(f);
  expect(factory({ db: f.daemon.db } as any)).toMatchObject({ available: false }); expect(mocks.compose).not.toHaveBeenCalled();
});
