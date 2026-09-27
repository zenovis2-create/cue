import { test, expect, vi } from 'vitest';
import { createClaudeFixtureDecoder, CLAUDE_PROTOCOL_LIMITS } from './fixtures/claude-jsonl-fixture.js';
const init = { type: 'system', subtype: 'init', tools: [], mcp_servers: [] };
const body = (text = '한글😀') => ({ type: 'assistant', message: { content: [{ type: 'text', text }] } });
const end = (text = '한글😀') => ({ type: 'result', subtype: 'success', is_error: false, result: text });
const event = (value: unknown) => ({ type: 'stream_event', event: value });
const stream = [init, event({ type: 'message_start', message: { content: [] } }), event({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }),
  event({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '한글😀' } }), event({ type: 'content_block_stop', index: 0 }),
  event({ type: 'message_delta', delta: { stop_reason: 'end_turn' } }), event({ type: 'message_stop' }), end()];
const wire = (frames: unknown[]) => Buffer.from(frames.map(x => JSON.stringify(x)).join('\n') + '\n');
test.each([false, true])('all byte splits retain UTF8 and provisional events; streamed=%s', streamed => {
  const bytes = wire(streamed ? stream : [init, body(), end()]);
  for (let cut = 0; cut <= bytes.length; cut++) {
    const decoder = createClaudeFixtureDecoder(); const events = [...decoder.push(bytes.subarray(0, cut)), ...decoder.push(bytes.subarray(cut))];
    expect(events.map(x => x.text).join('')).toBe('한글😀'); expect(events.every(x => x.provisional)).toBe(true);
    expect(decoder.finish()).toMatchObject({ text: '한글😀', usage: 'unknown', localCleanup: 'unverified', acceptance: 'unverified', remoteBilling: 'unknown', executable: false, eligibility: 'unverified' });
    expect(() => decoder.finish()).toThrow('closed');
  }
});
test('CRLF and empty text supported; terminal alone cannot succeed', () => {
  const decoder = createClaudeFixtureDecoder(); decoder.push(Buffer.from(wire([init, body(''), end('')]).toString().replaceAll('\n', '\r\n'))); expect(decoder.finish().text).toBe('');
  expect(() => createClaudeFixtureDecoder().push(wire([init, end('')]))).toThrow();
});
test('malformed UTF8 BOM duplicate keys partial EOF and oversized buffers fail sticky', () => {
  const invalid = [Buffer.from([0xc0, 0xaf]), Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), wire([init, body(), end()])]),
    Buffer.from('{"type":"system","type":"system","subtype":"init","tools":[],"mcp_servers":[]}\n'),
    Buffer.alloc(CLAUDE_PROTOCOL_LIMITS.streamBytes + 1), Buffer.from('x'.repeat(CLAUDE_PROTOCOL_LIMITS.frameBytes + 1))];
  for (const bytes of invalid) { const d = createClaudeFixtureDecoder(); expect(() => d.push(bytes)).toThrow(); expect(() => d.push(wire([init, body(), end()]))).toThrow('closed'); }
  for (const bytes of [wire([init]), wire([init, body(), end()]).subarray(0, -1), Buffer.from([0xe2])]) { const d = createClaudeFixtureDecoder(); d.push(bytes); expect(() => d.finish()).toThrow(); }
});
test('all unsupported tool, identity, usage, stop, ordering and terminal schemas reject', () => {
  const bad = [ [{ ...init, tools: ['Bash'] }, body(), end()], [init, { ...body(), usage: {} }, end()],
    [init, { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash' }] } }, end()],
    [init, body(), { ...end(), session_id: 'not-proven' }], [init, body(), { ...end(), subtype: 'error_max_turns' }],
    [init, body(), end('altered')], [init, body(), end(), end()], [init, body(), body(), end()],
    [...stream.slice(0, 5), event({ type: 'message_delta', delta: { stop_reason: 'max_tokens' } }), ...stream.slice(6)],
    [...stream.slice(0, 3), event({ type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'wrong-index' } }), ...stream.slice(4)],
    [init, stream[3], end()], [init, { type: 'tool_result' }, end()] ];
  for (const frames of bad) expect(() => createClaudeFixtureDecoder().push(wire(frames))).toThrow();
});
test('native byte snapshot does not invoke override getters; proxy/shared/detached rejected', () => {
  const bytes = wire([init, body(), end()]), getter = vi.fn(() => Buffer.from('bad'));
  Object.defineProperty(bytes, 'valueOf', { value: getter }); Object.defineProperty(bytes, 'buffer', { get: getter });
  const d = createClaudeFixtureDecoder(); d.push(bytes); expect(d.finish().text).toBe('한글😀'); expect(getter).not.toHaveBeenCalled();
  const detached = new Uint8Array(8); structuredClone(detached, { transfer: [detached.buffer] });
  for (const value of [new Proxy(bytes, {}), new Uint8Array(new SharedArrayBuffer(8)), detached, 'string']) expect(() => createClaudeFixtureDecoder().push(value)).toThrow();
});
test('bounded frame count and bytes forbid unending delta stream', () => {
  const d = createClaudeFixtureDecoder(); d.push(wire(stream.slice(0, 3)));
  const delta = wire([event({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '' } })]);
  expect(() => { for (let i = 0; i < CLAUDE_PROTOCOL_LIMITS.frames; i++) d.push(delta); }).toThrow();
});
