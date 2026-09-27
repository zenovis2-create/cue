import { measureModelControlBundle } from '../src/model-control-bundle.js';
import { afterAll, describe, expect, it } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createConnection, createServer, type Socket } from 'node:net';

const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const launcher = resolve('src/model-only-launch.ps1');
const evidence: Record<string, unknown> = { scope: 'fixed-client narrow policy and controlled TCP observation; not B3/all-protocol/provider qualification', observations: [] };
const records = evidence.observations as unknown[];
const observationRunId = randomUUID();
const observationDirectory = resolve('../evidence/integrations/S1/20260911-model-boundary');
function record(value: unknown) {
  records.push(value);
  mkdirSync(observationDirectory, { recursive: true });
  appendFileSync(join(observationDirectory, `controlled-qualification-${observationRunId}.jsonl`), JSON.stringify(value) + '\n');
}
const field = (out: string, key: string) => out.split(/\r?\n/).find(line => line.startsWith(key + '='))?.slice(key.length + 1);
function launch(extra: Record<string, unknown>, probe = false, onOutput?: (out: string) => void) {
  const payload = { ...(!probe ? {controlBundle: measureModelControlBundle({controlRoot: resolve('src'),nodeExecutable: process.execPath,clientKind: 'model'})} : {}), nodeExecutable: process.execPath, nodeSha256: hash(process.execPath), parentPid: process.pid,
    request: JSON.stringify({ protocol: 'cue-model-client-v1', operation: 'ping' }), timeoutMs: 10000, ...extra };
  const child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', launcher,
    '-PayloadBase64', Buffer.from(JSON.stringify(payload)).toString('base64'), ...(probe ? ['-ProbeHarness'] : [])], { windowsHide: true });
  return new Promise<{ code: number | null; out: string; err: string }>((done, reject) => {
    let out = '', err = ''; child.stdout.on('data', bytes => { out += bytes.toString(); onOutput?.(out); }); child.stderr.on('data', bytes => { err += bytes.toString(); });
    child.on('error', reject); child.on('close', code => done({ code, out, err }));
  });
}
function assertClean(out: string) {
  expect(JSON.parse(field(out, 'CUE_MODEL_CLEANUP')!)).toEqual({ taskRootAbsent: true, profileAbsent: true });
  const boundary = JSON.parse(field(out, 'CUE_MODEL_BOUNDARY')!);
  expect(existsSync(boundary.taskRoot)).toBe(false); expect(existsSync(boundary.profilePath)).toBe(false);
  expect(() => process.kill(Number(field(out, 'CUE_MODEL_PID')), 0)).toThrow();
}
afterAll(() => {
  if (process.platform !== 'win32') return;
  evidence.observedAt = new Date().toISOString();
  evidence.sourceHashes = Object.fromEntries(['src/model-only-launch.ps1', 'src/model-only-client.cjs', 'src/model-only-profile-cleanup.ps1', 'test/integration-model-boundary-qualification.test.ts'].map(path => [path, hash(resolve(path))]));
  evidence.nodeSha256 = hash(process.execPath);
  const directory = resolve('../evidence/integrations/S1/20260911-model-boundary'); mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, `controlled-qualification-${observationRunId}.json`), JSON.stringify(evidence, null, 2), { flag: 'wx' });
});

