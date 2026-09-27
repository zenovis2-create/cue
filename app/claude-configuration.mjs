import { lstatSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { types } from 'node:util';
import { assertCurrentProviderInstallation } from './provider-installation.mjs';

const issued = new WeakMap();
const ENV_KEYS = ['SystemRoot', 'WINDIR', 'USERPROFILE', 'HOME', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'CLAUDE_CONFIG_DIR'];
const fail = () => { throw Error('claude_configuration_unavailable'); };
const samePath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
function exact(value, keys) {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) fail();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length !== keys.length) fail();
  const copy = {};
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) fail();
    copy[key] = descriptor.value;
  }
  return copy;
}
function text(value, max = 4096) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f]/u.test(value)) fail();
  return value;
}
function digest(value) { if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) fail(); return value; }
function time(value) { if (!Number.isSafeInteger(value) || value < 0) fail(); return value; }
function requestSnapshot(input) {
  const f = exact(input, ['attemptId', 'candidateId', 'subjectDigest', 'accountIdentity', 'model', 'worktreePath']);
  const account = exact(f.accountIdentity, ['reference', 'digest']);
  return Object.freeze({ attemptId: text(f.attemptId, 200), candidateId: text(f.candidateId, 200), subjectDigest: digest(f.subjectDigest),
    accountIdentity: Object.freeze({ reference: text(account.reference, 200), digest: digest(account.digest) }),
    model: text(f.model, 128), worktreePath: text(f.worktreePath) });
}
function canonicalPath(input, directory) {
  const path = text(input);
  if (!isAbsolute(path) || !samePath(resolve(path), path)) fail();
  let cursor = parse(path).root;
  for (const part of ['', ...path.slice(cursor.length).split(sep).filter(Boolean)]) {
    if (part) cursor = join(cursor, part);
    const stat = lstatSync(cursor);
    if (stat.isSymbolicLink() || !samePath(realpathSync.native(cursor), cursor)) fail();
  }
  const stat = lstatSync(path);
  if (directory ? !stat.isDirectory() : !stat.isFile()) fail();
  return { path, dev: String(stat.dev), ino: String(stat.ino),
    ...(!directory ? { size: stat.size, mtimeMs: stat.mtimeMs, ctimeMs: stat.ctimeMs } : {}) };
}
function within(root, path) {
  const suffix = relative(root, path);
  return !isAbsolute(suffix) && suffix !== '..' && !suffix.startsWith('..' + sep);
}
function layout(environment, authProfilePath, worktreePath) {
  const directories = ENV_KEYS.map(key => canonicalPath(environment[key], true));
  const home = environment.USERPROFILE;
  if (samePath(home, resolve(homedir())) || !samePath(home, environment.HOME)
    || !samePath(environment.TEMP, environment.TMP) || !samePath(environment.SystemRoot, environment.WINDIR)) fail();
  for (const key of ['APPDATA', 'LOCALAPPDATA', 'TEMP', 'CLAUDE_CONFIG_DIR']) {
    if (samePath(home, environment[key]) || !within(home, environment[key])) fail();
  }
  const worktree = canonicalPath(worktreePath, true);
  if (within(home, worktreePath) || within(worktreePath, home)
    || within(environment.SystemRoot, home) || within(home, environment.SystemRoot)
    || within(worktreePath, environment.SystemRoot) || within(environment.SystemRoot, worktreePath)) fail();
  const profile = canonicalPath(authProfilePath, false);
  if (!within(home, profile.path)) fail();
  return JSON.stringify({ directories, profile, worktree });
}
function current(installation) {
  assertCurrentProviderInstallation(installation);
  if (installation.provider !== 'claude' || installation.version.value !== '2.1.274') fail();
}
function fresh(record) {
  current(record.installation);
  if (layout(record.environment, record.authProfilePath, record.request.worktreePath) !== record.layout) fail();
  const now = time(record.now());
  if (now < record.observedAtMs || now >= record.validUntilMs || now - record.observedAtMs > record.maxAgeMs) fail();
}

/** Host-only adapter for an explicitly authorized existing session. The callback
 * must establish CLI-specific session/profile semantics; metadata cannot do so.
 * No default resolver, ambient login fallback, credential I/O or qualification. */
export function createClaudeConfigurationResolver(input) {
  const host = exact(input, ['installation', 'now', 'maxAgeMs', 'resolveAuthorizedSession']);
  if (typeof host.now !== 'function' || typeof host.resolveAuthorizedSession !== 'function'
    || !Number.isSafeInteger(host.maxAgeMs) || host.maxAgeMs < 1 || host.maxAgeMs > 86400000) fail();
  const attempts = new Set();
  return async rawRequest => {
    try {
      const request = requestSnapshot(rawRequest);
      current(host.installation);
      // A resolver instance cannot issue concurrent or replacement bindings for
      // an attempt. Restart/attempt ownership remains the durable driver's job.
      if (attempts.has(request.attemptId)) fail();
      attempts.add(request.attemptId);
      const returned = host.resolveAuthorizedSession(request);
      // Only a real host Promise may be awaited; a plain session's `then`
      // accessor (or a Proxy trap) must not execute before shape validation.
      const raw = types.isPromise(returned) ? await returned : returned;
      if (raw === null) return null;
      const session = exact(raw, ['request', 'authProfilePath', 'environment', 'observedAtMs', 'validUntilMs']);
      if (JSON.stringify(requestSnapshot(session.request)) !== JSON.stringify(request)) fail();
      const environment = Object.freeze(exact(session.environment, ENV_KEYS));
      for (const key of ENV_KEYS) text(environment[key]);
      const authProfilePath = text(session.authProfilePath);
      if (!host.installation.authProfiles.some(profile => samePath(profile.path, authProfilePath))) fail();
      const observedAtMs = time(session.observedAtMs), validUntilMs = time(session.validUntilMs);
      if (validUntilMs <= observedAtMs || validUntilMs - observedAtMs > host.maxAgeMs) fail();
      const record = { installation: host.installation, request, environment, authProfilePath,
        observedAtMs, validUntilMs, now: host.now, maxAgeMs: host.maxAgeMs,
        layout: layout(environment, authProfilePath, request.worktreePath) };
      fresh(record);
      // Nothing serializable carries the environment or grants execution.
      const binding = Object.freeze({ version: 'cue-claude-configuration-v1' });
      issued.set(binding, record);
      return binding;
    } catch { fail(); }
  };
}

/** Consume immediately before spawn. Identity/freshness is rechecked after any
 * async resolver work; a cloned, foreign or previously consumed object fails. */
export function consumeClaudeConfiguration(binding, rawRequest, installation) {
  try {
    if (!binding || typeof binding !== 'object' || types.isProxy(binding)) fail();
    const record = issued.get(binding);
    if (!record) fail();
    // Failed consumption is final too; no retry can repurpose this capability.
    issued.delete(binding);
    if (record.installation !== installation || JSON.stringify(requestSnapshot(rawRequest)) !== JSON.stringify(record.request)) fail();
    fresh(record);
    return record.environment;
  } catch { fail(); }
}
