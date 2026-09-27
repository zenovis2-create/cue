import { afterEach, expect, test, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
const signatureMock = vi.hoisted(() => ({ value: null as null | { path: string; fileVersion: string | null; signer: string; thumbprint: string } }));
vi.mock('node:child_process', async importOriginal => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return { ...actual, spawnSync: (...args: Parameters<typeof actual.spawnSync>) => signatureMock.value
    ? { status: 0, error: undefined, stdout: JSON.stringify({ ...signatureMock.value, status: 'Valid' }), stderr: '' }
    : actual.spawnSync(...args) };
});
import { identifyProviderInstallation, assertCurrentProviderInstallation } from '../../app/provider-installation.mjs';

const roots: string[] = [];
afterEach(() => { signatureMock.value = null; for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'cue-provider-fixture-')); roots.push(root);
  const executablePath = join(root, 'provider.exe'), profilePath = join(root, 'auth.opaque');
  writeFileSync(executablePath, 'reviewed provider fixture bytes'); writeFileSync(profilePath, 'credential contents must not be read');
  signatureMock.value = { path: resolve(executablePath), fileVersion: '1.2.3.4', signer: 'Fixture Vendor', thumbprint: 'A'.repeat(40) };
  const input = { provider: 'claude' as const, executablePath, expectedSha256: createHash('sha256').update('reviewed provider fixture bytes').digest('hex'),
    expectedSigner: { subject: 'Fixture Vendor', thumbprint: 'A'.repeat(40) }, version: { kind: 'pe-file' as const, value: '1.2.3.4' }, authProfilePaths: [profilePath] };
  return { root, executablePath, profilePath, input };
}

const claude = {
  provider: 'claude', executablePath: 'C:\\Users\\User\\.local\\bin\\claude.exe',
  expectedSha256: 'FD7F35EC7761195AB5BA4EFF423E48A78A7849E78F60D93EC31256CDB1A9EC7E',
  expectedSigner: { subject: 'Anthropic, PBC', thumbprint: '0D7581D2C51C59DF686C3000C70BF543F9F6C6CB' },
  version: { kind: 'pe-file', value: '2.1.270.0' },
  authProfilePaths: ['C:\\Users\\User\\.claude.json', 'C:\\Users\\User\\.claude\\settings.json'],
} as const;

test('returns a branded frozen unqualified identity and rejects later executable or opaque-profile drift', () => {
  const first = fixture(), descriptor = identifyProviderInstallation(first.input);
  expect(descriptor).toMatchObject({ provider: 'claude', status: 'unqualified', authenticated: false, entitled: false, qualified: false,
    executable: { sha256: first.input.expectedSha256, signerSubject: 'Fixture Vendor' }, version: { kind: 'pe-file', value: '1.2.3.4' } });
  expect(Object.isFrozen(descriptor)).toBe(true); expect(assertCurrentProviderInstallation(descriptor)).toBe(true);
  writeFileSync(first.executablePath, 'substituted provider fixture bytes'); expect(() => assertCurrentProviderInstallation(descriptor)).toThrow('provider_installation');
  const second = fixture(), secondDescriptor = identifyProviderInstallation(second.input);
  writeFileSync(second.profilePath, 'changed opaque profile metadata with a different size'); expect(() => assertCurrentProviderInstallation(secondDescriptor)).toThrow('provider_installation');
});

test.runIf(process.platform === 'win32' && process.env.CUE_PROVIDER_INSTALLATION_LIVE_TEST === '1')('identifies current signed Claude bytes without claiming auth, entitlement, or qualification, then remeasures', () => {
  const descriptor = identifyProviderInstallation({ ...claude, authProfilePaths: [...claude.authProfilePaths] });
  expect(descriptor).toMatchObject({ provider: 'claude', executablePath: claude.executablePath, status: 'unqualified', authenticated: false, entitled: false, qualified: false,
    executable: { sha256: claude.expectedSha256.toLowerCase(), signerSubject: 'Anthropic, PBC', signerThumbprint: claude.expectedSigner.thumbprint }, version: { kind: 'pe-file', value: '2.1.270.0' } });
  expect(descriptor.authProfiles.map(profile => profile.path)).toEqual(claude.authProfilePaths);
  expect(Object.isFrozen(descriptor)).toBe(true); expect(Object.isFrozen(descriptor.authProfiles)).toBe(true);
  expect(assertCurrentProviderInstallation(descriptor)).toBe(true);
});

test('rejects unsupported providers, substitution hashes, relative paths, accessors, proxies, and unissued descriptors before granting identity', () => {
  const valid = { ...claude, authProfilePaths: [...claude.authProfilePaths] } as any;
  for (const input of [{ ...valid, provider: 'other' }, { ...valid, expectedSha256: '0'.repeat(64) }, { ...valid, executablePath: 'claude.exe' }, new Proxy(valid, {})])
    expect(() => identifyProviderInstallation(input)).toThrow('provider_installation');
  let read = false; const hostile = Object.defineProperty({ ...valid }, 'provider', { enumerable: true, get() { read = true; return 'claude'; } });
  expect(() => identifyProviderInstallation(hostile)).toThrow('provider_installation'); expect(read).toBe(false);
  expect(() => assertCurrentProviderInstallation(Object.freeze({}))).toThrow('provider_installation');
});

test.runIf(process.platform === 'win32')('rejects a provider path crossing a directory reparse point before reading provider bytes', () => {
  const root = mkdtempSync(join(tmpdir(), 'cue-provider-reparse-')), outside = mkdtempSync(join(tmpdir(), 'cue-provider-target-'));
  try {
    mkdirSync(join(outside, 'bin')); writeFileSync(join(outside, 'bin', 'provider.exe'), 'must not be identified');
    symlinkSync(outside, join(root, 'linked'), 'junction');
    expect(() => identifyProviderInstallation({ ...claude, executablePath: join(root, 'linked', 'bin', 'provider.exe'), authProfilePaths: [...claude.authProfilePaths] })).toThrow('provider_installation');
  } finally { rmSync(root, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true }); }
});

test.runIf(process.platform === 'win32' && process.env.CUE_PROVIDER_INSTALLATION_LIVE_TEST === '1')('pins the audited canonical Codex package payload rather than a command name or launcher path', () => {
  const descriptor = identifyProviderInstallation({
    provider: 'codex', executablePath: 'C:\\Users\\User\\AppData\\Roaming\\npm\\node_modules\\@openai\\codex\\node_modules\\@openai\\codex-win32-x64\\vendor\\x86_64-pc-windows-msvc\\bin\\codex.exe',
    expectedSha256: 'BE96B992178B1E467C225800DA0D65F2C86D5EBA1EF0B14632F65DB381CBDFDE', expectedSigner: { subject: 'OpenAI OpCo, LLC', thumbprint: 'FEAA595B06C5C389641FF093A5FB6506A7AF50B9' },
    version: { kind: 'package', value: '0.154.0-win32-x64', packageName: '@openai/codex', manifestPath: 'C:\\Users\\User\\AppData\\Roaming\\npm\\node_modules\\@openai\\codex\\node_modules\\@openai\\codex-win32-x64\\package.json', expectedManifestSha256: 'CFBAD545E49F73F266DC7DD6DA345C0A3397C173EBF5F9D0A1E3030D23BD4329' },
    authProfilePaths: ['C:\\Users\\User\\.codex\\auth.json'],
  });
  expect(descriptor).toMatchObject({ provider: 'codex', status: 'unqualified', version: { kind: 'package', value: '0.154.0-win32-x64', packageName: '@openai/codex' }, authenticated: false, entitled: false, qualified: false });
});
