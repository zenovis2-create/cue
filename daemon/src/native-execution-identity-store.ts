import { createHash } from 'node:crypto';
import { win32 } from 'node:path';
import { types } from 'node:util';
import type { Ledger } from './ledger.js';
import type { SessionRecord } from './session-spawn.js';

export interface NativeProcessIdentity { readonly pid: number; readonly createdFileTime: string }
export interface NativeExecutionIdentity {
  readonly version: 'cue-native-execution-identity-v1';
  readonly runId: string; readonly candidateId: string; readonly role: 'model'; readonly subjectDigest: string;
  readonly session: Readonly<SessionRecord>;
  readonly processes: Readonly<{ launcher: NativeProcessIdentity; client: NativeProcessIdentity; guardian: NativeProcessIdentity }>;
  readonly boundary: Readonly<{ profile: string; sid: string; taskRoot: string; profilePath: string; clientKind: 'model' | 'json-checker' | 'goal-proposal-checker';
    controlBundleSha256: string; launcherSha256: string; clientSha256: string; guardianSha256: string }>;
  readonly observedAt: string;
}
type Row = { sha256: string; run_id: string; session_handle: string; candidate_id: string; subject_digest: string; payload: Buffer };
const PREFIX = 'cue-native-identity:';
const MAX_BYTES = 16384;
const fail = (code: string): never => { throw Error('native_identity_' + code); };
const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9:_-]{1,128}$/.test(v);
const candidate = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/.test(v);
const pid = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0 && v <= 2147483647;
const hash = (v: Buffer) => createHash('sha256').update(v).digest('hex');
function data(v: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!v || typeof v !== 'object' || types.isProxy(v) || Object.getPrototypeOf(v) !== Object.prototype) return fail('plain_record');
  const descriptors = Object.getOwnPropertyDescriptors(v);
  if (Reflect.ownKeys(descriptors).length !== keys.length) return fail('fields');
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const field = descriptors[key];
    if (!field?.enumerable || !Object.hasOwn(field, 'value')) return fail('fields');
    result[key] = field.value;
  }
  return result;
}
function path(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= 2048 && !v.includes('\0') && /^[A-Za-z]:[\\/]/.test(v)
    && !v.split(/[\\/]/).some(part => part === '.' || part === '..');
}
function processIdentity(v: unknown): NativeProcessIdentity {
  const value = data(v, ['pid', 'createdFileTime']);
  if (!pid(value.pid) || typeof value.createdFileTime !== 'string' || !/^[1-9]\d{0,19}$/.test(value.createdFileTime)
    || BigInt(value.createdFileTime) > 18446744073709551615n) return fail('process');
  return Object.freeze({ pid: value.pid, createdFileTime: value.createdFileTime });
}
function snapshot(input: unknown): Readonly<NativeExecutionIdentity> {
  const v = data(input, ['version','runId','candidateId','role','subjectDigest','session','processes','boundary','observedAt']);
  if (v.version !== 'cue-native-execution-identity-v1' || !id(v.runId) || !candidate(v.candidateId) || v.role !== 'model' || !digest(v.subjectDigest)
    || typeof v.observedAt !== 'string' || !Number.isFinite(Date.parse(v.observedAt)) || new Date(v.observedAt).toISOString() !== v.observedAt) return fail('metadata');
  const s = data(v.session, ['handle','pid','start_time','cwd','task_id','run_id']);
  if (!id(s.handle) || !pid(s.pid) || typeof s.start_time !== 'string' || !s.start_time || s.start_time.length > 128 || !path(s.cwd)
    || !id(s.task_id) || s.run_id !== v.runId) return fail('session');
  const p = data(v.processes, ['launcher','client','guardian']);
  const processes = Object.freeze({ launcher: processIdentity(p.launcher), client: processIdentity(p.client), guardian: processIdentity(p.guardian) });
  if (processes.launcher.pid !== s.pid || new Set(Object.values(processes).map(value => value.pid)).size !== 3) return fail('process_lineage');
  const b = data(v.boundary, ['profile','sid','taskRoot','profilePath','clientKind','controlBundleSha256','launcherSha256','clientSha256','guardianSha256']);
  if (typeof b.profile !== 'string' || !/^Cue\.Model\.[a-f0-9]{32}$/.test(b.profile) || typeof b.sid !== 'string' || b.sid.length > 256
    || !/^S-1-15-2-\d+(?:-\d+)+$/.test(b.sid) || !path(b.taskRoot) || !path(b.profilePath)
    || win32.basename(b.taskRoot).toLowerCase() !== b.profile.toLowerCase() || win32.basename(b.profilePath).toLowerCase() !== 'ac' || win32.basename(win32.dirname(b.profilePath)).toLowerCase() !== b.profile.toLowerCase()
    || typeof b.clientKind !== 'string' || !['model','json-checker','goal-proposal-checker'].includes(b.clientKind)
    || ![b.controlBundleSha256,b.launcherSha256,b.clientSha256,b.guardianSha256].every(digest)) return fail('boundary');
  return Object.freeze({ version: v.version, runId: v.runId, candidateId: v.candidateId, role: v.role, subjectDigest: v.subjectDigest,
    session: Object.freeze(s) as unknown as Readonly<SessionRecord>, processes, boundary: Object.freeze(b) as unknown as NativeExecutionIdentity['boundary'], observedAt: v.observedAt });
}
function encode(value: Readonly<NativeExecutionIdentity>): Buffer {
  const bytes = Buffer.from(JSON.stringify(value));
  if (bytes.length > MAX_BYTES) return fail('bounds');
  return bytes;
}

