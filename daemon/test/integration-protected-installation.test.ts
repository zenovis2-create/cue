import { beforeEach, expect, test, vi } from 'vitest';
import { resolve, join } from 'node:path';
const mocks = vi.hoisted(() => ({ settings: vi.fn(), process: vi.fn(), bootstrap: vi.fn(), fetch: vi.fn(), cache: {} as Record<string, unknown> }));
vi.mock('node:fs', () => ({ lstatSync: () => ({ isSymbolicLink: () => false, isDirectory: () => true, isFile: () => true }), realpathSync: (p: string) => p }));
vi.mock('node:module', () => ({ createRequire: () => ({ resolve: () => resolve('node_modules/better-sqlite3/package.json'), cache: mocks.cache }) }));
vi.mock('../../app/installation-identity.mjs', () => ({ isInstallationGeneration: (g: any) => g?.fixture === true }));
vi.mock('../../daemon/dist/src/process-launch.js', () => ({ runProcessSync: mocks.process }));
vi.mock('../../daemon/dist/src/selection/local-host-settings.js', () => ({ readLatestLocalHostSettings: mocks.settings }));
vi.mock('../../app/default-generated-json-bootstrap.mjs', () => ({ DEFAULT_GENERATED_JSON_SETTINGS_ID: 'generated-json-default', createDefaultGeneratedJsonBootstrap: mocks.bootstrap }));
vi.mock('../../app/native-existing-file-authorities.mjs',()=>({readNativeProposalExecutionCatalog:vi.fn()}));
import { createStartupOrchestrationFactory } from '../../app/protected-installation.mjs';
const root = resolve('..'), native = resolve('node_modules/better-sqlite3/build/Release/better_sqlite3.node');
function fixture() { return { guard: { fixture: true, assertCurrent: vi.fn(() => true), snapshot: { root, dependencyRoot: resolve('node_modules'), files: [{ label: 'dependency/better-sqlite3/build/Release/better_sqlite3.node', sha256: 'a'.repeat(64) }] } }, daemon: { db: {}, status: 'ready' } } as any; }
beforeEach(() => {
  vi.restoreAllMocks(); vi.unstubAllGlobals();
  mocks.settings.mockReset().mockReturnValue({ settings: { version: 'cue-local-host-settings-v2', enabled: true } });
  mocks.process.mockReset().mockReturnValue({ status: 0, stdout: JSON.stringify({ programFiles: 'C:\\Program Files', localAppData: 'C:\\Users\\Fixture\\AppData\\Local', temp: 'C:\\Users\\Fixture\\Temp' }) });
  mocks.bootstrap.mockReset().mockImplementation(authority => (context: any) => ({ authority, context }));
  mocks.fetch.mockReset().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: 'qwen38-27b-unc' }] })));
  for (const key of Object.keys(mocks.cache)) delete mocks.cache[key]; mocks.cache[native] = {};
  vi.stubGlobal('fetch', mocks.fetch);
});
test.each([undefined, { settings: { version: 'cue-local-host-settings-v2', enabled: false } }])('missing/disabled settings do no HTTP, discovery or bootstrap', async saved => {
  mocks.settings.mockReturnValue(saved); const f = fixture(), factory = await createStartupOrchestrationFactory(f);
  expect(factory({ db: f.daemon.db } as any)).toMatchObject({ available: false });
  expect(mocks.fetch).not.toHaveBeenCalled(); expect(mocks.process).not.toHaveBeenCalled(); expect(mocks.bootstrap).not.toHaveBeenCalled();
});
test('fixed GET and sealed knownfolders, same DB, captured native and expiring health; no qualification or inference', async () => {
  const f = fixture(), factory = await createStartupOrchestrationFactory(f), result = factory({ db: f.daemon.db } as any) as any;
  expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith('http://127.0.0.1:8085/v1/models', expect.objectContaining({ method: 'GET', redirect: 'error' }));
  expect(mocks.process.mock.calls[0][1].slice(0, 3)).toEqual(['-NoProfile', '-NonInteractive', '-Command']);
  expect(mocks.process.mock.calls[0][2]).toMatchObject({ timeout: 5000, maxBuffer: 8192, windowsHide: true });
  const install = result.authority.discoverInstallation({ db: f.daemon.db });
  expect(install.measurement.sqliteNativePath).toBe(native); expect(install.controlRoot).toBe(join(root, 'daemon', 'dist', 'src'));
  expect(result.authority.observeReadiness('model', { db: f.daemon.db })).toEqual({ authenticated: true, dataAllowed: true, resourceAvailable: true, quotaAvailable: true });
  vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 600001);
  expect(result.authority.observeReadiness('model', { db: f.daemon.db }).resourceAvailable).toBe(false);
  expect(factory({ db: {} } as any)).toMatchObject({ available: false });
});
test.each(['wrong-model', 'oversize', 'redirect', 'timeout'])('health %s fails closed without bootstrap', async mode => {
  if (mode === 'wrong-model') mocks.fetch.mockResolvedValue(new Response('{"data":[{"id":"other"}]}'));
  if (mode === 'oversize') mocks.fetch.mockResolvedValue(new Response('x'.repeat(32769)));
  if (mode === 'redirect') mocks.fetch.mockRejectedValue(Error('redirect denied'));
  if (mode === 'timeout') mocks.fetch.mockImplementation((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(Error('aborted')))));
  const f = fixture(), factory = await createStartupOrchestrationFactory(f);
  expect(factory({ db: f.daemon.db } as any)).toMatchObject({ available: false }); expect(mocks.bootstrap).not.toHaveBeenCalled();
}, 10000);
test('forged guard or native outside captured inventory denies discovery', async () => {
  const f = fixture(); f.guard.fixture = false; await expect(createStartupOrchestrationFactory(f)).rejects.toThrow('generation');
  f.guard.fixture = true; f.guard.snapshot.files = []; const factory = await createStartupOrchestrationFactory(f);
  expect(factory({ db: f.daemon.db } as any)).toMatchObject({ available: false }); expect(mocks.fetch).not.toHaveBeenCalled();
});
