import { afterEach, expect, test } from 'vitest';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { openLedger, type Ledger } from '../src/ledger.js';
import { saveSelectionPolicy } from '../src/selection/policy-store.js';
import { saveLocalSelectionPolicy } from '../src/selection/local-policy-store.js';
import { saveLocalHostSettings, readLatestLocalHostSettings, readLocalHostSettings, configureLocalGoalPlanningSettings, LOCAL_GOAL_PLANNING_SETTINGS_ID, LOCAL_GOAL_PLANNING_CHECKER_CANDIDATE_ID, type LocalHostSettings, type LocalHostSettingsV1, type LocalHostSettingsV2 } from '../src/selection/local-host-settings.js';

const dbs: Ledger[] = [], roots: string[] = [];
const stamp = '2026-09-11T00:00:00.000Z';
afterEach(() => {
  for (const db of dbs.splice(0)) if (db.open) db.close();
  for (const root of roots.splice(0)) {
    if (dirname(resolve(root)) !== resolve(tmpdir()) || !root.startsWith(join(tmpdir(), 'cue-local-settings-'))) throw Error('unsafe-test-cleanup');
    rmSync(root, { recursive: true, force: true });
  }
});
function database(path?: string) {
  const db = openLedger(path); dbs.push(db);
  db.exec(readFileSync(new URL('../migrations/020_local_host_settings.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../migrations/022_local_selection_policy.sql', import.meta.url), 'utf8'));
  return db;
}
function fixture(db: Ledger): LocalHostSettingsV1 {
  const policies = {} as LocalHostSettings['policies'];
  for (const mode of ['efficiency', 'performance', 'value', 'speed'] as const) {
    const policy = saveSelectionPolicy(db, { policyId: mode, expectedRevision: null, createdAt: stamp, sourceVersion: 'test',
      policy: { version: 'cue-selection-v1', mode, qualityMinimum: 0.5, costBasis: 1, timeBasisMs: 1000, currency: 'USD',
        costLimit: 10, remainingTimeMs: 10000, maxEstimateAgeMs: 1000, allowedCandidateIds: ['model', 'checker'], pinnedCandidateId: null } });
    Object.assign(policies, { [mode]: { policyId: policy.policyId, revision: policy.revision, digest: policy.digest } });
  }
  return { version: 'cue-local-host-settings-v1', templateId: 'generated-json-v1', enabled: false,
    accounting: { kind: 'local-invocation' }, limits: { maxInvocations: 4, timeoutMs: 30000, maxOutputBytes: 65536, maxOutputTokens: 2048 }, policies };
}
const input = (settings: LocalHostSettings, expectedRevision: number | null = null) => ({ settingsId: 'default', expectedRevision, settings, createdAt: stamp, sourceVersion: 'test-v1' });

test('immutable canonical snapshots retain exact policies, defensive copies and accounting intent', () => {
  const db = database(), settings = fixture(db);
  expect(readLatestLocalHostSettings(db, 'default')).toBeNull();
  const first = saveLocalHostSettings(db, input(settings));
  expect(first.revision).toBe(1); expect(first.settings.enabled).toBe(false);
  // Captured from the pre-v2 compiled implementation, not recomputed by this test.
  expect(first.digest).toBe('4b7f71d3303794b41cd7dd999d365ad418a944d06842e04779f2a9826c739a9a');
  expect(Object.isFrozen(first.settings.policies.efficiency)).toBe(true);
  expect(Object.isFrozen(first.settings.limits)).toBe(true);
  Object.assign(settings.limits, { maxInvocations: 8 });
  expect(first.settings.limits.maxInvocations).toBe(4);
  const second = saveLocalHostSettings(db, input({ ...settings, enabled: true, accounting: { kind: 'monetary', sourceRef: 'user-rate-v1' } }, 1));
  expect(second.revision).toBe(2); expect(second.digest).not.toBe(first.digest);
  expect(readLocalHostSettings(db, 'default', 1)).toEqual(first);
  expect(readLatestLocalHostSettings(db, 'default')).toEqual(second);
  expect(db.prepare('SELECT COUNT(*) n FROM selection_policy_snapshot').get()).toEqual({ n: 4 });
  expect(db.prepare('SELECT COUNT(*) n FROM capability_evidence').get()).toEqual({ n: 0 });
});

