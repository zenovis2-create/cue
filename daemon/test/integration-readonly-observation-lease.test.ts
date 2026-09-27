import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { runProcessSync } from '../src/process-launch.js';

const root = mkdtempSync(join(tmpdir(), 'cue-observation-lease-'));
afterAll(() => {
  const base = `${resolve(tmpdir())}\\`;
  const target = resolve(root);
  if (!target.startsWith(base) || !target.slice(base.length).startsWith('cue-observation-lease-')) throw new Error('unsafe observation lease fixture cleanup');
  rmSync(target, { recursive: true, force: true });
});
const launcher = readFileSync(resolve('src/readonly-verifier-launch.ps1'), 'utf8');
const match = launcher.match(/Add-Type -TypeDefinition @'\r?\n([\s\S]*?)\r?\n'@/);
if (!match) throw new Error('embedded launcher source missing');

const harness = String.raw`
public sealed class FakeLease : ICueObservationLease {
 public bool ready=true,death=true,throwReady,throwDeath,throwDispose;public int readyCalls,deathCalls,disposeCalls;
 public bool Ready(){readyCalls++;if(throwReady)throw new Exception("ready");return ready;}
 public bool ObserveProcessDeath(IntPtr process){deathCalls++;if(process!=(IntPtr)7)throw new Exception("handle");if(throwDeath)throw new Exception("death");return death;}
 public void Dispose(){disposeCalls++;if(throwDispose)throw new Exception("dispose");}
}
public static class LeaseHarness {
 public static string Run(string mode){var l=new FakeLease();if(mode=="refuse")l.ready=false;if(mode=="unknown")l.death=false;if(mode=="deaththrow")l.throwDeath=true;if(mode=="disposethrow")l.throwDispose=true;var o=new CueObservationLeaseOwner(l,(IntPtr)7,(IntPtr)8);bool ready=false,released=false;try{ready=o.Ready();}catch{}if(mode=="quarantine")released=o.Quarantine();else released=o.ReleaseAfterObservedDeath();bool repeated=o.ReleaseAfterObservedDeath();return ready+"|"+released+"|"+repeated+"|"+l.readyCalls+"|"+l.deathCalls+"|"+l.disposeCalls;}
 public static string Boundary(string mode){var l=new FakeLease();if(mode=="refuse")l.ready=false;if(mode=="readythrow")l.throwReady=true;var o=new CueObservationLeaseOwner(l,(IntPtr)7,(IntPtr)8);int resumes=0,terminates=0;string outcome="ok";try{o.PrepareAndResume(()=>{resumes++;return mode=="resumefail"?0xffffffffu:0u;},()=>{terminates++;if(mode=="termfail")throw new Exception("terminate");},()=>5);}catch(Exception e){outcome=e.GetType().Name;}if(mode=="normal")o.MarkDeathObserved();bool finished=o.Finish(()=>{terminates++;if(mode=="finishfail"||mode=="termfail")throw new Exception("terminate");});return outcome+"|"+finished+"|"+resumes+"|"+terminates+"|"+l.deathCalls+"|"+l.disposeCalls;}
 public static string Acquire(string mode){int terminates=0;try{CueObservationLeaseOwner.Acquire((p,j)=>{throw new Exception("provider");},(IntPtr)7,(IntPtr)8,()=>{terminates++;if(mode=="stopfail")throw new Exception("stop");});return "unexpected";}catch(CueObservationAcquireException e){return e.DeathObserved+"|"+terminates;}}
 public static int PendingReturn(string mode){var l=new FakeLease();if(mode=="unknown")l.death=false;if(mode=="deaththrow")l.throwDeath=true;if(mode=="disposethrow")l.throwDispose=true;var o=new CueObservationLeaseOwner(l,(IntPtr)7,(IntPtr)8);try{return 0;}finally{CueAppContainer.FinalizeObservationOrThrow(o,true,()=>{});}}
 public static string Fallback(bool attempted){int calls=0;bool dead=CueAppContainer.ObserveFallbackTermination(true,false,attempted,false,()=>{calls++;throw new Exception("stop");});return dead+"|"+calls;}
 public static string CleanupAfterFailure(){int cleanup=0;try{CueAppContainer.RunFinalizationAndCleanup(()=>{throw new InvalidOperationException("finalize");},()=>{cleanup++;});return "unexpected";}catch(Exception e){return e.GetType().Name+"|"+cleanup;}}
 public static string NestedCleanup(bool fail){int cleanup=0;try{CueAppContainer.RunFinalizationAndCleanup(()=>{if(fail)throw new InvalidOperationException("finalize");},()=>{cleanup++;});return "return:0|"+cleanup;}catch(Exception e){return "throw:"+e.GetType().Name+"|"+cleanup;}}
}`;

