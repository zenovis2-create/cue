import { createHash } from 'node:crypto';
import { closeSync, fstatSync, lstatSync, openSync, readSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { isAbsolute, join, parse, resolve, sep } from 'node:path';
import { types } from 'node:util';

const MAX_EXECUTABLE_BYTES = 536870912;
const MAX_MANIFEST_BYTES = 65536;
const issued = new WeakMap();
const samePath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
function fail() { throw Error('provider_installation_unavailable_or_drifted'); }
function plain(value, keys) {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) fail();
  const own = Reflect.ownKeys(value);
  if (own.length !== keys.length || keys.some(key => !own.includes(key))) fail();
  for (const key of own) { const descriptor = Object.getOwnPropertyDescriptor(value, key); if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) fail(); }
}
function canonicalFile(path) {
  if (typeof path !== 'string' || path.length < 3 || path.length > 32768 || path.includes('\0') || !isAbsolute(path)) fail();
  const absolute = resolve(path); let cursor = parse(absolute).root;
  for (const part of absolute.slice(cursor.length).split(sep).filter(Boolean)) {
    cursor = join(cursor, part); const stat = lstatSync(cursor);
    if (stat.isSymbolicLink() || !samePath(realpathSync(cursor), cursor)) fail();
  }
  const stat = lstatSync(absolute); if (!stat.isFile() || stat.isSymbolicLink()) fail();
  return absolute;
}
function identity(stat) { return { dev: String(stat.dev), ino: String(stat.ino), size: stat.size, mtimeMs: stat.mtimeMs, ctimeMs: stat.ctimeMs }; }
function sameIdentity(a, b) { return JSON.stringify(identity(a)) === JSON.stringify(identity(b)); }
function hashFile(path, maximum) {
  const before = lstatSync(path); if (!before.isFile() || before.isSymbolicLink() || !Number.isSafeInteger(before.size) || before.size < 1 || before.size > maximum) fail();
  const fd = openSync(path, 'r');
  try {
    const opened = fstatSync(fd); if (!opened.isFile() || !sameIdentity(opened, before)) fail();
    const hash = createHash('sha256'), buffer = Buffer.alloc(1048576); let length = 0;
    for (;;) { const count = readSync(fd, buffer, 0, Math.min(buffer.length, before.size - length + 1), null); if (!count) break; length += count; if (length > before.size) fail(); hash.update(buffer.subarray(0, count)); }
    const after = fstatSync(fd), current = lstatSync(path);
    if (length !== before.size || !sameIdentity(after, before) || !sameIdentity(current, before) || current.isSymbolicLink()) fail();
    return { sha256: hash.digest('hex'), ...identity(before) };
  } finally { closeSync(fd); }
}
function readBounded(path, expected) {
  const before = lstatSync(path); if (!before.isFile() || before.isSymbolicLink() || before.size < 1 || before.size > MAX_MANIFEST_BYTES) fail();
  const fd = openSync(path, 'r');
  try {
    if (!sameIdentity(fstatSync(fd), before)) fail(); const bytes = Buffer.alloc(before.size); let length = 0;
    while (length < bytes.length) { const count = readSync(fd, bytes, length, bytes.length - length, null); if (!count) fail(); length += count; }
    const after = fstatSync(fd), current = lstatSync(path), sha256 = createHash('sha256').update(bytes).digest('hex');
    if (!sameIdentity(after, before) || !sameIdentity(current, before) || current.isSymbolicLink() || sha256 !== expected) fail();
    return { bytes, measured: { sha256, ...identity(before) } };
  } finally { closeSync(fd); }
}
function signature(path) {
  if (process.platform !== 'win32') fail();
  const powershell = canonicalFile('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
  const script = "Import-Module -Name 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules\\Microsoft.PowerShell.Security\\Microsoft.PowerShell.Security.psd1';$p=[Environment]::GetEnvironmentVariable('CUE_PROVIDER_INSTALLATION_PATH');$i=Get-Item -LiteralPath $p -Force;$s=Get-AuthenticodeSignature -LiteralPath $p;@{path=$i.FullName;fileVersion=$i.VersionInfo.FileVersion;status=[string]$s.Status;signer=$s.SignerCertificate.GetNameInfo([System.Security.Cryptography.X509Certificates.X509NameType]::SimpleName,$false);thumbprint=$s.SignerCertificate.Thumbprint}|ConvertTo-Json -Compress";
  const result = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', windowsHide: true, timeout: 10000, maxBuffer: 16384, shell: false, env: { ...process.env, CUE_PROVIDER_INSTALLATION_PATH: path } });
  if (result.status !== 0 || result.error || Buffer.byteLength(result.stdout ?? '') > 16384) fail();
  try { const value = JSON.parse(result.stdout); plain(value, ['path', 'fileVersion', 'status', 'signer', 'thumbprint']); return value; } catch { fail(); }
}
function validateInput(input) {
  plain(input, ['provider', 'executablePath', 'expectedSha256', 'expectedSigner', 'version', 'authProfilePaths']);
  if (input.provider !== 'claude' && input.provider !== 'codex') fail();
  if (typeof input.executablePath !== 'string' || typeof input.expectedSha256 !== 'string' || !/^[a-fA-F0-9]{64}$/.test(input.expectedSha256)) fail();
  plain(input.expectedSigner, ['subject', 'thumbprint']);
  if (typeof input.expectedSigner.subject !== 'string' || input.expectedSigner.subject.length < 1 || input.expectedSigner.subject.length > 256 || typeof input.expectedSigner.thumbprint !== 'string' || !/^[a-fA-F0-9]{40}$/.test(input.expectedSigner.thumbprint)) fail();
  if (!input.version || typeof input.version !== 'object' || types.isProxy(input.version) || Object.getPrototypeOf(input.version) !== Object.prototype) fail();
  const kindDescriptor = Object.getOwnPropertyDescriptor(input.version, 'kind'); if (!kindDescriptor || !Object.hasOwn(kindDescriptor, 'value')) fail();
  const kind = kindDescriptor.value; plain(input.version, kind === 'pe-file' ? ['kind', 'value'] : ['kind', 'value', 'manifestPath', 'expectedManifestSha256', 'packageName']);
  if (typeof input.version.value !== 'string' || input.version.value.length < 1 || input.version.value.length > 128) fail();
  if (kind === 'package') {
    if (typeof input.version.packageName !== 'string' || typeof input.version.manifestPath !== 'string' || typeof input.version.expectedManifestSha256 !== 'string' || !/^[a-fA-F0-9]{64}$/.test(input.version.expectedManifestSha256)) fail();
  } else if (kind !== 'pe-file') fail();
  const profiles = input.authProfilePaths;
  if (!Array.isArray(profiles) || types.isProxy(profiles) || Object.getPrototypeOf(profiles) !== Array.prototype || profiles.length < 1 || profiles.length > 4) fail();
  const profileKeys = Reflect.ownKeys(profiles); if (profileKeys.length !== profiles.length + 1 || !profileKeys.includes('length')) fail();
  for (let index = 0; index < profiles.length; index++) { const descriptor = Object.getOwnPropertyDescriptor(profiles, String(index)); if (!descriptor || !Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'string') fail(); }
}
function freeze(value) { if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; }
function measure(input) {
  const executablePath = canonicalFile(input.executablePath), executable = hashFile(executablePath, MAX_EXECUTABLE_BYTES);
  if (executable.sha256.toUpperCase() !== input.expectedSha256.toUpperCase()) fail();
  const signed = signature(executablePath);
  if (!samePath(signed.path, executablePath) || signed.status !== 'Valid' || signed.signer !== input.expectedSigner.subject || String(signed.thumbprint).toUpperCase() !== input.expectedSigner.thumbprint.toUpperCase()) fail();
  const afterSignature = hashFile(canonicalFile(executablePath), MAX_EXECUTABLE_BYTES);
  if (JSON.stringify(afterSignature) !== JSON.stringify(executable)) fail();
  let version;
  if (input.version.kind === 'pe-file') { if (signed.fileVersion !== input.version.value) fail(); version = { kind: 'pe-file', value: signed.fileVersion }; }
  else {
    const manifestPath = canonicalFile(input.version.manifestPath), { bytes, measured } = readBounded(manifestPath, input.version.expectedManifestSha256.toLowerCase());
    let manifest; try { manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { fail(); }
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest) || manifest.name !== input.version.packageName || manifest.version !== input.version.value) fail();
    version = { kind: 'package', value: manifest.version, packageName: manifest.name, manifestPath, manifestSha256: measured.sha256 };
  }
  const authProfiles = input.authProfilePaths.map(path => { const canonical = canonicalFile(path), stat = lstatSync(canonical); return { path: canonical, ...identity(stat) }; });
  return freeze({ provider: input.provider, executablePath, executable: { ...executable, signerSubject: signed.signer, signerThumbprint: String(signed.thumbprint).toUpperCase() }, version, authProfiles, status: 'unqualified', authenticated: false, entitled: false, qualified: false });
}

/** Identifies exact trusted provider bytes and opaque auth-file references. It
 * neither runs provider bytes nor reads auth-file contents. Identification is
 * not authentication, entitlement, protocol qualification, or launch authority. */
export function identifyProviderInstallation(input) {
  try { validateInput(input); const expected = freeze(structuredClone(input)), descriptor = measure(expected); issued.set(descriptor, expected); return descriptor; } catch { fail(); }
}
/** Re-measures an issued descriptor. This is a pre-use drift check, not an
 * atomic anti-TOCTOU guarantee for a later process launch. */
export function assertCurrentProviderInstallation(value) {
  try { const expected = issued.get(value); if (!expected || JSON.stringify(measure(expected)) !== JSON.stringify(value)) fail(); return true; } catch { fail(); }
}