function localFixture(db: Ledger, old: LocalHostSettingsV1): LocalHostSettingsV2 {
  const policies = {} as LocalHostSettingsV2['policies'];
  for (const mode of ['efficiency', 'performance', 'value', 'speed'] as const) {
    // Deliberately collide IDs/revisions with monetary policies to test table isolation.
    const stored = saveLocalSelectionPolicy(db, { policyId: mode, expectedRevision: null, createdAt: stamp, sourceVersion: 'local-test',
      policy: { version: 'cue-local-selection-v1', mode, producerCandidateId: 'model', checkerCandidateId: 'checker', limitAttempts: 8, timeoutMs: 60000 } });
    Object.assign(policies, { [mode]: { policyId: stored.policyId, revision: stored.revision, digest: stored.digest } });
  }
  return { ...old, version: 'cue-local-host-settings-v2', accounting: { kind: 'local-invocation' }, policies };
}

test('v2 local references survive CAS/reopen while v1 historical digest remains unchanged', () => {
  const root = mkdtempSync(join(tmpdir(), 'cue-local-settings-')); roots.push(root);
  const path = join(root, 'ledger.sqlite'), db = database(path), old = fixture(db);
  const first = saveLocalHostSettings(db, input(old));
  const local = localFixture(db, old), second = saveLocalHostSettings(db, input(local, 1));
  expect(second.settings.version).toBe('cue-local-host-settings-v2');
  expect(() => saveLocalHostSettings(db, input(local, 1))).toThrow('revision-conflict');
  expect(Object.isFrozen(second.settings.accounting)).toBe(true);
  db.close(); const reopened = database(path);
  expect(readLocalHostSettings(reopened, 'default', 1)).toEqual(first);
  expect(readLatestLocalHostSettings(reopened, 'default')).toEqual(second);
});

test('protected planning setup writes a distinct v2 template, policy pair and CAS revision without changing JSON setup',()=>{
  const db=database(),limits={maxInvocations:4,timeoutMs:30000,maxOutputBytes:65536,maxOutputTokens:2048};
  const first=configureLocalGoalPlanningSettings(db,{expectedRevision:null,enabled:true,limits,createdAt:stamp});
  expect(first.settings).toMatchObject({version:'cue-local-host-settings-v2',templateId:'goal-planning-v1',enabled:true});
  expect(readLatestLocalHostSettings(db,LOCAL_GOAL_PLANNING_SETTINGS_ID)).toEqual(first);
  expect(readLatestLocalHostSettings(db,'generated-json-default')).toBeNull();
  for(const mode of ['efficiency','performance','value','speed'] as const){
    const ref=first.settings.policies[mode];
    const row=db.prepare('SELECT policy_json FROM local_selection_policy_snapshot WHERE policy_id=? AND revision=?').get(ref.policyId,ref.revision) as {policy_json:string};
    expect(JSON.parse(row.policy_json).checkerCandidateId).toBe(LOCAL_GOAL_PLANNING_CHECKER_CANDIDATE_ID);
  }
  expect(()=>configureLocalGoalPlanningSettings(db,{expectedRevision:null,enabled:false,limits,createdAt:stamp})).toThrow('revision-conflict');
  const second=configureLocalGoalPlanningSettings(db,{expectedRevision:first.revision,enabled:false,limits,createdAt:stamp});
  expect(second.revision).toBe(2);expect(second.settings.enabled).toBe(false);
});

test('v2 refuses monetary refs/kinds, false modes, wrong digest and any policy-exceeding limits', () => {
  const db = database(), old = fixture(db), local = localFixture(db, old);
  const malformed: unknown[] = [
    { ...local, policies: old.policies },
    { ...old, policies: local.policies },
    { ...local, accounting: { kind: 'monetary', sourceRef: 'source' } },
    { ...local, accounting: { kind: 'local-invocation', currency: 'USD' } },
    { ...local, policies: { ...local.policies, efficiency: local.policies.speed } },
    { ...local, policies: { ...local.policies, speed: { ...local.policies.speed, digest: '0'.repeat(64) } } },
    { ...local, limits: { ...local.limits, maxInvocations: 9 } },
    { ...local, limits: { ...local.limits, timeoutMs: 60001 } },
  ];
  for (const value of malformed) expect(() => saveLocalHostSettings(db, input(value as LocalHostSettings))).toThrow();
  expect(readLatestLocalHostSettings(db, 'default')).toBeNull();
  const tighter = saveLocalSelectionPolicy(db, { policyId: 'speed', expectedRevision: 1, createdAt: stamp, sourceVersion: 'local-test',
    policy: { version: 'cue-local-selection-v1', mode: 'speed', producerCandidateId: 'model', checkerCandidateId: 'checker', limitAttempts: 2, timeoutMs: 1000 } });
  expect(() => saveLocalHostSettings(db, input({ ...local, policies: { ...local.policies, speed: { policyId: tighter.policyId, revision: tighter.revision, digest: tighter.digest } } }))).toThrow('policy-limits');
  // Old revision remains usable; current/latest policy never replaces an explicit ref.
  expect(saveLocalHostSettings(db, input(local)).settings.policies.speed.revision).toBe(1);
});

