import { types } from 'node:util';

/** Experimental test helper for synthetic JSONL framing; not a production Claude protocol.
 * No live wire compatibility, credentials, OS isolation or admission is established. */
export const CLAUDE_FIXTURE_DIALECT = 'cue-claude-fixture-v1' as const;

export const CLAUDE_PROTOCOL_LIMITS = Object.freeze({ streamBytes: 1048576, frameBytes: 65536, frames: 4096 });
function data(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) throw Error('claude_plain_data');
  const fields = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(fields).length !== keys.length || keys.some(key => !fields[key]?.enumerable || !Object.hasOwn(fields[key], 'value'))) throw Error('claude_exact_fields');
  return Object.fromEntries(keys.map(key => [key, fields[key]!.value]));
}
const typed = Object.getPrototypeOf(Uint8Array.prototype);
const bufferOf = Object.getOwnPropertyDescriptor(typed, 'buffer')!.get!;
const offsetOf = Object.getOwnPropertyDescriptor(typed, 'byteOffset')!.get!;
const lengthOf = Object.getOwnPropertyDescriptor(typed, 'byteLength')!.get!;
function bytes(value: unknown, remaining: number): Uint8Array {
  if (!types.isUint8Array(value) || types.isProxy(value)) throw Error('claude_bytes');
  const buffer = bufferOf.call(value), offset = offsetOf.call(value), length = lengthOf.call(value);
  if (types.isSharedArrayBuffer(buffer) || length > remaining) throw Error('claude_stream_limit');
  return Uint8Array.from(new Uint8Array(buffer, offset, length));
}
export interface ClaudeFixtureEvent { readonly ordinal: number; readonly type: 'text'; readonly text: string; readonly provisional: true }
export interface ClaudeFixtureResult {
  readonly dialect: typeof CLAUDE_FIXTURE_DIALECT; readonly text: string; readonly providerStatus: 'fixture-success';
  readonly usage: 'unknown'; readonly acceptance: 'unverified'; readonly localCleanup: 'unverified';
  readonly remoteBilling: 'unknown'; readonly executable: false; readonly eligibility: 'unverified';
}
/** Exact supported dialect: init -> one assistant text message OR one streamed
 * text block -> success result -> EOF. Canonical JSON.stringify frames, LF/CRLF
 * accepted (duplicate fields/noncanonical JSON rejected). No thinking, usage,
 * model/session identity, unknown fields, tools or alternative stop reasons.
 * Provisional text must not authorize side effects. finish() is required. */
export function createClaudeFixtureDecoder() {
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
  let total = 0, pending = '', frames = 0, ordinal = 0, collected = '', state = 'init', failed = false, finished = false;
  let result: ClaudeFixtureResult | undefined;
  const fail = () => { throw Error('claude_fixture_protocol'); };
  const content = (value: unknown): string => {
    if (!Array.isArray(value) || value.length !== 1) return fail();
    const block = data(value[0], ['type', 'text']);
    if (block.type !== 'text' || typeof block.text !== 'string') return fail();
    return block.text;
  };
  const frame = (line: string, events: ClaudeFixtureEvent[]) => {
    if (++frames > CLAUDE_PROTOCOL_LIMITS.frames || !line || Buffer.byteLength(line) > CLAUDE_PROTOCOL_LIMITS.frameBytes || state === 'terminal') fail();
    const raw: unknown = JSON.parse(line);
    if (JSON.stringify(raw) !== line) fail();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail();
    const type = (raw as Record<string, unknown>).type;
    const emit = (text: string) => { collected += text; events.push(Object.freeze({ ordinal: ++ordinal, type: 'text', text, provisional: true })); };
    if (state === 'init') {
      const value = data(raw, ['type', 'subtype', 'tools', 'mcp_servers']);
      if (value.type !== 'system' || value.subtype !== 'init' || !Array.isArray(value.tools) || value.tools.length || !Array.isArray(value.mcp_servers) || value.mcp_servers.length) fail();
      state = 'body'; return;
    }
    if (type === 'assistant' && state === 'body') {
      const value = data(raw, ['type', 'message']), message = data(value.message, ['content']);
      emit(content(message.content)); state = 'result'; return;
    }
    if (type === 'stream_event') {
      const value = data(raw, ['type', 'event']);
      if (!value.event || typeof value.event !== 'object') fail();
      const eventType = (value.event as Record<string, unknown>).type;
      if (state === 'body' && eventType === 'message_start') {
        const event = data(value.event, ['type', 'message']), message = data(event.message, ['content']);
        if (!Array.isArray(message.content) || message.content.length) fail(); state = 'block-start';
      } else if (state === 'block-start' && eventType === 'content_block_start') {
        const event = data(value.event, ['type', 'index', 'content_block']);
        if (event.index !== 0) fail(); emit(content([event.content_block])); state = 'block';
      } else if (state === 'block' && eventType === 'content_block_delta') {
        const event = data(value.event, ['type', 'index', 'delta']), delta = data(event.delta, ['type', 'text']);
        if (event.index !== 0 || delta.type !== 'text_delta' || typeof delta.text !== 'string') fail(); emit(delta.text as string);
      } else if (state === 'block' && eventType === 'content_block_stop') {
        const event = data(value.event, ['type', 'index']); if (event.index !== 0) fail(); state = 'message-delta';
      } else if (state === 'message-delta' && eventType === 'message_delta') {
        const event = data(value.event, ['type', 'delta']), delta = data(event.delta, ['stop_reason']);
        if (delta.stop_reason !== 'end_turn') fail(); state = 'message-stop';
      } else if (state === 'message-stop' && eventType === 'message_stop') {
        data(value.event, ['type']); state = 'result';
      } else fail();
      return;
    }
    if (type === 'result' && state === 'result') {
      const value = data(raw, ['type', 'subtype', 'is_error', 'result']);
      if (value.subtype !== 'success' || value.is_error !== false || typeof value.result !== 'string' || value.result !== collected) fail();
      result = Object.freeze({ dialect: CLAUDE_FIXTURE_DIALECT, text: collected, providerStatus: 'fixture-success', usage: 'unknown',
        acceptance: 'unverified', localCleanup: 'unverified', remoteBilling: 'unknown', executable: false, eligibility: 'unverified' });
      state = 'terminal'; return;
    }
    fail();
  };
  return Object.freeze({
    push(value: unknown): readonly ClaudeFixtureEvent[] {
      if (failed || finished) throw Error('claude_decoder_closed');
      try {
        const chunk = bytes(value, CLAUDE_PROTOCOL_LIMITS.streamBytes - total); total += chunk.byteLength;
        pending += decoder.decode(chunk, { stream: true });
        const events: ClaudeFixtureEvent[] = [];
        let index: number;
        while ((index = pending.indexOf('\n')) !== -1) {
          let line = pending.slice(0, index); pending = pending.slice(index + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          frame(line, events);
        }
        if (Buffer.byteLength(pending) > CLAUDE_PROTOCOL_LIMITS.frameBytes) fail();
        return Object.freeze(events);
      } catch (error) { failed = true; throw error; }
    },
    finish(): ClaudeFixtureResult {
      if (failed || finished) throw Error('claude_decoder_closed');
      finished = true;
      try { pending += decoder.decode(); if (pending || state !== 'terminal' || !result) fail(); return result!; }
      catch (error) { failed = true; throw error; }
    },
  });
}
