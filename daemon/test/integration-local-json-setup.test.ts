import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { openLedger, type Ledger } from '../src/ledger.js';
import { configureLocalJsonSettings, LOCAL_JSON_SETTINGS_ID, LOCAL_JSON_PRODUCER_CANDIDATE_ID, LOCAL_JSON_CHECKER_CANDIDATE_ID,
  readLatestLocalHostSettings, readLocalHostSettings, saveLocalHostSettings } from '../src/selection/local-host-settings.js';
import { readLocalSelectionPolicy } from '../src/selection/local-policy-store.js';
const roots: string[] = [], dbs: Ledger[] = [];
afterEach(() => { for (const db of dbs.splice(0)) if (db.open) db.close(); for (const root of roots.splice(0)) {
  expect(dirname(resolve(root))).toBe(resolve(tmpdir())); expect(basename(root).startsWith('cue-local-setup-')).toBe(true); rmSync(root, { recursive: true, force: true });
} });
const input = () => ({ expectedRevision: null as number | null, enabled: true, limits: { maxInvocations: 2, timeoutMs: 30000, maxOutputBytes: 4096, maxOutputTokens: 256 }, createdAt: '2026-09-11T00:00:00.000Z' });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'cue-local-setup-')); roots.push(root); const path = join(root, 'ledger.sqlite'), db = openLedger(path); dbs.push(db);
  for (const name of ['020_local_host_settings.sql', '022_local_selection_policy.sql']) db.exec(readFileSync(resolve('migrations', name), 'utf8'));
  return { db, path };
}
const counts = (db: Ledger) => ['local_host_settings_snapshot', 'local_selection_policy_snapshot'].map(t => (db.prepare(`SELECT count(*) n FROM ${t}`).get() as { n: number }).n);
describe('atomic explicit local JSON settings setup', () => {
  it('creates exactly four fixed pair policies and V2 settings without execution or evidence', () => {
    const { db } = fixture(), saved = configureLocalJsonSettings(db, input());
    expect(saved).toMatchObject({ settingsId: LOCAL_JSON_SETTINGS_ID, revision: 1, sourceVersion: 'cue-local-json-setup-v1', settings: { version: 'cue-local-host-settings-v2', enabled: true } });
    expect(Object.isFrozen(saved)).toBe(true); expect(Object.isFrozen(saved.settings.policies)).toBe(true); expect(counts(db)).toEqual([1, 4]);
    for (const [mode, ref] of Object.entries(saved.settings.policies)) {
      const p = readLocalSelectionPolicy(db, ref.policyId, ref.revision)!;
      expect(p.digest).toBe(ref.digest); expect(p.sourceVersion).toBe('cue-local-json-setup-v1');
      expect(p.policy).toMatchObject({ mode, producerCandidateId: LOCAL_JSON_PRODUCER_CANDIDATE_ID, checkerCandidateId: LOCAL_JSON_CHECKER_CANDIDATE_ID, limitAttempts: 2, timeoutMs: 30000 });
    }
    for (const table of ['task', 'run', 'session_handle', 'capability_evidence', 'orchestration_attempt', 'local_invocation_budget', 'selection_policy_snapshot', 'integration_budget']) {
      expect(db.prepare(`SELECT count(*) n FROM ${table}`).get()).toEqual({ n: 0 });
    }
  });
  it('retains historical revisions after disable/change and actual SQLite reopen', () => {
    const f = fixture(), first = configureLocalJsonSettings(f.db, input());
    const second = configureLocalJsonSettings(f.db, { ...input(), expectedRevision: 1, enabled: false, limits: { ...input().limits, maxInvocations: 4, timeoutMs: 120000 } });
    expect(second.revision).toBe(2); expect(second.settings.enabled).toBe(false); expect(counts(f.db)).toEqual([2, 8]); f.db.close();
    const reopened = openLedger(f.path); dbs.push(reopened);
    expect(readLocalHostSettings(reopened, LOCAL_JSON_SETTINGS_ID, 1)).toEqual(first);
    expect(readLatestLocalHostSettings(reopened, LOCAL_JSON_SETTINGS_ID)).toEqual(second);
    const oldRef = first.settings.policies.efficiency; expect(readLocalSelectionPolicy(reopened, oldRef.policyId, oldRef.revision)?.policy.limitAttempts).toBe(2);
  });
  it('checks settings CAS before any policy writes, including separate connections', () => {
    const f = fixture(), first = configureLocalJsonSettings(f.db, input());
    expect(() => configureLocalJsonSettings(f.db, input())).toThrow('revision-conflict'); expect(counts(f.db)).toEqual([1, 4]);
    const other = openLedger(f.path); dbs.push(other);
    configureLocalJsonSettings(other, { ...input(), expectedRevision: first.revision });
    const changes = f.db.prepare('SELECT total_changes() n').get();
    expect(() => configureLocalJsonSettings(f.db, { ...input(), expectedRevision: first.revision })).toThrow('revision-conflict');
    expect(counts(f.db)).toEqual([2, 8]); expect(f.db.prepare('SELECT total_changes() n').get()).toEqual(changes);
  });
  it.each(['third-policy', 'settings'])('rolls every inserted policy back on injected %s SQL failure', boundary => {
    const { db } = fixture();
    db.exec(boundary === 'settings'
      ? "CREATE TRIGGER fixture_reject BEFORE INSERT ON local_host_settings_snapshot BEGIN SELECT RAISE(ABORT,'fixture-boundary'); END;"
      : "CREATE TRIGGER fixture_reject BEFORE INSERT ON local_selection_policy_snapshot WHEN NEW.policy_id='cue.local-json.value.v1' BEGIN SELECT RAISE(ABORT,'fixture-boundary'); END;");
    expect(() => configureLocalJsonSettings(db, input())).toThrow('fixture-boundary'); expect(counts(db)).toEqual([0, 0]);
    db.exec('DROP TRIGGER fixture_reject'); expect(configureLocalJsonSettings(db, input()).revision).toBe(1); expect(counts(db)).toEqual([1, 4]);
  });
  it('rejects unsafe bounds, arbitrary candidate/policy data, accessors and outer transactions before writes', () => {
    const { db } = fixture(); let invoked = 0;
    const getter = Object.defineProperty(input(), 'enabled', { enumerable: true, get() { invoked++; return true; } });
    const limitsGetter = { ...input(), limits: Object.defineProperty(input().limits, 'timeoutMs', { enumerable: true, get() { invoked++; return 1000; } }) };
    const values: unknown[] = [null, [], { ...input(), candidateId: 'other' }, { ...input(), expectedRevision: 0 }, { ...input(), enabled: 'true' }, { ...input(), createdAt: 'today' }, getter, limitsGetter,
      new Proxy(input(), { getOwnPropertyDescriptor() { invoked++; throw Error('proxy'); } }), Object.assign(Object.create({ inherited: true }), input())];
    for (const [name, value] of [['maxInvocations', 1], ['maxInvocations', 1001], ['timeoutMs', 999], ['timeoutMs', 120001], ['maxOutputBytes', 0], ['maxOutputBytes', 1048577], ['maxOutputTokens', 0], ['maxOutputTokens', 32769], ['maxInvocations', NaN]]) {
      values.push({ ...input(), limits: { ...input().limits, [String(name)]: value } });
    }
    const total = db.prepare('SELECT total_changes() n').get();
    for (const value of values) expect(() => configureLocalJsonSettings(db, value as any)).toThrow();
    expect(() => db.transaction(() => configureLocalJsonSettings(db, input()))()).toThrow('outer-transaction');
    expect(invoked).toBe(0); expect(counts(db)).toEqual([0, 0]); expect(db.prepare('SELECT total_changes() n').get()).toEqual(total);
    const saved = configureLocalJsonSettings(db, input());
    expect(() => db.transaction(() => saveLocalHostSettings(db, { settingsId: 'other', expectedRevision: null, settings: saved.settings, createdAt: saved.createdAt, sourceVersion: saved.sourceVersion }))()).toThrow('outer-transaction');
    expect(counts(db)).toEqual([1, 4]);
  });
});
