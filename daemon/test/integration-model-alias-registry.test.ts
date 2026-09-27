import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { getModelAliasRegistry, lookupModelAlias } from '../src/model-alias-registry.js';

const SPEC_ALIASES = [
  'gpt 5.6 sol',
  'terra',
  'luna',
  '6 astra',
  'claude opus 5.0',
  'sonnet 5',
  'haiku',
  'fable 5.1',
  'gemini flash 3.8',
  'qwen 3.8 27b (로컬)',
  'grok 4.6',
  'muse 1.3',
] as const;

function aliasesFromSpec(): string[] {
  const candidates = [
    resolve(process.cwd(), 'docs/INTEGRATION_SPEC.md'),
    resolve(process.cwd(), '../docs/INTEGRATION_SPEC.md'),
  ];
  const path = candidates.find(candidate => existsSync(candidate));
  if (!path) throw new Error('INTEGRATION_SPEC.md not found');
  const line = readFileSync(path, 'utf8').split(/\r?\n/u).find(value => value.startsWith('사용자 제시 모델 후보:'));
  if (!line) throw new Error('user model alias source line not found');
  return [...line.matchAll(/`([^`]+)`/gu)].map(match => match[1]);
}

const RESOLVED_IDS = new Map<string, string>([
  ['gpt 5.6 sol', 'gpt-5.6-sol'],
  ['6 astra', 'gpt-6-astra'],
  ['claude opus 5.0', 'claude-opus-5'],
  ['sonnet 5', 'claude-sonnet-5'],
  ['fable 5.1', 'claude-fable-5-1'],
  ['gemini flash 3.8', 'gemini-3.8-flash'],
  ['qwen 3.8 27b (로컬)', 'qwen38-27b-unc'],
  ['grok 4.6', 'grok-4.6'],
]);

function deepFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== 'object' || seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Reflect.ownKeys(value).every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && Object.hasOwn(descriptor, 'value') && deepFrozen(descriptor.value, seen);
  });
}

describe('static model alias inventory', () => {
  test('contains every spec alias exactly once and no extra alias', () => {
    const aliases = getModelAliasRegistry().records.map(record => record.originalAlias);
    expect(aliasesFromSpec()).toEqual(SPEC_ALIASES);
    expect(aliases).toEqual(SPEC_ALIASES);
    expect(new Set(aliases).size).toBe(SPEC_ALIASES.length);
  });

  test('maps only primary-evidence canonical IDs and keeps all rows disabled', () => {
    const registry = getModelAliasRegistry();
    expect(registry).toMatchObject({
      version: 'cue-model-alias-registry-v1',
      authority: 'observation-only',
      grants: { selection: false, admission: false, price: false, rank: false, entitlement: false, dispatch: false },
    });
    for (const record of registry.records) {
      expect(record).toMatchObject({ qualification: false, enabled: false, entitlement: 'unknown', price: 'unknown', capabilities: 'unknown' });
      expect(record.evidence.digest).toMatch(/^[a-f0-9]{64}$/);
      expect(record.evidence.observedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const expected = RESOLVED_IDS.get(record.originalAlias);
      if (expected) expect(record).toMatchObject({ state: 'resolved-inactive', canonicalModelId: expected });
      else expect(record).toMatchObject({ state: 'inactive-unresolved', canonicalModelId: null });
    }
  });

  test('binds the local Qwen wording only to the server-advertised ID', () => {
    const qwen = lookupModelAlias('qwen 3.8 27b (로컬)');
    expect(qwen).toMatchObject({ available: false, reason: 'resolved-disabled', record: {
      provider: 'local-llama.cpp',
      canonicalModelId: 'qwen38-27b-unc',
      evidence: { reference: 'evidence/integrations/S1/20260911-qwen-live/result.json' },
    } });
    for (const guessed of ['qwen-3.8-27b', 'Qwen 3.8 27B (로컬)', 'qwen38-27b']) {
      expect(lookupModelAlias(guessed)).toMatchObject({ available: false, reason: 'unknown-alias', record: null });
    }
  });

  test('every unresolved alias is known but unavailable', () => {
    const unresolved = getModelAliasRegistry().records.filter(record => record.state === 'inactive-unresolved');
    expect(unresolved.map(record => record.originalAlias)).toEqual(['terra', 'luna', 'haiku', 'muse 1.3']);
    for (const record of unresolved) {
      expect(lookupModelAlias(record.originalAlias)).toEqual({ available: false, reason: 'inactive-unresolved', record });
    }
  });

  test('does not use normalized collision keys for fuzzy or wrong-case lookup', () => {
    const registry = getModelAliasRegistry();
    expect(new Set(registry.records.map(record => record.normalizedLookupKey)).size).toBe(registry.records.length);
    for (const record of registry.records) {
      const wrongCase = record.originalAlias.replace(/[A-Za-z]/u, character =>
        character === character.toUpperCase() ? character.toLowerCase() : character.toUpperCase());
      expect(wrongCase).not.toBe(record.originalAlias);
      expect(lookupModelAlias(wrongCase)).toMatchObject({ available: false, reason: 'unknown-alias', record: null });
      expect(lookupModelAlias(` ${record.originalAlias}`)).toMatchObject({ available: false, reason: 'invalid-alias', record: null });
    }
  });
});

describe('hostile input and immutability guards', () => {
  test('registry, records, evidence and grants are deeply frozen', () => {
    const registry = getModelAliasRegistry();
    expect(deepFrozen(registry)).toBe(true);
    expect(() => (registry.records as unknown as unknown[]).push(registry.records[0])).toThrow();
    expect(() => Object.assign(registry.records[0], { originalAlias: 'duplicate' })).toThrow();
    expect(() => Object.assign(registry.records[0].evidence, { digest: '0'.repeat(64) })).toThrow();
    expect(() => Object.assign(registry.grants, { selection: true })).toThrow();
    expect(getModelAliasRegistry().records.map(record => record.originalAlias)).toEqual(SPEC_ALIASES);
  });

  test('proxy, getter, custom prototype and oversized lookup values invoke no caller code', () => {
    let reads = 0;
    const proxy = new Proxy({}, {
      get() { reads++; throw new Error('get trap'); },
      getPrototypeOf() { reads++; throw new Error('prototype trap'); },
      ownKeys() { reads++; throw new Error('keys trap'); },
    });
    const getter = Object.defineProperty({}, 'alias', { enumerable: true, get() { reads++; throw new Error('getter'); } });
    const custom = Object.create({ toString() { reads++; return 'haiku'; } }) as object;
    for (const bad of [proxy, getter, custom, new String('haiku'), 'x'.repeat(201), '', 'haiku\u0000']) {
      expect(lookupModelAlias(bad)).toMatchObject({ available: false, reason: 'invalid-alias', record: null });
    }
    expect(reads).toBe(0);
  });

  test('snapshot rejects caller inventory, callbacks and extra lookup authority', () => {
    let reads = 0;
    const hostile = Object.defineProperty({}, 'records', { enumerable: true, get() { reads++; throw new Error('getter'); } });
    expect(() => (getModelAliasRegistry as unknown as (...args: unknown[]) => unknown)(hostile)).toThrow(/takes no input/);
    expect((lookupModelAlias as unknown as (...args: unknown[]) => unknown)('haiku', () => true)).toMatchObject({
      available: false,
      reason: 'invalid-alias',
      record: null,
    });
    expect(reads).toBe(0);
  });

  test('lookup results are frozen and duplicate mutation cannot alter the exact index', () => {
    const resolved = lookupModelAlias('gpt 5.6 sol');
    const unresolved = lookupModelAlias('haiku');
    const unknown = lookupModelAlias('HAIKU');
    for (const result of [resolved, unresolved, unknown]) expect(deepFrozen(result)).toBe(true);
    expect(() => Object.assign(resolved, { available: true })).toThrow();
    expect(lookupModelAlias('gpt 5.6 sol')).toMatchObject({ available: false, reason: 'resolved-disabled', record: { canonicalModelId: 'gpt-5.6-sol' } });
    expect(lookupModelAlias('HAIKU')).toMatchObject({ available: false, reason: 'unknown-alias', record: null });
  });
});
