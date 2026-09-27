import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
const m = vi.hoisted(() => ({ ready: vi.fn(), on: vi.fn(), off: vi.fn(), validate: vi.fn(), discover: vi.fn(), create: vi.fn(), collect: vi.fn(), close: vi.fn(), daemon: undefined as any }));
vi.mock('electron', () => ({ app: { whenReady: m.ready, on: m.on, removeListener: m.off, getPath: vi.fn() } }));
vi.mock('../../app/core.mjs', () => ({ AppDaemon: class { db = {}; close = m.close; constructor() { m.daemon = this; } }, validatePersistedConfig: m.validate }));
vi.mock('../../app/installation-identity.mjs', () => ({ isInstallationGeneration: (g: any) => g?.fixture === true }));
vi.mock('../../app/protected-installation.mjs', () => ({ discoverGeneratedJsonInstallation: m.discover }));
vi.mock('../../app/qualify-generated-json.mjs', () => ({ createGeneratedJsonQualification: m.create }));
const roots: string[] = [];
beforeEach(() => {
  vi.resetModules(); for (const mock of Object.values(m)) if (vi.isMockFunction(mock)) mock.mockReset(); m.daemon = undefined;
  m.ready.mockResolvedValue(undefined); m.validate.mockImplementation((_directory, value) => value); m.discover.mockReturnValue({ fixture: 'installation' });
  m.create.mockReturnValue({ collect: m.collect }); m.collect.mockResolvedValue({ eligible: true, allClean: true, failure: null }); m.close.mockResolvedValue(undefined);
});
afterEach(() => { vi.unstubAllEnvs(); for (const root of roots.splice(0)) { expect(dirname(resolve(root))).toBe(resolve(tmpdir())); expect(basename(root).startsWith('cue-qualification-entry-')).toBe(true); rmSync(root, { recursive: true, force: true }); } });
function config(contents?: string | null) {
  const root = mkdtempSync(join(tmpdir(), 'cue-qualification-entry-')); roots.push(root); mkdirSync(join(root, 'worktree'));
  const value = { version: 1, ledgerPath: join(root, 'cue-ledger.sqlite'), worktreeRoot: join(root, 'worktree') };
  if (contents !== null) writeFileSync(join(root, 'cue-config.json'), contents === undefined ? JSON.stringify(value) : contents);
  vi.stubEnv('CUE_USER_DATA', root); return { root, value };
}
const guard = () => ({ fixture: true, assertCurrent: vi.fn(() => true) });
test('definitions only; exact existing JSON validation, one daemon passed to operation and closed after collection', async () => {
  const f = config(), api = await import('../../app/qualification-application.mjs'); expect(m.ready).not.toHaveBeenCalled(); expect(m.create).not.toHaveBeenCalled();
  const generation = guard(), result = await api.runQualificationApplication({ guard: generation });
  expect(m.validate).toHaveBeenCalledWith(f.root, f.value); expect(m.create).toHaveBeenCalledWith({ daemon: m.daemon, config: f.value, installation: { fixture: 'installation' }, generation });
  expect(result).toMatchObject({ exitCode: 0, eligible: true, cleanup: 'confirmed' }); expect(m.close).toHaveBeenCalledTimes(1);
  await expect(api.runQualificationApplication({ guard: generation })).rejects.toThrow('already_attempted');
});
test.each([null, '{invalid', 'x'.repeat(32769)])('missing/malformed/oversized existing config never creates DB or starts collection', async contents => {
  config(contents); const api = await import('../../app/qualification-application.mjs');
  expect(await api.runQualificationApplication({ guard: guard() })).toMatchObject({ exitCode: 1 }); expect(m.daemon).toBeUndefined(); expect(m.collect).not.toHaveBeenCalled();
});
test('abort prevents quit until collect settles, then closes; no collect/close race', async () => {
  config(); let settle!: (result: unknown) => void; m.collect.mockImplementation(() => new Promise(resolve => { settle = resolve; }));
  const api = await import('../../app/qualification-application.mjs'), operation = api.runQualificationApplication({ guard: guard() });
  await vi.waitFor(() => expect(m.collect).toHaveBeenCalledTimes(1));
  const stop = m.on.mock.calls.find(call => call[0] === 'before-quit')![1], event = { preventDefault: vi.fn() }; stop(event);
  expect(m.collect.mock.calls[0][0].signal.aborted).toBe(true); expect(m.close).not.toHaveBeenCalled();
  settle({ eligible: false, allClean: true, failure: 'aborted' });
  expect(await operation).toMatchObject({ exitCode: 130, aborted: true, eligible: false }); expect(m.close).toHaveBeenCalledTimes(1); expect(event.preventDefault).toHaveBeenCalledTimes(1);
});
test.each(['incomplete', 'unresolved', 'close-failure', 'collect-reject'])('outcome %s never exits as qualified', async mode => {
  config(); if (mode === 'incomplete') m.collect.mockResolvedValue({ eligible: false, allClean: true, failure: 'incomplete' });
  if (mode === 'unresolved') m.collect.mockResolvedValue({ eligible: false, allClean: false, failure: 'unresolved' });
  if (mode === 'close-failure') m.close.mockRejectedValue(Error('close failure'));
  if (mode === 'collect-reject') m.collect.mockRejectedValue(Error('collection failed'));
  const api = await import('../../app/qualification-application.mjs');
  expect(await api.runQualificationApplication({ guard: guard() })).toMatchObject({ exitCode: mode === 'incomplete' ? 2 : 3, eligible: false }); expect(m.close).toHaveBeenCalledTimes(1);
});
