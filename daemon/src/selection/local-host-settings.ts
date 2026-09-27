import { createHash } from 'node:crypto';
import { types } from 'node:util';
import type { Ledger } from '../ledger.js';
import { readSelectionPolicy } from './policy-store.js';
import { readLatestLocalSelectionPolicy, readLocalSelectionPolicy, saveLocalSelectionPolicy } from './local-policy-store.js';

const modes = ['efficiency', 'performance', 'value', 'speed'] as const;
type Mode = typeof modes[number];
export interface LocalHostPolicyReference { readonly policyId: string; readonly revision: number; readonly digest: string }
interface LocalHostSettingsBase {
  readonly templateId: 'generated-json-v1' | 'goal-planning-v1';
  readonly enabled: boolean;
  readonly limits: Readonly<{ maxInvocations: number; timeoutMs: number; maxOutputBytes: number; maxOutputTokens: number }>;
  readonly policies: Readonly<Record<Mode, LocalHostPolicyReference>>;
}
export interface LocalHostSettingsV1 extends LocalHostSettingsBase {
  readonly version: 'cue-local-host-settings-v1';
  readonly templateId: 'generated-json-v1';
  readonly accounting: Readonly<{ kind: 'local-invocation' }> | Readonly<{ kind: 'monetary'; sourceRef: string }>;
}
export interface LocalHostSettingsV2 extends LocalHostSettingsBase {
  readonly version: 'cue-local-host-settings-v2';
  readonly accounting: Readonly<{ kind: 'local-invocation' }>;
}
export type LocalHostSettings = LocalHostSettingsV1 | LocalHostSettingsV2;
export interface StoredLocalHostSettings {
  readonly settingsId: string; readonly revision: number; readonly digest: string;
  readonly settings: LocalHostSettings; readonly createdAt: string; readonly sourceVersion: string;
}
export interface SaveLocalHostSettings {
  settingsId: string; expectedRevision: number | null; settings: LocalHostSettings; createdAt: string; sourceVersion: string;
}
export const LOCAL_JSON_SETTINGS_ID = 'generated-json-default';
export const LOCAL_GOAL_PLANNING_SETTINGS_ID = 'goal-planning-default';
export const LOCAL_JSON_PRODUCER_CANDIDATE_ID = 'cue.local.qwen38-27b-unc';
export const LOCAL_JSON_CHECKER_CANDIDATE_ID = 'cue.checker.json-format';
export const LOCAL_GOAL_PLANNING_CHECKER_CANDIDATE_ID = 'cue.checker.goal-proposal';
export interface ConfigureLocalJsonSettings {
  expectedRevision: number | null; enabled: boolean;
  limits: LocalHostSettingsV2['limits']; createdAt: string;
}
function fail(reason: string): never { throw new TypeError(`local_host_settings:${reason}`); }
function data(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) fail('record');
  const fields = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(fields).length !== keys.length) fail('fields');
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const field = fields[key];
    if (!field?.enumerable || !Object.hasOwn(field, 'value')) fail('fields');
    out[key] = field.value;
  }
  return out;
}
function id(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)) fail('id');
  return value;
}
function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) fail('integer');
  return value;
}
const rev = (value: unknown) => integer(value, 1, Number.MAX_SAFE_INTEGER - 1);
function digest(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) fail('digest');
  return value;
}
function timestamp(value: unknown): string {
  if (typeof value !== 'string' || value.length !== 24 || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail('timestamp');
  return value;
}
function snapshot(db: Ledger, value: unknown): LocalHostSettings {
  const fields = data(value, ['version', 'templateId', 'enabled', 'accounting', 'limits', 'policies']);
  if (!['cue-local-host-settings-v1', 'cue-local-host-settings-v2'].includes(fields.version as string)
    || !['generated-json-v1','goal-planning-v1'].includes(fields.templateId as string)
    || (fields.version === 'cue-local-host-settings-v1' && fields.templateId !== 'generated-json-v1')
    || typeof fields.enabled !== 'boolean') fail('template');
  const local = fields.version === 'cue-local-host-settings-v2';
  // Inspect the discriminator as an own data descriptor, never by invoking a getter.
  const raw = fields.accounting;
  if (!raw || typeof raw !== 'object' || types.isProxy(raw) || Object.getPrototypeOf(raw) !== Object.prototype) fail('accounting');
  const kind = Object.getOwnPropertyDescriptor(raw, 'kind');
  if (!kind?.enumerable || !Object.hasOwn(kind, 'value')) fail('accounting');
  let accounting: LocalHostSettings['accounting'];
  if (kind.value === 'local-invocation') { data(raw, ['kind']); accounting = Object.freeze({ kind: 'local-invocation' }); }
  else if (kind.value === 'monetary' && !local) { const a = data(raw, ['kind', 'sourceRef']); accounting = Object.freeze({ kind: 'monetary', sourceRef: id(a.sourceRef) }); }
  else fail('accounting');
  const l = data(fields.limits, ['maxInvocations', 'timeoutMs', 'maxOutputBytes', 'maxOutputTokens']);
  const limits = Object.freeze({ maxInvocations: integer(l.maxInvocations, 1, 1000), timeoutMs: integer(l.timeoutMs, 1000, 3600000),
    maxOutputBytes: integer(l.maxOutputBytes, 1, 1048576), maxOutputTokens: integer(l.maxOutputTokens, 1, 32768) });
  const refs = data(fields.policies, modes), policies = {} as Record<Mode, LocalHostPolicyReference>;
  for (const mode of modes) {
    const r = data(refs[mode], ['policyId', 'revision', 'digest']);
    const reference = Object.freeze({ policyId: id(r.policyId), revision: rev(r.revision), digest: digest(r.digest) });
    if (local) {
      const stored = readLocalSelectionPolicy(db, reference.policyId, reference.revision);
      if (!stored || stored.digest !== reference.digest || stored.policy.mode !== mode) fail('policy-reference');
      if (limits.maxInvocations > stored.policy.limitAttempts || limits.timeoutMs > stored.policy.timeoutMs) fail('policy-limits');
    } else {
      const stored = readSelectionPolicy(db, reference.policyId, reference.revision);
      if (!stored || stored.digest !== reference.digest || stored.policy.mode !== mode) fail('policy-reference');
    }
    policies[mode] = reference;
  }
  if (local) return Object.freeze({ version: 'cue-local-host-settings-v2', templateId: fields.templateId as LocalHostSettingsV2['templateId'], enabled: fields.enabled,
    accounting: Object.freeze({ kind: 'local-invocation' }), limits, policies: Object.freeze(policies) });
  return Object.freeze({ version: 'cue-local-host-settings-v1', templateId: 'generated-json-v1', enabled: fields.enabled,
    accounting, limits, policies: Object.freeze(policies) });
}
function hash(value: Omit<StoredLocalHostSettings, 'digest'>): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
type Row = { settings_id: string; revision: number; digest: string; settings_json: string; created_at: string; source_version: string };
function decode(db: Ledger, row: Row): StoredLocalHostSettings {
  if (typeof row.settings_json !== 'string' || row.settings_json.length > 16384) fail('stored-json');
  const value = { settingsId: id(row.settings_id), revision: rev(row.revision), settings: snapshot(db, JSON.parse(row.settings_json)),
    createdAt: timestamp(row.created_at), sourceVersion: id(row.source_version) };
  if (JSON.stringify(value.settings) !== row.settings_json || hash(value) !== digest(row.digest)) fail('corrupt-snapshot');
  return Object.freeze({ ...value, digest: row.digest });
}
export function readLocalHostSettings(db: Ledger, settingsId: string, revision: number): StoredLocalHostSettings | null {
  const row = db.prepare('SELECT * FROM local_host_settings_snapshot WHERE settings_id=? AND revision=?').get(id(settingsId), rev(revision)) as Row | undefined;
  return row ? decode(db, row) : null;
}
export function readLatestLocalHostSettings(db: Ledger, settingsId: string): StoredLocalHostSettings | null {
  const row = db.prepare('SELECT * FROM local_host_settings_snapshot WHERE settings_id=? ORDER BY revision DESC LIMIT 1').get(id(settingsId)) as Row | undefined;
  return row ? decode(db, row) : null;
}
/** Protected configuration only: enabled is intent, never admission or proof of prices.
 * A monetary sourceRef is unresolved here. A local count requires a separate runtime
 * accounting contract; existing monetary policies are not reinterpreted by this store.
 * V1 always references the original monetary policy table (including inert local
 * intent). V2 references only the separate local policy table; neither grants admission.
 */
export function saveLocalHostSettings(db: Ledger, input: SaveLocalHostSettings): StoredLocalHostSettings {
  if (db.inTransaction) fail('outer-transaction');
  const fields = data(input, ['settingsId', 'expectedRevision', 'settings', 'createdAt', 'sourceVersion']);
  const settingsId = id(fields.settingsId), expected = fields.expectedRevision === null ? null : rev(fields.expectedRevision);
  const createdAt = timestamp(fields.createdAt), sourceVersion = id(fields.sourceVersion);
  return db.transaction(() => writeSettingsRow(db, settingsId, expected, fields.settings, createdAt, sourceVersion)).immediate();
}

function writeSettingsRow(db: Ledger, settingsId: string, expected: number | null, settings: unknown, createdAt: string, sourceVersion: string): StoredLocalHostSettings {
  const previous = readLatestLocalHostSettings(db, settingsId);
  if ((previous?.revision ?? null) !== expected) fail('revision-conflict');
  const value = { settingsId, revision: rev((previous?.revision ?? 0) + 1), settings: snapshot(db, settings), createdAt, sourceVersion };
  const result = Object.freeze({ ...value, digest: hash(value) });
  db.prepare('INSERT INTO local_host_settings_snapshot VALUES(?,?,?,?,?,?)')
    .run(settingsId, result.revision, result.digest, JSON.stringify(result.settings), createdAt, sourceVersion);
  return result;
}

/** Protected explicit setup only. Enabled means configuration intent, never
 * qualification, model invocation, discovery or authority to launch. Existing
 * approvals retain their exact policy revisions; all four new references and
 * the settings revision commit atomically, or none of them do. */
export function configureLocalJsonSettings(db: Ledger, input: ConfigureLocalJsonSettings): StoredLocalHostSettings {
  if (db.inTransaction) fail('outer-transaction');
  const fields = data(input, ['expectedRevision', 'enabled', 'limits', 'createdAt']);
  const expected = fields.expectedRevision === null ? null : rev(fields.expectedRevision), createdAt = timestamp(fields.createdAt);
  if (typeof fields.enabled !== 'boolean') fail('enabled');
  const raw = data(fields.limits, ['maxInvocations', 'timeoutMs', 'maxOutputBytes', 'maxOutputTokens']);
  const limits = Object.freeze({ maxInvocations: integer(raw.maxInvocations, 2, 1000), timeoutMs: integer(raw.timeoutMs, 1000, 120000),
    maxOutputBytes: integer(raw.maxOutputBytes, 1, 1048576), maxOutputTokens: integer(raw.maxOutputTokens, 1, 32768) });
  return db.transaction(() => {
    const previous = readLatestLocalHostSettings(db, LOCAL_JSON_SETTINGS_ID);
    if ((previous?.revision ?? null) !== expected) fail('revision-conflict');
    const policies = {} as Record<Mode, LocalHostPolicyReference>;
    for (const mode of modes) {
      const policyId = `cue.local-json.${mode}.v1`, latest = readLatestLocalSelectionPolicy(db, policyId);
      const p = saveLocalSelectionPolicy(db, { policyId, expectedRevision: latest?.revision ?? null, createdAt, sourceVersion: 'cue-local-json-setup-v1',
        policy: { version: 'cue-local-selection-v1', mode, producerCandidateId: LOCAL_JSON_PRODUCER_CANDIDATE_ID, checkerCandidateId: LOCAL_JSON_CHECKER_CANDIDATE_ID,
          limitAttempts: limits.maxInvocations, timeoutMs: limits.timeoutMs } });
      policies[mode] = Object.freeze({ policyId: p.policyId, revision: p.revision, digest: p.digest });
    }
    return writeSettingsRow(db, LOCAL_JSON_SETTINGS_ID, expected, { version: 'cue-local-host-settings-v2', templateId: 'generated-json-v1',
      enabled: fields.enabled, accounting: { kind: 'local-invocation' }, limits, policies }, createdAt, 'cue-local-json-setup-v1');
  }).immediate();
}

/** Separate protected planning intent. Shares local invocation policy semantics,
 * but its checker candidate and template can never alias the JSON workflow. */
export function configureLocalGoalPlanningSettings(db: Ledger, input: ConfigureLocalJsonSettings): StoredLocalHostSettings {
  if (db.inTransaction) fail('outer-transaction');
  const fields = data(input, ['expectedRevision', 'enabled', 'limits', 'createdAt']);
  const expected = fields.expectedRevision === null ? null : rev(fields.expectedRevision), createdAt = timestamp(fields.createdAt);
  if (typeof fields.enabled !== 'boolean') fail('enabled');
  const raw = data(fields.limits, ['maxInvocations', 'timeoutMs', 'maxOutputBytes', 'maxOutputTokens']);
  const limits = Object.freeze({ maxInvocations: integer(raw.maxInvocations, 2, 1000), timeoutMs: integer(raw.timeoutMs, 1000, 120000),
    maxOutputBytes: integer(raw.maxOutputBytes, 1, 1048576), maxOutputTokens: integer(raw.maxOutputTokens, 1, 32768) });
  return db.transaction(() => {
    const previous = readLatestLocalHostSettings(db, LOCAL_GOAL_PLANNING_SETTINGS_ID);
    if ((previous?.revision ?? null) !== expected) fail('revision-conflict');
    const policies = {} as Record<Mode, LocalHostPolicyReference>;
    for (const mode of modes) {
      const policyId = `cue.local-goal-planning.${mode}.v1`, latest = readLatestLocalSelectionPolicy(db, policyId);
      const p = saveLocalSelectionPolicy(db, { policyId, expectedRevision: latest?.revision ?? null, createdAt, sourceVersion: 'cue-local-goal-planning-setup-v1',
        policy: { version: 'cue-local-selection-v1', mode, producerCandidateId: LOCAL_JSON_PRODUCER_CANDIDATE_ID, checkerCandidateId: LOCAL_GOAL_PLANNING_CHECKER_CANDIDATE_ID,
          limitAttempts: limits.maxInvocations, timeoutMs: limits.timeoutMs } });
      policies[mode] = Object.freeze({ policyId: p.policyId, revision: p.revision, digest: p.digest });
    }
    return writeSettingsRow(db, LOCAL_GOAL_PLANNING_SETTINGS_ID, expected, { version: 'cue-local-host-settings-v2', templateId: 'goal-planning-v1',
      enabled: fields.enabled, accounting: { kind: 'local-invocation' }, limits, policies }, createdAt, 'cue-local-goal-planning-setup-v1');
  }).immediate();
}