function run(mode: string) {
  const source = `${match![1]}\n${harness}`;
  const encoded = Buffer.from(source, 'utf16le').toString('base64');
  const path = join(root, `${mode}.ps1`);
  writeFileSync(path, `$s=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encoded}'));Add-Type -TypeDefinition $s;[LeaseHarness]::Run('${mode}')`, 'utf8');
  const result = runProcessSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path], { encoding: 'utf8', windowsHide: true, timeout: 20_000, maxBuffer: 65_536 });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}
function boundary(mode: string) {
  const source = `${match![1]}\n${harness}`;
  const encoded = Buffer.from(source, 'utf16le').toString('base64');
  const path = join(root, `boundary-${mode}.ps1`);
  writeFileSync(path, `$s=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encoded}'));Add-Type -TypeDefinition $s;[LeaseHarness]::Boundary('${mode}')`, 'utf8');
  const result = runProcessSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path], { encoding: 'utf8', windowsHide: true, timeout: 20_000, maxBuffer: 65_536 });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}
function acquire(mode: string) {
  const source = `${match![1]}\n${harness}`;
  const encoded = Buffer.from(source, 'utf16le').toString('base64');
  const path = join(root, `acquire-${mode}.ps1`);
  writeFileSync(path, `$s=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encoded}'));Add-Type -TypeDefinition $s;[LeaseHarness]::Acquire('${mode}')`, 'utf8');
  const result = runProcessSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path], { encoding: 'utf8', windowsHide: true, timeout: 20_000, maxBuffer: 65_536 });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}
function pendingReturn(mode: string) {
  const source = `${match![1]}\n${harness}`;
  const encoded = Buffer.from(source, 'utf16le').toString('base64');
  const path = join(root, `pending-${mode}.ps1`);
  writeFileSync(path, `$s=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encoded}'));Add-Type -TypeDefinition $s;try{$v=[LeaseHarness]::PendingReturn('${mode}');'return:'+ $v}catch{'throw:'+ $_.Exception.GetBaseException().GetType().Name}`, 'utf8');
  const result = runProcessSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path], { encoding: 'utf8', windowsHide: true, timeout: 20_000, maxBuffer: 65_536 });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}
function fallback(attempted: boolean) {
  const source = `${match![1]}\n${harness}`;
  const encoded = Buffer.from(source, 'utf16le').toString('base64');
  const path = join(root, `fallback-${attempted}.ps1`);
  writeFileSync(path, `$s=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encoded}'));Add-Type -TypeDefinition $s;[LeaseHarness]::Fallback($${attempted})`, 'utf8');
  const result = runProcessSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path], { encoding: 'utf8', windowsHide: true, timeout: 20_000, maxBuffer: 65_536 });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}
function cleanupAfterFailure() {
  const source = `${match![1]}\n${harness}`;
  const encoded = Buffer.from(source, 'utf16le').toString('base64');
  const path = join(root, 'cleanup-after-failure.ps1');
  writeFileSync(path, `$s=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encoded}'));Add-Type -TypeDefinition $s;[LeaseHarness]::CleanupAfterFailure()`, 'utf8');
  const result = runProcessSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path], { encoding: 'utf8', windowsHide: true, timeout: 20_000, maxBuffer: 65_536 });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}
