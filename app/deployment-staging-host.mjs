import { lstatSync, realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { types } from 'node:util';
import { createGitStagingHost } from '../daemon/dist/src/orchestration/git-staging-factory.js';

const VERSION = 'cue-git-staging-deployment-v1';
const unavailable = reason => () => Object.freeze({ available: false, reasons: Object.freeze([reason]) });
const plain = value => typeof value === 'string' && value.length > 0 && value.length <= 32768 && !/[\0\r\n]/u.test(value);
const same = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
const contains = (root, candidate) => { const part = relative(root, candidate); return part === '' || (!isAbsolute(part) && part.split(/[\\/]/u)[0] !== '..'); };

function exactObject(value, keys) {
  return value && typeof value === 'object' && !types.isProxy(value) && Object.getPrototypeOf(value) === Object.prototype
    && Reflect.ownKeys(value).sort().join(',') === [...keys].sort().join(',');
}

function canonicalExisting(path, directory) {
  if (!plain(path) || !isAbsolute(path) || !same(resolve(path), path)) throw Error('deployment-staging-path-invalid');
  const exact = realpathSync.native(path), stat = lstatSync(path);
  if (!same(exact, path) || stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile())) throw Error('deployment-staging-path-untrusted');
  return exact;
}

export function parseDeploymentStagingConfiguration(raw) {
  if (raw === undefined || raw === '') return Object.freeze({ enabled: false, configured: false });
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > 65536 || raw.includes('\0')) throw Error('deployment-staging-config-invalid');
  let value;
  try { value = JSON.parse(raw); } catch { throw Error('deployment-staging-config-invalid'); }
  if (exactObject(value, ['version', 'enabled']) && value.version === VERSION && value.enabled === false) return Object.freeze({ enabled: false, configured: true });
  const keys = value?.gitExecutable === undefined ? ['version', 'enabled', 'storageRoot'] : ['version', 'enabled', 'storageRoot', 'gitExecutable'];
  if (!exactObject(value, keys) || value.version !== VERSION || value.enabled !== true || !plain(value.storageRoot)) throw Error('deployment-staging-config-invalid');
  const parent = canonicalExisting(dirname(value.storageRoot), true);
  if (!same(resolve(parent, basename(value.storageRoot)), value.storageRoot)) throw Error('deployment-staging-path-invalid');
  let storageRoot = value.storageRoot;
  try { storageRoot = canonicalExisting(value.storageRoot, true); } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    if (!same(dirname(value.storageRoot), parent)) throw Error('deployment-staging-path-untrusted');
  }
  const gitExecutable = value.gitExecutable === undefined ? undefined : canonicalExisting(value.gitExecutable, false);
  return Object.freeze({ enabled: true, configured: true, storageRoot, ...(gitExecutable ? { gitExecutable } : {}) });
}

export async function createDeploymentStagingOrchestrationFactory(options) {
  let configuration;
  try { configuration = parseDeploymentStagingConfiguration(options.configuration); }
  catch { return unavailable('deployment-staging-config-invalid'); }
  if (!configuration.enabled) return options.createOrchestrationFactory();
  const baseFactory = await options.createOrchestrationFactory();
  return context => {
    if (!context || !plain(context.worktree) || !isAbsolute(context.worktree)) return Object.freeze({ available: false, reasons: Object.freeze(['deployment-staging-worktree-invalid']) });
    let worktree;
    try { worktree = canonicalExisting(context.worktree, true); }
    catch { return Object.freeze({ available: false, reasons: Object.freeze(['deployment-staging-worktree-untrusted']) }); }
    if (contains(worktree, configuration.storageRoot) || contains(configuration.storageRoot, worktree)) return Object.freeze({ available: false, reasons: Object.freeze(['deployment-staging-storage-overlap']) });
    const readiness = baseFactory(context);
    if (readiness?.available === false) return readiness;
    if (!readiness || readiness.executionStagingSupport !== 'git-worktree-v1') return Object.freeze({ available: false, reasons: Object.freeze(['deployment-staging-adapter-unsupported']) });
    let executionStaging;
    try { executionStaging = (options.createStagingHost ?? createGitStagingHost)({ storageRoot: configuration.storageRoot, ...(configuration.gitExecutable ? { gitExecutable: configuration.gitExecutable } : {}) }); }
    catch { return Object.freeze({ available: false, reasons: Object.freeze(['deployment-staging-factory-unavailable']) }); }
    return Object.freeze({ ...readiness, executionStaging });
  };
}
