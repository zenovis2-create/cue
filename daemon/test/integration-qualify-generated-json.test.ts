import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, realpathSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { AppDaemon } from '../../app/core.mjs';
import { createGeneratedJsonQualification } from '../../app/qualify-generated-json.mjs';
const mocks = vi.hoisted(() => ({ authentic: new WeakSet<object>(), collector: vi.fn(), bundle: vi.fn(), diagnostic: vi.fn() }));
// Offline module doubles only: no production factory override or authenticated
// generation registration is exposed by the operation being tested.
vi.mock('../../app/installation-identity.mjs', () => ({ isInstallationGeneration: (v: object) => mocks.authentic.has(v) }));
vi.mock('../../daemon/dist/src/model-qualification.js', () => ({ createModelQualification: mocks.collector, measureModelDiagnosticBundle: mocks.diagnostic }));
vi.mock('../../daemon/dist/src/model-control-bundle.js', () => ({ measureModelControlBundle: mocks.bundle }));
const fixtures: Array<{ daemon: AppDaemon; root: string }> = [];
afterEach(async () => { for (const f of fixtures.splice(0)) { await f.daemon.close(); expect(dirname(f.root)).toBe(realpathSync(tmpdir())); expect(basename(f.root).startsWith('cue-qualify-op-')).toBe(true); rmSync(f.root, { recursive: true, force: true }); } });
beforeEach(() => {
  mocks.collector.mockReset(); mocks.bundle.mockReset().mockReturnValue(Object.freeze({ version: 'offline-control' })); mocks.diagnostic.mockReset().mockReturnValue(Object.freeze({ version: 'offline-diagnostic' }));
  mocks.collector.mockImplementation(host => ({ collect: async () => {
    host.assertInstallationCurrent();
    return Object.freeze({ kind: 'live', eligible: true, allClean: true, failure: null, references: Object.freeze({ M1: 'offline-ref' }), subjectDigest: host.measurement.kind });
  } }));
});
function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'cue-qualify-op-'))); mkdirSync(join(root, 'work'));
  const config = Object.freeze({ version: 1, ledgerPath: join(root, 'ledger.sqlite'), worktreeRoot: join(root, 'work') });
  const daemon = new AppDaemon(config); fixtures.push({ daemon, root });
  const generation = Object.freeze({ digest: 'a'.repeat(64), snapshot: Object.freeze({ root: realpathSync(resolve('..')), dependencyRoot: realpathSync(resolve('node_modules')) }), assertCurrent: vi.fn(() => true) });
  mocks.authentic.add(generation);
  const installation = { measurement: { installRoot: resolve('..'), dependencyRoot: resolve('node_modules'), nodeExecutable: process.execPath,
    powershellExecutable: process.execPath, sqliteNativePath: process.execPath }, controlRoot: resolve('dist/src'), taskRootBase: tmpdir(), profileRootBase: tmpdir(),
    loadedHost: { executable: process.execPath, runtime: process.versions.electron ? 'electron' : 'node', version: process.versions.electron ?? process.versions.node } };
  return { daemon, config, generation, installation } as any;
}
test('explicit operation uses same DB and default collector only, checker first; duplicate calls never collect twice', async () => {
  const f = fixture(), op = createGeneratedJsonQualification(f);
  expect(mocks.collector).not.toHaveBeenCalled();
  const pending = op.collect(); expect(op.collect()).toBe(pending);
  expect(createGeneratedJsonQualification(f)).toBe(op);
  const result = await pending; expect(await op.collect()).toBe(result);
  expect(result).toMatchObject({ eligible: true, allClean: true, failure: null, restartRequired: true, daemonCloseRequired: true });
  expect(mocks.collector.mock.calls.map(([h]) => h.measurement.kind)).toEqual(['json-checker', 'model']);
  for (const [host] of mocks.collector.mock.calls) { expect(host.db).toBe(f.daemon.db); expect(Object.keys(host).sort()).toEqual(['assertInstallationCurrent', 'controlBundle', 'db', 'diagnosticBundle', 'measurement']); }
  expect(f.daemon.db.open).toBe(true);
  for (const table of ['local_host_settings_snapshot', 'local_selection_policy_snapshot', 'capability_evidence', 'session_handle']) expect(f.daemon.db.prepare(`SELECT count(*) n FROM ${table}`).get()).toEqual({ n: 0 });
});
test('rejects missing/forged guard, getters, fixture seams and wrong same-ledger binding before collection', () => {
  const f = fixture();
  for (const value of [{ ...f, generation: null }, { ...f, generation: { ...f.generation } }, { ...f, fixture: {} }, { ...f, config: { ...f.config, ledgerPath: process.execPath } }]) expect(() => createGeneratedJsonQualification(value)).toThrow();
  let invoked = 0;
  const value = Object.defineProperty({ ...f }, 'generation', { enumerable: true, get() { invoked++; return f.generation; } });
  expect(() => createGeneratedJsonQualification(value)).toThrow(); expect(invoked).toBe(0); expect(mocks.collector).not.toHaveBeenCalled();
});
test('generation drift at issuance prevents model collection and retains failure without close or retry', async () => {
  const f = fixture();
  mocks.collector.mockImplementation(host => ({ collect: async () => {
    f.generation.assertCurrent.mockImplementation(() => { throw Error('drift'); }); host.assertInstallationCurrent();
  } }));
  const op = createGeneratedJsonQualification(f), result = await op.collect();
  expect(result).toMatchObject({ eligible: false, allClean: false, failure: 'qualification-unresolved', results: {} });
  expect(await op.collect()).toBe(result); expect(mocks.collector).toHaveBeenCalledTimes(1); expect(f.daemon.db.open).toBe(true);
});
test.each(['unknown', 'fixture', 'error'])('checker %s prevents any model call and cannot be retried', async variant => {
  const f = fixture(); mocks.collector.mockReturnValue({ collect: async () => {
    if (variant === 'error') throw Error('native-failure-private-path');
    return Object.freeze({ kind: variant === 'fixture' ? 'fixture' : 'live', eligible: variant === 'fixture', allClean: variant === 'fixture', failure: 'offline-failure' });
  } });
  const op = createGeneratedJsonQualification(f), result = await op.collect();
  expect(result.eligible).toBe(false); expect(result.failure).not.toBeNull(); expect(JSON.stringify(result)).not.toContain('private-path');
  await op.collect(); expect(mocks.collector).toHaveBeenCalledTimes(1);
});
test('preabort never collects and remains consumed; conflicting operation payload is rejected', async () => {
  const f = fixture(), op = createGeneratedJsonQualification(f);
  const result = await op.collect({ signal: AbortSignal.abort() }); expect(result.failure).toBe('qualification-aborted');
  await op.collect(); expect(mocks.collector).not.toHaveBeenCalled();
  expect(() => createGeneratedJsonQualification({ ...f, installation: { ...f.installation, taskRootBase: resolve('..') } })).toThrow('operation-conflict');
});
test('abort during owned checker await is forwarded and never starts model or closes caller DB', async () => {
  const f = fixture(), controller = new AbortController(); let started!: () => void;
  const ready = new Promise<void>(done => { started = done; });
  mocks.collector.mockReturnValue({ collect: ({ signal }: { signal: AbortSignal }) => new Promise((_done, reject) => {
    expect(signal).toBe(controller.signal); signal.addEventListener('abort', () => reject(Error('owned-abort')), { once: true }); started();
  }) });
  const pending = createGeneratedJsonQualification(f).collect({ signal: controller.signal }); await ready; controller.abort();
  expect(await pending).toMatchObject({ eligible: false, allClean: false, failure: 'qualification-aborted' });
  expect(mocks.collector).toHaveBeenCalledTimes(1); expect(f.daemon.db.open).toBe(true);
});
