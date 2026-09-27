import { expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const versions = { electron: '44.2.0', node: '24.20.0', modules: '149' }; // VM fixture, not observed runtime.
test.each([{ args: [] }, { args: ['--other'] }, { args: ['--generated-json-qualify', 'extra'] }])('CLI rejects nonexplicit args $args before loading any qualification module', async ({ args }) => {
  const source = readFileSync(new URL('../../app/qualification-start.mjs', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '');
  const load = vi.fn(), exit = vi.fn(), error = vi.fn();
  runInNewContext(source, { process: { argv: ['electron', 'entry', ...args], env: {}, versions }, runGuardedEntry: load, app: { exit }, console: { error } });
  await new Promise(resolve => setImmediate(resolve)); expect(load).not.toHaveBeenCalled(); expect(exit).toHaveBeenCalledExactlyOnceWith(1); expect(error).toHaveBeenCalledWith('cue_qualification_startup_denied');
});
test('entry returns only settled initializer summary and then exits (fixture loader, no actual command)', async () => {
  const source = readFileSync(new URL('../../app/qualification-start.mjs', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '');
  let settle!: (result: unknown) => void; const initialize = vi.fn(() => new Promise(resolve => { settle = resolve; })), guard = {}, exit = vi.fn(), log = vi.fn();
  const load = vi.fn(async () => ({ guard, loaded: { runQualificationApplication: initialize } }));
  runInNewContext(source, { process: { argv: ['electron', 'entry', '--generated-json-qualify'], env: {}, versions }, runGuardedEntry: load, app: { exit }, console: { log, error: vi.fn() } });
  await new Promise(resolve => setImmediate(resolve)); expect(initialize).toHaveBeenCalledWith({ guard }); expect(exit).not.toHaveBeenCalled();
  settle({ exitCode: 3, eligible: false }); await new Promise(resolve => setImmediate(resolve)); expect(exit).toHaveBeenCalledExactlyOnceWith(3); expect(log).toHaveBeenCalledTimes(1);
  expect(JSON.parse(log.mock.calls[0]![0])).toEqual({ exitCode: 3, eligible: false, runtime: { electron: versions.electron, node: versions.node, abi: versions.modules } });
});
test('absent Electron runtime denies explicit command before guard or loader', async () => {
  const source = readFileSync(new URL('../../app/qualification-start.mjs', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '');
  const load = vi.fn(), exit = vi.fn();
  runInNewContext(source, { process: { argv: ['node', 'entry', '--generated-json-qualify'], env: {}, versions: { node: '24.20.0', modules: '149' } }, runGuardedEntry: load, app: { exit }, console: { error: vi.fn() } });
  await new Promise(resolve => setImmediate(resolve)); expect(load).not.toHaveBeenCalled(); expect(exit).toHaveBeenCalledExactlyOnceWith(1);
});