/** Host-owned recorded structure and ledger lineage only. No OS observations,
 * execution/deletion authority, cleanup receipt, acceptance or qualification.
 * session.start_time is host metadata; it never substitutes for createdFileTime.
 * Workflow parent/stage authorization belongs to the protected caller. */
export function createNativeExecutionIdentityStore(db: Ledger) {
  function linked(value: NativeExecutionIdentity): boolean {
    const row = db.prepare('SELECT s.* FROM session_handle s JOIN run r ON r.id=s.run_id AND r.task_id=s.task_id WHERE s.handle=?').get(value.session.handle) as Record<string, unknown> | undefined;
    return Boolean(row && Object.entries(value.session).every(([key, field]) => row[key] === field));
  }
  function readRow(row: Row): Readonly<NativeExecutionIdentity> {
    if (!Buffer.isBuffer(row.payload) || !row.payload.length || row.payload.length > MAX_BYTES || !digest(row.sha256) || hash(row.payload) !== row.sha256) return fail('integrity');
    const value = snapshot(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(row.payload)));
    if (!encode(value).equals(row.payload) || row.run_id !== value.runId || row.session_handle !== value.session.handle
      || row.candidate_id !== value.candidateId || row.subject_digest !== value.subjectDigest || !linked(value)) return fail('integrity');
    return value;
  }
  return Object.freeze({
    record(input: NativeExecutionIdentity): string {
      if (db.inTransaction) return fail('outer_transaction');
      const value = snapshot(input), payload = encode(value), sha256 = hash(payload);
      db.transaction(() => {
        if (!linked(value)) return fail('session_linkage');
        const existing = db.prepare('SELECT * FROM native_execution_identity WHERE session_handle=? OR sha256=?').all(value.session.handle, sha256) as Row[];
        if (existing.length) {
          if (existing.length !== 1 || existing[0]!.sha256 !== sha256 || !existing[0]!.payload.equals(payload)) return fail('immutable_conflict');
          readRow(existing[0]!);
        } else db.prepare('INSERT INTO native_execution_identity VALUES(?,?,?,?,?,?)').run(sha256,value.runId,value.session.handle,value.candidateId,value.subjectDigest,payload);
      }).immediate();
      return PREFIX + sha256;
    },
    read(ref: string): Readonly<NativeExecutionIdentity> | null {
      if (typeof ref !== 'string' || !ref.startsWith(PREFIX) || !digest(ref.slice(PREFIX.length))) return null;
      try {
        const row = db.prepare('SELECT * FROM native_execution_identity WHERE sha256=?').get(ref.slice(PREFIX.length)) as Row | undefined;
        return row ? readRow(row) : null;
      } catch { return null; }
    },
  });
}
