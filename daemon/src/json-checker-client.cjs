'use strict';
// Fixed packaged dependency; no module/path/command is taken from the request.
const { checkJsonFormat } = require('./verification/json-format-checker.cjs');
const { createHash } = require('node:crypto');
const VERSION = 'cue-json-checker-v1', CONTRACT = 'cue-json-format-v1', MAX = 1048576;
let pending = Buffer.alloc(0), request = null, finished = false;
const id = value => typeof value === 'string' && /^[a-zA-Z0-9:_-]{1,128}$/.test(value);
const keys = (value, expected) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join(',') === expected.sort().join(',');
const sha = value => createHash('sha256').update(value).digest('hex');
function decode(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw Error();
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length > MAX || bytes.toString('base64') !== value) throw Error();
  return bytes;
}
function end(value) { if (finished) return; finished = true; process.stdout.end(JSON.stringify(value) + '\n'); process.stdin.destroy(); }
function fail() { end({ protocol: VERSION, type: 'protocol_error' }); }
function consume(line) {
  try {
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(line));
    if (!request) {
      if (!keys(value, ['protocol', 'type', 'contract', 'requestId', 'attemptId', 'inputBase64', 'outputBase64'])
          || value.protocol !== VERSION || value.type !== 'check' || value.contract !== CONTRACT || !id(value.requestId) || !id(value.attemptId)) throw Error();
      const input = decode(value.inputBase64), output = decode(value.outputBase64);
      const identity = { protocol: VERSION, type: 'checker_request', contract: CONTRACT, requestId: value.requestId, attemptId: value.attemptId,
        inputSha256: sha(input), outputSha256: sha(output) };
      request = { input, output, identity }; process.stdout.write(JSON.stringify(identity) + '\n');
    } else {
      if (JSON.stringify(value) !== JSON.stringify({ ...request.identity, type: 'authorize_check' })) throw Error();
      const verdict = checkJsonFormat(request.input, request.output);
      end({ protocol: VERSION, type: 'checker_result', contract: CONTRACT, requestId: request.identity.requestId, attemptId: request.identity.attemptId, verdict });
    }
  } catch { fail(); }
}
process.stdin.on('data', chunk => {
  if (finished) return;
  if (pending.length + chunk.length > MAX + 1) { fail(); return; }
  pending = Buffer.concat([pending, chunk]); let position;
  while (!finished && (position = pending.indexOf(10)) >= 0) { const line = pending.subarray(0, position); pending = pending.subarray(position + 1); consume(line); }
});
process.stdin.on('error', fail);
process.stdin.on('end', () => { if (!finished) fail(); });
