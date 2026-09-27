import { createHash } from 'node:crypto';
import { types } from 'node:util';
import type { Ledger } from './ledger.js';

const MAX_BYTES = 65536;
const PREFIX = 'cue-cleanup:';
const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9:_-]{1,128}$/.test(v);
// Candidate identities follow integration-catalog's canonical ID contract;
// run/session/task identifiers retain their existing narrower validation.
const candidateId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/.test(v);
const hash = (v: Buffer) => createHash('sha256').update(v).digest('hex');
type Row = { sha256: string; run_id: string; subject_digest: string; session_handle: string | null; payload: Buffer };
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
function canonical(input: unknown): Buffer {
  let nodes = 0, bytes = 0;
  const seen = new Set<object>();
  function visit(v: unknown, depth: number): Json {
    if (++nodes > 4096 || depth > 8) throw Error('cleanup_observation_bounds');
    if (v === null || typeof v === 'boolean') return v;
    if (typeof v === 'number') { if (!Number.isSafeInteger(v) || Object.is(v, -0)) throw Error('cleanup_observation_number'); return v; }
    if (typeof v === 'string') {
      if (v.length > MAX_BYTES || (bytes += Buffer.byteLength(JSON.stringify(v))) > MAX_BYTES) throw Error('cleanup_observation_bounds');
      return v;
    }
    if (typeof v !== 'object' || types.isProxy(v) || seen.has(v)) throw Error('cleanup_observation_plain_data');
    const array = Array.isArray(v), proto = Object.getPrototypeOf(v);
    if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) throw Error('cleanup_observation_plain_data');
    const keys = Reflect.ownKeys(v);
    if (keys.length > 257 || keys.some(k => typeof k !== 'string')) throw Error('cleanup_observation_bounds');
    seen.add(v);
    try {
      if (array) {
        if (v.length > 256 || keys.length !== v.length + 1) throw Error('cleanup_observation_array');
        const values: Json[] = [];
        for (let i = 0; i < v.length; i++) {
          const d = Object.getOwnPropertyDescriptor(v, String(i));
          if (!d?.enumerable || !Object.hasOwn(d, 'value')) throw Error('cleanup_observation_plain_data');
          values.push(visit(d.value, depth + 1));
        }
        return values;
      }
      if (keys.length > 256) throw Error('cleanup_observation_bounds');
      const result: { [key: string]: Json } = Object.create(null);
      for (const key of (keys as string[]).sort()) {
        const d = Object.getOwnPropertyDescriptor(v, key)!;
        if (!d.enumerable || !Object.hasOwn(d, 'value')) throw Error('cleanup_observation_plain_data');
        visit(key, depth + 1); result[key] = visit(d.value, depth + 1);
      }
      return result;
    } finally { seen.delete(v); }
  }
  const payload = Buffer.from(JSON.stringify(visit(input, 0)));
  if (payload.length > MAX_BYTES) throw Error('cleanup_observation_bounds');
  return payload;
}
function metadata(payload: Buffer) {
  const v = JSON.parse(payload.toString('utf8')) as Record<string, unknown>;
  if (!v || Array.isArray(v) || typeof v !== 'object' || !id(v.runId) || !candidateId(v.candidateId) || typeof v.role !== 'string' || !['model', 'implementation'].includes(v.role)
    || !digest(v.subjectDigest) || typeof v.measuredAt !== 'string' || !Number.isFinite(Date.parse(v.measuredAt)) || new Date(v.measuredAt).toISOString() !== v.measuredAt
    || typeof v.result !== 'string' || !['verified-clean', 'residual', 'unknown'].includes(v.result) || v.providerStopped !== 'unknown' || v.billing !== 'unknown'
    || typeof v.reason !== 'string' || !v.reason.trim() || v.reason.length > 256) throw Error('cleanup_observation_identity');
  let session: Record<string, unknown> | null = null;
  if (Object.hasOwn(v, 'session')) {
    const s = v.session;
    if (!s || typeof s !== 'object' || Array.isArray(s)) throw Error('cleanup_observation_session');
    session = s as Record<string, unknown>;
    if (Object.keys(session).length !== 6 || !id(session.handle) || session.run_id !== v.runId || !id(session.task_id)
      || !Number.isSafeInteger(session.pid) || Number(session.pid) <= 0 || typeof session.cwd !== 'string' || !session.cwd
      || typeof session.start_time !== 'string' || !session.start_time) throw Error('cleanup_observation_session');
  }
  return { runId: v.runId, subjectDigest: v.subjectDigest, session };
}

/** Protected host persistence only, never a model/plugin API. Content hashes attest
 * to stored bytes, not OS truth, cleanup freshness, or M/P qualification. In particular
 * a stored result string is not a CleanupReceipt; read returns observation bytes only.
 * Read verifies historical identity stored in those bytes, not current session
 * existence, process death, freshness, or the truth of a host-reported result. */
export function createCleanupObservationStore(db: Ledger) {
  function valid(row: Row, refHash: string): boolean {
    try {
      if (!Buffer.isBuffer(row.payload) || row.payload.length > MAX_BYTES || row.sha256 !== refHash || hash(row.payload) !== refHash) return false;
      if (!canonical(JSON.parse(row.payload.toString('utf8'))).equals(row.payload)) return false;
      const m = metadata(row.payload);
      return row.run_id === m.runId && row.subject_digest === m.subjectDigest && row.session_handle === (m.session?.handle ?? null);
    } catch { return false; }
  }
  return Object.freeze({
    persist(observation: Readonly<Record<string, unknown>>): string {
      // A nested SQLite transaction is a savepoint, not a durable commit. Never issue
      // a receipt reference that an enclosing caller can later roll back.
      if (db.inTransaction) throw Error('cleanup_observation_outer_transaction');
      const payload = canonical(observation), m = metadata(payload), sha256 = hash(payload);
      db.transaction(() => {
        const run = db.prepare('SELECT task_id FROM run WHERE id=?').get(m.runId) as { task_id: string } | undefined;
        if (!run) throw Error('cleanup_observation_missing_run');
        if (m.session) {
          const s = db.prepare('SELECT * FROM session_handle WHERE handle=?').get(m.session.handle) as Record<string, unknown> | undefined;
          if (!s || m.session.task_id !== run.task_id || Object.entries(m.session).some(([key,value]) => s[key] !== value)) throw Error('cleanup_observation_session_mismatch');
        }
        const existing = db.prepare('SELECT * FROM cleanup_observation WHERE sha256=?').get(sha256) as Row | undefined;
        if (existing) {
          if (!valid(existing, sha256) || !existing.payload.equals(payload)) throw Error('cleanup_observation_collision');
        } else db.prepare('INSERT INTO cleanup_observation VALUES(?,?,?,?,?)').run(sha256, m.runId, m.subjectDigest, m.session?.handle ?? null, payload);
      }).immediate();
      return PREFIX + sha256;
    },
    read(ref: string): Uint8Array | undefined {
      if (typeof ref !== 'string' || !ref.startsWith(PREFIX) || !digest(ref.slice(PREFIX.length))) return undefined;
      try {
        const sha256 = ref.slice(PREFIX.length), row = db.prepare('SELECT * FROM cleanup_observation WHERE sha256=?').get(sha256) as Row | undefined;
        return row && valid(row, sha256) ? Buffer.from(row.payload) : undefined;
      } catch { return undefined; }
    },
  });
}
