import test from 'node:test';
import assert from 'node:assert/strict';
import { buildClaudeModelOnlySpec, inspectClaudeModelOnlyTranscript } from './claude-launch-spec.mjs';

const input = () => ({ version: '2.1.267', binary: 'C:\\fixtures\\claude.exe',
  isolatedCwd: 'C:\\fixtures\\controller', isolatedHome: 'C:\\fixtures\\home', systemRoot: 'C:\\Windows',
  prompt: 'Explain this supplied text.', modelBinding: { canonicalId: 'claude-fixture-model', identityVerified: true } });
const init = { type: 'system', subtype: 'init', tools: [], mcp_servers: [] };
const done = { type: 'result', subtype: 'success', is_error: false, result: 'fixture answer' };
const wire = (...frames) => frames.map(f => JSON.stringify(f)).join('\n') + '\n';

test('input and binding reject unknown privilege fields, symbols, inherited properties and proxies', () => {
  const badInput = [Object.assign(input(), { env: { ANTHROPIC_API_KEY: 'fixture' } }),
    Object.assign(input(), { [Symbol('hidden')]: true }), Object.create(input()),
    Object.assign(Object.create({ inherited: true }), input()), new Proxy(input(), {}),
    Object.assign(input(), { tools: ['Bash'] }), Object.assign(input(), { permissionMode: 'bypassPermissions' })];
  for (const value of badInput) assert.throws(() => buildClaudeModelOnlySpec(value));
  const binding = input().modelBinding;
  const badBinding = [{ ...binding, tools: ['Bash'] }, { ...binding, [Symbol('hidden')]: true },
    Object.create(binding), Object.assign(Object.create({ inherited: true }), binding), new Proxy(binding, {})];
  for (const modelBinding of badBinding) assert.throws(() => buildClaudeModelOnlySpec({ ...input(), modelBinding }));
});

test('accessor input and binding are rejected without invoking any getter', () => {
  let calls = 0;
  const value = input();
  Object.defineProperty(value, 'prompt', { enumerable: true, get() { calls++; return calls < 5 ? 'safe' : 'x'.repeat(99_999); } });
  assert.throws(() => buildClaudeModelOnlySpec(value), /data fields/);
  const modelBinding = input().modelBinding;
  Object.defineProperty(modelBinding, 'canonicalId', { enumerable: true, get() { calls++; return 'claude-fixture-model'; } });
  assert.throws(() => buildClaudeModelOnlySpec({ ...input(), modelBinding }), /data fields/);
  assert.equal(calls, 0);
});

test('spec disables tool/customization entry points and stays non-executable without credentials', () => {
  const spec = buildClaudeModelOnlySpec(input());
  assert.equal(spec.args[spec.args.indexOf('--tools') + 1], '');
  for (const flag of ['--restricted', '--safe-mode', '--strict-mcp-config', '--no-session-persistence']) assert.ok(spec.args.includes(flag));
  assert.equal(spec.args[spec.args.indexOf('--mcp-config') + 1], '{"mcpServers":{}}');
  assert.equal(spec.args[spec.args.indexOf('--disallowedTools') + 1], 'mcp__*');
  assert.equal(spec.cwd, input().isolatedCwd);
  assert.equal(spec.stdin, input().prompt);
  assert.equal(spec.auth, 'unconfigured');
  assert.equal(spec.executable, false);
  assert.equal(spec.env.PATH, undefined);
  assert.equal(spec.env.ANTHROPIC_API_KEY, undefined);
  assert.ok(Object.isFrozen(spec.args));
});

test('unreviewed old and future versions fail instead of dropping protections', () => {
  for (const version of ['2.1.247', '2.1.266', '2.1.268', '3.0.0', undefined]) {
    assert.throws(() => buildClaudeModelOnlySpec({ ...input(), version }), /unreviewed/);
  }
});

test('aliases, unverified identities and command injection strings fail', () => {
  for (const canonicalId of ['opus', 'claude-test --tools default', 'claude-test\nattack']) {
    assert.throws(() => buildClaudeModelOnlySpec({ ...input(), modelBinding: { canonicalId, identityVerified: true } }));
  }
  assert.throws(() => buildClaudeModelOnlySpec({ ...input(), modelBinding: { canonicalId: 'claude-fixture-model', identityVerified: false } }));
});

test('prompt and path limits reject invalid launch inputs', () => {
  for (const prompt of ['', ' ', 'x'.repeat(16_385), 'x\0y']) assert.throws(() => buildClaudeModelOnlySpec({ ...input(), prompt }));
  for (const isolatedHome of ['relative', 'C:\\fixtures\\..\\User', 'C:\\bad\npath']) assert.throws(() => buildClaudeModelOnlySpec({ ...input(), isolatedHome }));
  assert.throws(() => buildClaudeModelOnlySpec({ ...input(), binary: 'C:\\fixtures\\claude.cmd' }));
});

test('provider success never claims acceptance, cleanup or billing completion', () => {
  const result = inspectClaudeModelOnlyTranscript(wire(init, { type: 'assistant', message: { content: [{ type: 'text', text: 'answer' }] } }, done));
  assert.equal(result.providerStatus, 'completed');
  assert.equal(result.acceptance, 'unverified');
  assert.equal(result.localCleanup, 'unverified');
  assert.equal(result.remoteBilling, 'unknown');
});

test('tools in init, assistant, partial stream and unknown frames fail closed', () => {
  const unsafe = [
    { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash' }] } },
    { type: 'stream_event', event: { type: 'content_block_start', content_block: { type: 'tool_use' } } },
    { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'input_json_delta' } } },
    { type: 'tool_result' },
  ];
  for (const frame of unsafe) assert.throws(() => inspectClaudeModelOnlyTranscript(wire(init, frame, done)));
  assert.throws(() => inspectClaudeModelOnlyTranscript(wire({ ...init, tools: ['Bash'] }, done)));
  assert.throws(() => inspectClaudeModelOnlyTranscript(wire({ ...init, mcp_servers: [{}] }, done)));
});

test('partial, duplicate, absent, failure or malformed terminal cannot complete', () => {
  for (const transcript of [wire(init), wire(done), wire(init, done).trimEnd(), wire(init, done, done),
    wire(init, { ...done, subtype: 'error_max_turns' }), wire(init, { ...done, is_error: true }),
    wire(init, { ...done, result: null }), wire(init) + '{bad}\n', 'x'.repeat(1_048_577) + '\n']) {
    assert.throws(() => inspectClaudeModelOnlyTranscript(transcript));
  }
});
