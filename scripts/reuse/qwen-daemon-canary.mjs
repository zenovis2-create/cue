// Manual, user-authorized localhost canary. Never grants runtime admission.
import { streamLocalModel } from '../../daemon/dist/src/adapters/local-model.js';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const endpoint = 'http://127.0.0.1:8085/v1';
const model = 'qwen38-27b-unc';
const directory = new URL('../../evidence/integrations/S1/20260911-local-model/', import.meta.url);
const result = {
  command: 'node scripts/reuse/qwen-daemon-canary.mjs', startedAt: new Date().toISOString(),
  endpoint, model, scope: 'real daemon transport connectivity; no M1-M3 qualification',
  sourceSha256: createHash('sha256').update(readFileSync(new URL('../../daemon/src/adapters/local-model.ts', import.meta.url))).digest('hex'),
  events: [],
};
try {
  const response = await fetch(endpoint + '/models', { redirect: 'error', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw Error('models HTTP ' + response.status);
  result.modelMetadata = (await response.json()).data.find(item => item.id === model);
  if (!result.modelMetadata) throw Error('model not advertised');
  for await (const event of streamLocalModel({ endpoint, model, prompt: 'Reply with exactly OK. /no_think',
    maxOutputTokens: 128, timeoutMs: 10000 })) result.events.push(event);
  result.passed = result.events.some(event => event.type === 'text' && event.text.trim()) &&
    result.events.some(event => event.type === 'terminal' && event.status === 'completed');
} catch (error) { result.passed = false; result.error = String(error); }
result.finishedAt = new Date().toISOString();
mkdirSync(directory, { recursive: true });
const filename = 'live-' + result.startedAt.replace(/[:.]/g, '-') + '.json';
writeFileSync(new URL(filename, directory), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ ...result, evidence: filename }, null, 2));
process.exitCode = result.passed ? 0 : 1;
