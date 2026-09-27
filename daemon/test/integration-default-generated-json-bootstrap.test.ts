import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { openLedger, type Ledger } from '../src/ledger.js';
import { createCapabilityEvidenceStore } from '../src/capability-store.js';
import { MODEL_PROBES } from '../src/capability-admission.js';
import { SUBJECT_FIELDS, subjectDigest, type MeasurementSubject } from '../src/measurement-subject.js';
import { saveLocalSelectionPolicy } from '../src/selection/local-policy-store.js';
import { saveSelectionPolicy } from '../src/selection/policy-store.js';
import { readLatestLocalHostSettings, saveLocalHostSettings } from '../src/selection/local-host-settings.js';
import { envelopeHash } from '../src/envelope.js';
import { createDefaultGeneratedJsonBootstrap, DEFAULT_GENERATED_JSON_SETTINGS_ID, type DefaultGeneratedJsonAuthority } from '../../app/default-generated-json-bootstrap.mjs';
const mocks = vi.hoisted(() => ({ measure: vi.fn(), bundle: vi.fn() }));
// Module mocks model protected discovery for offline composition tests only.
// Synthetic live-shaped evidence below is not an actual qualification result.
vi.mock('../../daemon/dist/src/model-measurement-subject.js', () => ({ createModelMeasurementSubject: mocks.measure }));
vi.mock('../../daemon/dist/src/model-control-bundle.js', async importOriginal => ({ ...await importOriginal<object>(), measureModelControlBundle: mocks.bundle }));
const dbs: Ledger[] = [];
function measured(kind: string) {
  const subject = Object.freeze(Object.fromEntries(SUBJECT_FIELDS.map(key => [key, key.endsWith('Sha256') ? (kind === 'model' ? 'a' : 'b').repeat(64) : key + kind])) as unknown as MeasurementSubject);
  return Object.freeze({ subject, subjectDigest: subjectDigest(subject), manifest: Object.freeze({ version: 'fixture', kind, artifacts: Object.freeze([]) }), limitations: Object.freeze(['synthetic-measurement-only']) });
}
function bundle(clientKind: string) {
  const p = { version: 'cue-model-control-v1', clientKind, nodeSha256: '1'.repeat(64), launcherSha256: '2'.repeat(64), guardianSha256: '3'.repeat(64),
    clientSha256: '4'.repeat(64), checkerCoreSha256: clientKind === 'model' ? null : '5'.repeat(64) };
  return Object.freeze({ ...p, sha256: createHash('sha256').update(JSON.stringify(Object.values(p))).digest('hex') });
}
beforeEach(() => { mocks.measure.mockReset().mockImplementation(input => measured(input.kind)); mocks.bundle.mockReset().mockImplementation(input => bundle(input.clientKind)); });
afterEach(() => { for (const db of dbs.splice(0)) db.close(); });
function fixture(options: { settings?: 'missing' | 'disabled' | 'v1'; evidence?: 'missing' | 'fixture' | 'unknown' | 'expired'; limitMismatch?: boolean; timeMismatch?: boolean } = {}) {
  const db = openLedger(); dbs.push(db);
  for (const file of ['020_local_host_settings.sql', '021_local_invocation_budget.sql', '022_local_selection_policy.sql']) db.exec(readFileSync(resolve('migrations', file), 'utf8'));
  const policies: any = {};
  for (const mode of ['efficiency', 'performance', 'value', 'speed'] as const) {
    const p = options.settings === 'v1'
      ? saveSelectionPolicy(db, { policyId: mode, expectedRevision: null, createdAt: new Date(1000).toISOString(), sourceVersion: 'fixture', policy: {
        version: 'cue-selection-v1', mode, qualityMinimum: 0, costBasis: 1, timeBasisMs: 1, currency: 'TEST', costLimit: null, remainingTimeMs: null, maxEstimateAgeMs: 100,
        allowedCandidateIds: ['producer', 'checker'], pinnedCandidateId: null } })
      : saveLocalSelectionPolicy(db, { policyId: mode, expectedRevision: null, createdAt: new Date(1000).toISOString(), sourceVersion: 'fixture', policy: {
        version: 'cue-local-selection-v1', mode, producerCandidateId: 'producer', checkerCandidateId: 'checker', limitAttempts: options.limitMismatch ? 4 : 3, timeoutMs: options.timeMismatch ? 40000 : 30000 } });
    policies[mode] = { policyId: p.policyId, revision: p.revision, digest: p.digest };
  }
  if (options.settings !== 'missing') saveLocalHostSettings(db, { settingsId: DEFAULT_GENERATED_JSON_SETTINGS_ID, expectedRevision: null, createdAt: new Date(1000).toISOString(), sourceVersion: 'fixture', settings: {
    version: options.settings === 'v1' ? 'cue-local-host-settings-v1' : 'cue-local-host-settings-v2', templateId: 'generated-json-v1', enabled: options.settings !== 'disabled', accounting: { kind: 'local-invocation' },
    limits: { maxInvocations: 3, timeoutMs: 30000, maxOutputBytes: 4096, maxOutputTokens: 256 }, policies } });
  if (options.evidence !== 'missing') for (const kind of ['model', 'json-checker']) for (const probe of MODEL_PROBES) {
    createCapabilityEvidenceStore(db, () => 1000).record({ probe, subjectDigest: measured(kind).subjectDigest, measuredAt: new Date(options.evidence === 'expired' ? 1 : 999).toISOString(),
      kind: options.evidence === 'fixture' ? 'fixture' : 'live', status: options.evidence === 'unknown' ? 'unknown' : 'pass', observation: Buffer.from('synthetic host fixture only') });
  }
  const context = { db, config: Object.freeze({ version: 1 }), worktree: 'C:/fixture' };
  const truth = { discoveries: 0, guards: 0, readiness: 0, authenticated: true, guard: true, runtime: process.versions.electron ? 'electron' : 'node' };
  const authority: DefaultGeneratedJsonAuthority = { now: () => 1000, maxEvidenceAgeMs: 100,
    discoverInstallation(c) { expect(c.db).toBe(db); truth.discoveries++; return {
      measurement: { installRoot: 'C:/controlled', nodeExecutable: process.execPath, powershellExecutable: 'C:/Windows/powershell.exe', sqliteNativePath: 'C:/controlled/sqlite.node', dependencyRoot: 'C:/controlled/deps' },
      controlRoot: 'C:/controlled/control', taskRootBase: 'C:/controlled/tasks', profileRootBase: 'C:/controlled/profiles',
      loadedHost: { executable: process.execPath, runtime: truth.runtime as 'node' | 'electron', version: process.versions.electron ?? process.versions.node } }; },
    validateLoadedInstallation(value) { truth.guards++; expect(value.hostExecutable).toBeTruthy(); return truth.guard; },
    observeReadiness(_kind, c) { expect(c.db).toBe(db); truth.readiness++; return { authenticated: truth.authenticated, dataAllowed: true, resourceAvailable: true, quotaAvailable: true }; },
    };
  return { db, context, authority, truth };
}
describe('default local JSON bootstrap, synthetic discovery only, no startup activation', () => {
  it.each(['missing', 'disabled', 'v1'] as const)('returns unavailable for %s settings before discovery', settings => {
    const f = fixture({ settings }); const result = createDefaultGeneratedJsonBootstrap(f.authority)(f.context);
    expect(result).toHaveProperty('available', false); expect(f.truth.discoveries).toBe(0); expect(mocks.measure).not.toHaveBeenCalled();
  });
  it('requires protected loaded-installation authority and rejects Node/Electron mismatch', () => {
    const f = fixture(); expect(createDefaultGeneratedJsonBootstrap()(f.context)).toMatchObject({ available: false, reasons: ['default-host-missing-authority'] });
    const { validateLoadedInstallation: _omitted, ...partial } = f.authority;
    expect(createDefaultGeneratedJsonBootstrap(partial)(f.context)).toHaveProperty('available', false);
    f.truth.runtime = f.truth.runtime === 'node' ? 'electron' : 'node';
    expect(createDefaultGeneratedJsonBootstrap(f.authority)(f.context)).toMatchObject({ available: false, reasons: ['default-host-loaded-runtime-mismatch'] });
  });
  it.each(['missing', 'fixture', 'unknown', 'expired'] as const)('never manufactures %s capability evidence', evidence => {
    const f = fixture({ evidence }); const before = f.db.prepare('SELECT total_changes() n').get();
    expect(createDefaultGeneratedJsonBootstrap(f.authority)(f.context)).toHaveProperty('available', false);
    expect(f.db.prepare('SELECT total_changes() n').get()).toEqual(before);
  });
  it.each([{ limitMismatch: true }, { timeMismatch: true }])('requires exact settings limits across all four policies', options => {
    const f = fixture(options);
    expect(createDefaultGeneratedJsonBootstrap(f.authority)(f.context)).toMatchObject({ available: false, reasons: ['default-host-policy-limits-mismatch'] });
    expect(f.truth.discoveries).toBe(0);
  });
  it('rejects unavailable authentication, false guards, async guards and discovery accessors', () => {
    const f = fixture(); f.truth.authenticated = false;
    expect(createDefaultGeneratedJsonBootstrap(f.authority)(f.context)).toMatchObject({ available: false, reasons: ['default-host-authentication-unavailable'] });
    f.truth.authenticated = true; f.truth.guard = false;
    expect(createDefaultGeneratedJsonBootstrap(f.authority)(f.context)).toMatchObject({ available: false, reasons: ['default-host-loaded-installation-unverified'] });
    f.truth.guard = true; const asyncGuard = { ...f.authority, validateLoadedInstallation: (() => Promise.resolve(true)) as never };
    expect(createDefaultGeneratedJsonBootstrap(asyncGuard)(f.context)).toHaveProperty('available', false);
    let called = false;
    const getter = { ...f.authority, discoverInstallation: (() => Object.defineProperty({}, 'measurement', { enumerable: true, get() { called = true; throw Error('getter'); } })) as never };
    expect(createDefaultGeneratedJsonBootstrap(getter)(f.context)).toHaveProperty('available', false); expect(called).toBe(false);
  });
  it('unwraps the real host using the same ledger without writing or launching, and keeps guards active', () => {
    const f = fixture(), before = f.db.prepare('SELECT total_changes() n').get();
    const host = createDefaultGeneratedJsonBootstrap(f.authority)(f.context);
    expect(host).toHaveProperty('accountingKind', 'local-invocation'); expect(host).not.toHaveProperty('host'); expect(host).not.toHaveProperty('available');
    expect(f.db.prepare('SELECT total_changes() n').get()).toEqual(before);
    expect(f.db.prepare('SELECT count(*) n FROM orchestration_attempt').get()).toEqual({ n: 0 });
    expect(f.db.prepare('SELECT count(*) n FROM local_invocation_budget').get()).toEqual({ n: 0 });
    expect(f.truth.readiness).toBeGreaterThan(0);
    if ('available' in host) throw Error(host.reasons.join(','));
    const envelope = { run_id: 'prepared', worktree_realpath: process.cwd(), allowed_actions: [], egress: ['http://127.0.0.1:8085/v1'], expires_at: new Date(60000).toISOString(), autonomy_level: 'bounded' as const };
    expect(host.requiresExplicitTemplate).toBe(true);
    const run = { runId: 'prepared', taskId: 'parent', goal: 'This goal is deliberately not JSON.', scope: 'document', envelope, envelopeHash: envelopeHash(envelope) };
    expect(() => host.prepare(run)).toThrow();
    const prepared = host.prepare({ ...run, template: { id: 'generated-json-v1', inputText: '{"a":1}' } });
    const settings = readLatestLocalHostSettings(f.db, DEFAULT_GENERATED_JSON_SETTINGS_ID)!;
    expect(prepared.budget).toMatchObject({ limit: 3, source: `settings:${settings.settingsId}:${settings.revision}:${settings.digest}` });
    expect(prepared.generatedOutputs?.[0]).toMatchObject({ inputText: '{"a":1}', maxBytes: 4096 });
    expect(f.db.prepare('SELECT total_changes() n').get()).toEqual(before);
    f.truth.guard = false;
    expect(host.catalog.lookup('producer')).toHaveProperty('available', false);
    const other = openLedger(); dbs.push(other);
    expect(createDefaultGeneratedJsonBootstrap(f.authority)({ ...f.context, db: other })).toHaveProperty('available', false);
  });
});
