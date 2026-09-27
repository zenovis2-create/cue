import { measureModelControlBundle } from '../src/model-control-bundle.js';
import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

describe.skipIf(process.platform !== 'win32')('actual owned Job process-limit event', () => {
  it('correlates a native ACTIVE_PROCESS_LIMIT receipt to one controlled spawn without treating UNKNOWN as denial', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cue-limit-event-')), fixture = join(root, 'attempt.cjs');
    writeFileSync(fixture, `const cp=require('node:child_process');let finished=false;function finish(result){if(finished)return;finished=true;process.stdout.write(JSON.stringify({pid:process.pid,attempts:1,result})+'\\n',()=>process.exit(0))}try{const child=cp.spawn(process.execPath,['--no-addons','-e','process.stdout.write("UNEXPECTED_CHILD_MARKER")'],{stdio:['ignore',1,2]});child.on('error',e=>finish(e.code));child.on('spawn',()=>finish('SPAWNED'));setTimeout(()=>finish('TIMEOUT'),1000)}catch(e){finish(e.code)}`);
    const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
    async function run(probe: boolean) {
      const payload = { ...(!probe ? {controlBundle: measureModelControlBundle({controlRoot: resolve('src'),nodeExecutable: process.execPath,clientKind: 'model'})} : {}), nodeExecutable: process.execPath, nodeSha256: hash(process.execPath), parentPid: process.pid,
        request: JSON.stringify({ protocol: 'cue-model-client-v1', operation: 'ping' }), timeoutMs: 5000,
        ...(probe ? { probePath: fixture, probeSha256: hash(fixture) } : {}) };
      const child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', resolve('src/model-only-launch.ps1'),
        '-PayloadBase64', Buffer.from(JSON.stringify(payload)).toString('base64'), ...(probe ? ['-ProbeHarness'] : [])], { windowsHide: true });
      let out = '', err = ''; child.stdout.on('data', data => { out += data.toString(); }); child.stderr.on('data', data => { err += data.toString(); });
      const code = await new Promise<number | null>((done, reject) => { child.on('close', done); child.on('error', reject); });
      expect(err).toBe(''); expect(code, out).toBe(0);
      const field = (key: string) => out.split(/\r?\n/).find(line => line.startsWith(key + '='))!.slice(key.length + 1);
      const response = Buffer.from(field('CUE_MODEL_RESPONSE'), 'base64').toString();
      const boundary = JSON.parse(field('CUE_MODEL_BOUNDARY'));
      expect(existsSync(boundary.taskRoot)).toBe(false); expect(existsSync(boundary.profilePath)).toBe(false);
      return { out, response, limit: JSON.parse(field('CUE_MODEL_PROCESS_LIMIT')), observed: JSON.parse(field('CUE_MODEL_OBSERVATION')) };
    }
    try {
      const probe = await run(true), result = JSON.parse(probe.response);
      expect(result.attempts).toBe(1); expect(probe.response).not.toContain('UNEXPECTED_CHILD_MARKER');
      expect(probe.limit).toMatchObject({ status: 'observed', ownedWorkerPid: result.pid, activeProcessLimit: 1, eventCount: 1, messageId: 3, qualification: 'unknown' });
      expect(probe.limit.createdFileTime).toBe(probe.observed.createdFileTime); expect(probe.limit.ownedWorkerPid).toBe(probe.observed.pid);
      // Generic Node error remains raw data. It is not the success criterion above.
      expect(typeof result.result).toBe('string');
      const noAttempt = await run(false);
      expect(noAttempt.limit).toMatchObject({ status: 'unknown', eventCount: 0, qualification: 'unknown' });
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 30000);
});
