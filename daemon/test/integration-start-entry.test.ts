import { afterEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
afterEach(() => vi.restoreAllMocks());
test('legacy live environment rejects before protected loader, initialization or inference', async () => {
  const source = readFileSync(new URL('../../app/start.mjs', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '');
  const load = vi.fn(), exit = vi.fn(), errorBox = vi.fn(), errors = vi.fn();
  runInNewContext(source, { process: { env: { CUE_LIVE_RUN: '1' } }, runGuardedEntry: load,
    app: { exit }, dialog: { showErrorBox: errorBox }, console: { error: errors } });
  await new Promise(resolve => setImmediate(resolve));
  expect(load).not.toHaveBeenCalled(); expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  expect(errorBox).toHaveBeenCalledExactlyOnceWith('Cue 시작 실패', 'cue_legacy_live_startup_denied');
  expect(errors).toHaveBeenCalledTimes(1);
});
