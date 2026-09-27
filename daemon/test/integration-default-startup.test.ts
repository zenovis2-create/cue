import { afterEach, beforeEach, expect, test, vi } from 'vitest';
const m = vi.hoisted(() => ({ ready: vi.fn(), on: vi.fn(), initialize: vi.fn(), factory: vi.fn(), planningFactory:vi.fn(), createCore: vi.fn(), close: vi.fn(), handlers: vi.fn(), windows: vi.fn(), daemon: undefined as any }));
vi.mock('electron', () => ({ app: { whenReady: m.ready, on: m.on, getPath: () => 'fixture-user-data', quit: vi.fn() }, dialog: {}, ipcMain: {}, session: {}, BrowserWindow: class { webContents = {}; loadFile = vi.fn(); constructor() { m.windows(); } } }));
vi.mock('../../app/core.mjs', () => ({ AppDaemon: class { db = {}; close = m.close; constructor() { m.daemon = this; } }, createCueCore: m.createCore }));
vi.mock('../../app/installation-identity.mjs', () => ({ isInstallationGeneration: (guard: any) => guard?.fixture === true }));
vi.mock('../../app/protected-installation.mjs', () => ({ createStartupOrchestrationFactory: m.factory,createStartupGoalPlanningFactory:m.planningFactory }));
vi.mock('../../app/first-run.mjs', () => ({ initializeFirstRunConfig: m.initialize }));
// Startup plumbing fixture has no real filesystem or SQLite; project catalog is tested separately.
vi.mock('../../app/workspace-management.mjs', () => ({ createWorkspaceManagement: vi.fn(() => ({})), activateProjectConfig: vi.fn() }));
vi.mock('../../app/ipc.mjs', () => ({ registerIpcHandlers: m.handlers }));
vi.mock('../../app/electron-security.mjs', () => ({ applyNavigationGuards: vi.fn() }));
vi.mock('../../app/quit-guard.mjs', () => ({ registerQuitGuard: vi.fn() }));
vi.mock('../../app/report-window.mjs', () => ({ openReportWindow: vi.fn() }));
beforeEach(() => { vi.resetModules(); for (const mock of Object.values(m)) if (vi.isMockFunction(mock)) mock.mockReset(); m.ready.mockResolvedValue(undefined); m.initialize.mockResolvedValue({ ledgerPath: 'fixture.db', worktreeRoot: 'fixture-workspace' }); m.factory.mockResolvedValue(() => ({ available: false }));m.planningFactory.mockResolvedValue(() => ({available:false})); m.createCore.mockReturnValue({ close: m.close }); });
afterEach(() => vi.unstubAllEnvs());
test('host-owned config overrides pass through existing first-run validation', async () => {
  vi.stubEnv('CUE_USER_DATA', 'C:\\fixture-owned\\state'); vi.stubEnv('CUE_WORKTREE_ROOT', 'C:\\fixture-owned\\worktree');
  const main = await import('../../app/main.mjs'); await main.startCueApplication({ guard: { fixture: true, assertCurrent: vi.fn() } });
  expect(m.initialize).toHaveBeenCalledWith('C:\\fixture-owned\\state', expect.objectContaining({ worktreeOverride: 'C:\\fixture-owned\\worktree', chooseDirectory: expect.any(Function) }));
});
test('definitions-only main import; initialization uses same daemon and never auto runs live env', async () => {
  const main = await import('../../app/main.mjs'); expect(m.ready).not.toHaveBeenCalled(); expect(m.on).not.toHaveBeenCalled(); expect(m.createCore).not.toHaveBeenCalled();
  const guard = { fixture: true, assertCurrent: vi.fn() }; const core = await main.startCueApplication({ guard });
  expect(m.factory).toHaveBeenCalledWith({ guard, daemon: m.daemon }); expect(m.createCore).toHaveBeenCalledWith(expect.anything(), m.daemon,
    { orchestrationFactory: expect.any(Function),planningOrchestrationFactory:expect.any(Function), nativeRecoveryFactory: expect.any(Function) });
  expect(core).toBe(m.createCore.mock.results[0].value); expect(m.windows).toHaveBeenCalledTimes(1); expect(guard.assertCurrent).toHaveBeenCalledTimes(4);
  await expect(main.startCueApplication({ guard })).rejects.toThrow('already_attempted');
});
test('failed factory closes same daemon, creates no window and cannot retry', async () => {
  m.factory.mockRejectedValue(Error('fixture failure')); const main = await import('../../app/main.mjs'), guard = { fixture: true, assertCurrent: vi.fn() };
  await expect(main.startCueApplication({ guard })).rejects.toThrow('fixture failure'); expect(m.close).toHaveBeenCalledTimes(1); expect(m.windows).not.toHaveBeenCalled();
  await expect(main.startCueApplication({ guard })).rejects.toThrow('already_attempted');
});
test('forged generation never begins initialization', async () => {
  const main = await import('../../app/main.mjs'); await expect(main.startCueApplication({ guard: { assertCurrent: vi.fn() } })).rejects.toThrow('generation'); expect(m.ready).not.toHaveBeenCalled();
});
