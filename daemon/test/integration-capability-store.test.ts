import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openLedger, type Ledger } from '../src/ledger.js';
import { createCapabilityEvidenceStore, type HostMeasurement } from '../src/capability-store.js';
import { createCapabilityAdmission, MODEL_PROBES } from '../src/capability-admission.js';
import { SUBJECT_FIELDS, subjectDigest, type MeasurementSubject } from '../src/measurement-subject.js';
const databases: Ledger[] = []; const paths: string[] = [];
afterEach(() => { for (const db of databases.splice(0)) if (db.open) db.close(); for (const path of paths.splice(0)) rmSync(path, { recursive: true, force: true }); });
const input = (overrides: Partial<HostMeasurement> = {}): HostMeasurement => ({ probe: 'M1', subjectDigest: 'a'.repeat(64),
  measuredAt: new Date(1000).toISOString(), kind: 'fixture', status: 'pass', observation: Buffer.from('synthetic observation'), ...overrides });
function fixture() { const db = openLedger(); databases.push(db); return { db, store: createCapabilityEvidenceStore(db, () => 2000) }; }
test('exact replay and resolution preserve bytes without reading arbitrary filesystem paths', () => {
  const { db, store } = fixture(); const ref = store.record(input());
  expect(store.record(input())).toEqual(ref);
  expect(db.prepare('SELECT COUNT(*) n FROM capability_evidence').get()).toEqual({ n: 1 });
  expect(JSON.parse(Buffer.from(store.resolveEvidence(ref)!).toString())).toMatchObject({ kind: 'fixture', status: 'pass' });
  expect(store.resolveEvidence({ id: '../../auth.json', sha256: ref.sha256 })).toBeUndefined();
  const bytes = store.resolveEvidence(ref)!; bytes.fill(0);
  expect(store.resolveEvidence(ref)?.[0]).toBe(123);
});
test('latest failure supersedes pass and simultaneous conflict returns no usable reference', () => {
  const { store } = fixture(); store.record(input());
  const failed = store.record(input({ status: 'fail', measuredAt: new Date(1500).toISOString() }));
  expect(store.referencesFor('a'.repeat(64)).M1).toEqual(failed);
  store.record(input({ status: 'pass', measuredAt: new Date(1500).toISOString() }));
  expect(store.referencesFor('a'.repeat(64)).M1).toBeUndefined();
  expect(store.referencesFor('b'.repeat(64))).toEqual({});
});
test('immutable data cannot be changed through REPLACE, UPDATE or DELETE', () => {
  const { db, store } = fixture(); const ref = store.record(input()); db.pragma('recursive_triggers=OFF');
  expect(() => db.exec('INSERT OR REPLACE INTO capability_evidence SELECT * FROM capability_evidence')).toThrow('immutable');
  expect(() => db.exec("UPDATE capability_evidence SET payload=x'00'")).toThrow('immutable');
  expect(() => db.exec('DELETE FROM capability_evidence')).toThrow('immutable');
  expect(store.resolveEvidence({ id: ref.id, sha256: 'b'.repeat(64) })).toBeUndefined();
});
test('record survives actual SQLite reopen and preserves observed fixture provenance', () => {
  const root = mkdtempSync(join(tmpdir(), 'cue-proof-store-')); paths.push(root);
  const filename = join(root, 'proof.db'); const db = openLedger(filename);
  const ref = createCapabilityEvidenceStore(db, () => 2000).record(input()); db.close();
  const reopened = openLedger(filename); databases.push(reopened);
  const store = createCapabilityEvidenceStore(reopened, () => 2000);
  expect(store.referencesFor('a'.repeat(64)).M1).toEqual(ref);
  expect(JSON.parse(Buffer.from(store.resolveEvidence(ref)!).toString()).kind).toBe('fixture');
});
test('future, invalid and executable data rejected before recording', () => {
  const { store } = fixture();
  expect(() => store.record(input({ measuredAt: new Date(2001).toISOString() }))).toThrow();
  let calls = 0; const value = input(); Object.defineProperty(value, 'status', { get() { calls++; return 'pass'; }, enumerable: true });
  expect(() => store.record(value)).toThrow(); expect(calls).toBe(0);
  expect(() => store.record(input({ observation: Buffer.alloc(0) }))).toThrow();
});
test('real admission consumes store references while fixture summaries remain ineligible', () => {
  const { store } = fixture();
  const subject = Object.fromEntries(SUBJECT_FIELDS.map(key => [key, key.endsWith('Sha256') ? 'a'.repeat(64) : key])) as MeasurementSubject;
  const subjectHash = subjectDigest(subject);
  for (const probe of MODEL_PROBES) store.record(input({ probe, subjectDigest: subjectHash }));
  const admit = createCapabilityAdmission({ now: () => 2000, maxAgeMs: 5000, resolveEvidence: store.resolveEvidence });
  const result = admit(subject, store.referencesFor(subjectHash));
  expect(result.modelOnlyEligible).toBe(false);
  expect(result.reasons.filter(reason => MODEL_PROBES.includes(reason.probe as typeof MODEL_PROBES[number])).map(reason => reason.code)).toEqual(['fixture', 'fixture', 'fixture']);
});
test('cached pass references cannot bypass newer failure or simultaneous conflict', () => {
  const { store } = fixture();
  const subject = Object.fromEntries(SUBJECT_FIELDS.map(key => [key, key.endsWith('Sha256') ? 'a'.repeat(64) : key])) as MeasurementSubject;
  const subjectHash = subjectDigest(subject);
  // Synthetic host observations simulate live records only inside this in-memory test.
  for (const probe of MODEL_PROBES) store.record(input({ probe, subjectDigest: subjectHash, kind: 'live' }));
  const cached = store.referencesFor(subjectHash);
  const admit = createCapabilityAdmission({ now: () => 2000, maxAgeMs: 5000, resolveEvidence: store.resolveEvidence });
  expect(admit(subject, cached).modelOnlyEligible).toBe(true);
  store.record(input({ subjectDigest: subjectHash, kind: 'live', status: 'fail', measuredAt: new Date(1500).toISOString() }));
  expect(admit(subject, cached).modelOnlyEligible).toBe(false);
  const later = store.record(input({ subjectDigest: subjectHash, kind: 'live', status: 'pass', measuredAt: new Date(1600).toISOString() }));
  const refreshed = store.referencesFor(subjectHash);
  expect(admit(subject, refreshed).modelOnlyEligible).toBe(true);
  store.record(input({ subjectDigest: subjectHash, kind: 'live', status: 'fail', measuredAt: new Date(1600).toISOString() }));
  expect(store.resolveEvidence(later)).toBeUndefined();
  expect(admit(subject, refreshed).modelOnlyEligible).toBe(false);
});