test('persisted CAS across connections, reopen and outer transaction denial', () => {
  const root = mkdtempSync(join(tmpdir(), 'cue-local-settings-')); roots.push(root);
  const path = join(root, 'ledger.sqlite'), a = database(path), settings = fixture(a);
  const b = database(path), first = saveLocalHostSettings(a, input(settings));
  expect(() => saveLocalHostSettings(b, input(settings))).toThrow('revision-conflict');
  expect(saveLocalHostSettings(b, input(settings, 1)).revision).toBe(2);
  expect(() => saveLocalHostSettings(a, input(settings, 1))).toThrow('revision-conflict');
  a.exec('BEGIN'); expect(() => saveLocalHostSettings(a, input(settings, 2))).toThrow('outer-transaction'); a.exec('ROLLBACK');
  a.close(); b.close();
  const reopened = database(path);
  expect(readLocalHostSettings(reopened, 'default', 1)).toEqual(first);
  expect(readLatestLocalHostSettings(reopened, 'default')?.revision).toBe(2);
});

test('missing, wrong-mode and stale-digest policy references reject with no settings writes', () => {
  const db = database(), settings = fixture(db);
  for (const efficiency of [
    { ...settings.policies.efficiency, policyId: 'absent' },
    settings.policies.speed,
    { ...settings.policies.efficiency, digest: '0'.repeat(64) },
  ]) expect(() => saveLocalHostSettings(db, input({ ...settings, policies: { ...settings.policies, efficiency } }))).toThrow('policy-reference');
  expect(readLatestLocalHostSettings(db, 'default')).toBeNull();
});

test('descriptor-only schema refuses hidden authority, getters, proxies, inherited data and out-of-range limits', () => {
  const db = database(), settings = fixture(db); let calls = 0;
  const values: unknown[] = [
    { ...settings, endpoint: 'http://other-host' }, { ...settings, evidence: [] }, { ...settings, fixture: true },
    { ...settings, accounting: { kind: 'local-invocation', price: 0 } },
    { ...settings, accounting: { kind: 'monetary', sourceRef: 'https://example.com' } },
    { ...settings, limits: { ...settings.limits, timeoutMs: 999 } },
    { ...settings, limits: { ...settings.limits, maxInvocations: 1001 } },
    { ...settings, limits: { ...settings.limits, maxOutputBytes: 1048577 } },
    { ...settings, limits: { ...settings.limits, maxOutputTokens: 32769 } },
    Object.create(settings), new Proxy(settings, { ownKeys() { calls++; return []; } }),
    { ...settings, accounting: { get kind() { calls++; return 'local-invocation'; } } },
    { ...settings, policies: { ...settings.policies, get speed() { calls++; return settings.policies.speed; } } },
  ];
  for (const value of values) expect(() => saveLocalHostSettings(db, input(value as LocalHostSettings))).toThrow();
  expect(calls).toBe(0); expect(readLatestLocalHostSettings(db, 'default')).toBeNull();
});

test('SQL update/delete/REPLACE/UPSERT cannot replace identity even without recursive triggers', () => {
  const db = database(), settings = fixture(db), saved = saveLocalHostSettings(db, input(settings));
  db.exec('PRAGMA recursive_triggers=OFF');
  for (const sql of [
    "UPDATE local_host_settings_snapshot SET source_version='changed'",
    'DELETE FROM local_host_settings_snapshot',
    'INSERT OR REPLACE INTO local_host_settings_snapshot SELECT * FROM local_host_settings_snapshot',
    "INSERT INTO local_host_settings_snapshot SELECT * FROM local_host_settings_snapshot WHERE 1 ON CONFLICT(settings_id,revision) DO UPDATE SET source_version='changed'",
  ]) expect(() => db.exec(sql)).toThrow('immutable_local_host_settings');
  expect(readLatestLocalHostSettings(db, 'default')).toEqual(saved);
});

test('stored bytes and referenced policy corruption are refused on historical reads', () => {
  const db = database(), settings = fixture(db); saveLocalHostSettings(db, input(settings));
  db.exec('DROP TRIGGER local_host_settings_no_update');
  db.exec("UPDATE local_host_settings_snapshot SET settings_json=settings_json || ' '");
  expect(() => readLatestLocalHostSettings(db, 'default')).toThrow('corrupt-snapshot');
  db.exec('UPDATE local_host_settings_snapshot SET settings_json=trim(settings_json)');
  db.exec('DROP TRIGGER selection_policy_snapshot_no_update');
  db.exec("UPDATE selection_policy_snapshot SET source_version='corrupt' WHERE policy_id='speed'");
  expect(() => readLocalHostSettings(db, 'default', 1)).toThrow('corrupt-snapshot');
});
