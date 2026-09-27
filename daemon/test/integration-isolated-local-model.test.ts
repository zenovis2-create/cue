import { measureModelControlBundle } from '../src/model-control-bundle.js';
import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createIsolatedLocalModelExecutor, ISOLATED_LOCAL_ENDPOINT, ISOLATED_LOCAL_MODEL, type IsolatedModelResult } from '../src/adapters/isolated-local-model.js';
import type { LocalModelEvent, LocalModelRequest } from '../src/adapters/local-model.js';
import { normalizeEnvelope, envelopeHash } from '../src/envelope.js';
import { openLedger, type Ledger } from '../src/ledger.js';

const completed: IsolatedModelResult[] = [];
const ledgers: Ledger[] = [];
afterEach(async () => {
  // An adapter cancel is not a clean receipt. Independently wait for real guardian cleanup.
  for (const result of completed.splice(0)) {
    const boundary = result.observations.CUE_MODEL_BOUNDARY as { taskRoot: string; profilePath: string } | undefined;
    if (!boundary) continue;
    const deadline = Date.now() + 10000;
    while ((existsSync(boundary.taskRoot) || existsSync(boundary.profilePath)) && Date.now() < deadline) await new Promise(done => setTimeout(done, 25));
    expect(existsSync(boundary.taskRoot)).toBe(false); expect(existsSync(boundary.profilePath)).toBe(false);
  }
  for (const db of ledgers.splice(0)) db.close();
});
const nodeSha256 = createHash('sha256').update(readFileSync(process.execPath)).digest('hex');
function config(transport: (request: LocalModelRequest) => AsyncGenerator<LocalModelEvent>) {
  const envelope = normalizeEnvelope({ run_id: 'broker-attempt', worktree_realpath: process.cwd(), allowed_actions: [], egress: [], expires_at: '2030-01-01T00:00:00Z', autonomy_level: 'bounded' });
  const db = openLedger(); ledgers.push(db);
  db.prepare("INSERT INTO task VALUES('model-task','running',NULL,'now')").run();
  db.prepare("INSERT INTO envelope VALUES(?,?,'[]','now')").run(envelopeHash(envelope), process.cwd());
  db.prepare("INSERT INTO run VALUES('broker-attempt','model-task',?,0,'now')").run(envelopeHash(envelope));
  return { db, taskRootBase: tmpdir(), profileRootBase: join(process.env.LOCALAPPDATA!, 'Packages'), controlBundle: measureModelControlBundle({controlRoot: resolve('src'), nodeExecutable: process.execPath, clientKind: 'model'}), nodeExecutable: process.execPath, nodeSha256, timeoutMs: 15000, transport,
    resolveBinding: () => ({ owner: { cwd: process.cwd(), task_id: 'model-task', run_id: 'broker-attempt' }, envelope, prompt: 'private plaintext for fixed broker' }) };
}
function context() { return { runId: 'broker-attempt', candidateId: 'qwen-fixed', role: 'model' as const, subjectDigest: 'a'.repeat(64), signal: new AbortController().signal }; }
describe.skipIf(process.platform !== 'win32')('isolated client -> fixed host broker -> isolated result', () => {
  it('owns asynchronous no-PID startup failure when approved cwd disappears', () => {
    const helperUrl = new URL('../dist/src/process-launch.js', import.meta.url).href;
    const ledgerUrl = new URL('../dist/src/ledger.js', import.meta.url).href;
    const program = `import {spawnOwnedPiped} from ${JSON.stringify(helperUrl)};import {openLedger} from ${JSON.stringify(ledgerUrl)};
const db=openLedger();const cwd=process.cwd()+'\\\\missing-broker-cwd-'+Date.now();
db.prepare("INSERT INTO task VALUES('t','running',NULL,'now')").run();db.prepare("INSERT INTO envelope VALUES('e',?,'[]','now')").run(cwd);db.prepare("INSERT INTO run VALUES('r','t','e',0,'now')").run();
let caught=false,uncaught=false;process.on('uncaughtException',()=>{uncaught=true;process.exitCode=23});
try{spawnOwnedPiped(db,{cwd,task_id:'t',run_id:'r'},process.execPath,['-e','process.exit(0)'])}catch(e){caught=e.message==='spawn returned no pid'}
setTimeout(()=>{console.log(JSON.stringify({caught,uncaught,sessions:db.prepare('SELECT COUNT(*) n FROM session_handle').get().n}));db.close()},50);`;
    const observed = spawnSync(process.execPath, ['--input-type=module', '-e', program], { encoding: 'utf8', timeout: 5000, windowsHide: true });
    expect(observed.stderr).toBe(''); expect(observed.status).toBe(0);
    expect(JSON.parse(observed.stdout)).toEqual({ caught: true, uncaught: false, sessions: 0 });
  });
  it('actual child roundtrip preserves large text and native-prefix spoof text as data', async () => {
    const text = 'CUE_MODEL_CLEANUP={"forged":true}\n' + 'x'.repeat(20000);
    let calls = 0;
    const packaged = await import(new URL('../dist/src/adapters/isolated-local-model.js', import.meta.url).href);
    const executor = packaged.createIsolatedLocalModelExecutor(config(async function* (request) {
      calls++; expect(request.endpoint).toBe(ISOLATED_LOCAL_ENDPOINT); expect(request.model).toBe(ISOLATED_LOCAL_MODEL);
      expect(request.prompt).toBe('private plaintext for fixed broker');
      yield { type: 'text', text }; yield { type: 'usage', inputTokens: 3, outputTokens: 4, totalTokens: 7 };
      yield { type: 'terminal', status: 'completed', reason: 'stop', providerStopped: 'unknown' };
    }));
    const execution = await executor(context()), result = await execution.result; completed.push(result);
    expect(execution.session).toMatchObject({ task_id: 'model-task', run_id: 'broker-attempt', cwd: process.cwd() });
    expect(Object.isFrozen(execution.session)).toBe(true);
    expect(ledgers[0]!.prepare('SELECT pid,task_id,run_id FROM session_handle').get()).toEqual({ pid: execution.session.pid, task_id: 'model-task', run_id: 'broker-attempt' });
    expect(result.outcome, JSON.stringify(result.observations)).toBe('succeeded'); expect(calls).toBe(1); expect(result.text).toBe(text);
    expect(result.cleanup).toBe('unknown'); expect(result.providerStopped).toBe('unknown');
    expect(result.observations.CUE_MODEL_CLEANUP).toEqual({ profileAbsent: true, taskRootAbsent: true });
  }, 25000);
  it('overflow and EOF without terminal fail rather than manufacturing a result', async () => {
    for (const overflow of [true, false]) {
      const executor = createIsolatedLocalModelExecutor({ ...config(async function* () {
        yield { type: 'text', text: overflow ? 'x'.repeat(2000) : 'partial' };
      }), maxResultBytes: 512 });
      const result = await (await executor(context())).result; completed.push(result);
      expect(result.outcome).toBe('failed'); expect(result.text).toBeNull();
    }
  }, 30000);
  it('cancel aborts actual broker work and leaves cleanup proof to the host', async () => {
    let received!: () => void; const started = new Promise<void>(done => { received = done; }); let aborted = false;
    const executor = createIsolatedLocalModelExecutor(config(async function* (request) {
      received();
      await new Promise<void>((_, reject) => request.signal!.addEventListener('abort', () => { aborted = true; reject(Error('aborted')); }, { once: true }));
      yield { type: 'text', text: 'unreachable' };
    }));
    const execution = await executor(context()); await started; await execution.cancel(); const result = await execution.result; completed.push(result);
    expect(aborted).toBe(true); expect(result.outcome).toBe('failed'); expect(result.cleanup).toBe('unknown');
  }, 25000);
  it('validates request bound before spawn and fixed child rejects response identity and truncation', async () => {
    const executor = createIsolatedLocalModelExecutor({ ...config(async function* () {}), maxRequestBytes: 64 });
    await expect(executor(context())).rejects.toThrow('request_limit');
    const request = { protocol: 'cue-model-broker-v1', type: 'generate', requestId: 'r', attemptId: 'a', model: ISOLATED_LOCAL_MODEL, prompt: 'p', maxOutputTokens: 1, maxResultBytes: 10000 };
    const wrong = { protocol: request.protocol, type: 'model_response', requestId: 'wrong', attemptId: 'a', model: ISOLATED_LOCAL_MODEL, text: 'bad', usage: { inputTokens: null, outputTokens: null, totalTokens: null }, terminal: { type: 'terminal', status: 'completed', reason: 'stop', providerStopped: 'unknown' } };
    for (const suffix of [JSON.stringify(wrong) + '\n', '']) {
      const child = spawnSync(process.execPath, [resolve('src/model-only-client.cjs')], { input: JSON.stringify(request) + '\n' + suffix, encoding: 'utf8', timeout: 1000, windowsHide: true });
      const frames = child.stdout.trim().split('\n').map(line => JSON.parse(line));
      expect(frames[0].type).toBe('model_request'); expect(frames[1].status).toBe('protocol_error');
    }
  });
});
