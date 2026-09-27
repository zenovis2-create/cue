import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchSubscriptionTask, RUN_KEY, validateSpec, __test } from './subscription-live-runner.mjs';

const executableSha = createHash('sha256').update(await readFile(process.execPath)).digest('hex').toUpperCase();
const makeRoot = () => mkdtemp(join(tmpdir(), 'cue-subscription-runner-'));
const spec = (slot, code = "process.stdin.resume();process.stdin.on('end',()=>console.log(JSON.stringify({result:'ok',model:'fake-model',session_id:'session-1',usage:{input_tokens:1}})))") => ({
  provider: 'fake', slot, executable: process.execPath, expectedSha256: executableSha,
  argv: ['-e', code], cwd: tmpdir(), env: { SystemRoot: process.env.SystemRoot ?? 'C:\\Windows', WINDIR: process.env.WINDIR ?? 'C:\\Windows' }, stdin: 'fixed prompt', timeoutMs: 5_000,
});

test('spec surface rejects proxies, accessors, and oversized input before launch', () => {
  assert.throws(() => validateSpec(new Proxy(spec(1), {}), { allowFake: true }), /spec_object_required/u);
  assert.throws(() => validateSpec({ ...spec(1), argv: new Proxy([], {}) }, { allowFake: true }), /argv_invalid/u);
  const hostileEnv = { SystemRoot: 'C:\\Windows' };
  Object.defineProperty(hostileEnv, 'TOKEN', { enumerable: true, get() { throw Error('must not run'); } });
  assert.throws(() => validateSpec({ ...spec(1), env: hostileEnv }, { allowFake: true }), /env_data_fields_required/u);
  assert.throws(() => validateSpec({ ...spec(1), stdin: 'x'.repeat(65_537) }, { allowFake: true }), /stdin_invalid/u);
});

test('four durable slots survive reopen and a duplicate is denied', async () => {
  const ledgerRoot = await makeRoot();
  for (let slot = 1; slot <= 4; slot++) assert.equal((await launchSubscriptionTask(spec(slot), { ledgerRoot, allowFake: true })).status, 'completed');
  await assert.rejects(() => launchSubscriptionTask(spec(2), { ledgerRoot, allowFake: true }), /slot_already_consumed:2/u);
  await assert.rejects(() => launchSubscriptionTask(spec(5), { ledgerRoot, allowFake: true }), /slot_invalid/u);
  const reopened = JSON.parse(await readFile(join(ledgerRoot, RUN_KEY, 'slot-4.json'), 'utf8'));
  assert.equal(reopened.slot, 4);
  assert.equal(reopened.status, 'completed');
});

test('failure consumes its reservation and captures safe projected evidence', async () => {
  const ledgerRoot = await makeRoot();
  const bad = { ...spec(1), expectedSha256: 'A'.repeat(64) };
  const result = await launchSubscriptionTask(bad, { ledgerRoot, allowFake: true });
  assert.equal(result.status, 'failed-or-unknown');
  assert.equal(result.error, 'executable_hash_mismatch');
  await assert.rejects(() => launchSubscriptionTask(spec(1), { ledgerRoot, allowFake: true }), /slot_already_consumed/u);

  const safe = await launchSubscriptionTask(spec(2, `process.stdin.resume();process.stdin.on('end',()=>console.log(JSON.stringify({result:'Bearer abc.def.secret',model:'m',session_id:'s',usage:{output_tokens:2},authorization:'sk-secretsecret'})))`), { ledgerRoot, allowFake: true });
  assert.equal(safe.status, 'completed');
  assert.equal(safe.usage.output_tokens, 2);
  assert.equal(safe.resultModel, 'm');
  assert.equal(safe.sessionId, 's');
  assert.doesNotMatch(JSON.stringify(safe), /abc\.def\.secret|sk-secretsecret/u);
  assert.equal(Object.hasOwn(safe.streams, 'stdout'), true);
  assert.equal(Object.keys(safe.streams).includes('stdout'), false);
  assert.ok(Number.isInteger(safe.processIdentity.pid));
  assert.equal(typeof safe.processIdentity.createdAt, 'string');
  assert.match(safe.specDigest, /^[A-F0-9]{64}$/u);
  assert.equal(safe.exit.quiescenceScope, 'owned-root-close-only');
});

test('provider evidence remains separate from process completion', async () => {
  const ledgerRoot = await makeRoot();
  const incomplete = await launchSubscriptionTask(spec(1, `console.log(JSON.stringify({result:'ok',model:'fake-model'}))`), { ledgerRoot, allowFake: true });
  assert.equal(incomplete.status, 'completed');
  assert.equal(incomplete.sessionId, null);
  const tool = await launchSubscriptionTask(spec(2, `console.log(JSON.stringify({type:'tool_call',result:'ok',model:'fake-model',session_id:'s',usage:{input_tokens:1}}))`), { ledgerRoot, allowFake: true });
  assert.equal(tool.toolEvent, true);
  assert.equal(tool.status, 'completed');
});

test('pending ledger rows count as consumed', async () => {
  const ledgerRoot = await makeRoot();
  const first = launchSubscriptionTask(spec(3, `setTimeout(()=>process.exit(0),300)`), { ledgerRoot, allowFake: true });
  await new Promise(resolve => setTimeout(resolve, 50));
  await assert.rejects(() => launchSubscriptionTask(spec(3), { ledgerRoot, allowFake: true }), /slot_already_consumed/u);
  await first;
});

test('timeout is bounded and verified through creation-bound cleanup', { skip: process.platform !== 'win32' }, async () => {
  const result = await __test.runChild({ ...spec(1, `setInterval(()=>{},1000)`), timeoutMs: 100 });
  assert.equal(result.timedOut, true);
  assert.equal(result.terminationVerified, true);
  assert.ok(result.latencyMs < 20_000);
});

test('combined stream capture is capped and sanitized', async () => {
  const result = await __test.runChild(spec(1, `process.stdout.write('Bearer secret.token.value\\n');process.stderr.write('x'.repeat(300000));setInterval(()=>{},1000)`));
  assert.equal(result.overflow, true);
  assert.ok(Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr) <= 256 * 1024);
  assert.doesNotMatch(result.stdout, /secret\.token\.value/u);
});
