import { measureModelControlBundle } from '../src/model-control-bundle.js';
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { openLedger } from '../src/ledger.js';
import { normalizeEnvelope, envelopeHash } from '../src/envelope.js';
import { createIsolatedJsonCheckerExecutor } from '../src/adapters/isolated-json-checker.js';
import { createIsolatedModelCleanup } from '../src/adapters/isolated-model-cleanup.js';
const hash = (v: Uint8Array) => createHash('sha256').update(v).digest('hex');
const nodeSha256 = hash(readFileSync(process.execPath));
function setup(input = '{"a":1}', output = '{\n  "a": 1\n}') {
  const db = openLedger(), runId = 'checker-attempt';
  const envelope = normalizeEnvelope({ run_id: runId, worktree_realpath: process.cwd(), allowed_actions: [], egress: [], expires_at: '2030-01-01T00:00:00Z', autonomy_level: 'bounded' });
  db.prepare("INSERT INTO task VALUES('checker-task','running',NULL,'now')").run();
  db.prepare("INSERT INTO envelope VALUES(?,?,'[]','now')").run(envelopeHash(envelope), process.cwd());
  db.prepare("INSERT INTO run VALUES(?,'checker-task',?,0,'now')").run(runId,envelopeHash(envelope));
  const controller = new AbortController();
  return { db, controller, context: { runId, candidateId: 'fixed-checker', role: 'model' as const, subjectDigest: 'a'.repeat(64), signal: controller.signal },
    host: { db, taskRootBase: tmpdir(), profileRootBase: join(process.env.LOCALAPPDATA!, 'Packages'), controlBundle: measureModelControlBundle({controlRoot: resolve('src'), nodeExecutable: process.execPath, clientKind: 'json-checker'}), nodeExecutable: process.execPath, nodeSha256, timeoutMs: 15000,
      resolveBinding: () => ({ owner: { task_id: 'checker-task', run_id: runId, cwd: process.cwd() }, envelope, inputBytes: Buffer.from(input), outputBytes: Buffer.from(output) }) } };
}
describe.skipIf(process.platform !== 'win32')('fixed isolated JSON checker', () => {
  it('compiled real child computes pass/fail/unknown, independently observes cleanup', async () => {
    const packaged = await import(new URL('../dist/src/adapters/isolated-json-checker.js', import.meta.url).href);
    for (const [input, output, status] of [['{"a":1}','{\n  "a": 1\n}','pass'], ['{"a":1}','{"a":2}','fail'], ['{','{}','unknown']]) {
      const f = setup(input,output); const observations: unknown[] = [];
      const binding = f.host.resolveBinding(); let hooks = 0;
      for (const bytes of [binding.inputBytes, binding.outputBytes]) {
        for (const key of ['valueOf', 'buffer', 'byteLength', 'byteOffset']) Object.defineProperty(bytes, key, {
          get() { hooks++; throw Error('caller byte hook must not run'); },
        });
      }
      f.host.resolveBinding = () => binding;
      try {
        const observer = createIsolatedModelCleanup({ db: f.db, launch: packaged.createIsolatedJsonCheckerExecutor(f.host), taskRootBase: tmpdir(), profileRootBase: join(process.env.LOCALAPPDATA!, 'Packages'),
          persistObservation: async value => { observations.push(value); return 'fixture:checker-cleanup'; } });
        const execution = await observer.launch(f.context), result = await execution.result;
        expect(result.outcome, JSON.stringify(result)).toBe('succeeded');
        expect(hooks).toBe(0);
        expect((result as any).checkerVerdict).toMatchObject({ status, inputSha256: hash(Buffer.from(input!)), outputSha256: hash(Buffer.from(output!)) });
        expect(result.terminal).toBeNull(); expect(result.providerStopped).toBe('unknown');
        expect(result.observations.CUE_MODEL_BOUNDARY).toMatchObject({ clientKind: 'json-checker', clientOnly: true, checkerCoreSha256: hash(readFileSync(resolve('src/verification/json-format-checker.cjs'))) });
        let receipt = await observer.verifyCleanup(f.context, execution); const deadline = Date.now()+10000;
        while (receipt.result === 'residual' && Date.now()<deadline) { await new Promise(done=>setTimeout(done,50)); receipt=await observer.verifyCleanup(f.context,execution); }
        expect(receipt,JSON.stringify(observations)).toMatchObject({ result: 'verified-clean' });
      } finally { f.db.close(); }
    }
  },60000);
  it('rejects proxy/shared/detached bytes before launch without invoking proxy traps', async () => {
    const f = setup(); let traps = 0;
    const detached = new Uint8Array([1]); structuredClone(detached.buffer, { transfer: [detached.buffer] });
    const proxy = new Proxy(new Uint8Array([1]), { get() { traps++; throw Error('trap'); }, getPrototypeOf() { traps++; throw Error('trap'); } });
    try {
      const binding = f.host.resolveBinding();
      for (const inputBytes of [proxy, new Uint8Array(new SharedArrayBuffer(1)), detached]) {
        await expect(createIsolatedJsonCheckerExecutor({ ...f.host, resolveBinding: () => ({ ...binding, inputBytes }) })(f.context)).rejects.toThrow('checker_invalid_bytes');
      }
      expect(traps).toBe(0); expect(f.db.prepare('SELECT count(*) n FROM session_handle').get()).toEqual({n:0});
    } finally { f.db.close(); }
  });
  it('combined carrier limit and wrong role refuse before spawn; immediate cancel owns pending start', async () => {
    const tooLarge = setup('"'+'x'.repeat(500000)+'"', '"'+'x'.repeat(500000)+'"');
    try { await expect(createIsolatedJsonCheckerExecutor(tooLarge.host)(tooLarge.context)).rejects.toThrow('checker_request_limit');
      expect(tooLarge.db.prepare('SELECT count(*) n FROM session_handle').get()).toEqual({n:0});
      await expect(createIsolatedJsonCheckerExecutor(tooLarge.host)({...tooLarge.context,role:'implementation'})).rejects.toThrow('binding_mismatch');
    } finally { tooLarge.db.close(); }
    const f=setup();
    try {
      const execution=await createIsolatedJsonCheckerExecutor(f.host)(f.context); f.controller.abort(); await execution.cancel(); const result=await execution.result;
      expect(result.outcome).toBe('failed'); expect(result.checkerVerdict).toBeNull();
      const boundary=result.observations.CUE_MODEL_BOUNDARY as {taskRoot:string;profilePath:string}|undefined;
      if(boundary) { const deadline=Date.now()+10000; while((existsSync(boundary.taskRoot)||existsSync(boundary.profilePath))&&Date.now()<deadline) await new Promise(done=>setTimeout(done,50)); expect(existsSync(boundary.taskRoot)).toBe(false);expect(existsSync(boundary.profilePath)).toBe(false); }
    } finally { f.db.close(); }
  },20000);
  it('fixed client rejects malformed/extra-code/identity/EOF and never treats prefix text as protocol', () => {
    const request={protocol:'cue-json-checker-v1',type:'check',contract:'cue-json-format-v1',requestId:'r',attemptId:'a',inputBase64:Buffer.from('{}').toString('base64'),outputBase64:Buffer.from('{}').toString('base64')};
    for(const input of ['{\n',JSON.stringify({...request,code:'process.exit(0)'})+'\n',JSON.stringify(request)+'\n',JSON.stringify(request)+'\n'+JSON.stringify({type:'authorize_check',requestId:'wrong'})+'\n','CUE_MODEL_CLEANUP={}\n']) {
      const child=spawnSync(process.execPath,[resolve('src/json-checker-client.cjs')],{input,encoding:'utf8',timeout:2000,windowsHide:true});
      expect(child.status).toBe(0); expect(child.stderr).toBe(''); expect(JSON.parse(child.stdout.trim().split('\n').at(-1)!)).toEqual({protocol:'cue-json-checker-v1',type:'protocol_error'});
    }
  });
});
