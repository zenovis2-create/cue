import { afterEach, describe, expect, it, vi } from 'vitest';
import { readLocalModelHttpFailure, streamLocalModel } from '../src/adapters/local-model.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); });

async function rejected(status: number) {
  globalThis.fetch = vi.fn(async () => new Response('provider secret response', {
    status, statusText: 'provider secret status', headers: { 'x-provider-secret': 'secret' },
  })) as typeof fetch;
  try {
    for await (const _ of streamLocalModel({ endpoint: 'http://127.0.0.1:8085/v1', model: 'model', prompt: 'prompt' })) { /* no events */ }
  } catch (error) {
    return error;
  }
  throw Error('expected rejection');
}

describe('local model HTTP rejection facts (mock fetch; no network)', () => {
  it.each([
    [401, 'local-http-401'], [403, 'local-http-403'], [408, 'local-http-408'],
    [429, 'local-http-429'], [500, 'local-http-5xx'], [599, 'local-http-5xx'],
    [400, 'local-http-other'], [418, 'local-http-other'],
  ] as const)('classifies HTTP %i without retaining response data', async (status, code) => {
    const error = await rejected(status);
    expect(error).toEqual(Error(`local model HTTP ${status}`));
    expect(readLocalModelHttpFailure(error)).toBe(code);
    expect(JSON.stringify(error)).not.toContain('secret');
  });

  it('does not classify forged errors or a successful response with no body', async () => {
    expect(readLocalModelHttpFailure(Object.assign(Error('local model HTTP 401'), { diagnosticCode: 'local-http-401' }))).toBeNull();
    globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, body: null, headers: new Headers() }) as Response) as typeof fetch;
    const error = await rejectedByCurrentFetch();
    expect((error as Error).message).toBe('local model HTTP 200');
    expect(readLocalModelHttpFailure(error)).toBeNull();
  });
});

async function rejectedByCurrentFetch() {
  try {
    for await (const _ of streamLocalModel({ endpoint: 'http://127.0.0.1:8085/v1', model: 'model', prompt: 'prompt' })) { /* no events */ }
  } catch (error) { return error; }
  throw Error('expected rejection');
}
