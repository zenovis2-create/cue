import { createHash } from 'node:crypto';
import { types } from 'node:util';
import type { Ledger } from './ledger.js';
import { WRITE_PROBES, MODEL_PROBES, type Probe, type EvidenceRef } from './capability-admission.js';

export interface HostMeasurement {
  probe: Probe; subjectDigest: string; measuredAt: string;
  kind: 'live' | 'fixture'; status: 'pass' | 'fail' | 'unknown'; observation: Uint8Array;
}
const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const digest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
type Row = { id: string; payload_sha256: string; subject_digest: string; probe: Probe; measured_at: string;
  payload: Buffer; observation: Buffer; observation_sha256: string };
function fields(value: unknown, keys: string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) throw Error('invalid_evidence_input');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length !== keys.length || keys.some(key => !descriptors[key]?.enumerable || !Object.hasOwn(descriptors[key], 'value'))) throw Error('invalid_evidence_input');
}

/** Host-owned store in the protected ledger. Hashes prove integrity, not probe truth.
 * Only independently executed host probes may record live pass observations.
 * This API must never be exposed as a model tool or plugin permission.
 */
export function createCapabilityEvidenceStore(db: Ledger, now: () => number) {
  return Object.freeze({
    record(measurement: HostMeasurement): Readonly<EvidenceRef> {
      fields(measurement, ['probe', 'subjectDigest', 'measuredAt', 'kind', 'status', 'observation']);
      const { probe, subjectDigest, measuredAt, kind, status, observation } = measurement;
      const current = now();
      if (![...WRITE_PROBES, ...MODEL_PROBES].includes(probe) || !digest(subjectDigest) ||
          typeof measuredAt !== 'string' || !Number.isFinite(Date.parse(measuredAt)) || new Date(measuredAt).toISOString() !== measuredAt ||
          !Number.isSafeInteger(current) || Date.parse(measuredAt) > current ||
          !['live', 'fixture'].includes(kind) || !['pass', 'fail', 'unknown'].includes(status) ||
          !(observation instanceof Uint8Array) || types.isProxy(observation) || !observation.byteLength || observation.byteLength > 1_048_576) throw Error('invalid_host_measurement');
      const bytes = Buffer.from(observation);
      const payload = Buffer.from(JSON.stringify({ probe, subjectDigest, measuredAt, kind, status }));
      const sha256 = hash(payload), observationHash = hash(bytes), id = hash(sha256 + ':' + observationHash);
      db.transaction(() => {
        const existing = db.prepare('SELECT * FROM capability_evidence WHERE id=?').get(id) as Row | undefined;
        if (existing) {
          if (existing.payload_sha256 !== sha256 || !existing.payload.equals(payload) || !existing.observation.equals(bytes)) throw Error('evidence_collision');
          return;
        }
        db.prepare('INSERT INTO capability_evidence VALUES(?,?,?,?,?,?,?,?)').run(id, sha256, subjectDigest, probe, measuredAt, payload, bytes, observationHash);
      }).immediate();
      return Object.freeze({ id, sha256 });
    },
    resolveEvidence(ref: Readonly<EvidenceRef>): Uint8Array | undefined {
      fields(ref, ['id', 'sha256']);
      if (!digest(ref.id) || !digest(ref.sha256)) return undefined;
      const row = db.prepare('SELECT * FROM capability_evidence WHERE id=?').get(ref.id) as Row | undefined;
      if (!row || row.payload_sha256 !== ref.sha256 || hash(row.payload) !== ref.sha256 ||
          hash(row.observation) !== row.observation_sha256 || hash(row.payload_sha256 + ':' + row.observation_sha256) !== ref.id) return undefined;
      // Cached references cannot replay a pass after a newer failure or a
      // simultaneous conflicting observation has revoked that measurement.
      const latest = db.prepare(`SELECT MAX(measured_at) AS measured_at FROM capability_evidence
        WHERE subject_digest=? AND probe=?`).get(row.subject_digest, row.probe) as { measured_at: string };
      if (latest.measured_at !== row.measured_at) return undefined;
      const variants = db.prepare(`SELECT COUNT(DISTINCT payload_sha256) AS n FROM capability_evidence
        WHERE subject_digest=? AND probe=? AND measured_at=?`).get(row.subject_digest, row.probe, latest.measured_at) as { n: number };
      if (variants.n !== 1) return undefined;
      return Buffer.from(row.payload);
    },
    referencesFor(subjectDigest: string): Readonly<Partial<Record<Probe, Readonly<EvidenceRef>>>> {
      if (!digest(subjectDigest)) throw Error('invalid_subject_digest');
      const rows = db.prepare(`SELECT e.* FROM capability_evidence e WHERE subject_digest=? AND measured_at=(
        SELECT MAX(n.measured_at) FROM capability_evidence n WHERE n.subject_digest=e.subject_digest AND n.probe=e.probe)
        ORDER BY probe,id LIMIT 1001`).all(subjectDigest) as Row[];
      if (rows.length > 1000) throw Error('evidence_conflict_limit');
      const result: Partial<Record<Probe, Readonly<EvidenceRef>>> = {};
      for (const probe of [...WRITE_PROBES, ...MODEL_PROBES]) {
        const latest = rows.filter(row => row.probe === probe);
        // Conflicting verdicts at the same timestamp cannot be tie-broken into permission.
        if (latest.length && new Set(latest.map(row => row.payload_sha256)).size === 1) {
          result[probe] = Object.freeze({ id: latest[0]!.id, sha256: latest[0]!.payload_sha256 });
        }
      }
      return Object.freeze(result);
    },
  });
}
