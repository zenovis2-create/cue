import { types } from 'node:util';
import { realpathSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { AppDaemon } from './core.mjs';
import { isInstallationGeneration } from './installation-identity.mjs';
import { createModelQualification, measureModelDiagnosticBundle } from '../daemon/dist/src/model-qualification.js';
import { measureModelControlBundle } from '../daemon/dist/src/model-control-bundle.js';

const operations = new WeakMap();
const fail = code => { throw Error('generated-qualification-' + code); };
function record(value, keys) {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) fail('input');
  const d = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(d).length !== keys.length || keys.some(k => !d[k]?.enumerable || !Object.hasOwn(d[k], 'value'))) fail('input');
  return Object.fromEntries(keys.map(k => [k, d[k].value]));
}
const same = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
function path(value) {
  if (typeof value !== 'string' || value.length > 32768 || !isAbsolute(value) || value.includes('\0')) fail('path');
  return value;
}

/** Protected explicit operation; never startup fallback or renderer authority.
 * Entry must pass its authentic pre-import generation in the same fresh process.
 * The caller owns AppDaemon and MUST await collect before closing it in finally.
 * Collector owns native cleanup; unknown cleanup remains unknown. No retry/reset.
 * One model production request at most; diagnostic requests are local probes.
 */
export function createGeneratedJsonQualification(input) {
  const { daemon, config: rawConfig, installation: rawInstall, generation } = record(input, ['daemon', 'config', 'installation', 'generation']);
  if (!(daemon instanceof AppDaemon) || types.isProxy(daemon) || !isInstallationGeneration(generation)) fail('authority');
  const config = Object.freeze(record(rawConfig, ['version', 'ledgerPath', 'worktreeRoot']));
  if (config.version !== 1) fail('config');
  path(config.ledgerPath); path(config.worktreeRoot);
  const install = record(rawInstall, ['measurement', 'controlRoot', 'taskRootBase', 'profileRootBase', 'loadedHost']);
  const measurement = Object.freeze(record(install.measurement, ['installRoot', 'nodeExecutable', 'powershellExecutable', 'sqliteNativePath', 'dependencyRoot']));
  const loadedHost = Object.freeze(record(install.loadedHost, ['executable', 'runtime', 'version']));
  for (const value of [...Object.values(measurement), install.controlRoot, install.taskRootBase, install.profileRootBase, loadedHost.executable]) path(value);
  const installation = Object.freeze({ ...install, measurement, loadedHost });
  const db = daemon.db, signature = JSON.stringify({ config, installation, generationDigest: generation.digest });
  function current() {
    if (!db.open || daemon.db !== db || daemon.status !== 'ready' || db.inTransaction) fail('daemon-unavailable');
    // The collector invokes this guard in its own issuance transaction too.
    return sourceCurrent();
  }
  function sourceCurrent() {
    if (!db.open || daemon.db !== db || daemon.status !== 'ready') fail('daemon-unavailable');
    if (!same(realpathSync(db.name), realpathSync(config.ledgerPath))) fail('ledger-mismatch');
    if (!same(realpathSync(measurement.installRoot), generation.snapshot.root)
      || !same(realpathSync(measurement.dependencyRoot), generation.snapshot.dependencyRoot)
      || !same(realpathSync(install.controlRoot), realpathSync(join(measurement.installRoot, 'daemon', 'dist', 'src')))
      || !same(realpathSync(loadedHost.executable), realpathSync(process.execPath))
      || loadedHost.runtime !== (process.versions.electron ? 'electron' : 'node')
      || loadedHost.version !== (process.versions.electron ?? process.versions.node)) fail('installation-mismatch');
    const result = generation.assertCurrent();
    if (result instanceof Promise) void result.catch(() => {});
    if (result !== true) fail('generation-unverified');
    return true;
  }
  current();
  const previous = operations.get(daemon);
  if (previous) {
    if (previous.signature !== signature || previous.generation !== generation) fail('operation-conflict');
    return previous.operation;
  }
  let pending;
  const operation = Object.freeze({
    collect(options = {}) {
      if (!options || typeof options !== 'object' || types.isProxy(options) || Object.getPrototypeOf(options) !== Object.prototype) fail('input');
      const descriptors = record(options, Object.hasOwn(options, 'signal') ? ['signal'] : []);
      if (descriptors.signal !== undefined && !(descriptors.signal instanceof AbortSignal)) fail('signal');
      if (pending) return pending;
      const signal = descriptors.signal;
      pending = Promise.resolve().then(async () => {
        const results = {};
        let failure = null, unresolvedCleanup = false;
        try {
          for (const kind of ['json-checker', 'model']) {
            signal?.throwIfAborted(); current();
            const controlBundle = measureModelControlBundle({ controlRoot: install.controlRoot, nodeExecutable: measurement.nodeExecutable, clientKind: kind });
            const diagnosticBundle = measureModelDiagnosticBundle(install.controlRoot, controlBundle);
            current();
            const collector = createModelQualification({ db, measurement: Object.freeze({ ...measurement, kind }), controlBundle, diagnosticBundle,
              assertInstallationCurrent: sourceCurrent });
            const result = await collector.collect({ signal });
            results[kind] = result;
            signal?.throwIfAborted(); current();
            if (result.kind !== 'live' || !result.eligible || !result.allClean || result.failure) { failure = 'qualification-incomplete'; break; }
          }
        } catch { unresolvedCleanup = true; failure = signal?.aborted ? 'qualification-aborted' : 'qualification-unresolved'; }
        const allClean = !unresolvedCleanup && Object.keys(results).length > 0 && Object.values(results).every(result => result.allClean === true);
        return Object.freeze({ version: 'cue-generated-qualification-operation-v1', generationDigest: generation.digest,
          results: Object.freeze(results), eligible: failure === null && !!results.model, allClean, failure,
          restartRequired: true, daemonCloseRequired: true });
      });
      return pending;
    },
  });
  operations.set(daemon, { signature, generation, operation });
  return operation;
}