function nestedCleanup(fail: boolean) {
  const source = `${match![1]}\n${harness}`;
  const encoded = Buffer.from(source, 'utf16le').toString('base64');
  const path = join(root, `nested-cleanup-${fail}.ps1`);
  writeFileSync(path, `$s=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encoded}'));Add-Type -TypeDefinition $s;[LeaseHarness]::NestedCleanup($${fail})`, 'utf8');
  const result = runProcessSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path], { encoding: 'utf8', windowsHide: true, timeout: 20_000, maxBuffer: 65_536 });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}

describe('read-only launcher observation lease', () => {
  it('releases only after the lease independently observes the exact process handle dead', () => {
    expect(run('success')).toBe('True|True|True|1|1|1');
    expect(run('unknown')).toBe('True|False|False|1|1|0');
    expect(run('deaththrow')).toBe('True|False|False|1|1|0');
    expect(run('disposethrow')).toBe('True|False|False|1|1|1');
    expect(run('quarantine')).toBe('True|False|False|1|0|0');
  });

  it('places acquisition after job assignment and parent opening but before resume', () => {
    const assigned = launcher.indexOf('processAssigned = true;');
    const parent = launcher.indexOf('parent = OpenProcess', assigned);
    const acquire = launcher.indexOf('CueObservationLeaseOwner.Acquire(observationProvider,process.hProcess,job', parent);
    const resume = launcher.indexOf('ResumeThread(process.hThread)', acquire);
    expect(assigned).toBeGreaterThan(0);
    expect(parent).toBeGreaterThan(assigned);
    expect(acquire).toBeGreaterThan(parent);
    expect(resume).toBeGreaterThan(acquire);
  });

  it('executes the production pre-resume owner for refusal, throw, and resume failure', () => {
    expect(boundary('refuse')).toBe('InvalidOperationException|True|0|1|1|1');
    expect(boundary('readythrow')).toBe('Exception|True|0|1|1|1');
    expect(boundary('resumefail')).toBe('Win32Exception|True|1|1|1|1');
    expect(boundary('termfail')).toBe('ok|False|1|1|0|0');
  });

  it('retains through terminal handling and releases only after observed death', () => {
    expect(boundary('normal')).toBe('ok|True|1|0|1|1');
    expect(boundary('error')).toBe('ok|True|1|1|1|1');
    expect(boundary('finishfail')).toBe('ok|False|1|1|0|0');
  });

  it('terminates and verifies a suspended process when provider acquisition throws', () => {
    expect(acquire('success')).toBe('True|1');
    expect(acquire('stopfail')).toBe('False|1');
  });

  it('overrides a pending successful worker return when finalization is unverified', () => {
    expect(pendingReturn('success')).toBe('return:0');
    expect(pendingReturn('unknown')).toBe('throw:InvalidOperationException');
    expect(pendingReturn('deaththrow')).toBe('throw:InvalidOperationException');
    expect(pendingReturn('disposethrow')).toBe('throw:InvalidOperationException');
  });

  it('never repeats a default-path termination already attempted by a terminal branch', () => {
    expect(fallback(true)).toBe('False|0');
    expect(fallback(false)).toBe('False|1');
  });

  it('runs independent cleanup before propagating finalization failure', () => {
    expect(cleanupAfterFailure()).toBe('InvalidOperationException|1');
    expect(nestedCleanup(false)).toBe('return:0|1');
    expect(nestedCleanup(true)).toBe('throw:InvalidOperationException|1');
  });

  it('keeps the default PowerShell launch call free of an observation input', () => {
    expect(launcher).toContain('return LaunchCore(app,commandLine,cwd,sid,parentPid,environment,timeoutMs,cancelMarker,null);');
    expect(launcher).not.toMatch(/\$payload\.(observation|lease)/i);
  });
});
