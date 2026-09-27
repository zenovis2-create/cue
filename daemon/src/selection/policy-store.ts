import { createHash } from 'node:crypto';
import { types } from 'node:util';
import type { Ledger } from '../ledger.js';
import { selectCandidate, type SelectionPolicy } from './policy.js';

export interface StoredSelectionPolicy {
  readonly policyId: string;
  readonly revision: number;
  readonly digest: string;
  readonly policy: Readonly<SelectionPolicy>;
  readonly createdAt: string;
  readonly sourceVersion: string;
}
export interface SaveSelectionPolicy {
  policyId: string;
  expectedRevision: number | null;
  policy: SelectionPolicy;
  createdAt: string;
  sourceVersion: string;
}
export interface BindRunPolicy {
  runId: string;
  policyId: string;
  revision: number;
  digest: string;
  boundAt: string;
}
export interface StoredRunPolicy {
  readonly runId: string;
  readonly boundAt: string;
  readonly snapshot: StoredSelectionPolicy;
}
const policyKeys = ['version', 'mode', 'qualityMinimum', 'costBasis', 'timeBasisMs', 'currency', 'costLimit',
  'remainingTimeMs', 'maxEstimateAgeMs', 'allowedCandidateIds', 'pinnedCandidateId'] as const;
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
function fail(reason: string): never { throw new TypeError(`invalid_policy_store:${reason}`); }
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) fail('record');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const own = Reflect.ownKeys(descriptors);
  if (own.length !== keys.length || own.some(key => typeof key !== 'string' || !keys.includes(key))) fail('fields');
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const d = descriptors[key];
    if (!d || !Object.hasOwn(d, 'value') || !d.enumerable) fail('accessor');
    result[key] = d.value;
  }
  return result;
}
function identifier(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/u.test(value)) fail('id');
  return value;
}
function revision(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value >= Number.MAX_SAFE_INTEGER) fail('revision');
  return value;
}
function timestamp(value: unknown): string {
  if (typeof value !== 'string' || value.length !== 24 || !Number.isFinite(Date.parse(value))
      || new Date(value).toISOString() !== value) fail('timestamp');
  return value;
}
function hash(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/u.test(value)) fail('digest');
  return value;
}
function snapshotPolicy(value: unknown): Readonly<SelectionPolicy> {
  const data = record(value, policyKeys);
  const input = data.allowedCandidateIds;
  if (!Array.isArray(input) || types.isProxy(input) || Object.getPrototypeOf(input) !== Array.prototype) fail('candidate-ids');
  const length = Object.getOwnPropertyDescriptor(input, 'length')!.value as number;
  if (length > 1000 || Reflect.ownKeys(input).length !== length + 1) fail('candidate-ids');
  const candidates: string[] = [];
  for (let i = 0; i < length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(i));
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'string') fail('candidate-ids');
    candidates.push(descriptor.value);
  }
  data.allowedCandidateIds = Object.freeze(candidates.sort(compare));
  const policy = data as unknown as SelectionPolicy;
  // Reuse the production selector's validation without inventing candidates/estimates.
  selectCandidate(policy, [], 0);
  if (policy.pinnedCandidateId !== null && !policy.allowedCandidateIds.includes(policy.pinnedCandidateId)) fail('pin-not-allowed');
  return Object.freeze(policy);
}
function contentHash(policyId: string, rev: number, policy: Readonly<SelectionPolicy>, createdAt: string, sourceVersion: string): string {
  return createHash('sha256').update(JSON.stringify({ policyId, revision: rev, policy, createdAt, sourceVersion })).digest('hex');
}
interface SnapshotRow { policy_id: string; revision: number; digest: string; policy_json: string; created_at: string; source_version: string }
function decode(row: SnapshotRow): StoredSelectionPolicy {
  const policyId = identifier(row.policy_id); const rev = revision(row.revision);
  const createdAt = timestamp(row.created_at); const sourceVersion = identifier(row.source_version);
  if (typeof row.policy_json !== 'string' || row.policy_json.length > 1_048_576) fail('stored-json');
  const policy = snapshotPolicy(JSON.parse(row.policy_json));
  if (JSON.stringify(policy) !== row.policy_json || contentHash(policyId, rev, policy, createdAt, sourceVersion) !== hash(row.digest)) fail('corrupt-snapshot');
  return Object.freeze({ policyId, revision: rev, digest: row.digest, policy, createdAt, sourceVersion });
}
export function readSelectionPolicy(db: Ledger, policyId: string, policyRevision: number): StoredSelectionPolicy | null {
  identifier(policyId); revision(policyRevision);
  const row = db.prepare('SELECT * FROM selection_policy_snapshot WHERE policy_id=? AND revision=?').get(policyId, policyRevision) as SnapshotRow | undefined;
  return row ? decode(row) : null;
}
export function readLatestSelectionPolicy(db: Ledger, policyId: string): StoredSelectionPolicy | null {
  identifier(policyId);
  const row = db.prepare('SELECT * FROM selection_policy_snapshot WHERE policy_id=? ORDER BY revision DESC LIMIT 1').get(policyId) as SnapshotRow | undefined;
  return row ? decode(row) : null;
}
export function saveSelectionPolicy(db: Ledger, input: SaveSelectionPolicy): StoredSelectionPolicy {
  const data = record(input, ['policyId', 'expectedRevision', 'policy', 'createdAt', 'sourceVersion']);
  const policyId = identifier(data.policyId); const createdAt = timestamp(data.createdAt); const sourceVersion = identifier(data.sourceVersion);
  const expected = data.expectedRevision === null ? null : revision(data.expectedRevision);
  const policy = snapshotPolicy(data.policy);
  return db.transaction(() => {
    const previous = readLatestSelectionPolicy(db, policyId);
    if ((previous?.revision ?? null) !== expected) fail('revision-conflict');
    const rev = revision((previous?.revision ?? 0) + 1);
    const snapshot = Object.freeze({ policyId, revision: rev,
      digest: contentHash(policyId, rev, policy, createdAt, sourceVersion), policy, createdAt, sourceVersion });
    db.prepare('INSERT INTO selection_policy_snapshot(policy_id,revision,digest,policy_json,created_at,source_version) VALUES(?,?,?,?,?,?)')
      .run(policyId, rev, snapshot.digest, JSON.stringify(policy), createdAt, sourceVersion);
    return snapshot;
  }).immediate();
}
interface BindingRow { run_id: string; policy_id: string; revision: number; digest: string; bound_at: string }
function decodeBinding(db: Ledger, row: BindingRow): StoredRunPolicy {
  const runId = identifier(row.run_id); const boundAt = timestamp(row.bound_at);
  const snapshot = readSelectionPolicy(db, identifier(row.policy_id), revision(row.revision));
  if (!snapshot || snapshot.digest !== hash(row.digest)) fail('corrupt-binding');
  return Object.freeze({ runId, boundAt, snapshot });
}
export function readRunSelectionPolicy(db: Ledger, runId: string): StoredRunPolicy | null {
  identifier(runId);
  const row = db.prepare('SELECT * FROM selection_run_policy WHERE run_id=?').get(runId) as BindingRow | undefined;
  return row ? decodeBinding(db, row) : null;
}
/** Binding is idempotent for exact policy identity. The first boundAt remains authoritative. */
export function bindRunSelectionPolicy(db: Ledger, input: BindRunPolicy): StoredRunPolicy {
  const data = record(input, ['runId', 'policyId', 'revision', 'digest', 'boundAt']);
  const runId = identifier(data.runId); const policyId = identifier(data.policyId); const rev = revision(data.revision);
  const expectedDigest = hash(data.digest); const boundAt = timestamp(data.boundAt);
  return db.transaction(() => {
    const snapshot = readSelectionPolicy(db, policyId, rev);
    if (!snapshot || snapshot.digest !== expectedDigest) fail('binding-digest-mismatch');
    const previous = readRunSelectionPolicy(db, runId);
    if (previous) {
      if (previous.snapshot.policyId !== policyId || previous.snapshot.revision !== rev || previous.snapshot.digest !== expectedDigest) fail('run-rebind');
      return previous;
    }
    db.prepare('INSERT INTO selection_run_policy(run_id,policy_id,revision,digest,bound_at) VALUES(?,?,?,?,?)').run(runId, policyId, rev, expectedDigest, boundAt);
    return Object.freeze({ runId, boundAt, snapshot });
  }).immediate();
}
