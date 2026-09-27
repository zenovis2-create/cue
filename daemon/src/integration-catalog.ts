import { types } from 'node:util';

export type CatalogKind = 'agent' | 'model' | 'checker' | 'mcp' | 'orchestrator';
export interface ModelBinding { readonly endpointId: string; readonly modelId: string }
export interface CatalogRecord {
  readonly canonicalId: string;
  readonly toolId: string;
  readonly kind: CatalogKind;
  readonly aliases: readonly string[];
  readonly installation: 'installed' | 'missing' | 'unknown';
  readonly protocol: 'verified' | 'unsupported' | 'unknown';
  // Opaque host credential-store key only; never a token, auth object or URL.
  readonly authReference: string | null;
  readonly authAvailable: boolean;
  readonly sourceVersion: string;
  readonly observedAt: string;
  readonly subjectDigest: string | null;
  readonly binding: Readonly<ModelBinding> | null;
}
export type CatalogReason = 'unknown-identity' | 'unverified-alias' | 'kind-mismatch' |
  'invalid-host-clock' | 'future-observation' | 'stale-observation' | 'not-installed' |
  'installation-unknown' | 'protocol-unverified' | 'missing-auth' | 'subject-unavailable' | 'subject-drift';
export interface CatalogLookup {
  readonly available: boolean;
  readonly record: Readonly<CatalogRecord> | null;
  readonly reasons: readonly CatalogReason[];
}
export interface CatalogHost {
  readonly now: () => number;
  readonly maxAgeMs: number;
  // Host measured fingerprints only. A plugin/manifest is never this authority.
  readonly currentSubjectDigest?: (canonicalId: string) => string | undefined;
}
const HASH = /^[a-f0-9]{64}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/;
const REFERENCE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;
const text = (v: unknown): v is string => typeof v === 'string' && v.trim() === v && v.length > 0 && v.length <= 200;
function plain(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || types.isProxy(value)) return false;
  if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
  return Reflect.ownKeys(value).every(key => {
    const d = Object.getOwnPropertyDescriptor(value, key)!;
    return typeof key === 'string' && d.enumerable && Object.hasOwn(d, 'value');
  });
}
function exact(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
function list(value: unknown): value is unknown[] {
  if (!Array.isArray(value) || types.isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype) return false;
  if (Reflect.ownKeys(value).length !== value.length + 1) return false;
  for (let i = 0; i < value.length; i++) {
    const d = Object.getOwnPropertyDescriptor(value, String(i));
    if (!d || !Object.hasOwn(d, 'value') || !d.enumerable) return false;
  }
  return true;
}
const RECORD_KEYS = ['canonicalId', 'toolId', 'kind', 'aliases', 'installation', 'protocol',
  'authReference', 'authAvailable', 'sourceVersion', 'observedAt', 'subjectDigest', 'binding'];

/** Host-assembled observational inventory. Available means identity/transport
 * prerequisites are fresh, NEVER capability admission or execution permission.
 * Binding endpointId references host endpoint configuration; no endpoint secrets
 * or connection URLs are exposed to snapshots. Updates create a new catalog.
 */
export function createIntegrationCatalog(host: CatalogHost, input: unknown, unresolvedAliases: unknown = []) {
  const { now, maxAgeMs, currentSubjectDigest } = host;
  if (typeof now !== 'function' || !Number.isFinite(maxAgeMs) || maxAgeMs <= 0 ||
      (currentSubjectDigest !== undefined && typeof currentSubjectDigest !== 'function')) throw Error('invalid catalog host policy');
  if (!list(input) || !list(unresolvedAliases)) throw Error('catalog requires plain arrays');
  const records: Readonly<CatalogRecord>[] = [];
  const names = new Map<string, Readonly<CatalogRecord> | null>();
  const reserve = (name: string, record: Readonly<CatalogRecord> | null) => {
    if (names.has(name)) throw Error('ambiguous catalog identity or alias');
    names.set(name, record);
  };
  for (const value of input) {
    if (!plain(value) || !exact(value, RECORD_KEYS) || !text(value.canonicalId) || !ID.test(value.canonicalId) ||
        !text(value.toolId) || !ID.test(value.toolId) || !['agent', 'model', 'checker', 'mcp', 'orchestrator'].includes(value.kind as string) ||
        !list(value.aliases) || !value.aliases.every(text) ||
        !['installed', 'missing', 'unknown'].includes(value.installation as string) ||
        !['verified', 'unsupported', 'unknown'].includes(value.protocol as string) ||
        !(value.authReference === null || (text(value.authReference) && REFERENCE_ID.test(value.authReference))) ||
        typeof value.authAvailable !== 'boolean' || !text(value.sourceVersion) ||
        typeof value.observedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value.observedAt) ||
        !Number.isFinite(Date.parse(value.observedAt)) || new Date(value.observedAt).toISOString() !== value.observedAt ||
        !(value.subjectDigest === null || (typeof value.subjectDigest === 'string' && HASH.test(value.subjectDigest)))) throw Error('invalid catalog record');
    const binding = value.binding;
    if (binding !== null && (!plain(binding) || !exact(binding, ['endpointId', 'modelId']) ||
        !text(binding.endpointId) || !REFERENCE_ID.test(binding.endpointId) || !text(binding.modelId))) throw Error('invalid model binding');
    if ((value.kind === 'model' && binding === null) || (['mcp', 'checker'].includes(value.kind as string) && binding !== null)) throw Error('invalid binding for kind');
    const record = Object.freeze({ ...value, aliases: Object.freeze([...value.aliases]),
      binding: binding === null ? null : Object.freeze({ endpointId: binding.endpointId, modelId: binding.modelId }) }) as unknown as Readonly<CatalogRecord>;
    reserve(record.canonicalId, record);
    for (const alias of record.aliases) reserve(alias, record);
    records.push(record);
  }
  for (const alias of unresolvedAliases) {
    if (!text(alias)) throw Error('invalid unresolved alias');
    reserve(alias, null);
  }
  const evaluate = (record: Readonly<CatalogRecord>, expectedKind?: CatalogKind): CatalogLookup => {
    const reasons: CatalogReason[] = [];
    if (expectedKind !== undefined && record.kind !== expectedKind) reasons.push('kind-mismatch');
    let timestamp: number;
    try { timestamp = now(); } catch { timestamp = NaN; }
    const age = timestamp - Date.parse(record.observedAt);
    if (!Number.isFinite(timestamp)) reasons.push('invalid-host-clock');
    else if (age < 0) reasons.push('future-observation');
    else if (age >= maxAgeMs) reasons.push('stale-observation');
    if (record.installation === 'missing') reasons.push('not-installed');
    if (record.installation === 'unknown') reasons.push('installation-unknown');
    if (record.protocol !== 'verified') reasons.push('protocol-unverified');
    if (!record.authAvailable) reasons.push('missing-auth');
    if (record.subjectDigest !== null) {
      let current: string | undefined;
      try { current = currentSubjectDigest?.(record.canonicalId); } catch { current = undefined; }
      if (typeof current !== 'string' || !HASH.test(current)) reasons.push('subject-unavailable');
      else if (current !== record.subjectDigest) reasons.push('subject-drift');
    }
    return Object.freeze({ available: reasons.length === 0, record, reasons: Object.freeze(reasons) });
  };
  return Object.freeze({
    lookup(identity: string, expectedKind?: CatalogKind): CatalogLookup {
      const record = names.get(identity);
      if (record) return evaluate(record, expectedKind);
      return Object.freeze({ available: false, record: null,
        reasons: Object.freeze([names.has(identity) ? 'unverified-alias' : 'unknown-identity'] as CatalogReason[]) });
    },
    snapshot() {
      return Object.freeze({ records: Object.freeze(records.map(record => evaluate(record))),
        unresolvedAliases: Object.freeze([...names].filter(([, record]) => record === null).map(([alias]) => alias)) });
    },
  });
}
