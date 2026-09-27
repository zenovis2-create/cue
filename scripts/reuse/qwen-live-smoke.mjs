// Explicit manual connectivity probe. No application activation or P13 admission.
import { streamModel } from './model-transport.mjs';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const directory = 'evidence/integrations/S1/20260911-qwen-live';
const result = {
  startedAt: new Date().toISOString(),
  endpoint: 'http://127.0.0.1:8085/v1',
  model: 'qwen38-27b-unc',
  scope: 'live connectivity only; not M1-M3 qualification',
  transportSha256: createHash('sha256').update(readFileSync(new URL('./model-transport.mjs', import.meta.url))).digest('hex'),
  events: [],
};
try {
  const response = await fetch(result.endpoint + '/models', { redirect: 'error', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('models HTTP ' + response.status);
  const models = await response.json();
  result.modelMetadata = models.data.find(model => model.id === result.model);
  if (!result.modelMetadata) throw new Error('model not advertised');
  for await (const event of streamModel({
    url: result.endpoint + '/chat/completions', protocol: 'chat-sse', model: result.model,
    input: 'Reply with exactly OK. /no_think', timeoutMs: 10000,
  })) result.events.push(event);
  result.passed = result.events.some(event => event.type === 'text' && event.text.trim()) &&
    result.events.some(event => event.type === 'terminal' && event.status === 'completed');
} catch (error) {
  result.passed = false;
  result.error = String(error);
}
result.finishedAt = new Date().toISOString();
mkdirSync(directory, { recursive: true });
// Keep each measurement; reruns must not erase earlier observations.
const filename = result.startedAt.replace(/[:.]/g, '-') + '.json';
writeFileSync(directory + '/' + filename, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.passed ? 0 : 1;
