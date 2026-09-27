import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { streamModel } from './model-transport.mjs';

const model = 'fixture-model';
const sse = value => `data: ${typeof value === 'string' ? value : JSON.stringify(value)}\r\n\r\n`;
const choice = (content, finish_reason = null) => ({ model, choices: [{ index: 0, delta: { content }, finish_reason }] });
const local = (content, done = false, extra = {}) => JSON.stringify({ model, message: { content }, done, ...(done ? { done_reason: 'stop' } : {}), ...extra }) + '\n';
const collect = async options => { const out = []; for await (const e of streamModel(options)) out.push(e); return out; };
async function fixture(t, handler, protocol = 'chat-sse') {
  let requests = 0;
  const server = createServer((req, res) => {
    requests++;
    assert.equal(req.headers.authorization, undefined);
    res.setHeader('Content-Type', protocol === 'chat-sse' ? 'text/event-stream' : 'application/x-ndjson');
    handler(req, res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return { options: { url: `http://127.0.0.1:${server.address().port}${protocol === 'chat-sse' ? '/v1/chat/completions' : '/api/chat'}`, protocol, model, input: 'fixture', timeoutMs: 500 }, requests: () => requests };
}

test('chat SSE split UTF8, multiline data, usage and successful terminal', async t => {
  const body = sse(choice('한글')) + 'data: {"model":"fixture-model",\r\ndata: "choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\r\n\r\n' + sse({ model, choices: [], usage: { prompt_tokens: 2, completion_tokens: 3 }, extra: 'ignored' }) + sse('[DONE]');
  const f = await fixture(t, (_, res) => { for (const b of Buffer.from(body)) res.write(Buffer.from([b])); res.end(); });
  const events = await collect(f.options);
  assert.equal(events[0].text, '한글');
  assert.deepEqual(events[1], { type: 'usage', status: 'observed', inputTokens: 2, outputTokens: 3 });
  assert.equal(events[2].providerStopped, 'unknown'); assert.equal(f.requests(), 1);
});
test('local NDJSON known usage and unknown usage stay distinct', async t => {
  for (const extra of [{ prompt_eval_count: 4, eval_count: 2 }, {}]) {
    const f = await fixture(t, (_, res) => res.end(local('hello') + local('', true, extra)), 'ollama-ndjson');
    const events = await collect(f.options);
    assert.equal(events[0].text, 'hello'); assert.equal(events[1].status, Object.keys(extra).length ? 'observed' : 'unknown');
    assert.equal(events.at(-1).status, 'completed');
  }
});
for (const [name, body, error] of [
  ['malformed JSON', 'data: {bad}\n\n', /JSON/],
  ['partial stream', sse(choice('partial')), /EOF/],
  ['finish without DONE', sse(choice('', 'stop')), /EOF/],
  ['DONE without finish', sse('[DONE]'), /finish reason/],
  ['length limit', sse(choice('', 'length')), /incomplete/],
  ['wrong identity', sse({ ...choice('x'), model: 'other' }), /identity/],
  ['tool request', sse({ model, choices: [{ index: 0, delta: { tool_calls: [{}] }, finish_reason: null }] }), /tool request/],
  ['negative usage', sse({ model, choices: [], usage: { prompt_tokens: -1, completion_tokens: 0 } }), /usage/],
]) test(name, async t => { const f = await fixture(t, (_, res) => res.end(body)); await assert.rejects(collect(f.options), error); assert.equal(f.requests(), 1); });
test('response bound includes unfinished lines', async t => {
  const f = await fixture(t, (_, res) => res.end('data: ' + 'x'.repeat(100)));
  await assert.rejects(collect({ ...f.options, maxBytes: 30 }), /byte limit/);
});
test('HTTP error never retries', async t => {
  const f = await fixture(t, (_, res) => { res.statusCode = 429; res.end(); });
  await assert.rejects(collect(f.options), /http failure 429/); assert.equal(f.requests(), 1);
});
test('redirect never followed', async t => {
  const f = await fixture(t, (_, res) => { res.statusCode = 302; res.setHeader('Location', '/other'); res.end(); });
  await assert.rejects(collect(f.options)); assert.equal(f.requests(), 1);
});
test('already aborted performs zero requests', async t => {
  const f = await fixture(t, (_, res) => res.end()); const ac = new AbortController(); ac.abort(new Error('pre-abort'));
  await assert.rejects(collect({ ...f.options, signal: ac.signal }), /pre-abort/); assert.equal(f.requests(), 0);
});
test('pre-header timeout closes client connection', async t => {
  let closedResolve; const closed = new Promise(resolve => { closedResolve = resolve; });
  const f = await fixture(t, (_, res) => res.on('close', closedResolve));
  await assert.rejects(collect({ ...f.options, timeoutMs: 60 }), /timeout/);
  await Promise.race([closed, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('socket not closed')), 400); timer.unref(); })]);
  assert.equal(f.requests(), 1);
});
test('cancel after delta closes one stream while parallel request completes', async t => {
  let closedResolve; const closed = new Promise(resolve => { closedResolve = resolve; }); let n = 0;
  const f = await fixture(t, (_, res) => {
    if (++n === 1) { res.on('close', closedResolve); res.write(sse(choice('partial'))); }
    else res.end(sse(choice('other', 'stop')) + sse('[DONE]'));
  });
  const ac = new AbortController(); const iterator = streamModel({ ...f.options, signal: ac.signal });
  assert.equal((await iterator.next()).value.text, 'partial');
  const other = collect(f.options); ac.abort(new Error('user stop'));
  await assert.rejects(iterator.next()); assert.equal((await other).at(-1).status, 'completed');
  await closed; assert.equal(f.requests(), 2);
});
test('non-loopback URL and invalid protocol reject before network', async () => {
  for (const url of ['https://example.com/v1/chat/completions', 'http://user:pw@127.0.0.1:1/api/chat', 'http://127.0.0.1:1/api/chat?x=1']) {
    await assert.rejects(collect({ url, protocol: 'ollama-ndjson', model, input: 'x' }), /endpoint/);
  }
});
test('NDJSON partial, error, tools and missing terminal fail', async t => {
  for (const body of ['{bad}\n', local('x'), JSON.stringify({ error: 'failure' }) + '\n', JSON.stringify({ model, message: { content: '', tool_calls: [{}] }, done: true, done_reason: 'stop' }) + '\n']) {
    const f = await fixture(t, (_, res) => res.end(body), 'ollama-ndjson');
    await assert.rejects(collect(f.options));
  }
});
