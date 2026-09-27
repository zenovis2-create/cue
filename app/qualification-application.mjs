import { app } from 'electron';
import { lstatSync, openSync, fstatSync, readSync, closeSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { AppDaemon, validatePersistedConfig } from './core.mjs';
import { isInstallationGeneration } from './installation-identity.mjs';
import { discoverGeneratedJsonInstallation } from './protected-installation.mjs';
import { createGeneratedJsonQualification } from './qualify-generated-json.mjs';

let attempted = false;
function readExistingConfig(userData) {
  const directory = resolve(userData), path = join(directory, 'cue-config.json');
  const base = lstatSync(directory), before = lstatSync(path);
  if (!base.isDirectory() || base.isSymbolicLink() || realpathSync(directory) !== directory
    || !before.isFile() || before.isSymbolicLink() || before.size < 1 || before.size > 32768) throw Error('qualification_config_unavailable');
  const fd = openSync(path, 'r'); let bytes;
  try {
    const opened = fstatSync(fd);
    if (opened.dev !== before.dev || opened.ino !== before.ino) throw Error('qualification_config_drift');
    bytes = Buffer.alloc(32769); let count = 0;
    while (count < bytes.length) { const n = readSync(fd, bytes, count, bytes.length - count, null); if (!n) break; count += n; }
    const after = fstatSync(fd), current = lstatSync(path);
    if (count !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs
      || current.isSymbolicLink() || current.dev !== before.dev || current.ino !== before.ino) throw Error('qualification_config_drift');
    bytes = bytes.subarray(0, count);
  } finally { closeSync(fd); }
  return validatePersistedConfig(directory, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
}

/** Explicit fresh-entry operation only. Imports define functions; no measurement
 * starts before guarded-entry's post-import assertion and this initializer.
 * Exit codes: 0 qualified/clean, 1 startup failure, 2 incomplete, 3 cleanup unknown,
 * 130 aborted with confirmed cleanup. The caller exits only after this resolves. */
export async function runQualificationApplication({ guard }) {
  if (attempted) throw Error('qualification_startup_already_attempted');
  attempted = true;
  if (!isInstallationGeneration(guard)) throw Error('qualification_generation_invalid');
  guard.assertCurrent();
  const controller = new AbortController();
  const abort = () => controller.abort();
  const stopQuit = event => { event.preventDefault(); abort(); };
  process.on('SIGINT', abort); app.on('before-quit', stopQuit);
  let daemon, result, closeFailed = false, failed = false;
  try {
    await app.whenReady(); controller.signal.throwIfAborted(); guard.assertCurrent();
    const config = readExistingConfig(process.env.CUE_USER_DATA || app.getPath('userData'));
    guard.assertCurrent();
    daemon = new AppDaemon(config);
    const installation = discoverGeneratedJsonInstallation(guard);
    guard.assertCurrent(); controller.signal.throwIfAborted();
    const operation = createGeneratedJsonQualification({ daemon, config, installation, generation: guard });
    result = await operation.collect({ signal: controller.signal });
  } catch { failed = true; }
  finally {
    // Never close concurrently with collect: it has settled before entering here.
    try { await daemon?.close(); } catch { closeFailed = true; }
    process.removeListener('SIGINT', abort); app.removeListener('before-quit', stopQuit);
  }
  const cleanupConfirmed = !closeFailed && (!daemon || result?.allClean === true);
  const exitCode = !cleanupConfirmed ? 3 : controller.signal.aborted ? 130 : failed ? 1 : result?.eligible === true && !result.failure ? 0 : 2;
  return Object.freeze({ version: 'cue-qualification-exit-v1', exitCode, eligible: exitCode === 0,
    cleanup: cleanupConfirmed ? 'confirmed' : 'unknown', aborted: controller.signal.aborted, restartRequired: true });
}
