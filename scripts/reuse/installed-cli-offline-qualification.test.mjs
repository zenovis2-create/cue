import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRequest, __test } from './installed-cli-offline-qualification.mjs';
import { tmpdir } from 'node:os';

const base = { candidate: 'claude', observation: 'version', executable: 'C:\\fixed\\claude.exe',
  expectedSha256: 'A'.repeat(64), signerContains: 'Anthropic, PBC' };

test('only the five offline metadata observations are admitted', () => {
  const accepted = [['claude', 'version'], ['claude', 'help'], ['codex', 'version'], ['codex', 'help'], ['codex', 'app-server-help']];
  for (const [candidate, observation] of accepted) assert.doesNotThrow(() => validateRequest({ ...base, candidate, observation }));
  for (const observation of ['login', 'update', 'exec', 'app-server', 'model']) assert.throws(() => validateRequest({ ...base, observation }));
});

test('identity and input surface fail closed', () => {
  assert.throws(() => validateRequest({ ...base, expectedSha256: 'A'.repeat(63) }));
  assert.throws(() => validateRequest({ ...base, executable: 'claude.exe' }));
  assert.throws(() => validateRequest({ ...base, signerContains: '' }));
  assert.throws(() => validateRequest({ ...base, env: {}, observation: 'version' }));
  assert.throws(() => validateRequest(new Proxy(base, {})));
  const accessor = { ...base }; let calls = 0;
  Object.defineProperty(accessor, 'candidate', { enumerable: true, get() { calls++; return 'claude'; } });
  assert.throws(() => validateRequest(accessor), /data_fields/);
  assert.equal(calls, 0);
  let coercions = 0;
  const hostileSha = { [Symbol.toPrimitive]() { coercions++; return 'A'.repeat(64); } };
  assert.throws(() => validateRequest({ ...base, expectedSha256: hostileSha }), /identity_invalid/);
  assert.equal(coercions, 0);
});

test('returned argument vectors are exact and frozen', () => {
  assert.deepEqual(validateRequest(base).args, ['--version']);
  assert.deepEqual(validateRequest({ ...base, candidate: 'codex', observation: 'app-server-help' }).args, ['app-server', '--help']);
  assert.ok(Object.isFrozen(validateRequest(base).args));
});

test('failed spawn is bounded and reports no child to clean', async () => {
  const result = await __test.runChild('C:\\definitely-missing-cue-test.exe', [], tmpdir(), process.env, { timeoutMs: 250, maxOutput: 32 });
  assert.match(result.spawnError, /ENOENT/u);
  assert.equal(result.quiescent, true);
  assert.equal(result.quiescenceScope, 'spawn-failed-no-child');
});

test('overflow terminates the creation-bound observed tree', { skip: process.platform !== 'win32' }, async () => {
  const result = await __test.runChild(process.execPath, ['-e', "process.stdout.write('x'.repeat(4096));setInterval(()=>{},1000)"], tmpdir(), process.env, { timeoutMs: 5000, maxOutput: 32 });
  assert.equal(result.overflow, true);
  assert.equal(result.terminationVerified, true);
  assert.equal(result.quiescent, true);
  assert.equal(result.quiescenceScope, 'verified-observed-tree-dead');
});

test('timeout terminates the creation-bound observed tree', { skip: process.platform !== 'win32' }, async () => {
  const result = await __test.runChild(process.execPath, ['-e', 'setInterval(()=>{},1000)'], tmpdir(), process.env, { timeoutMs: 100, maxOutput: 32 });
  assert.equal(result.timedOut, true);
  assert.equal(result.terminationVerified, true);
  assert.equal(result.quiescent, true);
});
