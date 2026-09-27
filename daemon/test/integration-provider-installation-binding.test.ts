import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { SUBJECT_FIELDS, subjectDigest, type MeasurementSubject } from '../src/measurement-subject.js';

const mocks = vi.hoisted(() => ({ signature: null as any }));
vi.mock('node:child_process', async importOriginal => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return { ...actual, spawnSync: (...args: Parameters<typeof actual.spawnSync>) => mocks.signature
    ? { status: 0, error: undefined, stdout: JSON.stringify({ ...mocks.signature, status: 'Valid' }), stderr: '' }
    : actual.spawnSync(...args) };
});
vi.mock('../dist/src/adapters/integration-executors.js', () => ({ createDefaultCodexCandidate: (input: any) => Object.freeze({ ...input, supportedRoles: ['implementation'] }) }));
vi.mock('../dist/src/selection/policy-store.js', () => ({ readSelectionPolicy: (_db: any, policyId: string) => ({ policyId, revision: 1, digest: 'd'.repeat(64), policy: { mode: policyId, currency: 'TEST', pinnedCandidateId: null, allowedCandidateIds: ['implementation', 'verifier'] } }) }));
vi.mock('../dist/src/selection/policy.js', () => ({ selectCandidate: (_policy: any, candidates: any[]) => ({ selectedId: candidates[0].id }) }));
vi.mock('../../app/staged-existing-file-publication-host.mjs', () => ({ createStagedExistingFilePublicationHost: () => ({}) }));

import { identifyProviderInstallation } from '../../app/provider-installation.mjs';
import { bindProviderInstallationCandidate } from '../../app/provider-installation-binding.mjs';
import { createNativeImplementationHost } from '../../app/native-implementation-host.mjs';

