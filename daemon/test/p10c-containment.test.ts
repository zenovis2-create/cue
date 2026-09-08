import { afterEach, describe, expect, it } from 'vitest';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { openLedger } from '../src/ledger.js';
import { ownDaemonWorktree } from '../src/daemon-ownership.js';
import { normalizeEnvelope, type Envelope } from '../src/envelope.js';
import { createCleanCodexHome } from '../src/tool-home.js';
import { launchHostCodexRun } from '../src/host-codex-runtime.js';

const roots: string[] = [];
function temp(): string { const root = mkdtempSync(join(tmpdir(), 'cue-p10c-containment-')); roots.push(root); return root; }
afterEach(() => { while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }); });

function processAlive(pid: number): boolean {
  const result = spawnSync('tasklist.exe', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8' });
  return result.status === 0 && String(result.stdout).includes(`\"${pid}\"`);
}

type ProcessIdentity = { ProcessId: number; ParentProcessId: number; created: string };
function processIdentity(pid: number): ProcessIdentity | null {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `$ErrorActionPreference='Stop'; Get-CimInstance Win32_Process -Filter "ProcessId=${pid}" -ErrorAction Stop | Select-Object ProcessId,ParentProcessId,@{n='created';e={$_.CreationDate.ToUniversalTime().ToString('o')}} | ConvertTo-Json -Compress`], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error('FAIL: containment process identity query failed');
  return result.stdout.trim() ? JSON.parse(result.stdout) as ProcessIdentity : null;
}

function sameProcessInstance(before: ProcessIdentity | null, after: ProcessIdentity | null): boolean {
  return before !== null && after !== null
    && before.ProcessId === after.ProcessId
    && before.ParentProcessId === after.ParentProcessId
    && before.created === after.created;
}

function cueWorkerProfileCount(): number {
  const registry = 'Registry::HKEY_CURRENT_USER\\Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\CurrentVersion\\AppContainer\\Mappings';
  const script = `$items=@(Get-ChildItem '${registry}' | Where-Object {(Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue).Moniker -like 'Cue.Worker.*'}); Write-Output $items.Count`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error('AppContainer profile count query failed');
  return Number(result.stdout.trim());
}

function fakeControllerSource(marker: string, pidPath: string): string {
  return String.raw`
const {spawn}=require('node:child_process');
const readline=require('node:readline');const rl=readline.createInterface({input:process.stdin});const send=x=>process.stdout.write(JSON.stringify(x)+'\n');
const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',"$cueMarker='${marker}'; Start-Sleep -Seconds 120"],{stdio:'ignore',windowsHide:true});require('node:fs').writeFileSync(${JSON.stringify(pidPath)},String(child.pid));
rl.on('line',line=>{const m=JSON.parse(line);if(m.method==='initialize')send({id:m.id,result:{}});else if(m.method==='thread/start')send({id:m.id,result:{thread:{id:'thread-job'}}});else if(m.method==='turn/start')send({id:m.id,result:{turn:{id:'turn-job'}}});});`;
}

function workerHarnessSource(daemonRoot: string, worktree: string, ledgerPath: string, pidPath: string): string {
  return `
import { pathToFileURL } from 'node:url';
const root=${JSON.stringify(daemonRoot)};
const {openLedger}=await import(pathToFileURL(root+'/dist/src/ledger.js').href);
const {normalizeEnvelope}=await import(pathToFileURL(root+'/dist/src/envelope.js').href);
const {launchAppContainerWorker}=await import(pathToFileURL(root+'/dist/src/worker-enforcement.js').href);
const {writeFileSync}=await import('node:fs');
const db=openLedger(${JSON.stringify(ledgerPath)});const now=new Date().toISOString();
db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('task-parent-death','running',null,now);
db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run('envelope-parent-death',${JSON.stringify(worktree)},'[]',now);
db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('run-parent-death','task-parent-death','envelope-parent-death',1,now);
const envelope=normalizeEnvelope({run_id:'run-parent-death',worktree_realpath:${JSON.stringify(worktree)},egress:[],expires_at:'2099-01-01T00:00:00Z',autonomy_level:'bounded',allowed_actions:['command','file_change']});
const worker=launchAppContainerWorker(db,envelope,{cwd:${JSON.stringify(worktree)},task_id:'task-parent-death',run_id:'run-parent-death'},{executable:'powershell.exe',args:['-NoProfile','-NonInteractive','-Command',"$cueMarker='cue-worker-parent-death'; Start-Sleep -Seconds 120"],cwd:${JSON.stringify(worktree)},timeoutMs:125000});
const timer=setInterval(()=>{if(worker.session.pid!==worker.child.pid){clearInterval(timer);writeFileSync(${JSON.stringify(pidPath)},JSON.stringify({wrapperPid:worker.child.pid,workerPid:worker.session.pid}));}},25);
setInterval(()=>{},1000);
`;
}

