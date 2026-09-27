import { afterEach, expect, test } from 'vitest';
import { createServer } from 'node:http';
import type { Server, ServerResponse } from 'node:http';
import { streamLocalModel } from '../src/adapters/local-model.js';
import type { LocalModelEvent } from '../src/adapters/local-model.js';

const servers: Server[] = [];
afterEach(async () => { for (const server of servers.splice(0)) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); } });
const chunk = (delta: unknown = {}, finish_reason: unknown = null, model = 'local') =>
  `data: ${JSON.stringify({ model, choices: [{ index: 0, delta, finish_reason }] })}\n\n`;
async function server(write: (response: ServerResponse) => void) {
  let body = '';
  const http = createServer((request, response) => {
    request.on('data', value => { body += String(value); });
    request.on('end', () => { response.setHeader('Content-Type', 'text/event-stream'); write(response); });
  });
  servers.push(http);
  await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
  const address = http.address();
  if (!address || typeof address === 'string') throw Error('missing endpoint');
  return { endpoint: `http://127.0.0.1:${address.port}/v1`, body: () => JSON.parse(body) as Record<string, unknown> };
}
async function collect(endpoint: string, extra = {}) {
  const events: LocalModelEvent[] = [];
  for await (const event of streamLocalModel({ endpoint, model: 'local', prompt: 'hello', ...extra })) events.push(event);
  return events;
}
test('bounded request emits streamed text, reported usage and protocol completion only', async () => {
  const fixture = await server(response => response.end(chunk({ content: '안녕' }) + chunk({}, 'stop') +
    'data: {"model":"local","choices":[],"usage":{"prompt_tokens":3,"completion_tokens":2,"total_tokens":5}}\n\ndata: [DONE]\n\n'));
  expect(await collect(fixture.endpoint, { maxOutputTokens: 20 })).toEqual([
    { type: 'text', text: '안녕' }, { type: 'usage', inputTokens: 3, outputTokens: 2, totalTokens: 5 },
    { type: 'terminal', status: 'completed', reason: 'stop', providerStopped: 'unknown' },
  ]);
  expect(fixture.body()).toMatchObject({ max_tokens: 20, stream: true, stream_options: { include_usage: true } });
  expect(fixture.body()).not.toHaveProperty('tools');
});
test('length is incomplete and missing usage remains unknown', async () => {
  const fixture = await server(response => response.end(chunk({}, 'length') + 'data: [DONE]\n\n'));
  expect(await collect(fixture.endpoint)).toEqual([
    { type: 'usage', inputTokens: null, outputTokens: null, totalTokens: null },
    { type: 'terminal', status: 'incomplete', reason: 'length', providerStopped: 'unknown' },
  ]);
});
test.each([
  ['wrong identity', chunk({}, null, 'other')], ['missing terminal', chunk({}, 'stop')],
  ['tool request', chunk({ tool_calls: [{ id: 'x' }] })], ['malformed tool', chunk({ tool_calls: {} })],
  ['bad ordering', chunk({}, 'stop') + chunk({ content: 'late' })], ['early done', 'data: [DONE]\n\n'],
  ['bad JSON', 'data: {\n\n'],
  ['inconsistent usage', 'data: {"model":"local","choices":[],"usage":{"prompt_tokens":3,"completion_tokens":2,"total_tokens":4}}\n\n'],
])('rejects %s', async (_name, stream) => {
  const fixture = await server(response => response.end(stream));
  await expect(collect(fixture.endpoint)).rejects.toThrow();
});
test('byte bound, redirects and nonloopback endpoints fail closed', async () => {
  const fixture = await server(response => response.end(chunk({ content: 'large' })));
  await expect(collect(fixture.endpoint, { maxResponseBytes: 1 })).rejects.toThrow('byte limit');
  const redirect = await server(response => { response.statusCode = 302; response.setHeader('Location', 'http://example.com'); response.end(); });
  await expect(collect(redirect.endpoint)).rejects.toThrow();
  await expect(collect('http://localhost:8085/v1')).rejects.toThrow('endpoint');
});
test('timeout covers headers and stream; pre-cancel sends no request', async () => {
  const fixture = await server(response => response.write(chunk({ content: 'waiting' })));
  await expect(collect(fixture.endpoint, { timeoutMs: 20 })).rejects.toThrow();
  const controller = new AbortController(); controller.abort(Error('pre-cancel'));
  await expect(collect(fixture.endpoint, { signal: controller.signal })).rejects.toThrow('pre-cancel');
});
test('consumer stops its stream without terminating a concurrent request', async () => {
  const fixture = await server(response => response.write(chunk({ content: 'waiting' })));
  const controller = new AbortController();
  const iterator = streamLocalModel({ endpoint: fixture.endpoint, model: 'local', prompt: 'hello', signal: controller.signal });
  expect((await iterator.next()).value).toMatchObject({ type: 'text' });
  let finishOther: () => void = () => { throw Error('not started'); };
  const other = await server(response => {
    response.write(chunk({ content: 'alive' }));
    finishOther = () => response.end(chunk({}, 'stop') + 'data: [DONE]\n\n');
  });
  const otherIterator = streamLocalModel({ endpoint: other.endpoint, model: 'local', prompt: 'hello' });
  expect((await otherIterator.next()).value).toEqual({ type: 'text', text: 'alive' });
  controller.abort(Error('stop'));
  await expect(iterator.next()).rejects.toThrow();
  finishOther();
  const rest: LocalModelEvent[] = [];
  for await (const event of otherIterator) rest.push(event);
  expect(rest.at(-1)).toMatchObject({ type: 'terminal', status: 'completed' });
});
test.each(['cancel', 'timeout'])('buffered terminal cannot complete after %s during consumer pause', async kind => {
  const fixture = await server(response => response.end(chunk({ content: 'first' }) + chunk({}, 'stop') + 'data: [DONE]\n\n'));
  const controller = new AbortController();
  const iterator = streamLocalModel({ endpoint: fixture.endpoint, model: 'local', prompt: 'hello',
    signal: controller.signal, timeoutMs: kind === 'timeout' ? 100 : 5000 });
  expect((await iterator.next()).value).toMatchObject({ type: 'text' });
  if (kind === 'cancel') controller.abort(Error('cancel while buffered'));
  else await new Promise(resolve => setTimeout(resolve, 150));
  await expect(iterator.next()).rejects.toThrow();
});
