import { measureModelControlBundle } from '../src/model-control-bundle.js';
import { describe, it, expect } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createServer } from 'node:net';

const windows = process.platform === 'win32';
const launcher = resolve('src/model-only-launch.ps1');
const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
function launch(extra: Record<string, unknown> = {}, probe = false, onOutput?: (data: string) => void) {
  const payload = { ...(!probe ? {controlBundle: measureModelControlBundle({controlRoot: resolve('src'),nodeExecutable: process.execPath,clientKind: 'model'})} : {}), nodeExecutable: process.execPath, nodeSha256: hash(process.execPath), parentPid: process.pid,
    request: JSON.stringify({ protocol: 'cue-model-client-v1', operation: 'ping' }), timeoutMs: 5000, ...extra };
  const child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', launcher,
    '-PayloadBase64', Buffer.from(JSON.stringify(payload)).toString('base64'), ...(probe ? ['-ProbeHarness'] : [])], { windowsHide: true });
  const done = new Promise<{ code: number | null; out: string; err: string }>((done, reject) => {
    let out = '', err = ''; child.stdout.on('data', data => { out += data.toString(); onOutput?.(out); }); child.stderr.on('data', data => { err += data.toString(); });
    child.on('error', reject); child.on('close', code => done({ code, out, err }));
  });
  return { child, done };
}
function field(out: string, name: string) { return out.split(/\r?\n/).find(line => line.startsWith(name + '='))?.slice(name.length + 1); }
function cleaned(out: string) {
  expect(JSON.parse(field(out, 'CUE_MODEL_CLEANUP')!)).toEqual({ taskRootAbsent: true, profileAbsent: true });
  const boundary = JSON.parse(field(out, 'CUE_MODEL_BOUNDARY')!);
  expect(existsSync(boundary.taskRoot)).toBe(false); expect(existsSync(boundary.profilePath)).toBe(false);
  const pid = Number(field(out, 'CUE_MODEL_PID')); expect(pid).toBeGreaterThan(0);
  expect(() => process.kill(pid, 0)).toThrow();
}
describe.skipIf(!windows)('S1 actual Windows model-only client boundary (provider remains unknown)', () => {
  it('fixed production protocol uses inherited pipes and removes actual process/profile/root', async () => {
    const result = await launch().done;
    expect(result.err).toBe(''); expect(result.code).toBe(0);
    expect(JSON.parse(Buffer.from(field(result.out, 'CUE_MODEL_RESPONSE')!, 'base64').toString())).toEqual({ protocol: 'cue-model-client-v1', status: 'ok', text: 'client-boundary-ready' });
    expect(field(result.out, 'CUE_MODEL_EXIT')).toBe('0'); cleaned(result.out);
    const bad = await launch({ request: '{"operation":"eval","code":"process.exit(99)"}' }).done;
    expect(JSON.parse(Buffer.from(field(bad.out, 'CUE_MODEL_RESPONSE')!, 'base64').toString()).status).toBe('protocol_error'); cleaned(bad.out);
  }, 30000);
  it('same launcher preserves filesystem refusal regression and raw child/network diagnostics', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cue-model-probe-')); const fixture = join(root, 'probe.cjs'), outside = join(root, 'outside.txt');
    writeFileSync(outside, 'outside-unchanged');
    const server = createServer(socket => socket.destroy()); await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
    const port = (server.address() as { port: number }).port;
    writeFileSync(fixture, `const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),net=require('node:net');
const results={};function denied(name,fn){try{fn();results[name]='ALLOWED'}catch(e){results[name]=e.code}}
const existing=path.join(process.cwd(),'existing.txt');
denied('newWork',()=>fs.writeFileSync('new.txt','bad'));denied('appendWork',()=>fs.appendFileSync(existing,'bad'));
denied('overwriteWork',()=>fs.writeFileSync(existing,'bad'));denied('deleteWork',()=>fs.unlinkSync(existing));
denied('profile',()=>fs.writeFileSync(path.join(process.env.USERPROFILE,'bad.txt'),'bad'));
results.tempExists=fs.existsSync(process.env.TEMP);
denied('temp',()=>fs.writeFileSync(path.join(process.env.TEMP,'bad.txt'),'bad'));
denied('outside',()=>fs.writeFileSync(${JSON.stringify(outside)},'bad'));
const childProbe=new Promise(done=>{let timer,child;try{child=cp.spawn(process.execPath,['-e','process.exit(0)'],{stdio:'ignore'})}catch(e){results.child=e.code;done();return}
child.once('error',e=>{clearTimeout(timer);results.child=e.code;done()});child.once('spawn',()=>{clearTimeout(timer);results.child='ALLOWED';child.kill();done()});
timer=setTimeout(()=>{results.child='TIMEOUT';child.kill();done()},1000)});
const networkProbe=new Promise(done=>{const socket=net.connect(${port},'127.0.0.1');socket.on('connect',()=>{results.network='ALLOWED';socket.destroy()});
socket.on('error',e=>{results.network=e.code});socket.setTimeout(1000,()=>{results.network='TIMEOUT';socket.destroy()});
socket.on('close',done)});
Promise.all([childProbe,networkProbe]).then(()=>process.stdout.write(JSON.stringify(results)+'\\n',()=>process.exit(0)));
`);
    try {
      const result = await launch({ probePath: fixture, probeSha256: hash(fixture) }, true).done;
      expect(result.err).toBe(''); expect(result.code, result.out).toBe(0);
      const probes = JSON.parse(Buffer.from(field(result.out, 'CUE_MODEL_RESPONSE')!, 'base64').toString());
      const evidenceDirectory = resolve('../evidence/integrations/S1/20260911-model-boundary'); mkdirSync(evidenceDirectory, { recursive: true });
      writeFileSync(join(evidenceDirectory, `legacy-diagnostics-${randomUUID()}.json`), JSON.stringify({ observedAt: new Date().toISOString(),
        launcherSha256: hash(launcher), testSha256: hash(resolve('test/integration-model-boundary.test.ts')), probes,
        scope: 'Filesystem regression; child/network values are raw diagnostics, not qualification verdicts.' }, null, 2), { flag: 'wx' });
      expect(probes.tempExists).toBe(true);
      for (const name of ['newWork', 'appendWork', 'overwriteWork', 'deleteWork', 'profile', 'temp', 'outside']) expect(['EACCES', 'EPERM'], `OS probe ${name}: ${JSON.stringify(probes)}`).toContain(probes[name]);
      // Actual child policy is asserted by integration-model-boundary-process-limit.test.ts
      // (owned native ACTIVE_PROCESS_LIMIT event). Network policy/controlled host
      // pre/post nonce evidence is asserted by integration-model-boundary-qualification.test.ts.
      // This regression never treats UNKNOWN/timeout or any Node errno as their verdict.
      expect(typeof probes.child).toBe('string'); expect(typeof probes.network).toBe('string');
      expect(readFileSync(outside, 'utf8')).toBe('outside-unchanged'); cleaned(result.out);
    } finally { await new Promise<void>(done => server.close(() => done())); rmSync(root, { recursive: true, force: true }); }
  }, 30000);
  it('timeout cancellation and observed parent death kill job and clean profile', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cue-model-hold-')), fixture = join(root, 'hold.cjs');
    writeFileSync(fixture, 'process.stdin.resume();setInterval(()=>{},1000);');
    const parent = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { windowsHide: true });
    try {
      const timed = await launch({ probePath: fixture, probeSha256: hash(fixture), timeoutMs: 200 }, true).done;
      expect(timed.err).toBe(''); expect(field(timed.out, 'CUE_MODEL_STOP_REASON')).toBe('258'); cleaned(timed.out);
      const killed = await launch({ probePath: fixture, probeSha256: hash(fixture), parentPid: parent.pid }, true, out => {
        if (field(out, 'CUE_MODEL_PID')) parent.kill();
      }).done;
      expect(killed.err).toBe(''); expect(field(killed.out, 'CUE_MODEL_STOP_REASON')).toBe('1'); cleaned(killed.out);
    } finally { parent.kill(); rmSync(root, { recursive: true, force: true }); }
  }, 30000);
  it('production mode rejects harness override and client rejects oversized/multiple messages', async () => {
    const rejected = await launch({ probePath: 'anything' }).done; expect(rejected.code).not.toBe(0); expect(rejected.err).toContain('unknown_payload_field');
    for (const input of ['x'.repeat(8193), '{}\n{}']) {
      const result = spawnSync(process.execPath, [resolve('src/model-only-client.cjs')], { input, encoding: 'utf8', timeout: 1000, windowsHide: true });
      expect(JSON.parse(result.stdout).status).toBe('protocol_error'); expect(result.status).toBe(0);
    }
  }, 15000);
});
