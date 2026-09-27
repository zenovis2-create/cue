import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { checkJsonFormat, MAX_BYTES, MAX_DEPTH } from '../src/verification/json-format-checker.cjs';
const bytes = (text: string) => Buffer.from(text);
const sha = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
describe('cue-json-format-v1 exact bounded checker', () => {
  it('handles empty containers, scalars, Unicode and canonical key ordering with exact hashes', () => {
    for (const value of [{}, [], null, true, false, 0, 1.25, '', '한글😀', [1, null, {}], { 10: 'ten', 2: 'two', a: ['x', { z: false }] }]) {
      const input = bytes(JSON.stringify(value)), output = bytes(JSON.stringify(value, null, 2));
      const result = checkJsonFormat(input, output);
      expect(result).toEqual({ contract: 'cue-json-format-v1', status: 'pass', reason: 'exact_match', inputSha256: sha(input), outputSha256: sha(output), expectedSha256: sha(output) });
      expect(Object.isFrozen(result)).toBe(true); expect(checkJsonFormat(input, output)).toEqual(result);
    }
  });
  it('fails any formatting/value/output alteration for valid canonical input', () => {
    const input = bytes('{"a":1,"b":[true,null]}');
    for (const output of ['{"a":1,"b":[true,null]}', '{\n  "a": 2,\n  "b": [\n    true,\n    null\n  ]\n}', '{}', '{"a":1,"b":[true,null],"c":0}', '{', 'undefined']) {
      expect(checkJsonFormat(input, bytes(output)).status).toBe('fail');
    }
    const exact = JSON.stringify(JSON.parse(input.toString()), null, 2);
    expect(checkJsonFormat(input, bytes(exact + '\n')).status).toBe('fail');
    expect(checkJsonFormat(input, Buffer.from([0xff])).status).toBe('fail');
  });
  it('marks invalid, duplicate or noncanonical inputs unknown, never corrects them silently', () => {
    for (const input of ['', ' ', '{', 'NaN', 'Infinity', '{"x":1,"x":2}', '{ "x":1}', '{"10":1,"2":2}', '-0', '1.0', '1e309', '"\\u0061"', '"\\/"', '[1,]']) {
      const result = checkJsonFormat(bytes(input), bytes('null'));
      expect(result.status, input).toBe('unknown'); expect(result.expectedSha256).toBeNull(); expect(result.inputSha256).toBe(sha(bytes(input)));
    }
  });
  it('rejects malformed UTF-8/BOM and respects Unicode byte boundaries', () => {
    for (const input of [Buffer.from([0xc0, 0xaf]), Buffer.from([0xed, 0xa0, 0x80]), Buffer.from([0xe2, 0x82]), Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), bytes('{}')])]) {
      expect(checkJsonFormat(input, bytes('{}')).status).toBe('unknown');
    }
    const view = new Uint8Array([0, 123, 125, 0]).subarray(1, 3);
    expect(checkJsonFormat(view, bytes('{}')).status).toBe('pass');
  });
  it('enforces depth before recursive serialization while ignoring braces and escapes in strings', () => {
    const atLimit = '['.repeat(MAX_DEPTH) + '0' + ']'.repeat(MAX_DEPTH);
    expect(checkJsonFormat(bytes(atLimit), bytes(JSON.stringify(JSON.parse(atLimit), null, 2)))).toMatchObject({ status: 'pass' });
    const tooDeep = '['.repeat(MAX_DEPTH + 1) + '0' + ']'.repeat(MAX_DEPTH + 1);
    expect(checkJsonFormat(bytes(tooDeep), bytes(''))).toMatchObject({ status: 'unknown', reason: 'input_depth_limit' });
    const value = { text: '{['.repeat(100) + '\\"' + ']}'.repeat(100) };
    expect(checkJsonFormat(bytes(JSON.stringify(value)), bytes(JSON.stringify(value, null, 2))).status).toBe('pass');
  });
  it('supports exact byte cap, rejects oversize, and preflights pretty expansion as unknown', () => {
    const exactCap = bytes('"' + 'x'.repeat(MAX_BYTES - 2) + '"');
    expect(checkJsonFormat(exactCap, exactCap).status).toBe('pass');
    expect(checkJsonFormat(Buffer.alloc(MAX_BYTES + 1), bytes(''))).toMatchObject({ status: 'unknown', reason: 'input_size_limit', inputSha256: null });
    expect(checkJsonFormat(bytes('0'), Buffer.alloc(MAX_BYTES + 1))).toMatchObject({ status: 'fail', reason: 'output_size_limit', outputSha256: null, expectedSha256: sha(bytes('0')) });
    const compact = bytes(JSON.stringify(Array.from({ length: 220000 }, () => 0)));
    expect(compact.length).toBeLessThan(MAX_BYTES);
    expect(checkJsonFormat(compact, bytes('[]'))).toMatchObject({ status: 'unknown', reason: 'expected_output_limit', expectedSha256: null });
  });
  it('does not execute data or inspect user accessors and rejects shared mutable bytes', () => {
    const input = bytes('{"__proto__":{"polluted":true},"toJSON":"process.exit(1)","code":"require(\"fs\")"}');
    // Construct actual canonical JSON; names are ordinary data, never callbacks.
    const value = JSON.parse('{"__proto__":{"polluted":true},"toJSON":"process.exit(1)","code":"require(\\\"fs\\\")"}');
    expect(checkJsonFormat(bytes(JSON.stringify(value)), bytes(JSON.stringify(value, null, 2))).status).toBe('pass');
    let accessed = false;
    const notBytes = { get length() { accessed = true; throw Error('unexpected'); } };
    expect(checkJsonFormat(notBytes as unknown as Uint8Array, input).status).toBe('unknown'); expect(accessed).toBe(false);
    expect(checkJsonFormat(new Uint8Array(new SharedArrayBuffer(2)), bytes('{}'))).toMatchObject({ status: 'unknown', reason: 'input_shared_bytes' });
  });
});
