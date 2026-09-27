export type ModelAliasState = 'resolved-inactive' | 'inactive-unresolved';
export type ModelAliasUnknown = 'unknown';

export interface ModelAliasEvidence {
  readonly reference: string;
  readonly digest: string;
  readonly observedDate: string;
}

export interface ModelAliasRecord {
  readonly originalAlias: string;
  /** Collision-detection metadata only. Lookups never use this normalized key. */
  readonly normalizedLookupKey: string;
  readonly state: ModelAliasState;
  readonly provider: string | null;
  readonly canonicalModelId: string | null;
  readonly evidence: Readonly<ModelAliasEvidence>;
  readonly qualification: false;
  readonly enabled: false;
  readonly entitlement: ModelAliasUnknown;
  readonly price: ModelAliasUnknown;
  readonly capabilities: ModelAliasUnknown;
}

export interface ModelAliasAuthorityGrants {
  readonly selection: false;
  readonly admission: false;
  readonly price: false;
  readonly rank: false;
  readonly entitlement: false;
  readonly dispatch: false;
}

export interface ModelAliasRegistrySnapshot {
  readonly version: 'cue-model-alias-registry-v1';
  readonly authority: 'observation-only';
  readonly grants: Readonly<ModelAliasAuthorityGrants>;
  readonly records: readonly Readonly<ModelAliasRecord>[];
}

export type ModelAliasLookupReason =
  | 'resolved-disabled'
  | 'inactive-unresolved'
  | 'unknown-alias'
  | 'invalid-alias';

export interface ModelAliasLookup {
  readonly available: false;
  readonly reason: ModelAliasLookupReason;
  readonly record: Readonly<ModelAliasRecord> | null;
}

const SHA256 = /^[a-f0-9]{64}$/;
const OBSERVED_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ALIAS_LENGTH = 200;

interface StaticRecord {
  readonly originalAlias: string;
  readonly state: ModelAliasState;
  readonly provider: string | null;
  readonly canonicalModelId: string | null;
  readonly evidenceReference: string;
  readonly evidenceDigest: string;
  readonly evidenceObservedDate: string;
}

const STATIC_RECORDS: readonly StaticRecord[] = [
  {
    originalAlias: 'gpt 5.6 sol',
    state: 'resolved-inactive',
    provider: 'openai',
    canonicalModelId: 'gpt-5.6-sol',
    evidenceReference: 'https://developers.openai.com/api/docs/models',
    evidenceDigest: '02c3148374d626a52ddf2cb9111d2e27a27e2478013fa61c364638890a5c0d26',
    evidenceObservedDate: '2026-09-12',
  },
  {
    originalAlias: 'terra',
    state: 'inactive-unresolved',
    provider: null,
    canonicalModelId: null,
    evidenceReference: 'https://developers.openai.com/api/docs/models',
    evidenceDigest: '2783f78c6b5d3ae321a0fa61cf084483448ee8091cd6cf4b6bbb52db61158d1e',
    evidenceObservedDate: '2026-09-12',
  },
  {
    originalAlias: 'luna',
    state: 'inactive-unresolved',
    provider: null,
    canonicalModelId: null,
    evidenceReference: 'https://developers.openai.com/api/docs/models',
    evidenceDigest: 'a73db08f6c3c178714d448aad2939dd46f9dfd67a927972fb1e4b00ae785e11d',
    evidenceObservedDate: '2026-09-12',
  },
  {
    originalAlias: '6 astra',
    state: 'resolved-inactive',
    provider: 'openai',
    canonicalModelId: 'gpt-6-astra',
    evidenceReference: 'https://developers.openai.com/api/docs/models',
    evidenceDigest: '1ebe55787d93bcaddf28fcb837f7d6d653b23e246f3424a9f06ab14188d65865',
    evidenceObservedDate: '2026-09-12',
  },
  {
    originalAlias: 'claude opus 5.0',
    state: 'resolved-inactive',
    provider: 'anthropic',
    canonicalModelId: 'claude-opus-5',
    evidenceReference: 'https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions',
    evidenceDigest: 'dda574be0184bb319a2543d5be90939e27ef25dafdb895c6cb19fcf9099be840',
    evidenceObservedDate: '2026-09-12',
  },
  {
    originalAlias: 'sonnet 5',
    state: 'resolved-inactive',
    provider: 'anthropic',
    canonicalModelId: 'claude-sonnet-5',
    evidenceReference: 'https://platform.claude.com/docs/en/models/overview',
    evidenceDigest: '673a9e1c163158fe4394fdad62c3d14297fbac1283022d314d0f6f1d53b012ef',
    evidenceObservedDate: '2026-09-12',
  },
  {
    originalAlias: 'haiku',
    state: 'inactive-unresolved',
    provider: 'anthropic',
    canonicalModelId: null,
    evidenceReference: 'https://platform.claude.com/docs/en/models/overview',
    evidenceDigest: 'ad80eadc0bf60bb9c68226b34223d344415e69574d495553c3a1dccced73b67a',
    evidenceObservedDate: '2026-09-12',
  },
  {
    originalAlias: 'fable 5.1',
    state: 'resolved-inactive',
    provider: 'anthropic',
    canonicalModelId: 'claude-fable-5-1',
    evidenceReference: 'https://platform.claude.com/docs/en/models/fable-5-1/overview',
    evidenceDigest: 'e244007d7f4e906c8cc0139d417a78e7064f0314499872ef45200ffa76daccb4',
    evidenceObservedDate: '2026-09-12',
  },
  {
    originalAlias: 'gemini flash 3.8',
    state: 'resolved-inactive',
    provider: 'google',
    canonicalModelId: 'gemini-3.8-flash',
    evidenceReference: 'https://ai.google.dev/gemini-api/docs/models',
    evidenceDigest: '7e2f4d165a7edc6b1fe51716e14c0dc64a1cee82bac0dc6bd574fa2ed531e2b8',
    evidenceObservedDate: '2026-09-12',
  },
  {
    originalAlias: 'qwen 3.8 27b (로컬)',
    state: 'resolved-inactive',
    provider: 'local-llama.cpp',
    canonicalModelId: 'qwen38-27b-unc',
    evidenceReference: 'evidence/integrations/S1/20260911-qwen-live/result.json',
    evidenceDigest: '9c2f0bd6475e3890c5d5547173667d841325039013501d5a25e837ef8661aa40',
    evidenceObservedDate: '2026-09-11',
  },
  {
    originalAlias: 'grok 4.6',
    state: 'resolved-inactive',
    provider: 'xai',
    canonicalModelId: 'grok-4.6',
    evidenceReference: 'https://docs.x.ai/developers/models/grok-4.6',
    evidenceDigest: '545dc157ff70dee09ade47435caae7da291c19fba45adc51f50fff9957db6858',
    evidenceObservedDate: '2026-09-12',
  },
  {
    originalAlias: 'muse 1.3',
    state: 'inactive-unresolved',
    provider: null,
    canonicalModelId: null,
    evidenceReference: 'https://research.meta.ai/blog/introducing-muse-spark-1-3',
    evidenceDigest: 'b6ad513459e6c1559b7fadd05631cd147126f029d15e80f89baff863c9219f9f',
    evidenceObservedDate: '2026-09-12',
  },
];

