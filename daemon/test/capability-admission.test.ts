import { test } from 'vitest';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createCapabilityAdmission, WRITE_PROBES, MODEL_PROBES } from '../src/capability-admission.js';
import { SUBJECT_FIELDS, subjectDigest } from '../src/measurement-subject.js';

// Synthetic host store: these tests verify policy, never real P13 capability.
const time = Date.parse('2026-09-11T00:00:00.000Z');
function setup() {
  const subject = Object.fromEntries(SUBJECT_FIELDS.map(k => [k, k.endsWith('Sha256') ? 'a'.repeat(64) : 'test-' + k]));
  const store = new Map();
  const refs: Record<string, any> = {};
  const put = (probe: string, override: Record<string, unknown> = {}) => {
    const bytes = Buffer.from(JSON.stringify({ probe, subjectDigest: subjectDigest(subject as Record<(typeof SUBJECT_FIELDS)[number], string>),
      measuredAt: new Date(time - 1).toISOString(), kind: 'live', status: 'pass', ...override }));
    refs[probe] = { id: probe, sha256: createHash('sha256').update(bytes).digest('hex') };
    store.set(probe, bytes);
  };
  for (const p of [...WRITE_PROBES, ...MODEL_PROBES]) put(p);
  const admit = createCapabilityAdmission({ now: () => time, maxAgeMs: 1000, resolveEvidence: ref => store.get(ref.id) });
  return { subject, refs, store, put, admit, decide: () => admit(subject, refs) };
}
test('complete host records allow each role independently; decision is immutable', () => {
  const f = setup(); const decision = f.decide();
  assert.equal(decision.implementationEligible, true);
  assert.equal(decision.modelOnlyEligible, true);
  assert.deepEqual(decision.reasons, []);
  assert.ok(Object.isFrozen(decision)); assert.ok(Object.isFrozen(decision.reasons));
  f.put('M1', { status: 'fail' });
  assert.equal(f.decide().modelOnlyEligible, false);
  assert.equal(f.decide().implementationEligible, true);
});
test('every required probe, including all three cleanup paths, must exist and pass', () => {
  for (const p of [...WRITE_PROBES, ...MODEL_PROBES]) {
    const f = setup(); delete f.refs[p];
    const d = f.decide();
    assert.equal((WRITE_PROBES as readonly string[]).includes(p) ? d.implementationEligible : d.modelOnlyEligible, false, p);
    assert.deepEqual(d.reasons, [{ probe: p, code: 'missing' }]);
  }
});
test('fixture, failed, unknown, malformed, future and expired measurements deny', () => {
  const cases = [ [{ kind: 'fixture' }, 'fixture'], [{ status: 'fail' }, 'fail'],
    [{ status: 'unknown' }, 'unknown'], [{ status: true }, 'malformed'],
    [{ measuredAt: '2026-02-30T00:00:00.000Z' }, 'malformed'],
    [{ measuredAt: new Date(time + 1).toISOString() }, 'future'],
    [{ measuredAt: new Date(time - 1000).toISOString() }, 'stale'],
    [{ probe: 'P2' }, 'malformed'], [{ subjectDigest: 'b'.repeat(64) }, 'subject-drift'] ];
  for (const [change, code] of cases) {
    const f = setup(); f.put('P1', change as Record<string, unknown>);
    assert.equal(f.decide().implementationEligible, false);
    assert.deepEqual(f.decide().reasons, [{ probe: 'P1', code }]);
  }
});
test('artifact mutation, deletion and unknown identity deny', () => {
  const f = setup(); f.store.set('P1', Buffer.from('{}'));
  assert.equal(f.decide().reasons[0].code, 'artifact-drift');
  f.store.delete('P1'); assert.equal(f.decide().reasons[0].code, 'untrusted-or-missing-evidence');
  f.refs.P1.id = 'model-provided-path';
  assert.equal(f.decide().implementationEligible, false);
});
test('every subject field drift invalidates the full vector', () => {
  for (const key of SUBJECT_FIELDS) {
    const f = setup(); f.subject[key] = key.endsWith('Sha256') ? 'b'.repeat(64) : 'changed';
    const d = f.decide(); assert.equal(d.implementationEligible, false); assert.equal(d.modelOnlyEligible, false);
    assert.ok(d.reasons.every(r => r.code === 'subject-drift'));
  }
});
test('self-reported eligibility and malformed input cannot grant permissions', () => {
  const f = setup();
  for (const refs of [null, [], { implementationEligible: true }, { ...f.refs, reportPermission: true }]) {
    const d = f.admit(f.subject, refs); assert.equal(d.implementationEligible, false); assert.equal(d.modelOnlyEligible, false);
  }
  f.refs.P1 = { ...f.refs.P1, status: 'pass' };
  assert.equal(f.decide().reasons[0].code, 'malformed');
  assert.equal(f.admit({}, f.refs).reasons[0].code, 'invalid-subject');
});
test('host resolver errors and invalid host expiry policy fail closed', () => {
  const f = setup();
  const bad = createCapabilityAdmission({ now: () => time, maxAgeMs: 1000, resolveEvidence: () => { throw Error('missing'); } });
  assert.equal(bad(f.subject, f.refs).implementationEligible, false);
  for (const maxAgeMs of [0, -1, Infinity, NaN]) {
    const gate = createCapabilityAdmission({ now: () => time, maxAgeMs, resolveEvidence: ref => f.store.get(ref.id) });
    assert.equal(gate(f.subject, f.refs).reasons[0].code, 'invalid-host-policy');
  }
});
test('accessors, proxies, custom prototypes and symbol fields are denied without executing getters', () => {
  const f = setup(); let accesses = 0;
  const getter = Object.defineProperty({ ...f.subject }, 'osBuild', { enumerable: true, get() { accesses++; throw Error('getter'); } });
  const proxy = new Proxy(f.subject, { getPrototypeOf() { accesses++; throw Error('proxy'); } });
  const revoked = Proxy.revocable(f.subject, {}); revoked.revoke();
  for (const subject of [getter, proxy, revoked.proxy, Object.assign(Object.create({ inherited: true }), f.subject), { ...f.subject, [Symbol('extra')]: 1 }]) {
    assert.equal(f.admit(subject, f.refs).reasons[0].code, 'invalid-subject');
  }
  const refsGetter = Object.defineProperty({ ...f.refs }, 'P1', { enumerable: true, get() { accesses++; throw Error('getter'); } });
  assert.equal(f.admit(f.subject, refsGetter).implementationEligible, false);
  f.refs.P1 = Object.defineProperty({ ...f.refs.P1 }, 'id', { enumerable: true, get() { accesses++; throw Error('getter'); } });
  assert.equal(f.decide().implementationEligible, false);
  assert.equal(accesses, 0);
});
