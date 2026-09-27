import { createHash } from 'node:crypto';
import { types } from 'node:util';
import { SUBJECT_FIELDS, subjectDigest } from './measurement-subject.js';
import type { MeasurementSubject } from './measurement-subject.js';

// Host-owned admission foundation. No adapter activation or permission grant occurs here.
export const WRITE_PROBES = Object.freeze([
  'P1', 'P2', 'P3', 'P4', 'P5', 'B1', 'B2', 'B3', 'B4', 'B5',
  'B5.normal', 'B5.stop', 'B5.crash',
] as const);
export const MODEL_PROBES = Object.freeze(['M1', 'M2', 'M3'] as const);
export type Probe = typeof WRITE_PROBES[number] | typeof MODEL_PROBES[number];
export type ReasonCode = 'invalid-host-policy' | 'invalid-subject' | 'missing' | 'malformed'
  | 'untrusted-or-missing-evidence' | 'artifact-drift' | 'subject-drift'
  | 'fixture' | 'future' | 'stale' | 'fail' | 'unknown';
export interface Denial { readonly probe: Probe | 'all'; readonly code: ReasonCode }
export interface Admission {
  readonly implementationEligible: boolean;
  readonly modelOnlyEligible: boolean;
  readonly reasons: readonly Denial[];
}
export interface EvidenceRef { readonly id: string; readonly sha256: string }
export interface HostEvidencePolicy {
  // HOST ONLY: look up an opaque ID in an independently owned measurement store.
  // Return bytes from an existing trusted artifact, never a model/manifest-provided
  // path or payload. Integrity checks below cannot prove semantic probe truth.
  readonly resolveEvidence: (ref: Readonly<EvidenceRef>) => Uint8Array | undefined;
  readonly now: () => number;
  readonly maxAgeMs: number;
}
const HASH = /^[a-f0-9]{64}$/;
// Only plain JSON data crosses this boundary. Reject proxies before reflection,
// and inspect descriptors without invoking accessors or toJSON methods.
const record = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || types.isProxy(value) || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  return Reflect.ownKeys(value).every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    return typeof key === 'string' && descriptor.enumerable && Object.hasOwn(descriptor, 'value');
  });
};
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

/** Candidate input contains references only; host controls evidence, clock and TTL.
 * Decisions are snapshots, not durable permissions. Re-evaluate at execution time.
 */
export function createCapabilityAdmission(policy: HostEvidencePolicy) {
  const { resolveEvidence, now, maxAgeMs } = policy;
  return (subject: unknown, references: unknown): Admission => {
    const reasons: Denial[] = [];
    const result = (): Admission => Object.freeze({
      implementationEligible: !reasons.some(r => r.probe === 'all' || (WRITE_PROBES as readonly string[]).includes(r.probe)),
      modelOnlyEligible: !reasons.some(r => r.probe === 'all' || (MODEL_PROBES as readonly string[]).includes(r.probe)),
      reasons: Object.freeze(reasons.map(r => Object.freeze(r))),
    });
    let timestamp: number;
    try { timestamp = now(); } catch { timestamp = NaN; }
    if (!Number.isFinite(timestamp) || !Number.isFinite(maxAgeMs) || maxAgeMs <= 0 || typeof resolveEvidence !== 'function') {
      reasons.push({ probe: 'all', code: 'invalid-host-policy' }); return result();
    }
    if (!record(subject) || !exactKeys(subject, SUBJECT_FIELDS) || SUBJECT_FIELDS.some(key =>
      typeof subject[key] !== 'string' || (subject[key] as string).trim() === '' ||
      (key.endsWith('Sha256') && !HASH.test(subject[key] as string)))) {
      reasons.push({ probe: 'all', code: 'invalid-subject' }); return result();
    }
    const digest = subjectDigest(subject as MeasurementSubject);
    const refs = record(references) ? references : {};
    if (!record(references) || Object.keys(refs).some(key => ![...WRITE_PROBES, ...MODEL_PROBES].includes(key as Probe))) {
      reasons.push({ probe: 'all', code: 'malformed' });
    }
    for (const probe of [...WRITE_PROBES, ...MODEL_PROBES]) {
      const deny = (code: ReasonCode) => reasons.push({ probe, code });
      if (!Object.hasOwn(refs, probe)) { deny('missing'); continue; }
      const ref = refs[probe];
      if (!record(ref) || !exactKeys(ref, ['id', 'sha256']) || typeof ref.id !== 'string' ||
          !ref.id.trim() || typeof ref.sha256 !== 'string' || !HASH.test(ref.sha256)) {
        deny('malformed'); continue;
      }
      let bytes: Uint8Array | undefined;
      try { bytes = resolveEvidence(Object.freeze({ id: ref.id, sha256: ref.sha256 })); }
      catch { deny('untrusted-or-missing-evidence'); continue; }
      if (!(bytes instanceof Uint8Array)) { deny('untrusted-or-missing-evidence'); continue; }
      if (createHash('sha256').update(bytes).digest('hex') !== ref.sha256) { deny('artifact-drift'); continue; }
      let evidence: unknown;
      try { evidence = JSON.parse(Buffer.from(bytes).toString('utf8')); } catch { deny('malformed'); continue; }
      if (!record(evidence) || !exactKeys(evidence, ['probe', 'subjectDigest', 'measuredAt', 'kind', 'status']) ||
          evidence.probe !== probe || typeof evidence.subjectDigest !== 'string' || !HASH.test(evidence.subjectDigest) ||
          !['live', 'fixture'].includes(evidence.kind as string) || !['pass', 'fail', 'unknown'].includes(evidence.status as string) ||
          typeof evidence.measuredAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(evidence.measuredAt) ||
          !Number.isFinite(Date.parse(evidence.measuredAt)) || new Date(evidence.measuredAt).toISOString() !== evidence.measuredAt) {
        deny('malformed'); continue;
      }
      if (evidence.subjectDigest !== digest) { deny('subject-drift'); continue; }
      if (evidence.kind !== 'live') { deny('fixture'); continue; }
      const age = timestamp - Date.parse(evidence.measuredAt);
      if (age < 0) { deny('future'); continue; }
      if (age >= maxAgeMs) { deny('stale'); continue; }
      if (evidence.status !== 'pass') deny(evidence.status as 'fail' | 'unknown');
    }
    return result();
  };
}
