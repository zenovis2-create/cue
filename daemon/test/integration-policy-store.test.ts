import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bindRunSelectionPolicy, readLatestSelectionPolicy, readRunSelectionPolicy, readSelectionPolicy, saveSelectionPolicy } from '../src/selection/policy-store.js';
import type { SelectionPolicy } from '../src/selection/policy.js';

const opened: Database.Database[] = [];
const dirs: string[] = [];
const migration = readFileSync(fileURLToPath(new URL('../migrations/009_selection_policy.sql', import.meta.url)), 'utf8');
const connect = (path = ':memory:') => { const db = new Database(path); db.exec(migration); opened.push(db); return db; };
afterEach(() => { for (const db of opened.splice(0)) if (db.open) db.close(); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const now = '2026-09-11T00:00:00.000Z';
const policy = (): SelectionPolicy => ({ version: 'cue-selection-v1', mode: 'efficiency', qualityMinimum: 0.8,
  costBasis: 1, timeBasisMs: 1000, currency: 'USD', costLimit: null, remainingTimeMs: null,
  maxEstimateAgeMs: 10_000, allowedCandidateIds: ['b', 'a'], pinnedCandidateId: null });
const save = (db: Database.Database, expectedRevision: number | null = null, value = policy()) => saveSelectionPolicy(db,
  { policyId: 'default', expectedRevision, policy: value, createdAt: now, sourceVersion: 'cue-test-v1' });

describe('S2 immutable SQLite selection policy', () => {
  it('persists nullable fields and canonical sorted identities across real close/reopen', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cue-policy-')); dirs.push(dir); const path = join(dir, 'ledger.sqlite');
    const first = connect(path); const snapshot = save(first); first.close(); const second = connect(path);
    expect(readSelectionPolicy(second, 'default', 1)).toEqual(snapshot);
    expect(snapshot.policy.allowedCandidateIds).toEqual(['a', 'b']);
    expect(snapshot.policy.costLimit).toBeNull(); expect(snapshot.policy.remainingTimeMs).toBeNull();
    expect(snapshot.createdAt).toBe(now); expect(snapshot.sourceVersion).toBe('cue-test-v1');
  });
  it('competing connections cannot both save the same expected revision', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cue-policy-')); dirs.push(dir); const path = join(dir, 'ledger.sqlite');
    const a = connect(path); const b = connect(path); save(a);
    save(a, 1, { ...policy(), mode: 'speed' });
    expect(() => save(b, 1, { ...policy(), mode: 'value' })).toThrow(/revision-conflict/);
    expect(readLatestSelectionPolicy(b, 'default')?.revision).toBe(2);
    expect(a.prepare('SELECT count(*) AS n FROM selection_policy_snapshot').get()).toEqual({ n: 2 });
  });
  it('freezes defensive snapshots and produces deterministic digests for equivalent policy ordering', () => {
    const a = connect(); const b = connect(); const input = policy();
    const first = save(a, null, input); const second = save(b, null, { ...policy(), allowedCandidateIds: ['a', 'b'] });
    expect(first.digest).toBe(second.digest);
    (input.allowedCandidateIds as string[]).push('later');
    expect(first.policy.allowedCandidateIds).toEqual(['a', 'b']);
    expect(Object.isFrozen(first)).toBe(true); expect(Object.isFrozen(first.policy)).toBe(true);
    expect(() => (first.policy.allowedCandidateIds as string[]).push('bad')).toThrow();
  });
  it('binds a run idempotently to an exact immutable policy despite later revisions', () => {
    const db = connect(); const first = save(db);
    const input = { runId: 'run-1', policyId: 'default', revision: 1, digest: first.digest, boundAt: now };
    const bound = bindRunSelectionPolicy(db, input); const next = save(db, 1, { ...policy(), mode: 'performance' });
    expect(bindRunSelectionPolicy(db, { ...input, boundAt: '2026-09-12T00:00:00.000Z' })).toEqual(bound);
    expect(readRunSelectionPolicy(db, 'run-1')?.snapshot).toEqual(first);
    expect(() => bindRunSelectionPolicy(db, { ...input, revision: 2, digest: next.digest })).toThrow(/run-rebind/);
    expect(() => bindRunSelectionPolicy(db, { ...input, runId: 'run-2', digest: 'b'.repeat(64) })).toThrow(/digest-mismatch/);
  });
  it('validates production policy and manual pin even with no candidate availability set', () => {
    const db = connect();
    for (const value of [{ ...policy(), pinnedCandidateId: 'outside' }, { ...policy(), costBasis: 0 },
      { ...policy(), allowedCandidateIds: ['a', 'a'] }, { ...policy(), qualityMinimum: 2 }]) expect(() => save(db, null, value)).toThrow();
    expect(save(db, null, { ...policy(), pinnedCandidateId: 'a' }).policy.pinnedCandidateId).toBe('a');
  });
  it('rejects accessors and inherited/extra privilege fields without invoking caller code', () => {
    const db = connect(); let calls = 0;
    const input = { ...policy(), get mode() { calls++; return 'efficiency' as const; } };
    expect(() => save(db, null, input)).toThrow(/accessor/); expect(calls).toBe(0);
    expect(() => save(db, null, Object.create(policy()))).toThrow();
    expect(() => save(db, null, { ...policy(), allowUnsafe: true } as SelectionPolicy)).toThrow(/fields/);
    expect(() => save(db, null, new Proxy(policy(), {}))).toThrow();
    const ids = ['a']; Object.defineProperty(ids, '0', { get() { calls++; return 'a'; } });
    expect(() => save(db, null, { ...policy(), allowedCandidateIds: ids })).toThrow(); expect(calls).toBe(0);
  });
  it('database triggers reject in-place policy and binding mutation or deletion', () => {
    const db = connect(); const s = save(db);
    bindRunSelectionPolicy(db, { runId: 'run-1', policyId: s.policyId, revision: s.revision, digest: s.digest, boundAt: now });
    expect(() => db.exec("UPDATE selection_policy_snapshot SET source_version='modified'")).toThrow(/immutable/);
    expect(() => db.exec('DELETE FROM selection_policy_snapshot')).toThrow(/immutable/);
    expect(() => db.exec("UPDATE selection_run_policy SET run_id='other'")).toThrow(/immutable/);
    expect(() => db.exec('DELETE FROM selection_run_policy')).toThrow(/immutable/);
  });
  it('read and bind fail closed if stored policy content or provenance is corrupted', () => {
    const db = connect(); const s = save(db);
    db.exec('DROP TRIGGER selection_policy_snapshot_no_update');
    db.prepare('UPDATE selection_policy_snapshot SET source_version=?').run('corrupted');
    expect(() => readSelectionPolicy(db, 'default', 1)).toThrow(/corrupt/);
    expect(() => save(db, 1)).toThrow(/corrupt/);
    expect(() => bindRunSelectionPolicy(db, { runId: 'r', policyId: 'default', revision: 1, digest: s.digest, boundAt: now })).toThrow(/corrupt/);
  });
  it('REPLACE and UPSERT cannot bypass immutable identity with recursive triggers disabled', () => {
    const db = connect(); const s = save(db);
    const bound = bindRunSelectionPolicy(db, { runId: 'run-1', policyId: s.policyId, revision: 1, digest: s.digest, boundAt: now });
    db.pragma('recursive_triggers = OFF');
    const policyInsert = 'INTO selection_policy_snapshot(policy_id,revision,digest,policy_json,created_at,source_version) VALUES(?,?,?,?,?,?)';
    const policyValues = [s.policyId, 1, s.digest, JSON.stringify(s.policy), now, 'modified'];
    expect(() => db.prepare(`INSERT OR REPLACE ${policyInsert}`).run(...policyValues)).toThrow(/immutable/);
    expect(() => db.prepare(`INSERT ${policyInsert} ON CONFLICT(policy_id,revision) DO UPDATE SET source_version=excluded.source_version`).run(...policyValues)).toThrow(/immutable/);
    const bindingInsert = 'INTO selection_run_policy(run_id,policy_id,revision,digest,bound_at) VALUES(?,?,?,?,?)';
    const bindingValues = ['run-1', s.policyId, 1, s.digest, '2026-09-12T00:00:00.000Z'];
    expect(() => db.prepare(`INSERT OR REPLACE ${bindingInsert}`).run(...bindingValues)).toThrow(/immutable/);
    expect(() => db.prepare(`INSERT ${bindingInsert} ON CONFLICT(run_id) DO UPDATE SET bound_at=excluded.bound_at`).run(...bindingValues)).toThrow(/immutable/);
    expect(readSelectionPolicy(db, 'default', 1)).toEqual(s);
    expect(readRunSelectionPolicy(db, 'run-1')).toEqual(bound);
  });
  it('read fails closed for malformed stored JSON and corrupted binding digest', () => {
    const db = connect(); const s = save(db);
    bindRunSelectionPolicy(db, { runId: 'r', policyId: 'default', revision: 1, digest: s.digest, boundAt: now });
    db.exec('PRAGMA foreign_keys=OFF; DROP TRIGGER selection_run_policy_no_update');
    db.prepare('UPDATE selection_run_policy SET digest=?').run('c'.repeat(64));
    expect(() => readRunSelectionPolicy(db, 'r')).toThrow(/corrupt-binding/);
    db.exec('DROP TRIGGER selection_policy_snapshot_no_update');
    db.prepare('UPDATE selection_policy_snapshot SET policy_json=?').run('{broken');
    expect(() => readLatestSelectionPolicy(db, 'default')).toThrow();
  });
});
