import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, realpathSync } from 'node:fs';
import { dirname, basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { createResourcePackages } from '../../daemon/dist/src/resources/packages.js';
import { createKnowledgeIndex } from '../../daemon/dist/src/knowledge/lexical.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const evidence = join(root, 'evidence/integrations/S6/20260911-knowledge-holdout');
const resultPath = join(evidence, 'results.json');
if (existsSync(resultPath)) throw Error('frozen_evaluation_already_recorded');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const ordered = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const pins = {
  'evidence/integrations/S6/20260911-knowledge-holdout/corpus.json': 'b55fb2c1d05ec5079bc08c30827f24eef98a2ca46724c94d6b141744cf2670cc',
  'evidence/integrations/S6/20260911-knowledge-holdout/queries.json': '63122708be063f8f721da185d480d471e5dc19c7733d30a9e6c4f7ef9b3994b9',
  'daemon/src/knowledge/lexical.ts': 'b1c26bafc0a5671564a54ddeb0ce587d5b7f1422ad711fc56eaac32b871b6e21',
  'daemon/src/resources/packages.ts': 'e58bb3015fcb134db84a88b9fa049dd4f7cb2fc2509719509d9531a3c5e3924a',
};
const result = { schemaVersion: 1, evaluationComplete: false, kind: 'small-authored-not-blind-not-production', startedAt: new Date().toISOString(), modelCalls: 0, networkCalls: 0, bindings: {}, individual: [] };
let work;
try {
  for (const [path, expected] of Object.entries(pins)) {
    const observed = sha(readFileSync(join(root, path))); assert.equal(observed, expected, 'frozen input/source changed: ' + path); result.bindings[path] = observed;
  }
  for (const path of ['scripts/reuse/knowledge-holdout.mjs', 'evidence/integrations/S6/20260911-knowledge-holdout/contract.md', 'daemon/dist/src/knowledge/lexical.js', 'daemon/dist/src/resources/packages.js']) result.bindings[path] = sha(readFileSync(join(root, path)));
  const corpus = JSON.parse(readFileSync(join(evidence, 'corpus.json'), 'utf8'));
  const { queries, k } = JSON.parse(readFileSync(join(evidence, 'queries.json'), 'utf8'));
  assert.equal(corpus.documents.length, 16); assert.equal(queries.length, 24); assert.equal(k, 3);
  const docs = new Map(corpus.documents.map(d => [d.id, { ...d, bytes: Buffer.from((d.bom ? '\uFEFF' : '') + d.text) }]));
  assert.equal(docs.size, 16);
  for (const q of queries) { assert(q.relevant.every(id => docs.has(id))); assert.equal(new Set(q.relevant).size, q.relevant.length); }
  work = realpathSync(mkdtempSync(join(tmpdir(), 'cue-knowledge-holdout-'))); mkdirSync(join(work, 'docs'));
  const resources = [...docs.values()].map(d => {
    const path = 'docs/' + d.id + '.txt'; writeFileSync(join(work, path), d.bytes);
    return { id: d.id, kind: 'knowledge', path, sha256: sha(d.bytes), byteLength: d.bytes.length };
  });
  const manifest = { schemaVersion: 1, id: 'authored-evaluation', version: '1.0.0', source: 'https://example.invalid/authored-evaluation', revision: pins['evidence/integrations/S6/20260911-knowledge-holdout/corpus.json'], resources };
  const manifestText = JSON.stringify(manifest); writeFileSync(join(work, 'manifest.json'), manifestText);
  const registry = createResourcePackages(); registry.register({ root: work, manifestSha256: sha(manifestText) });
  const index = createKnowledgeIndex(registry.pinRun('authored-evaluation-run'));
  const metrics = (ids, relevant) => ({ ids, truePositives: ids.filter(id => relevant.includes(id)), falsePositives: ids.filter(id => !relevant.includes(id)),
    falseNegatives: relevant.filter(id => !ids.includes(id)), recall: relevant.length ? ids.filter(id => relevant.includes(id)).length / relevant.length : null });
  for (const q of queries) {
    const baselineIds = [...docs.values()].filter(d => d.bytes.toString('utf8').toLowerCase().includes(q.query.toLowerCase())).map(d => d.id).sort(ordered).slice(0, k);
    const hits = index.search(q.query, k);
    const citationChecks = hits.map(hit => {
      const d = docs.get(hit.resourceId); assert(d);
      assert.equal(d.bytes.subarray(hit.byteStart, hit.byteEnd).toString('utf8'), hit.excerpt);
      assert.equal(hit.sha256, sha(d.bytes)); assert.equal(hit.manifestSha256, sha(manifestText)); assert.equal(hit.revision, manifest.revision);
      assert.equal(hit.source, manifest.source); assert.equal(hit.authority, 'reference-only'); assert.equal(hit.sourceVerification, 'declared-not-remote-verified');
      assert.equal(hit.packageId, manifest.id); assert.equal(hit.path, 'docs/' + d.id + '.txt'); assert.equal(hit.version, manifest.version);
      assert(hit.byteStart >= 0 && hit.byteEnd <= d.bytes.length && hit.byteEnd >= hit.byteStart); assert(!hit.excerpt.includes('\uFFFD'));
      return { resourceId: hit.resourceId, byteStart: hit.byteStart, byteEnd: hit.byteEnd, excerpt: hit.excerpt, sha256: hit.sha256, manifestSha256: hit.manifestSha256, originalBytesVerified: true, bomDocument: !!d.bom };
    });
    result.individual.push({ ...q, baseline: metrics(baselineIds, q.relevant), actual: metrics(hits.map(h => h.resourceId), q.relevant), citationChecks });
  }
  const aggregate = method => {
    const positives = result.individual.filter(q => q.relevant.length), negatives = result.individual.filter(q => !q.relevant.length);
    const falsePositiveQueries = result.individual.filter(q => q[method].falsePositives.length).length;
    const negativeFalsePositiveQueries = negatives.filter(q => q[method].ids.length).length;
    return { k, totalQueries: queries.length, positiveQueries: positives.length, negativeQueries: negatives.length,
      macroRecallAtK: positives.reduce((n, q) => n + q[method].recall, 0) / positives.length, falsePositiveQueries,
      falsePositiveQueryRate: falsePositiveQueries / queries.length, negativeFalsePositiveQueries, negativeFalsePositiveQueryRate: negativeFalsePositiveQueries / negatives.length };
  };
  result.baseline = aggregate('baseline'); result.actual = aggregate('actual');
  result.provenanceChecksPassed = result.individual.reduce((n, q) => n + q.citationChecks.length, 0);
  result.qualityGate = result.actual.macroRecallAtK > result.baseline.macroRecallAtK && result.actual.falsePositiveQueryRate <= result.baseline.falsePositiveQueryRate && result.actual.negativeFalsePositiveQueryRate <= result.baseline.negativeFalsePositiveQueryRate;
  result.evaluationComplete = true;
} catch (error) { result.error = String(error); process.exitCode = 1; }
finally {
  if (work) try {
    assert.equal(dirname(work), realpathSync(tmpdir())); assert(basename(work).startsWith('cue-knowledge-holdout-')); rmSync(work, { recursive: true, force: true });
  } catch (error) { result.cleanupError = String(error); result.evaluationComplete = false; process.exitCode = 1; }
  result.finishedAt = new Date().toISOString(); writeFileSync(resultPath, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ evaluationComplete: result.evaluationComplete, qualityGate: result.qualityGate, baseline: result.baseline, actual: result.actual, error: result.error }));
}
