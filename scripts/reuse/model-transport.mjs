// Disposable research adapter. Not imported by the Cue application.
// Exact scope: local OpenAI-compatible chat completion SSE and Ollama chat NDJSON.
export async function* streamModel({ url, protocol, model, input, signal, timeoutMs = 1000, maxBytes = 65536 }) {
  const endpoint = new URL(url);
  const paths = { 'chat-sse': '/v1/chat/completions', 'ollama-ndjson': '/api/chat' };
  if (endpoint.protocol !== 'http:' || endpoint.hostname !== '127.0.0.1' || !endpoint.port ||
      endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== paths[protocol]) {
    throw new Error('fixture endpoint rejected');
  }
  if (typeof model !== 'string' || !model || typeof input !== 'string' ||
      !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000 ||
      !Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 1048576) throw new Error('invalid request');
  if (signal?.aborted) throw signal.reason ?? new Error('aborted');
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason ?? new Error('aborted'));
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(new Error('request timeout')), timeoutMs);
  let reader;
  try {
    const response = await fetch(endpoint, {
      method: 'POST', redirect: 'error', signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: input }], stream: true }),
    });
    if (!response.ok || !response.body) throw new Error(`http failure ${response.status}`);
    const contentType = response.headers.get('content-type')?.split(';')[0];
    if (protocol === 'chat-sse' ? contentType !== 'text/event-stream' : contentType !== 'application/x-ndjson') {
      throw new Error('unexpected content type');
    }
    reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let bytes = 0, pending = '', data = [], finished = false;
    let usage = { status: 'unknown' };
    const count = value => Number.isSafeInteger(value) && value >= 0;
    const parse = payload => {
      if (protocol === 'chat-sse' && payload === '[DONE]') {
        if (!finished) throw new Error('missing successful finish reason');
        return [{ type: 'usage', ...usage }, { type: 'terminal', status: 'completed', providerStopped: 'unknown' }];
      }
      const value = JSON.parse(payload);
      if (!value || typeof value !== 'object' || Array.isArray(value) || value.error || value.model !== model) throw new Error('invalid response identity or error');
      const events = [];
      if (protocol === 'chat-sse') {
        if (!Array.isArray(value.choices) || value.choices.length > 1) throw new Error('invalid choices');
        const choice = value.choices[0];
        if (choice) {
          if (choice.index !== 0 || !choice.delta || typeof choice.delta !== 'object') throw new Error('invalid choice');
          if (choice.delta.function_call || choice.delta.tool_calls?.length || choice.finish_reason === 'tool_calls' || choice.finish_reason === 'function_call') throw new Error('tool request rejected');
          if (finished) throw new Error('choice after finish');
          if (choice.delta.content != null) {
            if (typeof choice.delta.content !== 'string') throw new Error('invalid text');
            if (choice.delta.content) events.push({ type: 'text', text: choice.delta.content });
          }
          if (choice.finish_reason != null) {
            if (choice.finish_reason !== 'stop') throw new Error('incomplete generation');
            finished = true;
          }
        }
        if (value.usage != null) {
          if (!count(value.usage.prompt_tokens) || !count(value.usage.completion_tokens)) throw new Error('invalid usage');
          usage = { status: 'observed', inputTokens: value.usage.prompt_tokens, outputTokens: value.usage.completion_tokens };
        }
      } else {
        if (typeof value.done !== 'boolean' || !value.message || typeof value.message !== 'object') throw new Error('invalid local response');
        if (value.message.tool_calls?.length) throw new Error('tool request rejected');
        if (typeof value.message.content !== 'string') throw new Error('invalid text');
        if (value.message.content) events.push({ type: 'text', text: value.message.content });
        if (value.done) {
          if (value.done_reason !== 'stop') throw new Error('incomplete generation');
          if (value.prompt_eval_count != null || value.eval_count != null) {
            if (!count(value.prompt_eval_count) || !count(value.eval_count)) throw new Error('invalid usage');
            usage = { status: 'observed', inputTokens: value.prompt_eval_count, outputTokens: value.eval_count };
          }
          events.push({ type: 'usage', ...usage }, { type: 'terminal', status: 'completed', providerStopped: 'unknown' });
        }
      }
      return events;
    };
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        decoder.decode(); // Reject an unfinished UTF-8 codepoint as well as missing protocol terminal.
        throw new Error('EOF before protocol terminal');
      }
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) throw new Error('response byte limit exceeded');
      pending += decoder.decode(chunk.value, { stream: true });
      let newline;
      while ((newline = pending.indexOf('\n')) !== -1) {
        const line = pending.slice(0, newline).replace(/\r$/, '');
        pending = pending.slice(newline + 1);
        let payload;
        if (protocol === 'ollama-ndjson') {
          if (!line) continue;
          payload = line;
        } else if (line === '') {
          if (!data.length) continue;
          payload = data.join('\n'); data = [];
        } else {
          if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
          else if (!line.startsWith(':') && !line.startsWith('event:') && !line.startsWith('id:')) throw new Error('unsupported SSE field');
          continue;
        }
        for (const event of parse(payload)) {
          if (controller.signal.aborted) throw controller.signal.reason;
          yield event;
          if (event.type === 'terminal') return;
        }
      }
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    controller.abort();
    // abort() can make cancel() reject; preserve the actual protocol/timeout error.
    if (reader) { try { await reader.cancel(); } catch { /* transport already aborted */ } finally { reader.releaseLock(); } }
  }
}