describe.skipIf(process.platform !== 'win32')('fixed model-client controlled qualification observations', () => {
  it('M1 production rejects code/tool/url fields and cannot select a probe', async () => {
    for (const key of ['code', 'tool', 'url']) {
      const result = await launch({ request: JSON.stringify({ protocol: 'cue-model-client-v1', operation: 'ping', [key]: 'untrusted' }) });
      expect(result.err).toBe(''); expect(result.code).toBe(0); assertClean(result.out);
      const response = JSON.parse(Buffer.from(field(result.out, 'CUE_MODEL_RESPONSE')!, 'base64').toString());
      expect(response.status).toBe('protocol_error'); records.push({ case: `M1-${key}`, status: response.status });
    }
    const rejected = await launch({ probePath: 'untrusted', probeSha256: 'a'.repeat(64) });
    expect(rejected.code).not.toBe(0); expect(rejected.err).toContain('unknown_payload_field'); expect(field(rejected.out, 'CUE_MODEL_PID')).toBeUndefined();
    records.push({ case: 'M1-probe-not-selectable', rejectedBeforeChild: true });
    const hold = await launch({ probeHoldAfterExit: true });
    expect(hold.code).not.toBe(0); expect(hold.err).toContain('unknown_payload_field');
  }, 60000);

  it('diagnostic hold requires true boolean and missing host acknowledgement still cleans', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cue-inspection-timeout-')), fixture = join(root, 'exit.cjs');
    writeFileSync(fixture, 'process.stdout.end("{}\\n");');
    try {
      const extra = { probePath: fixture, probeSha256: hash(fixture) };
      const invalid = await launch({ ...extra, probeHoldAfterExit: 'true' }, true);
      expect(invalid.code).not.toBe(0); expect(invalid.err).toContain('invalid_probe_hold');
      const result = await launch({ ...extra, probeHoldAfterExit: true }, true);
      expect(result.code).not.toBe(0); expect(result.err).toContain('probe_inspection_timeout'); assertClean(result.out);
      records.push({ case: 'diagnostic-hold-timeout', marker: field(result.out, 'CUE_MODEL_PROBE_WAIT'), cleanup: JSON.parse(field(result.out, 'CUE_MODEL_CLEANUP')!) });
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 20000);

  it('M2/M3 denied file operations plus same-listener host controls and no confined TCP success', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cue-qualification-')), fixture = join(root, 'probe.cjs'), outside = join(root, 'outside.txt');
    writeFileSync(outside, 'outside-unchanged');
    const childNonce = 'child-' + randomUUID(), preNonce = 'pre-' + randomUUID(), postNonce = 'post-' + randomUUID();
    const received: string[] = [], sockets = new Set<Socket>();
    const server = createServer(socket => {
      sockets.add(socket); socket.on('close', () => sockets.delete(socket)); socket.on('error', () => {});
      let data = ''; socket.on('data', chunk => { data += chunk.toString(); if (data.includes('\n')) { received.push(data.trim()); socket.end(data); } });
    });
    await new Promise<void>((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
    const port = (server.address() as { port: number }).port;
    const control = (nonce: string) => new Promise<void>((done, reject) => {
      const socket = createConnection({ host: '127.0.0.1', port }); let data = '';
      socket.setTimeout(2000, () => socket.destroy(Error('host_control_timeout'))); socket.on('error', reject);
      socket.on('connect', () => socket.write(nonce + '\n')); socket.on('data', bytes => { data += bytes.toString(); });
      socket.on('end', () => { if (data.trim() === nonce) done(); else reject(Error('host_control_nonce_mismatch')); });
    });
    const source = `const fs=require('node:fs'),path=require('node:path'),net=require('node:net');
const wait=()=>new Promise(done=>setTimeout(done,10));
(async()=>{const ready=path.join(process.cwd(),'host-ready');const deadline=Date.now()+6000;while(!fs.existsSync(ready)){if(Date.now()>deadline)throw Error('host_seed_timeout');await wait()}
const targets={work:path.join(process.cwd(),'existing.txt'),profile:path.join(process.env.USERPROFILE,'probe-existing.txt'),temp:path.join(process.env.TEMP,'probe-existing.txt'),outside:${JSON.stringify(outside)}};
const results={pid:process.pid,files:{},network:{connected:false,sent:false,error:null}};
for(const [name,file] of Object.entries(targets)){const r={exists:fs.existsSync(file),before:null,after:null,operations:{}};try{r.before=fs.readFileSync(file,'utf8')}catch(e){r.before=e.code}
for(const [op,fn] of Object.entries({create:()=>fs.writeFileSync(path.join(path.dirname(file),'forbidden-new.txt'),'bad'),append:()=>fs.appendFileSync(file,'bad'),overwrite:()=>fs.writeFileSync(file,'bad'),delete:()=>fs.unlinkSync(file)})){try{fn();r.operations[op]='ALLOWED'}catch(e){r.operations[op]=e.code}}
try{r.after=fs.readFileSync(file,'utf8')}catch(e){r.after=e.code}results.files[name]=r}
await new Promise(done=>{const socket=net.connect(${port},'127.0.0.1');socket.on('connect',()=>{results.network.connected=true;socket.write(${JSON.stringify(childNonce)}+'\\n',e=>{if(!e)results.network.sent=true;socket.destroy()})});socket.on('error',e=>results.network.error=e.code);socket.setTimeout(700,()=>{results.network.error='TIMEOUT';socket.destroy()});socket.on('close',done)});
process.stdout.end(JSON.stringify(results)+'\\n');})().catch(()=>process.exit(2));`;
    writeFileSync(fixture, source);
    let seeded = false, inspected = false, seedError: Error | null = null, acl: unknown, hostPost: unknown, postAcl: unknown, aclCommand = '';
    try {
      await control(preNonce);
      const result = await launch({ probePath: fixture, probeSha256: hash(fixture), probeHoldAfterExit: true }, true, out => {
        if (!inspected && field(out, 'CUE_MODEL_PROBE_WAIT')) {
          inspected = true; record({ case: 'post-exit-raw-launcher', out });
          try {
            const boundary = JSON.parse(field(out, 'CUE_MODEL_BOUNDARY')!);
            expect(() => process.kill(Number(field(out, 'CUE_MODEL_PID')), 0)).toThrow();
            const targets = [join(boundary.taskRoot, 'existing.txt'), join(boundary.profilePath, 'probe-existing.txt'), join(boundary.profilePath, 'Temp', 'probe-existing.txt'), outside];
            hostPost = targets.map(target => ({ content: readFileSync(target, 'utf8'), forbiddenAbsent: !existsSync(join(resolve(target, '..'), 'forbidden-new.txt')) }));
            record({ case: 'post-exit-host-targets', hostPost });
            expect(hostPost).toEqual(['unchanged', 'host-seeded-unchanged', 'host-seeded-unchanged', 'outside-unchanged'].map(content => ({ content, forbiddenAbsent: true })));
            const postRead = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(aclCommand, 'utf16le').toString('base64')], { encoding: 'utf8', windowsHide: true, timeout: 3000 });
            record({ case: 'post-exit-host-acl-raw', status: postRead.status, stdout: postRead.stdout, stderr: postRead.stderr });
            expect(postRead.status).toBe(0); postAcl = JSON.parse(postRead.stdout); expect(postAcl).toEqual(acl);
            writeFileSync(join(boundary.taskRoot, 'host-inspection-complete'), 'complete');
          } catch (error) { seedError = error as Error; }
        }
        if (seeded || !field(out, 'CUE_MODEL_PID')) return; seeded = true;
        try {
          const boundary = JSON.parse(field(out, 'CUE_MODEL_BOUNDARY')!);
          const targets = [join(boundary.taskRoot, 'existing.txt'), join(boundary.profilePath, 'probe-existing.txt'), join(boundary.profilePath, 'Temp', 'probe-existing.txt')];
          for (const target of targets.slice(1)) writeFileSync(target, 'host-seeded-unchanged');
          const encoded = Buffer.from(JSON.stringify(targets)).toString('base64');
          const command = `$ErrorActionPreference='Stop'; $paths=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'))|ConvertFrom-Json; @($paths | ForEach-Object { $a=[IO.File]::GetAccessControl($_); @{exists=(Test-Path -LiteralPath $_);content=[IO.File]::ReadAllText($_);packageRules=@($a.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]) | ForEach-Object { $sid=$_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value; if ($sid -like 'S-1-15-*') { @{sid=$sid;rights=[int]$_.FileSystemRights;type=$_.AccessControlType.ToString()} } })} }) | ConvertTo-Json -Depth 5 -Compress`;
          aclCommand = command; const readback = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(command, 'utf16le').toString('base64')], { encoding: 'utf8', windowsHide: true, timeout: 5000 });
          record({ case: 'pre-host-acl-raw', status: readback.status, stdout: readback.stdout, stderr: readback.stderr });
          if (readback.status !== 0) throw Error('host_acl_readback_failed'); acl = JSON.parse(readback.stdout);
          writeFileSync(join(boundary.taskRoot, 'host-ready'), 'ready');
        } catch (error) { seedError = error as Error; }
      });
      record({ case: 'raw-launcher-result', result, seedError: seedError ? String(seedError) : null });
      await control(postNonce);
      record({ case: 'raw-tcp-controls', address: '127.0.0.1', port, preNonce, postNonce, childNonce, received: [...received] });
      expect(seedError).toBeNull(); expect(inspected).toBe(true); expect(result.err).toBe(''); expect(result.code, result.out).toBe(0);
      const probe = JSON.parse(Buffer.from(field(result.out, 'CUE_MODEL_RESPONSE')!, 'base64').toString());
      const observation = JSON.parse(field(result.out, 'CUE_MODEL_OBSERVATION')!);
      const boundary = JSON.parse(field(result.out, 'CUE_MODEL_BOUNDARY')!);
      expect(observation).toMatchObject({ status: 'observed', appContainer: true, appContainerSid: boundary.sid, capabilities: [], loopbackExempt: false, pid: probe.pid, job: { activeProcessLimit: 1, memberPids: [probe.pid] } });
      expect(observation.job.flags & 0x2008).toBe(0x2008); expect(observation.job.flags & 0x1800).toBe(0);
      expect(probe.pid).toBe(Number(field(result.out, 'CUE_MODEL_PID')));
      for (const name of ['work', 'profile', 'temp', 'outside']) {
        const file = probe.files[name];
        for (const operation of ['create', 'append', 'overwrite', 'delete']) expect(['EPERM', 'EACCES'], `${name}/${operation}`).toContain(file.operations[operation]);
        expect(file.after).toBe(file.before);
      }
      for (const item of acl as { exists: boolean; content: string; packageRules: { sid: string; rights: number; type: string }[] }[]) {
        expect(item.exists).toBe(true); const own = item.packageRules.find(rule => rule.sid === boundary.sid); expect(own).toBeDefined();
        expect(own!.type).toBe('Allow'); expect(own!.rights & 0x1200a9).toBe(0x1200a9);
        for (const rule of item.packageRules.filter(rule => rule.type === 'Allow')) expect(rule.rights & 0x0d0156).toBe(0);
      }
      expect(probe.network.connected).toBe(false); expect(probe.network.sent).toBe(false);
      expect(received).toEqual([preNonce, postNonce]); expect(readFileSync(outside, 'utf8')).toBe('outside-unchanged');
      expect(existsSync(join(root, 'forbidden-new.txt'))).toBe(false); assertClean(result.out);
      record({ case: 'M2-M3', probeSha256: hash(fixture), probe, tokenJobObservation: observation, hostAclReadback: acl,
        listener: { address: '127.0.0.1', port, hostPre: true, hostPost: true, childNonceReceived: received.includes(childNonce) },
        hostPostExitTargets: hostPost, hostPostExitAcl: postAcl, hostOutsideUnchanged: true, hostWorkSentinelCheckedByLauncher: true, cleanup: JSON.parse(field(result.out, 'CUE_MODEL_CLEANUP')!),
        limitation: 'Host target content snapshot follows child exit under bounded diagnostic hold. TCP timeout is not an OS denial errno or proof for every protocol.' });
    } catch (error) { record({ case: 'M2-M3-failure', message: String(error) }); throw error; } finally {
      for (const socket of sockets) socket.destroy(); await new Promise<void>(done => server.close(() => done()));
      rmSync(root, { recursive: true, force: true });
    }
  }, 40000);
});
