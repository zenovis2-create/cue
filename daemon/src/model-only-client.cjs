'use strict';
// Fixed text-only state machine: no network, tool dispatch, shell, eval or imports.
const VERSION = 'cue-model-broker-v1', MODEL = 'qwen38-27b-unc', MAX = 1048576;
let input = Buffer.alloc(0), request = null, answered = false;
const integer = (value, max) => Number.isSafeInteger(value) && value >= 1 && value <= max;
const id = value => typeof value === 'string' && /^[a-zA-Z0-9:_-]{1,128}$/.test(value);
function keys(value, expected) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join(',') === expected.sort().join(',');
}
function finish(value) {
  if (answered) return; answered = true;
  process.stdout.end(JSON.stringify(value) + '\n'); process.stdin.destroy();
}
function fail() { finish({ protocol: request ? VERSION : 'cue-model-client-v1', status: 'protocol_error' }); }
function consume(line) {
  if (answered) return;
  try {
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(line));
    if (!request) {
      if (keys(value, ['protocol', 'operation']) && value.protocol === 'cue-model-client-v1' && value.operation === 'ping') {
        finish({ protocol: 'cue-model-client-v1', status: 'ok', text: 'client-boundary-ready' }); return;
      }
      if (!keys(value, ['protocol', 'type', 'requestId', 'attemptId', 'model', 'prompt', 'maxOutputTokens', 'maxResultBytes'])
          || value.protocol !== VERSION || value.type !== 'generate' || value.model !== MODEL || !id(value.requestId) || !id(value.attemptId)
          || typeof value.prompt !== 'string' || !value.prompt.trim() || !integer(value.maxOutputTokens, 32768)
          || !integer(value.maxResultBytes, MAX)) throw Error();
      request = value;
      process.stdout.write(JSON.stringify({ ...value, type: 'model_request' }) + '\n'); return;
    }
    if (line.length > request.maxResultBytes || !keys(value, ['protocol', 'type', 'requestId', 'attemptId', 'model', 'text', 'usage', 'terminal'])
        || value.protocol !== VERSION || value.type !== 'model_response' || value.requestId !== request.requestId
        || value.attemptId !== request.attemptId || value.model !== MODEL || typeof value.text !== 'string'
        || !keys(value.usage, ['inputTokens', 'outputTokens', 'totalTokens'])
        || !Object.values(value.usage).every(n => n === null || Number.isSafeInteger(n) && n >= 0)
        || !keys(value.terminal, ['type', 'status', 'reason', 'providerStopped']) || value.terminal.type !== 'terminal'
        || value.terminal.providerStopped !== 'unknown'
        || !(value.terminal.status === 'completed' && value.terminal.reason === 'stop'
          || value.terminal.status === 'incomplete' && value.terminal.reason === 'length')) throw Error();
    const { inputTokens, outputTokens, totalTokens } = value.usage;
    if (totalTokens !== null && ((inputTokens !== null && totalTokens < inputTokens) || (outputTokens !== null && totalTokens < outputTokens)
        || inputTokens !== null && outputTokens !== null && BigInt(totalTokens) !== BigInt(inputTokens) + BigInt(outputTokens))) throw Error();
    finish({ ...value, type: 'model_result' });
  } catch { fail(); }
}
process.stdin.on('data', chunk => {
  if (answered) return;
  if (input.length + chunk.length > MAX + 1) { fail(); return; }
  input = Buffer.concat([input, chunk]);
  let end;
  while (!answered && (end = input.indexOf(10)) >= 0) {
    const line = input.subarray(0, end); input = input.subarray(end + 1);
    consume(line);
  }
});
process.stdin.on('error', fail);
process.stdin.on('end', () => {
  if (answered) return;
  // Legacy ping uses EOF framing and retains its original 8 KiB limit.
  if (!request && input.length <= 8192) consume(input);
  if (!answered) fail();
});