function collisionKey(alias: string): string {
  return alias.normalize('NFKC').toLocaleLowerCase('en-US').replace(/\s+/gu, ' ').trim();
}

function assertStaticRecord(value: StaticRecord): void {
  if (value.originalAlias.length === 0 || value.originalAlias.length > MAX_ALIAS_LENGTH ||
      value.originalAlias.trim() !== value.originalAlias || /[\u0000-\u001f\u007f]/u.test(value.originalAlias) ||
      !SHA256.test(value.evidenceDigest) || !OBSERVED_DATE.test(value.evidenceObservedDate)) {
    throw new Error('invalid static model alias record');
  }
  const resolved = value.state === 'resolved-inactive';
  if (resolved !== (value.provider !== null && value.canonicalModelId !== null)) {
    throw new Error('invalid static model alias resolution');
  }
}

const exactAliases = new Map<string, Readonly<ModelAliasRecord>>();
const normalizedAliases = new Set<string>();
const records: Readonly<ModelAliasRecord>[] = [];

for (const value of STATIC_RECORDS) {
  assertStaticRecord(value);
  const normalizedLookupKey = collisionKey(value.originalAlias);
  if (exactAliases.has(value.originalAlias) || normalizedAliases.has(normalizedLookupKey)) {
    throw new Error('ambiguous static model alias');
  }
  const evidence = Object.freeze({
    reference: value.evidenceReference,
    digest: value.evidenceDigest,
    observedDate: value.evidenceObservedDate,
  });
  const record = Object.freeze({
    originalAlias: value.originalAlias,
    normalizedLookupKey,
    state: value.state,
    provider: value.provider,
    canonicalModelId: value.canonicalModelId,
    evidence,
    qualification: false,
    enabled: false,
    entitlement: 'unknown',
    price: 'unknown',
    capabilities: 'unknown',
  }) satisfies Readonly<ModelAliasRecord>;
  exactAliases.set(value.originalAlias, record);
  normalizedAliases.add(normalizedLookupKey);
  records.push(record);
}

const grants = Object.freeze({
  selection: false,
  admission: false,
  price: false,
  rank: false,
  entitlement: false,
  dispatch: false,
}) satisfies Readonly<ModelAliasAuthorityGrants>;

const registry = Object.freeze({
  version: 'cue-model-alias-registry-v1',
  authority: 'observation-only',
  grants,
  records: Object.freeze(records),
}) satisfies Readonly<ModelAliasRegistrySnapshot>;

const invalidLookup = Object.freeze({ available: false, reason: 'invalid-alias', record: null }) satisfies Readonly<ModelAliasLookup>;
const unknownLookup = Object.freeze({ available: false, reason: 'unknown-alias', record: null }) satisfies Readonly<ModelAliasLookup>;

/** Returns the immutable host-owned inventory. It accepts no caller policy or data. */
export function getModelAliasRegistry(): Readonly<ModelAliasRegistrySnapshot> {
  if (arguments.length !== 0) throw new Error('model alias registry takes no input');
  return registry;
}

/** Exact original-alias observation only. A known record is still unavailable. */
export function lookupModelAlias(alias: unknown): Readonly<ModelAliasLookup> {
  if (arguments.length !== 1 || typeof alias !== 'string' || alias.length === 0 ||
      alias.length > MAX_ALIAS_LENGTH || alias.trim() !== alias || /[\u0000-\u001f\u007f]/u.test(alias)) return invalidLookup;
  const record = exactAliases.get(alias);
  if (!record) return unknownLookup;
  return Object.freeze({
    available: false,
    reason: record.state === 'resolved-inactive' ? 'resolved-disabled' : 'inactive-unresolved',
    record,
  });
}
