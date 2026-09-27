import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { open, readFile, mkdir, rename } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { types } from 'node:util';
import { observeProcessTree, terminateVerifiedTree } from '../../daemon/dist/src/process-termination.js';

export const RUN_KEY = '20260916-subscription-live';
export const MAX_SLOTS = 4;
export const MAX_OUTPUT_BYTES = 256 * 1024;
export const MAX_TIMEOUT_MS = 120_000;
const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_LEDGER_ROOT = join(REPOSITORY_ROOT, 'evidence/integrations/S1/20260916-subscription-live/ledger');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();
const plain = value => value && typeof value === 'object' && !Array.isArray(value) && !types.isProxy(value) && Object.getPrototypeOf(value) === Object.prototype;

function requireDataObject(value, fields, label) {
  if (!plain(value)) throw Error(`${label}_object_required`);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).some(key => typeof key !== 'string' || !descriptors[key]?.enumerable || !Object.hasOwn(descriptors[key], 'value'))) throw Error(`${label}_data_fields_required`);
  const keys = Object.keys(descriptors).sort();
  if (JSON.stringify(keys) !== JSON.stringify([...fields].sort())) throw Error(`${label}_fields_invalid`);
  return Object.fromEntries(keys.map(key => [key, descriptors[key].value]));
}

export function validateSpec(input, options = {}) {
  const value = requireDataObject(input, ['argv', 'cwd', 'env', 'executable', 'expectedSha256', 'provider', 'slot', 'stdin', 'timeoutMs'], 'spec');
  if (!['claude', 'codex'].includes(value.provider) && !(options.allowFake === true && value.provider === 'fake')) throw Error('provider_invalid');
  if (!Number.isInteger(value.slot) || value.slot < 1 || value.slot > MAX_SLOTS) throw Error('slot_invalid');
  if (typeof value.executable !== 'string' || !isAbsolute(value.executable) || value.executable.includes('\0')) throw Error('executable_invalid');
  if (typeof value.expectedSha256 !== 'string' || !/^[A-F0-9]{64}$/u.test(value.expectedSha256)) throw Error('expected_sha256_invalid');
  if (!Array.isArray(value.argv) || types.isProxy(value.argv) || value.argv.length > 64) throw Error('argv_invalid');
  const argvDescriptors = Object.getOwnPropertyDescriptors(value.argv);
  if (Object.keys(argvDescriptors).some(key => key !== 'length' && (!/^\d+$/u.test(key) || !argvDescriptors[key].enumerable || !Object.hasOwn(argvDescriptors[key], 'value')))) throw Error('argv_data_fields_required');
  const argv = Array.from({ length: value.argv.length }, (_, index) => argvDescriptors[index]?.value);
  if (argv.some(item => typeof item !== 'string' || item.length > 8_192 || item.includes('\0'))) throw Error('argv_invalid');
  if (typeof value.cwd !== 'string' || !isAbsolute(value.cwd) || value.cwd.includes('\0')) throw Error('cwd_invalid');
  if (!plain(value.env)) throw Error('env_invalid');
  const envDescriptors = Object.getOwnPropertyDescriptors(value.env);
  if (Object.keys(envDescriptors).length > 128 || Reflect.ownKeys(envDescriptors).some(key => typeof key !== 'string' || !envDescriptors[key]?.enumerable || !Object.hasOwn(envDescriptors[key], 'value'))) throw Error('env_data_fields_required');
  const env = Object.fromEntries(Object.keys(envDescriptors).sort().map(key => [key, envDescriptors[key].value]));
  if (Object.entries(env).some(([key, item]) => !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(key) || typeof item !== 'string' || item.length > 32_768 || item.includes('\0'))) throw Error('env_invalid');
  if (value.executable.length > 32_768 || value.cwd.length > 32_768) throw Error('path_too_long');
  if (typeof value.stdin !== 'string' || Buffer.byteLength(value.stdin) > 65_536) throw Error('stdin_invalid');
  if (!Number.isInteger(value.timeoutMs) || value.timeoutMs < 1 || value.timeoutMs > MAX_TIMEOUT_MS) throw Error('timeout_invalid');
  return Object.freeze({ ...value, argv: Object.freeze(argv), env: Object.freeze(env) });
}

