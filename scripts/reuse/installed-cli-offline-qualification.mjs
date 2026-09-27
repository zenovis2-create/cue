import { createHash } from 'node:crypto';
import { lstat, mkdtemp, mkdir, readFile, readdir, realpath, rm } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { types } from 'node:util';
import { observeProcessTree, terminateVerifiedTree } from '../../daemon/dist/src/process-termination.js';

const VERSION = 'cue-installed-cli-offline-qualification-v1';
const MAX_OUTPUT = 1_048_576;
const TIMEOUT_MS = 10_000;
const allowed = new Map([
  ['claude:version', ['--version']], ['claude:help', ['--help']],
  ['codex:version', ['--version']], ['codex:help', ['--help']],
  ['codex:app-server-help', ['app-server', '--help']],
]);

const sha256 = value => createHash('sha256').update(value).digest('hex').toUpperCase();
const samePath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;

export function validateRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || types.isProxy(input) || Object.getPrototypeOf(input) !== Object.prototype) throw Error('input_object_required');
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const keys = Reflect.ownKeys(descriptors).sort();
  if (JSON.stringify(keys) !== JSON.stringify(['candidate', 'executable', 'expectedSha256', 'observation', 'signerContains'])) throw Error('input_fields_invalid');
  if (keys.some(key => typeof key !== 'string' || !descriptors[key]?.enumerable || !Object.hasOwn(descriptors[key], 'value'))) throw Error('input_data_fields_required');
  const value = Object.fromEntries(keys.map(key => [key, descriptors[key].value]));
  if (!['claude', 'codex'].includes(value.candidate) || typeof value.observation !== 'string') throw Error('candidate_invalid');
  const args = allowed.get(`${value.candidate}:${value.observation}`);
  if (!args) throw Error('observation_not_allowed');
  if (typeof value.executable !== 'string' || !isAbsolute(value.executable) || value.executable.includes('\0')) throw Error('executable_invalid');
  if (typeof value.expectedSha256 !== 'string' || !/^[A-F0-9]{64}$/u.test(value.expectedSha256) || typeof value.signerContains !== 'string' || !value.signerContains.trim()) throw Error('identity_invalid');
  return Object.freeze({ ...value, args: Object.freeze([...args]) });
}

async function canonicalFile(path) {
  const absolute = resolve(path);
  let cursor = absolute.slice(0, absolute.indexOf(sep) + 1);
  for (const part of absolute.slice(cursor.length).split(sep).filter(Boolean)) {
    cursor = join(cursor, part);
    const stat = await lstat(cursor);
    if (stat.isSymbolicLink() || !samePath(await realpath(cursor), cursor)) throw Error('path_reparse_rejected');
  }
  if (!(await lstat(absolute)).isFile()) throw Error('executable_not_file');
  return absolute;
}

async function measure(path, expectedSha256, signerContains) {
  const bytes = await readFile(path);
  const digest = sha256(bytes);
  if (digest !== expectedSha256) throw Error('executable_hash_mismatch');
  const escaped = path.replaceAll("'", "''");
  const securityModule = String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1`;
  const ps = spawnSync(String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`,
    ['-NoProfile', '-NonInteractive', '-Command', `Import-Module -Name '${securityModule}'; $s=Get-AuthenticodeSignature -LiteralPath '${escaped}'; [pscustomobject]@{Status=$s.Status.ToString();Subject=$s.SignerCertificate.Subject;Thumbprint=$s.SignerCertificate.Thumbprint}|ConvertTo-Json -Compress`],
    { encoding: 'utf8', windowsHide: true, timeout: 5_000, maxBuffer: 16_384 });
  if (ps.status !== 0 || ps.error) throw Error(`signature_measurement_failed:${ps.status}:${ps.error?.code ?? 'no-error'}:${String(ps.stderr ?? '').trim()}`);
  const signature = JSON.parse(ps.stdout);
  if (signature.Status !== 'Valid' || !signature.Subject.includes(signerContains) || !/^[A-F0-9]{40}$/u.test(signature.Thumbprint)) throw Error('signature_invalid');
  return Object.freeze({ sha256: digest, signature });
}

async function inventory(root) {
  const rows = [];
  async function walk(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      rows.push(relative(root, child).split(sep).join('/'));
      if (entry.isDirectory()) await walk(child);
    }
  }
  await walk(root);
  return rows.sort();
}

