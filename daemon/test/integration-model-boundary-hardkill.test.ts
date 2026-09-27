import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';

function alive(pid: number) { try { process.kill(pid, 0); return true; } catch { return false; } }
const delay = (ms: number) => new Promise(done => setTimeout(done, ms));
function field(out: string, name: string) { return out.split(/\r?\n/).find(line => line.startsWith(name + '='))?.slice(name.length + 1); }
describe.skipIf(process.platform !== 'win32')('actual model client launcher hard-kill guardian', () => {
  it('drains actual owned Job before removing profile/root and exits without orphan guardian', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cue-hardkill-fixture-')), fixture = join(root, 'hold.cjs');
    writeFileSync(fixture, 'process.stdin.resume();setInterval(()=>{},1000);');
    const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
    const payload = { nodeExecutable: process.execPath, nodeSha256: hash(process.execPath), parentPid: process.pid,
      request: '{}', timeoutMs: 30000, probePath: fixture, probeSha256: hash(fixture) };
    const launcher = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File',
      resolve('src/model-only-launch.ps1'), '-PayloadBase64', Buffer.from(JSON.stringify(payload)).toString('base64'), '-ProbeHarness'], { windowsHide: true });
    let out = '', err = ''; launcher.stdout.on('data', bytes => { out += bytes.toString(); }); launcher.stderr.on('data', bytes => { err += bytes.toString(); });
    const done = new Promise<void>(resolveDone => launcher.on('close', () => resolveDone()));
    try {
      const deadline = Date.now() + 15000;
      while (!field(out, 'CUE_MODEL_PID') && launcher.exitCode === null && Date.now() < deadline) await delay(50);
      expect(err).toBe(''); expect(field(out, 'CUE_MODEL_PID'), out).toBeDefined();
      const clientPid = Number(field(out, 'CUE_MODEL_PID')), guardianPid = Number(field(out, 'CUE_MODEL_GUARDIAN_PID'));
      const boundary = JSON.parse(field(out, 'CUE_MODEL_BOUNDARY')!);
      expect(alive(clientPid)).toBe(true); expect(alive(guardianPid)).toBe(true);
      expect(existsSync(boundary.taskRoot)).toBe(true); expect(existsSync(boundary.profilePath)).toBe(true);
      // Windows Node kill is TerminateProcess: launcher finally cannot execute.
      expect(launcher.kill()).toBe(true); await done;
      expect(field(out, 'CUE_MODEL_CLEANUP')).toBeUndefined();
      const cleanupDeadline = Date.now() + 10000;
      while ((alive(clientPid) || alive(guardianPid) || existsSync(boundary.taskRoot) || existsSync(boundary.profilePath)) && Date.now() < cleanupDeadline) await delay(50);
      expect(alive(clientPid)).toBe(false); expect(alive(guardianPid)).toBe(false);
      expect(existsSync(boundary.taskRoot)).toBe(false); expect(existsSync(boundary.profilePath)).toBe(false);
    } finally { launcher.kill(); await done; rmSync(root, { recursive: true, force: true }); }
  }, 35000);
});
