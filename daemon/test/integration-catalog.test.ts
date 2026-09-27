import { test, expect } from 'vitest';
import { createIntegrationCatalog } from '../src/integration-catalog.js';
import type { CatalogRecord } from '../src/integration-catalog.js';
const digest = 'a'.repeat(64);
const host = { now: () => 1000, maxAgeMs: 100, currentSubjectDigest: () => digest };
const record = (overrides: Partial<CatalogRecord> = {}): CatalogRecord => ({ canonicalId: 'tool.local.small', toolId: 'tool.local',
  kind: 'model', aliases: ['local small'], installation: 'installed', protocol: 'verified', authReference: null,
  authAvailable: true, sourceVersion: 'fixture-v1', observedAt: new Date(999).toISOString(), subjectDigest: digest,
  binding: { endpointId: 'endpoint.local', modelId: 'small:1' }, ...overrides });
test('exact identity and alias resolve immutable canonical tool/model mapping', () => {
  const catalog = createIntegrationCatalog(host, [record()], ['unverified-name']);
  const found = catalog.lookup('local small', 'model');
  expect(found.available).toBe(true);
  expect(found.record).toMatchObject({ canonicalId: 'tool.local.small', toolId: 'tool.local', binding: { endpointId: 'endpoint.local', modelId: 'small:1' } });
  expect(catalog.lookup('LOCAL SMALL').reasons).toEqual(['unknown-identity']);
  expect(catalog.lookup('unverified-name').reasons).toEqual(['unverified-alias']);
});
test('MCP and orchestrator kinds do not become execution agents', () => {
  for (const kind of ['mcp', 'orchestrator'] as const) {
    const catalog = createIntegrationCatalog(host, [record({ kind, binding: null })]);
    expect(catalog.lookup('local small', 'agent')).toMatchObject({ available: false, reasons: ['kind-mismatch'] });
    expect(catalog.lookup('local small', kind).available).toBe(true);
  }
});

test('deterministic checker has its own kind without a model endpoint binding', () => {
  const catalog = createIntegrationCatalog(host, [record({ kind: 'checker', binding: null })]);
  expect(catalog.lookup('local small', 'checker')).toMatchObject({ available: true, record: { kind: 'checker', binding: null } });
  for (const kind of ['agent', 'model'] as const) expect(catalog.lookup('local small', kind).reasons).toContain('kind-mismatch');
  expect(() => createIntegrationCatalog(host, [record({ kind: 'checker' })])).toThrow(/binding/);
});
test('eligibility, auth payload and accessor injection fail schema without getter execution', () => {
  let reads = 0;
  const getter = Object.defineProperty({ ...record() }, 'authAvailable', { enumerable: true, get() { reads++; throw Error('getter'); } });
  const proxy = new Proxy(record(), { getPrototypeOf() { reads++; throw Error('proxy'); } });
  for (const bad of [{ ...record(), implementationEligible: true }, { ...record(), token: 'not-a-real-secret' },
    { ...record(), authReference: { token: 'not-a-real-secret' } },
    { ...record(), authReference: 'https://user:password@example.test' },
    { ...record(), binding: { endpointId: 'https://example.test', modelId: 'small' } }, getter, proxy]) {
    expect(() => createIntegrationCatalog(host, [bad])).toThrow();
  }
  expect(reads).toBe(0);
});
test('duplicate aliases, canonical collisions and unresolved alias ambiguity reject atomically', () => {
  for (const inputs of [ [record(), record({ canonicalId: 'other' })],
    [record({ aliases: ['local small', 'local small'] })],
    [record(), record({ canonicalId: 'other', aliases: ['tool.local.small'] })] ]) {
    expect(() => createIntegrationCatalog(host, inputs)).toThrow(/ambiguous/);
  }
  expect(() => createIntegrationCatalog(host, [record()], ['local small'])).toThrow(/ambiguous/);
});
test('stale/future observations and changed/missing subjects disable candidates', () => {
  expect(createIntegrationCatalog({ ...host, now: () => 1099 }, [record()]).lookup('local small').reasons).toContain('stale-observation');
  expect(createIntegrationCatalog({ ...host, now: () => 998 }, [record()]).lookup('local small').reasons).toContain('future-observation');
  expect(createIntegrationCatalog({ ...host, currentSubjectDigest: () => 'b'.repeat(64) }, [record()]).lookup('local small').reasons).toContain('subject-drift');
  expect(createIntegrationCatalog({ now: host.now, maxAgeMs: 100 }, [record()]).lookup('local small').reasons).toContain('subject-unavailable');
  expect(createIntegrationCatalog({ ...host, now: () => NaN }, [record()]).lookup('local small').available).toBe(false);
});
test('installation, protocol and auth availability failures remain explicit', () => {
  const catalog = createIntegrationCatalog(host, [record({ installation: 'missing', protocol: 'unknown', authReference: 'account.local', authAvailable: false })]);
  expect(catalog.lookup('local small')).toMatchObject({ available: false, reasons: ['not-installed', 'protocol-unverified', 'missing-auth'] });
});
test('input mutations cannot change catalog and all nested snapshots are frozen', () => {
  const input = structuredClone(record());
  const unresolved = ['unverified'];
  const catalog = createIntegrationCatalog(host, [input], unresolved);
  Object.assign(input, { canonicalId: 'changed', authAvailable: false });
  (input.aliases as string[]).push('injected'); Object.assign(input.binding!, { modelId: 'changed' }); unresolved.push('injected');
  expect(catalog.lookup('local small').available).toBe(true);
  expect(catalog.lookup('injected').record).toBeNull();
  const snapshot = catalog.snapshot();
  for (const value of [snapshot, snapshot.records, snapshot.records[0], snapshot.records[0].record,
    snapshot.records[0].record!.aliases, snapshot.records[0].record!.binding, snapshot.records[0].reasons, snapshot.unresolvedAliases]) expect(Object.isFrozen(value)).toBe(true);
});
test('nested array getters and invalid binding kinds cannot enter inventory', () => {
  let reads = 0; const aliases = ['x'];
  Object.defineProperty(aliases, '0', { enumerable: true, get() { reads++; return 'x'; } });
  expect(() => createIntegrationCatalog(host, [record({ aliases })])).toThrow();
  expect(() => createIntegrationCatalog(host, [record({ kind: 'mcp' })])).toThrow();
  expect(() => createIntegrationCatalog(host, [record({ binding: null })])).toThrow();
  expect(reads).toBe(0);
});