const roots: string[] = [];
afterEach(() => { mocks.signature = null; for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
beforeEach(() => vi.restoreAllMocks());

function fixture(provider: 'codex' | 'claude' = 'codex') {
  const root = mkdtempSync(join(tmpdir(), 'cue-provider-binding-')); roots.push(root);
  const executablePath = join(root, 'provider.exe'), profilePath = join(root, 'auth.opaque');
  const bytes = 'exact signed provider bytes'; writeFileSync(executablePath, bytes); writeFileSync(profilePath, 'opaque profile');
  mocks.signature = { path: resolve(executablePath), fileVersion: '1.2.3.4', signer: 'Fixture Vendor', thumbprint: 'A'.repeat(40) };
  const installation = identifyProviderInstallation({ provider, executablePath,
    expectedSha256: createHash('sha256').update(bytes).digest('hex'), expectedSigner: { subject: 'Fixture Vendor', thumbprint: 'A'.repeat(40) },
    version: { kind: 'pe-file', value: '1.2.3.4' }, authProfilePaths: [profilePath] });
  const subject = Object.freeze(Object.fromEntries(SUBJECT_FIELDS.map(key => [key,
    key === 'toolBinarySha256' ? installation.executable.sha256 : key.endsWith('Sha256') ? 'b'.repeat(64) : key])) as MeasurementSubject);
  const now = Date.now(), observed = (id: string) => ({ id, checks: { eligible: true }, estimate: { currency: 'TEST', conservativeMaxCost: 1 } });
  const record = (canonicalId: string, sourceVersion = installation.version.value) => ({ canonicalId, toolId: canonicalId, kind: 'agent', aliases: [], installation: 'installed', protocol: 'verified',
    authReference: `account-${canonicalId}`, authAvailable: true, sourceVersion, observedAt: new Date(now).toISOString(), subjectDigest: subjectDigest(subject), binding: null });
  const common = { currentSubject: () => subject, evidenceReferences: () => ({ M1: 'evidence' }), observeCandidate: () => observed('implementation') };
  const options: any = { db: { open: true }, now: () => now,
    workflow: { requirementId: 'requirement', requirementText: 'bounded', checkerId: 'checker', checkerRevision: 'v1', parametersDigest: 'c'.repeat(64), targets: [{ targetId: 'target', relativePath: 'target.txt', maxBackupBytes: 1 }], launchTimeoutMs: 1, taskTimeoutMs: 1, pollMs: 1 },
    policies: Object.fromEntries(['efficiency','performance','value','speed'].map(mode => [mode, { policyId: mode, revision: 1, digest: 'd'.repeat(64) }])),
    accounting: { currency: 'TEST', unit: 'micro', limitUnits: 2, unitsPerCost: 1, source: 'fixture', observedAtMs: now, upperUnitsByRole: { implementation: 1, verifier: 1 } },
    implementation: { ...common, installation, record: record('implementation'), executor: { binary: installation.executablePath,
      resolveBinding: () => { throw Error('composition-only-fixture-must-not-launch'); } } },
    verifier: { ...common, observeCandidate: () => observed('verifier'), record: record('verifier'), candidate: { supportedRoles: ['model'] } },
    requirementCheckers: [], resolveRequirementChecker: () => undefined, acceptance: {}, authorizePublication: () => true, verifyFinalBilling: () => false,
    authority: {}, runtime: { evidence: { maxAgeMs: 1000 } }, engine: { reservation: () => ({}), verifyBudgetMapping: () => true },
  };
  return { profilePath, installation, options };
}

test('production host binds candidate subject and evidence to current signed installation identity', () => {
  const first = fixture();
  expect(first.installation).toMatchObject({ status: 'unqualified', authenticated: false, entitled: false, qualified: false });
  expect(bindProviderInstallationCandidate({ installation: first.installation, record: first.options.implementation.record,
    provider: 'codex', executablePath: first.installation.executablePath,
    currentSubject: first.options.implementation.currentSubject, evidenceReferences: first.options.implementation.evidenceReferences }).currentSubject()).toEqual(first.options.implementation.currentSubject());
  const host = createNativeImplementationHost(first.options) as any;
  expect(host.available).not.toBe(false);
  expect(host.catalog.lookup('implementation')).toMatchObject({ available: true, reasons: [] });
  expect(host.runtime.resolveCandidate('implementation').evidenceReferences()).toEqual({ M1: 'evidence' });

  writeFileSync(first.profilePath, 'changed opaque profile metadata');
  expect(host.catalog.lookup('implementation')).toMatchObject({ available: false, reasons: ['subject-unavailable'] });
  expect(() => host.runtime.resolveCandidate('implementation').buildCurrentSubject()).toThrow('provider_installation_unavailable_or_drifted');
  expect(() => host.runtime.resolveCandidate('implementation').evidenceReferences()).toThrow('provider_installation_unavailable_or_drifted');
});

test('supplied unissued, subject-mismatched, or version-mismatched installation refuses host composition', () => {
  const f = fixture();
  expect(createNativeImplementationHost({ ...f.options, implementation: { ...f.options.implementation,
    executor: { binary: f.installation.executablePath } } })).toEqual({ available: false, reasons: ['native-implementation-candidates-unqualified'] });
  expect(createNativeImplementationHost({ ...f.options, implementation: { ...f.options.implementation, installation: { ...f.installation } } })).toEqual({ available: false, reasons: ['native-implementation-invalid'] });
  const wrongSubject = { ...f.options.implementation, currentSubject: () => ({ ...f.options.implementation.currentSubject(), toolBinarySha256: '0'.repeat(64) }) };
  expect(createNativeImplementationHost({ ...f.options, implementation: wrongSubject })).toEqual({ available: false, reasons: ['native-implementation-invalid'] });
  const wrongVersion = { ...f.options.implementation, record: { ...f.options.implementation.record, sourceVersion: 'other' } };
  expect(createNativeImplementationHost({ ...f.options, implementation: wrongVersion })).toEqual({ available: false, reasons: ['native-implementation-invalid'] });
  const wrongExecutable = { ...f.options.implementation, executor: { binary: resolve(f.options.implementation.installation.executablePath, '..', 'other.exe') } };
  expect(createNativeImplementationHost({ ...f.options, implementation: wrongExecutable })).toEqual({ available: false, reasons: ['native-implementation-invalid'] });
  const claude = fixture('claude');
  expect(() => bindProviderInstallationCandidate({ installation: claude.installation, provider: 'codex', executablePath: claude.installation.executablePath,
    record: claude.options.implementation.record, currentSubject: claude.options.implementation.currentSubject,
    evidenceReferences: claude.options.implementation.evidenceReferences })).toThrow('provider-installation-binding-unavailable');
  expect(createNativeImplementationHost({ ...f.options, verifier: { ...f.options.verifier, installation: f.installation } })).toEqual({ available: false, reasons: ['native-implementation-verifier-installation-unbound'] });
});