function sanitize(text) {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/giu, 'Bearer <redacted>')
    .replace(/\b(?:sk|sess|key)-[A-Za-z0-9_-]{8,}\b/gu, '<redacted>')
    .replace(/("(?:api[_-]?key|authorization|access[_-]?token|refresh[_-]?token)"\s*:\s*")[^"]*(")/giu, '$1<redacted>$2');
}

function projectedJsonLines(provider, stdout, stderr) {
  const rows = [];
  for (const line of `${stdout}\n${stderr}`.split(/\r?\n/u)) {
    if (!line.trim().startsWith('{')) continue;
    try { rows.push(JSON.parse(line)); } catch { /* raw stream evidence remains available */ }
  }
  const found = { usage: null, resultModel: null, resultModelSource: null, sessionId: null, result: null, terminalSuccess: false, toolEvent: false };
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    if (!found.usage && plain(value.usage)) found.usage = value.usage;
    if (!found.resultModel && typeof (value.model ?? value.result_model) === 'string') { found.resultModel = value.model ?? value.result_model; found.resultModelSource = 'provider-event'; }
    if (!found.sessionId && typeof (value.session_id ?? value.sessionId ?? value.thread_id) === 'string') found.sessionId = value.session_id ?? value.sessionId ?? value.thread_id;
    if (found.result === null && Object.hasOwn(value, 'result')) found.result = value.result;
    const eventType = String(value.type ?? value.event ?? '').toLowerCase();
    const itemType = String(value.item?.type ?? '').toLowerCase();
    if (/tool|command_execution|mcp|web_search/u.test(`${eventType} ${itemType}`)) found.toolEvent = true;
    if (provider === 'claude' && eventType === 'result' && value.is_error !== true && value.subtype !== 'error') found.terminalSuccess = true;
    if (provider === 'codex' && eventType === 'turn.completed') found.terminalSuccess = true;
    if (provider === 'fake' && Object.hasOwn(value, 'result')) found.terminalSuccess = true;
    if (found.result === null && itemType === 'agent_message' && typeof value.item?.text === 'string') found.result = value.item.text;
    for (const child of Object.values(value)) if (child && typeof child === 'object') visit(child);
  };
  for (const row of rows) visit(row);
  return JSON.parse(sanitize(JSON.stringify(found)));
}

async function durableJson(path, value, exclusive = false) {
  const data = `${JSON.stringify(value, null, 2)}\n`;
  if (exclusive) {
    const handle = await open(path, 'wx');
    try { await handle.writeFile(data, 'utf8'); await handle.sync(); } finally { await handle.close(); }
    return;
  }
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
  const handle = await open(temp, 'wx');
  try { await handle.writeFile(data, 'utf8'); await handle.sync(); } finally { await handle.close(); }
  await rename(temp, path);
}

