import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

describe.skipIf(process.platform !== 'win32')('owned suspended client native observations', () => {
  it('correlates actual token/Job/exemption readback to controlled client PID and denied profile write', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cue-observation-')), fixture = join(root, 'observe.cjs');
    writeFileSync(fixture, `const fs=require('node:fs'),path=require('node:path');let outcome;try{fs.writeFileSync(path.join(process.env.USERPROFILE,'forbidden.txt'),'bad');outcome='ALLOWED'}catch(e){outcome=e.code}process.stdout.end(JSON.stringify({pid:process.pid,profileWrite:outcome})+'\\n');`);
    const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
    const payload = { nodeExecutable: process.execPath, nodeSha256: hash(process.execPath), parentPid: process.pid, request: '{}', timeoutMs: 5000, probePath: fixture, probeSha256: hash(fixture) };
    try {
      const child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', resolve('src/model-only-launch.ps1'),
        '-PayloadBase64', Buffer.from(JSON.stringify(payload)).toString('base64'), '-ProbeHarness'], { windowsHide: true });
      let out = '', err = ''; child.stdout.on('data', bytes => { out += bytes.toString(); }); child.stderr.on('data', bytes => { err += bytes.toString(); });
      const code = await new Promise<number | null>((done, reject) => { child.on('close', done); child.on('error', reject); });
      expect(err).toBe(''); expect(code, out).toBe(0);
      const field = (key: string) => out.split(/\r?\n/).find(line => line.startsWith(key + '='))!.slice(key.length + 1);
      const observed = JSON.parse(field('CUE_MODEL_OBSERVATION')), boundary = JSON.parse(field('CUE_MODEL_BOUNDARY'));
      const controlled = JSON.parse(Buffer.from(field('CUE_MODEL_RESPONSE'), 'base64').toString());
      expect(observed).toMatchObject({ status: 'observed', phase: 'suspended-before-resume', appContainer: true, appContainerSid: boundary.sid,
        capabilities: [], job: { activeProcessLimit: 1, memberPids: [controlled.pid] }, loopbackExempt: false, qualification: 'unknown' });
      expect(observed.pid).toBe(controlled.pid); expect(observed.pid).toBe(Number(field('CUE_MODEL_PID')));
      expect(observed.createdFileTime).toMatch(/^[1-9][0-9]{16,18}$/);
      expect(observed.job.flags & 0x2008).toBe(0x2008); expect(observed.job.flags & 0x1800).toBe(0);
      expect(controlled.profileWrite).toBe('EPERM');
      expect(out.indexOf('CUE_MODEL_OBSERVATION=')).toBeLessThan(out.indexOf('CUE_MODEL_PID='));
      expect(existsSync(boundary.taskRoot)).toBe(false); expect(existsSync(boundary.profilePath)).toBe(false);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 20000);
});
