import { randomUUID } from 'node:crypto';

/** Text-only local transport. Host admission is separate; this grants no tool authority. */
export interface LocalModelRequest {
  endpoint: string;
  model: string;
  prompt: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  maxOutputTokens?: number;
  maxResponseBytes?: number;
}
export type LocalModelEvent =
  | { type: 'text'; text: string }
  | { type: 'usage'; inputTokens: number | null; outputTokens: number | null; totalTokens: number | null }
  | { type: 'terminal'; status: 'completed' | 'incomplete'; reason: 'stop' | 'length'; providerStopped: 'unknown' };

export type LocalModelHttpFailureCode =
  | 'local-http-401'
  | 'local-http-403'
  | 'local-http-408'
  | 'local-http-429'
  | 'local-http-5xx'
  | 'local-http-other';
const httpFailures = new WeakMap<object, LocalModelHttpFailureCode>();
export function readLocalModelHttpFailure(error: unknown): LocalModelHttpFailureCode | null {
  return error !== null && (typeof error === 'object' || typeof error === 'function') ? httpFailures.get(error) ?? null : null;
}
function httpFailure(status: number): Error {
  const error = Error(`local model HTTP ${status}`);
  httpFailures.set(error, status === 401 ? 'local-http-401'
    : status === 403 ? 'local-http-403'
    : status === 408 ? 'local-http-408'
    : status === 429 ? 'local-http-429'
    : status >= 500 && status <= 599 ? 'local-http-5xx' : 'local-http-other');
  return error;
}

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
function integer(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum && (value as number) <= maximum;
}
function counter(value: unknown): number | null {
  if (value == null) return null;
  if (!integer(value, 0, Number.MAX_SAFE_INTEGER)) throw Error('invalid token counter');
  return value;
}

/** Consume once; timeout spans headers and stream. No retries, redirects or server control. */
export async function* streamLocalModel(request: LocalModelRequest): AsyncGenerator<LocalModelEvent> {
  const endpoint = new URL(request.endpoint);
  if (endpoint.protocol !== 'http:' || endpoint.hostname !== '127.0.0.1' || !endpoint.port ||
      endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/v1') {
    throw Error('unapproved local endpoint shape');
  }
  const { model, prompt } = request;
  const timeoutMs = request.timeoutMs ?? 60_000;
  const maxOutputTokens = request.maxOutputTokens ?? 512;
  const maxResponseBytes = request.maxResponseBytes ?? 1_048_576;
  if (typeof model !== 'string' || !model.trim() || model.length > 256 ||
      typeof prompt !== 'string' || !prompt.trim() || Buffer.byteLength(prompt) > 1_048_576 ||
      !integer(timeoutMs, 1, 600_000) || !integer(maxOutputTokens, 1, 32_768) ||
      !integer(maxResponseBytes, 1, 8_388_608)) throw Error('invalid local model request');
  request.signal?.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort(request.signal?.reason ?? Error('cancelled'));
  request.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(Error('local model timeout')), timeoutMs);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await fetch(endpoint.href + '/chat/completions', {
      method: 'POST', signal: controller.signal, redirect: 'error',
      headers: { 'Content-Type': 'application/json', 'X-Request-ID': randomUUID() },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], stream: true,
        max_tokens: maxOutputTokens, stream_options: { include_usage: true } }),
    });
    if (!response.ok) throw httpFailure(response.status);
    if (!response.body) throw Error(`local model HTTP ${response.status}`);
    if (response.headers.get('content-type')?.split(';')[0].trim() !== 'text/event-stream') throw Error('expected SSE');
    reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let bytes = 0;
    let pending = '';
    let data: string[] = [];
    let finish: 'stop' | 'length' | null = null;
    let usage: Extract<LocalModelEvent, { type: 'usage' }> = {
      type: 'usage', inputTokens: null, outputTokens: null, totalTokens: null,
    };
    function parse(payload: string): LocalModelEvent[] {
      if (payload === '[DONE]') {
        if (!finish) throw Error('terminal before finish');
        return [usage, { type: 'terminal', status: finish === 'stop' ? 'completed' : 'incomplete',
          reason: finish, providerStopped: 'unknown' }];
      }
      const value: unknown = JSON.parse(payload);
      if (!object(value) || value.error || value.model !== model || !Array.isArray(value.choices) || value.choices.length > 1) {
        throw Error('invalid model response identity or choices');
      }
      const events: LocalModelEvent[] = [];
      const choice: unknown = value.choices[0];
      if (choice !== undefined) {
        if (finish || !object(choice) || choice.index !== 0 || !object(choice.delta)) throw Error('invalid stream ordering');
        const delta = choice.delta;
        if (Object.hasOwn(delta, 'function_call') && delta.function_call != null ||
            Object.hasOwn(delta, 'tool_calls') && (!Array.isArray(delta.tool_calls) || delta.tool_calls.length !== 0)) {
          throw Error('model tool request rejected');
        }
        if (delta.content != null) {
          if (typeof delta.content !== 'string') throw Error('invalid text');
          if (delta.content) events.push({ type: 'text', text: delta.content });
        }
        if (choice.finish_reason != null) {
          if (choice.finish_reason !== 'stop' && choice.finish_reason !== 'length') throw Error('unsupported finish reason');
          finish = choice.finish_reason;
        }
      }
      if (value.usage != null) {
        if (!object(value.usage)) throw Error('invalid usage');
        const inputTokens = counter(value.usage.prompt_tokens);
        const outputTokens = counter(value.usage.completion_tokens);
        const totalTokens = counter(value.usage.total_tokens);
        if (totalTokens !== null && ((inputTokens !== null && totalTokens < inputTokens) ||
            (outputTokens !== null && totalTokens < outputTokens) ||
            (inputTokens !== null && outputTokens !== null && BigInt(totalTokens) !== BigInt(inputTokens) + BigInt(outputTokens)))) {
          throw Error('inconsistent usage');
        }
        usage = { type: 'usage', inputTokens, outputTokens, totalTokens };
      }
      return events;
    }
    while (true) {
      controller.signal.throwIfAborted();
      const chunk = await reader.read();
      if (chunk.done) { decoder.decode(); throw Error('EOF before terminal'); }
      bytes += chunk.value.byteLength;
      if (bytes > maxResponseBytes) throw Error('response byte limit exceeded');
      pending += decoder.decode(chunk.value, { stream: true });
      let boundary: number;
      while ((boundary = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, boundary).replace(/\r$/, '');
        pending = pending.slice(boundary + 1);
        if (line === '') {
          if (!data.length) continue;
          const payload = data.join('\n'); data = [];
          for (const event of parse(payload)) {
            controller.signal.throwIfAborted();
            yield Object.freeze(event);
            if (event.type === 'terminal') return;
          }
        } else if (line.startsWith('data:')) {
          data.push(line.slice(5).replace(/^ /, ''));
        }
      }
    }
  } finally {
    clearTimeout(timer);
    request.signal?.removeEventListener('abort', abort);
    controller.abort();
    try { await reader?.cancel(); } catch { /* Retain original error, not cleanup noise. */ }
    reader?.releaseLock();
  }
}
