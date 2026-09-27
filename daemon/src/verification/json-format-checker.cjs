'use strict';
// Limited reuse: native JSON implements this exact formatting contract, and
// node:crypto hashes bytes. No general semantic checker or dependency is needed.
const { createHash } = require('node:crypto');
const { types } = require('node:util');
const CONTRACT = 'cue-json-format-v1', MAX_BYTES = 1048576, MAX_DEPTH = 64;
const typed = Object.getPrototypeOf(Uint8Array.prototype);
const bufferOf = Object.getOwnPropertyDescriptor(typed, 'buffer').get;
const offsetOf = Object.getOwnPropertyDescriptor(typed, 'byteOffset').get;
const lengthOf = Object.getOwnPropertyDescriptor(typed, 'byteLength').get;
function snapshot(value) {
  if (!types.isUint8Array(value) || types.isProxy(value)) return { reason: 'bytes_required' };
  try {
    const buffer = bufferOf.call(value), length = lengthOf.call(value), offset = offsetOf.call(value);
    if (types.isSharedArrayBuffer(buffer)) return { reason: 'shared_bytes' };
    if (length > MAX_BYTES) return { reason: 'size_limit' };
    return { bytes: Buffer.from(new Uint8Array(buffer, offset, length)) };
  } catch { return { reason: 'invalid_bytes' }; }
}
const hash = bytes => bytes ? createHash('sha256').update(bytes).digest('hex') : null;
function withinDepth(text) {
  let depth = 0, string = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (string) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') string = false;
    } else if (char === '"') string = true;
    else if (char === '[' || char === '{') { if (++depth > MAX_DEPTH) return false; }
    else if (char === ']' || char === '}') depth--;
  }
  return true;
}
// Count exact JSON.stringify(value,null,2) UTF-8 bytes before constructing it.
// Traversal is iterative and stops as soon as the configured output cap is exceeded.
function prettyFits(value) {
  const pending = [{ value, depth: 0 }]; let bytes = 0;
  while (pending.length) {
    const frame = pending.pop(), item = frame.value, depth = frame.depth;
    if (item === null || typeof item !== 'object') bytes += Buffer.byteLength(JSON.stringify(item));
    else {
      const array = Array.isArray(item), keys = Object.keys(item), count = keys.length;
      if (!count) bytes += 2;
      else {
        bytes += 2 + 2 * depth + 1 + count * (2 * (depth + 1) + 1) + count - 1;
        if (bytes > MAX_BYTES) return false;
        for (const key of keys) {
          if (!array) bytes += Buffer.byteLength(JSON.stringify(key)) + 2;
          if (bytes > MAX_BYTES) return false;
          pending.push({ value: item[key], depth: depth + 1 });
        }
      }
    }
    if (bytes > MAX_BYTES) return false;
  }
  return true;
}
/** Bytes only. Supported input, expected output and supplied output are each
 * capped at 1 MiB. Oversized expected output is unsupported/unknown, not a fail.
 * Hashes are null only for bytes that cannot be snapshotted within the cap or
 * an expected value that cannot safely be constructed from an accepted input. */
function checkJsonFormat(inputBytes, outputBytes) {
  const input = snapshot(inputBytes), output = snapshot(outputBytes);
  const inputSha256 = hash(input.bytes), outputSha256 = hash(output.bytes);
  function verdict(status, reason, expectedSha256 = null) {
    return Object.freeze({ contract: CONTRACT, status, reason, inputSha256, outputSha256, expectedSha256 });
  }
  if (!input.bytes) return verdict('unknown', 'input_' + input.reason);
  let text;
  try {
    if (input.bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) return verdict('unknown', 'input_bom');
    text = new TextDecoder('utf-8', { fatal: true }).decode(input.bytes);
  } catch { return verdict('unknown', 'input_utf8'); }
  if (!withinDepth(text)) return verdict('unknown', 'input_depth_limit');
  let value;
  try { value = JSON.parse(text); } catch { return verdict('unknown', 'input_json'); }
  if (JSON.stringify(value) !== text) return verdict('unknown', 'input_noncanonical');
  if (!prettyFits(value)) return verdict('unknown', 'expected_output_limit');
  const expected = Buffer.from(JSON.stringify(value, null, 2));
  // Guard the preflight implementation without treating unsupported work as a mismatch.
  if (expected.length > MAX_BYTES) return verdict('unknown', 'expected_output_limit');
  const expectedSha256 = hash(expected);
  if (!output.bytes) return verdict('fail', 'output_' + output.reason, expectedSha256);
  return output.bytes.equals(expected) ? verdict('pass', 'exact_match', expectedSha256)
    : verdict('fail', 'output_mismatch', expectedSha256);
}
module.exports = Object.freeze({ checkJsonFormat, CONTRACT, MAX_BYTES, MAX_DEPTH });
