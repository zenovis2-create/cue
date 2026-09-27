// Offline R-02 experiment. No subprocess, filesystem, credentials or network APIs.
import { win32 } from 'node:path';
import { types } from 'node:util';

export const REVIEWED_CLAUDE_VERSION = '2.1.267';
const MAX_PROMPT = 16_384;
const MAX_STREAM_BYTES = 1_048_576;

function ownDataSnapshot(value, allowedKeys, field) {
  if (!value || typeof value !== 'object' || types.isProxy(value)
      || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(`${field}: plain own data object required`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length !== allowedKeys.length || keys.some(key => typeof key !== 'string' || !allowedKeys.includes(key))) {
    throw new Error(`${field}: missing or unknown field`);
  }
  const snapshot = Object.create(null);
  for (const key of allowedKeys) {
    const descriptor = descriptors[key];
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) {
      throw new Error(`${field}: own enumerable data fields required`);
    }
    snapshot[key] = descriptor.value;
  }
  return Object.freeze(snapshot);
}

function absoluteWindowsPath(value, field) {
  if (typeof value !== 'string' || !/^[a-z]:\\/iu.test(value)
      || /[\r\n\0]/u.test(value) || value.split(/[\\/]/u).includes('..')) {
    throw new Error(`${field}: absolute Windows path required`);
  }
  return win32.normalize(value);
}

export function buildClaudeModelOnlySpec(input) {
  input = ownDataSnapshot(input,
    ['version', 'binary', 'isolatedCwd', 'isolatedHome', 'systemRoot', 'prompt', 'modelBinding'], 'input');
  if (input.version !== REVIEWED_CLAUDE_VERSION) {
    throw new Error('unreviewed CLI version; no weakened fallback');
  }
  const binary = absoluteWindowsPath(input.binary, 'binary');
  if (win32.basename(binary).toLowerCase() !== 'claude.exe') throw new Error('native claude.exe required');
  const cwd = absoluteWindowsPath(input.isolatedCwd, 'isolatedCwd');
  const home = absoluteWindowsPath(input.isolatedHome, 'isolatedHome');
  const systemRoot = absoluteWindowsPath(input.systemRoot, 'systemRoot');
  const prompt = input.prompt;
  if (typeof prompt !== 'string' || !prompt.trim()
      || prompt.length > MAX_PROMPT || prompt.includes('\0')) throw new Error('invalid prompt');
  const binding = ownDataSnapshot(input.modelBinding, ['canonicalId', 'identityVerified'], 'modelBinding');
  if (!binding || binding.identityVerified !== true || typeof binding.canonicalId !== 'string'
      || !/^claude-[a-z0-9][a-z0-9._-]{1,127}$/u.test(binding.canonicalId)) {
    throw new Error('verified canonical Claude model binding required; aliases are not resolved here');
  }
  const args = Object.freeze([
    '--restricted', '--safe-mode', '--print', '--output-format', 'stream-json',
    '--verbose', '--include-partial-messages', '--no-session-persistence',
    '--tools', '', '--disallowedTools', 'mcp__*', '--strict-mcp-config',
    '--mcp-config', '{"mcpServers":{}}', '--max-turns', '1', '--model', binding.canonicalId,
  ]);
  // Deliberately no process.env merge, PATH lookup, auth or spawn. Directories are not created.
  const env = Object.freeze({
    SystemRoot: systemRoot, WINDIR: systemRoot,
    HOME: home, USERPROFILE: home, CLAUDE_CONFIG_DIR: win32.join(home, 'claude'),
    APPDATA: win32.join(home, 'appdata'), LOCALAPPDATA: win32.join(home, 'localappdata'),
    TEMP: win32.join(home, 'tmp'), TMP: win32.join(home, 'tmp'),
    DISABLE_AUTOUPDATER: '1',
  });
  return Object.freeze({ command: binary, args, cwd, env, stdin: prompt, auth: 'unconfigured', executable: false });
}

function inspectContent(content) {
  if (!Array.isArray(content)) throw new Error('invalid content');
  for (const block of content) {
    if (!block || !['text', 'thinking', 'redacted_thinking'].includes(block.type)) {
      throw new Error('tool or unknown content forbidden');
    }
  }
}

/** Synthetic JSONL fixture validator, not a qualified live protocol implementation. */
export function inspectClaudeModelOnlyTranscript(wire) {
  if (typeof wire !== 'string' || Buffer.byteLength(wire) > MAX_STREAM_BYTES || !wire.endsWith('\n')) {
    throw new Error('oversized or incomplete transcript');
  }
  const lines = wire.slice(0, -1).split('\n');
  let initialized = false;
  let result;
  for (const line of lines) {
    if (!line.trim()) throw new Error('empty frame');
    const frame = JSON.parse(line);
    if (!frame || typeof frame !== 'object' || Array.isArray(frame) || result) throw new Error('unexpected frame');
    if (frame.type === 'system') {
      if (initialized || frame.subtype !== 'init' || !Array.isArray(frame.tools) || frame.tools.length
          || !Array.isArray(frame.mcp_servers) || frame.mcp_servers.length) throw new Error('unsafe initialization');
      initialized = true;
      continue;
    }
    if (!initialized) throw new Error('initialization required');
    if (frame.type === 'assistant') {
      inspectContent(frame.message?.content);
    } else if (frame.type === 'stream_event') {
      const event = frame.event;
      if (!event || !['message_start', 'content_block_start', 'content_block_delta', 'content_block_stop', 'message_delta', 'message_stop'].includes(event.type)) {
        throw new Error('unexpected stream event');
      }
      if (event.type === 'message_start') inspectContent(event.message?.content);
      if (event.type === 'content_block_start') inspectContent([event.content_block]);
      if (event.type === 'content_block_delta'
          && !['text_delta', 'thinking_delta', 'signature_delta'].includes(event.delta?.type)) throw new Error('tool delta forbidden');
    } else if (frame.type === 'result') {
      if (frame.subtype !== 'success' || frame.is_error !== false || typeof frame.result !== 'string') {
        throw new Error('unsuccessful or malformed result');
      }
      result = Object.freeze({ providerStatus: 'completed', text: frame.result,
        acceptance: 'unverified', localCleanup: 'unverified', remoteBilling: 'unknown' });
    } else {
      throw new Error('tool or unexpected frame forbidden');
    }
  }
  if (!result) throw new Error('terminal result missing');
  return result;
}
