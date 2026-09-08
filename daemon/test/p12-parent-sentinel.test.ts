import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { resolveSealedExecutable } from '../src/process-launch.js';

const roots: string[] = [];
const children: ChildProcess[] = [];
const profiles: string[] = [];
const delay = (ms: number) => new Promise(resolveDelay => setTimeout(resolveDelay, ms));
const alive = (pid: number) => {
  const result = spawnSync('tasklist.exe', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true });
  return result.status === 0 && String(result.stdout).includes(`\"${pid}\"`);
};
const profileExists = (moniker: string) => {
  const registry = 'Registry::HKEY_CURRENT_USER\\Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\CurrentVersion\\AppContainer\\Mappings';
  const script = `$items=@(Get-ChildItem '${registry}' | Where-Object {(Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue).Moniker -eq '${moniker}'}); if($items.Count -gt 0){exit 0}else{exit 1}`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true });
  if (result.status !== 0 && result.status !== 1) throw new Error('AppContainer profile query failed');
  return result.status === 0;
};
function quoteWindowsArg(value: string): string {
  if (!/[\s"]/u.test(value)) return value;
  return `"${value.replace(/(\\*)"/gu, '$1$1\\"').replace(/(\\+)$/u, '$1$1')}"`;
}
afterEach(() => {
  for (const child of children.splice(0)) if (child.pid && alive(child.pid)) spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true });
  for (const profile of profiles.splice(0)) {
    const source = "using System.Runtime.InteropServices; public static class CueProfileCleanup { [DllImport(\"userenv.dll\", CharSet=CharSet.Unicode)] public static extern int DeleteAppContainerProfile(string name); }";
    spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Add-Type -TypeDefinition '${source}'; [CueProfileCleanup]::DeleteAppContainerProfile('${profile}') | Out-Null`], { windowsHide: true });
  }
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
});

describe.skipIf(process.platform !== 'win32')('P12 AppContainer parent sentinel', () => {
  it('terminates the worker when the monitored sentinel dies while the launcher parent remains alive', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cue-p12-parent-sentinel-'));
    roots.push(root);
    const profile = `Cue.Worker.${randomUUID().replaceAll('-', '')}`;
    profiles.push(profile);
    const launcherPath = join(root, 'appcontainer-launch.ps1');
    writeFileSync(launcherPath, readFileSync(resolve('src/appcontainer-launch.ps1'), 'utf8'));
    const sentinel = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { stdio: 'ignore', windowsHide: true });
    children.push(sentinel);
    const powershell = resolveSealedExecutable('powershell.exe', [root]);
    const args = ['-NoProfile', '-NonInteractive', '-Command', 'Start-Sleep -Seconds 120'];
    const payload = Buffer.from(JSON.stringify({
      executable: powershell,
      commandLine: [powershell, ...args].map(quoteWindowsArg).join(' '),
      cwd: root,
      parentPid: sentinel.pid,
      profileName: profile,
    })).toString('base64');
    const launcher = spawn(powershell, ['-NoProfile', '-NonInteractive', '-File', launcherPath, '-PayloadBase64', payload], {
      cwd: root,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.push(launcher);
    let stdout = '';
    launcher.stdout!.on('data', chunk => { stdout += chunk.toString(); });
    const deadline = Date.now() + 15_000;
    let workerPid = 0;
    while (!workerPid && Date.now() < deadline) {
      workerPid = Number(/CUE_APPCONTAINER_PID=(\d+)/u.exec(stdout)?.[1] ?? 0);
      if (!workerPid) await delay(50);
    }
    expect(workerPid, stdout).toBeGreaterThan(0);
    expect(alive(workerPid)).toBe(true);
    expect(profileExists(profile)).toBe(true);

    const launcherClosed = once(launcher, 'close');
    expect(spawnSync('taskkill.exe', ['/PID', String(sentinel.pid), '/F'], { windowsHide: true }).status).toBe(0);
    await Promise.race([launcherClosed, delay(7_000).then(() => { throw new Error('launcher ignored sentinel death'); })]);
    const stopped = Date.now() + 5_000;
    while (alive(workerPid) && Date.now() < stopped) await delay(50);
    expect(alive(workerPid)).toBe(false);
    const profileCleanupDeadline = Date.now() + 5_000;
    while (profileExists(profile) && Date.now() < profileCleanupDeadline) await delay(50);
    expect(profileExists(profile)).toBe(false);
  }, 30_000);
});