async function runChild(command, args, cwd, env, limits = {}) {
  const timeoutMs = limits.timeoutMs ?? TIMEOUT_MS, maxOutput = limits.maxOutput ?? MAX_OUTPUT;
  const started = Date.now();
  let child;
  try { child = spawn(command, args, { cwd, env, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] }); }
  catch (error) { return { code: null, signal: null, durationMs: Date.now() - started, timedOut: false, overflow: false, spawnError: String(error), expectedCreatedAt: null, terminationVerified: false, terminationError: null, quiescent: true, quiescenceScope: 'spawn-failed-no-child', stdout: '', stderr: '', stdoutSha256: sha256(Buffer.alloc(0)), stderrSha256: sha256(Buffer.alloc(0)) }; }
  child.stdin.end();
  let stdout = Buffer.alloc(0), stderr = Buffer.alloc(0), overflow = false, timedOut = false;
  let expectedCreatedAt;
  if (Number.isSafeInteger(child.pid) && child.pid > 0) {
    try { expectedCreatedAt = observeProcessTree(child.pid).descendants.find(item => item.pid === child.pid)?.createdAt; } catch { /* a metadata command may already have exited */ }
  }
  let forced = false, terminationVerified = false, terminationError = null;
  const stop = () => {
    if (forced || child.exitCode !== null || child.signalCode !== null) return;
    forced = true;
    try {
      if (!expectedCreatedAt) throw Error('child_creation_identity_unavailable');
      terminateVerifiedTree(child.pid, expectedCreatedAt);
      terminationVerified = true;
    } catch (error) { terminationError = error instanceof Error ? error.message : String(error); }
  };
  const add = (current, chunk) => {
    const next = Buffer.concat([current, chunk]);
    if (next.length > maxOutput) { overflow = true; stop(); return next.subarray(0, maxOutput); }
    return next;
  };
  child.stdout.on('data', chunk => { stdout = add(stdout, chunk); });
  child.stderr.on('data', chunk => { stderr = add(stderr, chunk); });
  const result = await new Promise(resolvePromise => {
    const timer = setTimeout(() => {
      timedOut = true; stop();
      if (!terminationVerified) { child.stdout.destroy(); child.stderr.destroy(); child.stdin.destroy(); child.unref(); }
      resolvePromise({ code: child.exitCode, signal: child.signalCode });
    }, timeoutMs);
    child.once('error', error => { clearTimeout(timer); resolvePromise({ code: null, signal: null, spawnError: String(error) }); });
    child.once('close', (code, signal) => { clearTimeout(timer); resolvePromise({ code, signal }); });
  });
  const quiescent = !timedOut && !overflow ? child.exitCode !== null || child.signalCode !== null : terminationVerified;
  return { ...result, durationMs: Date.now() - started, timedOut, overflow,
    expectedCreatedAt: expectedCreatedAt ?? null, terminationVerified, terminationError, quiescent,
    quiescenceScope: result.spawnError ? 'spawn-failed-no-child' : terminationVerified ? 'verified-observed-tree-dead' : quiescent ? 'owned-root-close-help-version-allowlist' : 'unverified-retained',
    stdout: stdout.toString('utf8'), stderr: stderr.toString('utf8'),
    stdoutSha256: sha256(stdout), stderrSha256: sha256(stderr) };
}

export async function qualify(input) {
  const request = validateRequest(input);
  if (process.platform !== 'win32') throw Error('windows_required');
  const executable = await canonicalFile(request.executable);
  if ((request.candidate === 'claude' && basename(executable).toLowerCase() !== 'claude.exe')
      || (request.candidate === 'codex' && basename(executable).toLowerCase() !== 'codex.exe')) throw Error('executable_name_invalid');
  const pre = await measure(executable, request.expectedSha256, request.signerContains);
  const base = resolve(tmpdir());
  const tempRoot = await mkdtemp(join(base, 'cue-cli-qualification-'));
  if (dirname(tempRoot) !== base || !basename(tempRoot).startsWith('cue-cli-qualification-')) throw Error('temp_root_invalid');
  let cleanupAllowed = false, result;
  try {
    const home = join(tempRoot, 'home'), cwd = join(tempRoot, 'cwd');
    for (const path of [home, cwd, join(home, 'appdata'), join(home, 'localappdata'), join(home, 'tmp'), join(home, 'codex'), join(home, 'claude')]) await mkdir(path, { recursive: true });
    const before = await inventory(tempRoot);
    const env = {
      SystemRoot: process.env.SystemRoot ?? 'C:\\Windows', WINDIR: process.env.WINDIR ?? 'C:\\Windows',
      HOME: home, USERPROFILE: home, APPDATA: join(home, 'appdata'), LOCALAPPDATA: join(home, 'localappdata'),
      TEMP: join(home, 'tmp'), TMP: join(home, 'tmp'), CODEX_HOME: join(home, 'codex'), CLAUDE_CONFIG_DIR: join(home, 'claude'),
      DISABLE_AUTOUPDATER: '1', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1', CODEX_DISABLE_UPDATE_CHECK: '1', NO_COLOR: '1',
    };
    const child = await runChild(executable, request.args, cwd, env);
    cleanupAllowed = child.quiescent;
    const post = await measure(executable, request.expectedSha256, request.signerContains);
    const after = await inventory(tempRoot);
    const passed = child.code === 0 && !child.signal && !child.timedOut && !child.overflow && pre.sha256 === post.sha256;
    result = { version: VERSION, candidate: request.candidate, observation: request.observation, executable, args: request.args,
      expectedSha256: request.expectedSha256, signerContains: request.signerContains, pre, post, profileRoot: '<unique-system-temp>/home',
      profileInventoryBefore: before, profileInventoryAfter: after, child, passed };
  } finally {
    if (cleanupAllowed) await rm(tempRoot, { recursive: true, force: false });
  }
  return { ...result, cleanupSucceeded: cleanupAllowed, retainedTempRoot: cleanupAllowed ? null : tempRoot };
}

export const __test = Object.freeze({ runChild });

async function main() {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath || !outputPath) throw Error('usage: runner input.json output.json');
  const input = JSON.parse(await readFile(resolve(inputPath), 'utf8'));
  const result = await qualify(input);
  const { writeFile } = await import('node:fs/promises');
  await writeFile(resolve(outputPath), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  if (!result.passed) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