describe.skipIf(process.platform !== 'win32')('Phase 10-C process containment', () => {
  it('binds the AppContainer job lifetime to the daemon process handle', () => {
    const launcher = readFileSync(join(process.cwd(), 'src', 'appcontainer-launch.ps1'), 'utf8');
    const worker = readFileSync(join(process.cwd(), 'src', 'worker-enforcement.ts'), 'utf8');
    expect(worker).toContain('parentPid: process.pid');
    expect(launcher).toContain('OpenProcess');
    expect(launcher).toContain('WaitForMultipleObjects');
    expect(launcher).toContain('TerminateJobObject');
  });

  it('kills the host controller descendant when the owned controller root is hard-killed', async () => {
    const marker = 'cue-host-job-child';
    const root = temp(); const worktree = join(root, 'worktree'); const sourceHome = join(root, 'source-home'); const vendorDir = join(root, 'vendor');
    mkdirSync(worktree); mkdirSync(sourceHome); mkdirSync(vendorDir); writeFileSync(join(sourceHome, 'auth.json'), 'credential-placeholder');
    const codexHome = createCleanCodexHome(join(root, 'homes'), join(sourceHome, 'auth.json'));
    const binary = join(vendorDir, 'codex.exe'); copyFileSync(process.execPath, binary);
    const childPidPath = join(worktree, 'host-child.pid');
    const server = join(worktree, 'host-job-controller.cjs'); writeFileSync(server, fakeControllerSource(marker, childPidPath));
    const db = openLedger(); const now = new Date().toISOString();
    db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('task-host-job', 'running', null, now);
    db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run('envelope-host-job', worktree, '[]', now);
    db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('run-host-job', 'task-host-job', 'envelope-host-job', 1, now);
    const envelope = normalizeEnvelope({ run_id: 'run-host-job', worktree_realpath: worktree, egress: [], expires_at: '2099-01-01T00:00:00Z', autonomy_level: 'bounded', allowed_actions: ['command', 'file_change'] } satisfies Envelope);
    const running = launchHostCodexRun(db, { cwd: worktree, task_id: 'task-host-job', run_id: 'run-host-job' }, envelope, {
      binary, codexHome, goal: 'host job containment', controllerArgs: [server], requestTimeoutMs: 10_000, runTimeoutMs: 10_000,
    });
    const childDeadline = Date.now() + 5_000;
    while (!existsSync(childPidPath) && Date.now() < childDeadline) await new Promise(resolve => setTimeout(resolve, 50));
    expect(existsSync(childPidPath)).toBe(true);
    const childPid = Number(readFileSync(childPidPath, 'utf8'));
    expect(processAlive(childPid)).toBe(true);
    const wrapperPid = running.child.pid!;
    const identityDeadline = Date.now() + 5_000;
    while (running.session.pid === wrapperPid && Date.now() < identityDeadline) await new Promise(resolve => setTimeout(resolve, 50));
    expect(running.session.pid).not.toBe(wrapperPid);
    const killedAt = Date.now();
    spawnSync('taskkill.exe', ['/PID', String(wrapperPid), '/F']);
    await running.done;
    expect(Date.now() - killedAt).toBeLessThan(5_000);
    const deadline = Date.now() + 5_000;
    while (processAlive(childPid) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
    const orphanAlive = processAlive(childPid);
    if (orphanAlive) spawnSync('taskkill.exe', ['/PID', String(childPid), '/T', '/F']);
    db.close();
    expect(orphanAlive).toBe(false);
  }, 30_000);

  it('kills the capability-zero worker job when its daemon parent is hard-killed', async () => {
    const profilesBefore = cueWorkerProfileCount();
    const root = temp(); const worktree = join(root, 'worktree'); mkdirSync(worktree);
    const ledgerPath = join(root, 'worker-ledger.sqlite'); const pidPath = join(root, 'worker-pids.json');
    const harness = join(root, 'worker-parent.mjs');
    writeFileSync(harness, workerHarnessSource(process.cwd().replace(/\\/g, '/'), worktree, ledgerPath, pidPath));
    const { spawn } = await import('node:child_process');
    const parent = spawn(process.execPath, [harness], { stdio: 'ignore', windowsHide: true });
    const deadline = Date.now() + 15_000;
    while (!existsSync(pidPath) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
    expect(existsSync(pidPath)).toBe(true);
    const pids = JSON.parse(readFileSync(pidPath, 'utf8')) as { wrapperPid: number; workerPid: number };
    expect(processAlive(pids.wrapperPid)).toBe(true);
    expect(processAlive(pids.workerPid)).toBe(true);
    const wrapperIdentityBefore = processIdentity(pids.wrapperPid);
    const workerIdentityBefore = processIdentity(pids.workerPid);
    const killedAt = Date.now();
    const killed = spawnSync('taskkill.exe', ['/PID', String(parent.pid), '/F']);
    expect(killed.status).toBe(0);
    const stopped = Date.now() + 5_000;
    while ((processAlive(pids.wrapperPid) || processAlive(pids.workerPid)) && Date.now() < stopped) await new Promise(resolve => setTimeout(resolve, 50));
    const terminationObservedAt = Date.now();
    const wrapperAlive = processAlive(pids.wrapperPid); const workerAlive = processAlive(pids.workerPid);
    const wrapperIdentityAfter = processIdentity(pids.wrapperPid);
    const workerIdentityAfter = processIdentity(pids.workerPid);
    const originalWrapperAlive = sameProcessInstance(wrapperIdentityBefore, wrapperIdentityAfter);
    const originalWorkerAlive = sameProcessInstance(workerIdentityBefore, workerIdentityAfter);
    console.log('P12_PARENT_DEATH_IDENTITY', JSON.stringify({
      parentPid: parent.pid, ...pids, terminationLatencyMs: terminationObservedAt - killedAt,
      wrapperAlive, workerAlive, originalWrapperAlive, originalWorkerAlive,
      wrapperIdentityBefore, wrapperIdentityAfter, workerIdentityBefore, workerIdentityAfter,
    }));
    if (originalWrapperAlive) spawnSync('taskkill.exe', ['/PID', String(pids.wrapperPid), '/T', '/F']);
    if (originalWorkerAlive) spawnSync('taskkill.exe', ['/PID', String(pids.workerPid), '/T', '/F']);
    expect(originalWrapperAlive).toBe(false);
    expect(originalWorkerAlive).toBe(false);
    const recovered = openLedger(ledgerPath);
    const releaseOwnership = ownDaemonWorktree(worktree, ledgerPath, recovered);
    try {
      expect(recovered.prepare("SELECT count(*) AS n FROM artifact WHERE kind='appcontainer_profile_pending'").get()).toEqual({ n: 0 });
      const profileCleanupDeadline = Date.now() + 15_000;
      while (cueWorkerProfileCount() !== profilesBefore && Date.now() < profileCleanupDeadline) await new Promise(resolve => setTimeout(resolve, 50));
      expect(cueWorkerProfileCount()).toBe(profilesBefore);
    } finally {
      releaseOwnership();
      recovered.close();
    }
  }, 90_000);
});
