import { createHash } from 'node:crypto';
import { types } from 'node:util';
import type { Ledger } from '../ledger.js';

export interface LocalSelectionPolicy {
  readonly version: 'cue-local-selection-v1';
  readonly mode: 'efficiency' | 'performance' | 'value' | 'speed';
  readonly producerCandidateId: string;
  readonly checkerCandidateId: string;
  readonly limitAttempts: number;
  readonly timeoutMs: number;
}
export interface StoredLocalSelectionPolicy { readonly policyId: string; readonly revision: number; readonly digest: string; readonly policy: Readonly<LocalSelectionPolicy>; readonly createdAt: string; readonly sourceVersion: string }
export interface LocalRunPolicy { readonly runId: string; readonly boundAt: string; readonly snapshot: StoredLocalSelectionPolicy }
function fail(reason: string): never { throw new TypeError(`invalid_local_policy:${reason}`); }
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) fail('record');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length !== keys.length || Reflect.ownKeys(descriptors).some(k => typeof k !== 'string' || !keys.includes(k))) fail('fields');
  const result: Record<string, unknown> = {};
  for (const key of keys) { const d = descriptors[key]; if (!d || !Object.hasOwn(d, 'value') || !d.enumerable) fail('accessor'); result[key] = d.value; }
  return result;
}
function id(v: unknown): string { if (typeof v !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(v)) fail('id'); return v; }
function integer(v: unknown, min: number, max: number): number { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min || v > max) fail('integer'); return v; }
function revision(v: unknown): number { return integer(v, 1, Number.MAX_SAFE_INTEGER - 1); }
function time(v: unknown): string { if (typeof v !== 'string' || v.length !== 24 || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString() !== v) fail('time'); return v; }
function hash(v: unknown): string { if (typeof v !== 'string' || !/^[a-f0-9]{64}$/.test(v)) fail('digest'); return v; }
export function validateLocalSelectionPolicy(value: unknown): Readonly<LocalSelectionPolicy> {
  const p = record(value, ['version', 'mode', 'producerCandidateId', 'checkerCandidateId', 'limitAttempts', 'timeoutMs']);
  if (p.version !== 'cue-local-selection-v1' || !['efficiency', 'performance', 'value', 'speed'].includes(p.mode as string)) fail('version-mode');
  const producerCandidateId = id(p.producerCandidateId), checkerCandidateId = id(p.checkerCandidateId);
  if (producerCandidateId === checkerCandidateId) fail('same-candidate');
  return Object.freeze({ version: 'cue-local-selection-v1', mode: p.mode as LocalSelectionPolicy['mode'], producerCandidateId, checkerCandidateId,
    limitAttempts: integer(p.limitAttempts, 1, 1000), timeoutMs: integer(p.timeoutMs, 1000, 3600000) });
}
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
interface Row { policy_id: string; revision: number; digest: string; policy_json: string; created_at: string; source_version: string }
function decode(row: Row): StoredLocalSelectionPolicy {
  if (typeof row.policy_json !== 'string' || row.policy_json.length > 4096) fail('stored-json');
  const body = { policyId: id(row.policy_id), revision: revision(row.revision), policy: validateLocalSelectionPolicy(JSON.parse(row.policy_json)), createdAt: time(row.created_at), sourceVersion: id(row.source_version) };
  if (JSON.stringify(body.policy) !== row.policy_json || digest(body) !== hash(row.digest)) fail('corrupt');
  return Object.freeze({ ...body, digest: row.digest });
}
export function readLocalSelectionPolicy(db: Ledger, policyId: string, policyRevision: number): StoredLocalSelectionPolicy | null {
  const row = db.prepare('SELECT * FROM local_selection_policy_snapshot WHERE policy_id=? AND revision=?').get(id(policyId), revision(policyRevision)) as Row | undefined;
  return row ? decode(row) : null;
}
export function readLatestLocalSelectionPolicy(db: Ledger, policyId: string): StoredLocalSelectionPolicy | null {
  const row = db.prepare('SELECT * FROM local_selection_policy_snapshot WHERE policy_id=? ORDER BY revision DESC LIMIT 1').get(id(policyId)) as Row | undefined;
  return row ? decode(row) : null;
}
export function saveLocalSelectionPolicy(db: Ledger, input: { policyId: string; expectedRevision: number | null; policy: LocalSelectionPolicy; createdAt: string; sourceVersion: string }): StoredLocalSelectionPolicy {
  const p = record(input, ['policyId', 'expectedRevision', 'policy', 'createdAt', 'sourceVersion']);
  const policyId = id(p.policyId), expected = p.expectedRevision === null ? null : revision(p.expectedRevision), policy = validateLocalSelectionPolicy(p.policy), createdAt = time(p.createdAt), sourceVersion = id(p.sourceVersion);
  return db.transaction(() => {
    const previous = readLatestLocalSelectionPolicy(db, policyId);
    if ((previous?.revision ?? null) !== expected) fail('revision-conflict');
    const body = { policyId, revision: revision((previous?.revision ?? 0) + 1), policy, createdAt, sourceVersion };
    const value = Object.freeze({ ...body, digest: digest(body) });
    db.prepare('INSERT INTO local_selection_policy_snapshot VALUES(?,?,?,?,?,?)').run(policyId, value.revision, value.digest, JSON.stringify(policy), createdAt, sourceVersion);
    return value;
  }).immediate();
}
export function readRunLocalSelectionPolicy(db: Ledger, runId: string): LocalRunPolicy | null {
  const row = db.prepare('SELECT * FROM local_selection_run_policy WHERE run_id=?').get(id(runId)) as { run_id: string; policy_id: string; revision: number; digest: string; bound_at: string } | undefined;
  if (!row) return null;
  const snapshot = readLocalSelectionPolicy(db, row.policy_id, row.revision);
  if (!snapshot || snapshot.digest !== hash(row.digest)) fail('corrupt-binding');
  return Object.freeze({ runId: id(row.run_id), boundAt: time(row.bound_at), snapshot });
}
export function bindRunLocalSelectionPolicy(db: Ledger, input: { runId: string; policyId: string; revision: number; digest: string; boundAt: string }): LocalRunPolicy {
  const p = record(input, ['runId', 'policyId', 'revision', 'digest', 'boundAt']);
  const runId = id(p.runId), policyId = id(p.policyId), rev = revision(p.revision), expectedDigest = hash(p.digest), boundAt = time(p.boundAt);
  return db.transaction(() => {
    const snapshot = readLocalSelectionPolicy(db, policyId, rev);
    if (!snapshot || snapshot.digest !== expectedDigest) fail('binding-digest');
    const previous = readRunLocalSelectionPolicy(db, runId);
    if (previous) { if (previous.snapshot.digest !== expectedDigest || previous.snapshot.policyId !== policyId || previous.snapshot.revision !== rev) fail('rebind'); return previous; }
    db.prepare('INSERT INTO local_selection_run_policy VALUES(?,?,?,?,?)').run(runId, policyId, rev, expectedDigest, boundAt);
    return Object.freeze({ runId, boundAt, snapshot });
  }).immediate();
}
const checks = ['eligible', 'authenticated', 'compatible', 'dataAllowed', 'resourceAvailable', 'quotaAvailable'] as const;
export interface LocalCandidateChecks { candidateId: string; eligible: boolean; authenticated: boolean; compatible: boolean; dataAllowed: boolean; resourceAvailable: boolean; quotaAvailable: boolean }
export type LocalSelectionDecision = Readonly<{ selected: boolean; candidateId: string | null; reasons: readonly string[]; authority: 'none'; ranking: 'not-performed' }>;
/** Call only with current host-owned checks. A policy or manifest cannot supply
 * observations, issue eligibility, grant permissions, or prove optimization. */
