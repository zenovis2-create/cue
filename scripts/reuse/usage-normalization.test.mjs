import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUsage } from './usage-normalization.mjs';

test('absent usage remains unknown instead of a zero-cost observation', () => {
  for (const provider of ['openai-chat', 'ollama']) {
    assert.equal(normalizeUsage(provider, undefined).total, null);
    assert.equal(normalizeUsage(provider, {}).status, 'unknown');
  }
});

test('chat cached input is a subset, never added to total twice', () => {
  const result = normalizeUsage('openai-chat', { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120, prompt_tokens_details: { cached_tokens: 80 } });
  assert.deepEqual(result, { provider: 'openai-chat', status: 'reported', input: 100, output: 20, cachedInput: 80, total: 120, totalSource: 'reported' });
  assert.ok(Object.isFrozen(result));
});

test('Ollama counters use eval counts and preserve unknown cache attribution', () => {
  assert.deepEqual(normalizeUsage('ollama', { prompt_eval_count: 10, eval_count: 2 }), {
    provider: 'ollama', status: 'reported', input: 10, output: 2, cachedInput: null, total: 12, totalSource: 'derived',
  });
});

test('a supplied zero is an observation; a missing counter is not', () => {
  assert.equal(normalizeUsage('openai-chat', { prompt_tokens: 0, completion_tokens: 0 }).total, 0);
  const partial = normalizeUsage('openai-chat', { prompt_tokens: 0 });
  assert.equal(partial.total, null);
  assert.equal(partial.output, null);
  assert.equal(partial.status, 'partial');
});

test('partial reported totals stay partial and are not invented component counts', () => {
  const result = normalizeUsage('openai-chat', { total_tokens: 10 });
  assert.equal(result.input, null);
  assert.equal(result.status, 'partial');
  assert.equal(result.totalSource, 'reported');
});

test('rejects malformed counters and inconsistent cache or totals', () => {
  for (const bad of [-1, 1.1, '5', true, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => normalizeUsage('openai-chat', { prompt_tokens: bad }));
  }
  for (const bad of [
    { prompt_tokens: 1, completion_tokens: 2, total_tokens: 4 },
    { prompt_tokens: 10, total_tokens: 1 },
    { prompt_tokens: 1, prompt_tokens_details: { cached_tokens: 2 } },
    { total_tokens: 1, prompt_tokens_details: { cached_tokens: 100 } },
    { total_tokens: 100, completion_tokens: 99, prompt_tokens_details: { cached_tokens: 2 } },
    { prompt_tokens: Number.MAX_SAFE_INTEGER, completion_tokens: 1 },
  ]) assert.throws(() => normalizeUsage('openai-chat', bad));
});

test('rejects unsupported provider and non-record inputs', () => {
  assert.throws(() => normalizeUsage('unknown', {}));
  for (const raw of [[], 1, 'x', new Date()]) assert.throws(() => normalizeUsage('ollama', raw));
});

test('does not mutate input or retain arbitrary provider data', () => {
  const raw = Object.freeze({ prompt_tokens: 1, completion_tokens: 2, privateMetadata: 'not-for-output' });
  assert.equal(JSON.stringify(normalizeUsage('openai-chat', raw)).includes('not-for-output'), false);
  assert.deepEqual(normalizeUsage('openai-chat', raw), normalizeUsage('openai-chat', raw));
});
