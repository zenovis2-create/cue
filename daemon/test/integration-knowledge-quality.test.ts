import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createKnowledgeIndex } from '../src/knowledge/lexical.js';
import type { ResourceSnapshot } from '../src/resources/packages.js';

type Document = { id: string; text: string; bom?: boolean };
type Query = { id: string; language: 'en' | 'ko'; query: string; relevant: string[] };
type Contract = {
  k: number;
  thresholds: {
    macroRecallAt3Minimum: number; englishMacroRecallAt3Minimum: number; koreanMacroRecallAt3Minimum: number;
    allQueryFalsePositiveQueriesMaximum: number; negativeFalsePositiveQueriesMaximum: number;
    requiresRecallImprovementOverLexicalBaseline: boolean; requiresAllProvenanceChecks: boolean;
  };
  frozenLexicalBaseline: Metrics;
  fixtureSha256: Record<string, string>;
};
type Metrics = {
  macroRecallAt3: number; englishMacroRecallAt3: number; koreanMacroRecallAt3: number;
  allQueryFalsePositiveQueries: number; negativeFalsePositiveQueries: number;
};

const fixture = (name: string) => fileURLToPath(new URL(`fixtures/s6-knowledge-quality-v2/${name}`, import.meta.url));
const bytes = (name: string) => readFileSync(fixture(name));
const json = <T>(name: string): T => JSON.parse(bytes(name).toString('utf8')) as T;
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

function snapshots(documents: Document[]): { snapshots: readonly ResourceSnapshot[]; originals: Map<string, string> } {
  const originals = new Map(documents.map(document => [document.id, (document.bom ? '\uFEFF' : '') + document.text]));
  const resources = Object.freeze(documents.map(document => {
    const text = originals.get(document.id)!;
    return Object.freeze({ id: document.id, kind: 'knowledge' as const, path: `docs/${document.id}.txt`, sha256: sha(text), byteLength: Buffer.byteLength(text), text });
  }));
  const snapshot = Object.freeze({
    id: 's6-quality-fixture', version: '2.0.0', source: 'https://example.invalid/s6-quality-fixture',
    revision: 'b'.repeat(40), manifestSha256: sha(JSON.stringify(resources.map(({ text: _text, ...entry }) => entry))), resources,
  });
  return { snapshots: Object.freeze([snapshot]), originals };
}

describe('S6 authored bilingual lexical quality gate', () => {
  it('measures fixed recall, false positives, provenance, UTF8 byte ranges, and stable ordering', () => {
    const contract = json<Contract>('contract.json');
    const corpus = json<{ documents: Document[] }>('corpus.json');
    const queries = json<{ k: number; queries: Query[] }>('queries.json');
    expect(sha(bytes('corpus.json'))).toBe(contract.fixtureSha256['corpus.json']);
    expect(sha(bytes('queries.json'))).toBe(contract.fixtureSha256['queries.json']);
    expect(queries.k).toBe(contract.k);

    const source = snapshots(corpus.documents);
    const index = createKnowledgeIndex(source.snapshots);
    let truePositives = 0, falsePositives = 0, falseNegatives = 0;
    let falsePositiveQueries = 0, negativeFalsePositiveQueries = 0, provenanceChecks = 0;
    const recall: number[] = [], english: number[] = [], korean: number[] = [];
    for (const query of queries.queries) {
      const hits = index.search(query.query, contract.k);
      expect(index.search(query.query, contract.k)).toEqual(hits);
      const ids = hits.map(hit => hit.resourceId);
      const relevant = new Set(query.relevant);
      const tp = ids.filter(id => relevant.has(id)).length;
      const fp = ids.filter(id => !relevant.has(id)).length;
      const fn = query.relevant.filter(id => !ids.includes(id)).length;
      truePositives += tp; falsePositives += fp; falseNegatives += fn;
      if (fp) falsePositiveQueries++;
      if (!query.relevant.length && hits.length) negativeFalsePositiveQueries++;
      if (query.relevant.length) {
        const value = tp / query.relevant.length;
        recall.push(value); (query.language === 'en' ? english : korean).push(value);
      }
      for (const hit of hits) {
        const original = source.originals.get(hit.resourceId)!;
        expect(Buffer.from(original).subarray(hit.byteStart, hit.byteEnd).toString('utf8')).toBe(hit.excerpt);
        expect(hit).toMatchObject({
          packageId: 's6-quality-fixture', version: '2.0.0', source: 'https://example.invalid/s6-quality-fixture',
          revision: 'b'.repeat(40), manifestSha256: source.snapshots[0]!.manifestSha256, sha256: sha(original),
          authority: 'reference-only', sourceVerification: 'declared-not-remote-verified',
        });
        expect(Object.isFrozen(hit)).toBe(true); provenanceChecks++;
      }
      expect(Object.isFrozen(hits)).toBe(true);
    }
    const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    const metrics: Metrics = {
      macroRecallAt3: mean(recall), englishMacroRecallAt3: mean(english), koreanMacroRecallAt3: mean(korean),
      allQueryFalsePositiveQueries: falsePositiveQueries, negativeFalsePositiveQueries,
    };
    const measured = { mode: process.env.S6_QUALITY_BASELINE === '1' ? 'baseline' : 'final', metrics,
      confusion: { truePositives, falsePositives, falseNegatives }, provenanceChecks };
    console.log(`S6_KNOWLEDGE_QUALITY ${JSON.stringify(measured)}`);

    if (process.env.S6_QUALITY_BASELINE === '1') {
      expect(metrics).toEqual(contract.frozenLexicalBaseline);
      return;
    }
    expect(metrics.macroRecallAt3).toBeGreaterThanOrEqual(contract.thresholds.macroRecallAt3Minimum);
    expect(metrics.englishMacroRecallAt3).toBeGreaterThanOrEqual(contract.thresholds.englishMacroRecallAt3Minimum);
    expect(metrics.koreanMacroRecallAt3).toBeGreaterThanOrEqual(contract.thresholds.koreanMacroRecallAt3Minimum);
    expect(metrics.allQueryFalsePositiveQueries).toBeLessThanOrEqual(contract.thresholds.allQueryFalsePositiveQueriesMaximum);
    expect(metrics.negativeFalsePositiveQueries).toBeLessThanOrEqual(contract.thresholds.negativeFalsePositiveQueriesMaximum);
    if (contract.thresholds.requiresRecallImprovementOverLexicalBaseline) expect(metrics.macroRecallAt3).toBeGreaterThan(contract.frozenLexicalBaseline.macroRecallAt3);
    if (contract.thresholds.requiresAllProvenanceChecks) expect(provenanceChecks).toBe(truePositives + falsePositives);
  });
});