async function runChild(spec) {
  const startedAt = new Date().toISOString();
  const started = Date.now();
  let child;
  try {
    child = spawn(spec.executable, spec.argv, { cwd: spec.cwd, env: spec.env, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (error) {
    return { startedAt, completedAt: new Date().toISOString(), latencyMs: Date.now() - started, pid: null, createdAt: null, code: null, signal: null, spawnError: sanitize(String(error)), timedOut: false, overflow: false, terminationVerified: false, stdout: '', stderr: '' };
  }
  let createdAt = null;
  try { createdAt = observeProcessTree(child.pid).descendants.find(row => row.pid === child.pid)?.createdAt ?? null; } catch { /* recorded as unknown */ }
  let stdout = Buffer.alloc(0), stderr = Buffer.alloc(0), captured = 0, overflow = false, timedOut = false, terminationVerified = false, terminationError = null, forced = false;
  const stop = () => {
    if (forced || child.exitCode !== null || child.signalCode !== null) return;
    forced = true;
    try {
      if (!createdAt) throw Error('child_creation_identity_unavailable');
      terminateVerifiedTree(child.pid, createdAt);
      terminationVerified = true;
    } catch (error) { terminationError = sanitize(error instanceof Error ? error.message : String(error)); }
  };
  const add = (current, chunk) => {
    const remaining = MAX_OUTPUT_BYTES - captured;
    if (remaining <= 0) { overflow = true; stop(); return current; }
    const kept = chunk.subarray(0, remaining);
    captured += kept.length;
    if (kept.length < chunk.length) { overflow = true; stop(); }
    return Buffer.concat([current, kept]);
  };
  child.stdout.on('data', chunk => { stdout = add(stdout, chunk); });
  child.stderr.on('data', chunk => { stderr = add(stderr, chunk); });
  child.stdin.on('error', () => {});
  child.stdin.end(spec.stdin);
  const exit = await new Promise(resolvePromise => {
    const timer = setTimeout(() => { timedOut = true; stop(); if (!terminationVerified) { child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy(); child.unref(); } resolvePromise({ code: child.exitCode, signal: child.signalCode }); }, spec.timeoutMs);
    child.once('error', error => { clearTimeout(timer); resolvePromise({ code: null, signal: null, spawnError: sanitize(String(error)) }); });
    child.once('close', (code, signal) => { clearTimeout(timer); resolvePromise({ code, signal }); });
  });
  return { startedAt, completedAt: new Date().toISOString(), latencyMs: Date.now() - started, pid: child.pid, createdAt, ...exit, timedOut, overflow, terminationVerified, terminationError, quiescenceScope: terminationVerified ? 'verified-observed-tree-dead' : child.exitCode !== null || child.signalCode !== null ? 'owned-root-close-only' : 'unverified-retained', stdout: sanitize(stdout.toString('utf8')), stderr: sanitize(stderr.toString('utf8')), stdoutBytes: stdout.length, stderrBytes: stderr.length, stdoutSha256: sha256(stdout), stderrSha256: sha256(stderr) };
}

export async function launchSubscriptionTask(input, options = {}) {
  const spec = validateSpec(input, { allowFake: options.allowFake === true });
  const ledgerRoot = resolve(options.ledgerRoot ?? DEFAULT_LEDGER_ROOT);
  const runDir = join(ledgerRoot, RUN_KEY);
  await mkdir(runDir, { recursive: true });
  const ledgerPath = join(runDir, `slot-${spec.slot}.json`);
  const reservedAt = new Date().toISOString();
  const specDigest = sha256(JSON.stringify({ provider: spec.provider, executable: spec.executable, expectedSha256: spec.expectedSha256, argv: spec.argv, cwd: spec.cwd, env: spec.env, stdin: spec.stdin, timeoutMs: spec.timeoutMs }));
  const reservation = { version: 1, runKey: RUN_KEY, slot: spec.slot, provider: spec.provider, specDigest, status: 'pending', reservedAt };
  try { await durableJson(ledgerPath, reservation, true); }
  catch (error) { if (error?.code === 'EEXIST') throw Error(`slot_already_consumed:${spec.slot}`); throw error; }

  let outcome;
  try {
    const actualSha256 = sha256(await readFile(spec.executable));
    if (actualSha256 !== spec.expectedSha256) throw Error('executable_hash_mismatch');
    const child = await runChild(spec);
    const projection = projectedJsonLines(spec.provider, child.stdout, child.stderr);
    const processCompleted = child.code === 0 && !child.signal && !child.spawnError && !child.timedOut && !child.overflow;
    const streams = { stdoutBytes: child.stdoutBytes, stderrBytes: child.stderrBytes, stdoutSha256: child.stdoutSha256, stderrSha256: child.stderrSha256 };
    Object.defineProperties(streams, { stdout: { value: child.stdout, enumerable: false }, stderr: { value: child.stderr, enumerable: false } });
    outcome = { ...reservation, status: processCompleted ? 'completed' : 'failed-or-unknown', completedAt: new Date().toISOString(), executableIdentity: { path: spec.executable, sha256: actualSha256 }, processIdentity: { pid: child.pid, createdAt: child.createdAt }, latencyMs: child.latencyMs, exit: { code: child.code, signal: child.signal, spawnError: child.spawnError ?? null, timedOut: child.timedOut, overflow: child.overflow, terminationVerified: child.terminationVerified, terminationError: child.terminationError ?? null, quiescenceScope: child.quiescenceScope }, streams, ...projection };
  } catch (error) {
    outcome = { ...reservation, status: 'failed-or-unknown', completedAt: new Date().toISOString(), error: sanitize(error instanceof Error ? error.message : String(error)) };
  }
  await durableJson(ledgerPath, outcome);
  return outcome;
}

export const __test = Object.freeze({ sanitize, projectedJsonLines, runChild });

async function main() {
  const [specPath] = process.argv.slice(2);
  if (!specPath) throw Error('usage: node subscription-live-runner.mjs <reviewed-spec.json>');
  const result = await launchSubscriptionTask(JSON.parse(await readFile(resolve(specPath), 'utf8')));
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.status !== 'completed') process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main().catch(error => { process.stderr.write(`${sanitize(error instanceof Error ? error.message : String(error))}\n`); process.exitCode = 1; });