export function selectLocalCandidate(policyInput: unknown, role: string, hostChecks: unknown): LocalSelectionDecision {
  const result = (candidateId: string | null, reasons: string[]): LocalSelectionDecision => Object.freeze({ selected: reasons.length === 0, candidateId, reasons: Object.freeze(reasons), authority: 'none', ranking: 'not-performed' });
  try {
    const policy = validateLocalSelectionPolicy(policyInput);
    if (!['model-producer', 'verifier'].includes(role)) return result(null, ['unsupported-role']);
    const state = record(hostChecks, ['candidateId', ...checks]);
    const expected = role === 'model-producer' ? policy.producerCandidateId : policy.checkerCandidateId;
    if (id(state.candidateId) !== expected) return result(null, ['candidate-mismatch']);
    if (checks.some(key => typeof state[key] !== 'boolean')) return result(null, ['malformed-checks']);
    const reasons = checks.filter(key => state[key] !== true);
    return result(reasons.length ? null : expected, reasons);
  } catch { return result(null, ['malformed-input']); }
}

/** Snapshot the already computed fixed-pair result, without re-observation. */
export function snapshotLocalSelectionDecision(input: unknown): LocalSelectionDecision {
  const v = record(input, ['selected','candidateId','reasons','authority','ranking']);
  if (typeof v.selected !== 'boolean' || v.authority !== 'none' || v.ranking !== 'not-performed' || !Array.isArray(v.reasons)
    || types.isProxy(v.reasons) || v.reasons.length > 10 || Reflect.ownKeys(v.reasons).length !== v.reasons.length + 1) fail('decision');
  const allowed = [...checks, 'unsupported-role','candidate-mismatch','malformed-checks','malformed-input'];
  const reasons: string[] = [];
  for (let i = 0; i < v.reasons.length; i++) { const d = Object.getOwnPropertyDescriptor(v.reasons, String(i)); if (!d || !('value' in d) || typeof d.value !== 'string' || !allowed.includes(d.value) || reasons.includes(d.value)) fail('decision'); reasons.push(d.value); }
  const candidateId = v.candidateId === null ? null : id(v.candidateId);
  if (v.selected ? candidateId === null || reasons.length !== 0 : candidateId !== null || reasons.length === 0) fail('decision');
  return Object.freeze({ selected: v.selected, candidateId, reasons: Object.freeze(reasons), authority: 'none', ranking: 'not-performed' });
}
