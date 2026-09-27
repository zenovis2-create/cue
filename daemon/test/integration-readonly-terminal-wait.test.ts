import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterAll, describe, expect, it } from 'vitest';

const root = mkdtempSync(join(tmpdir(), 'cue-terminal-wait-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

const launcher = readFileSync(resolve('src/readonly-verifier-launch.ps1'), 'utf8');
const match = launcher.match(/Add-Type -TypeDefinition @'\r?\n([\s\S]*?)\r?\n'@/);
if (!match) throw new Error('embedded CueAppContainer source missing');
const embeddedSource = match[1];

const harness = String.raw`
public static class CueTerminalWaitHarness {
  public static string Run(string mode) {
    int terminateCalls=0, waitCalls=0;
    CueAppContainer.TerminateJobCall terminate=(job,code)=>{terminateCalls++;return mode!="refuse";};
    CueAppContainer.WaitProcessCall wait=(process,milliseconds)=>{waitCalls++;if(milliseconds!=5000)throw new Exception("wrong wait");return mode=="timeout"?0x102u:mode=="failed"?0xffffffffu:mode=="unexpected"?7u:0u;};
    CueAppContainer.LastErrorCall error=()=>5;
    string outcome="success";
    try { CueAppContainer.TerminateAndObserveProcess((IntPtr)1,(IntPtr)2,116,terminate,wait,error); }
    catch(Exception ex) { outcome=ex.GetType().Name; }
    return outcome+":"+terminateCalls+":"+waitCalls;
  }
}`;

function run(mode: string): string {
  const scriptPath = join(root, `${mode}.ps1`);
  const encoded = Buffer.from(`${embeddedSource}\n${harness}`, 'utf16le').toString('base64');
  writeFileSync(scriptPath, `$src=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encoded}'));Add-Type -TypeDefinition $src;[CueTerminalWaitHarness]::Run('${mode}')`, 'utf8');
  const result = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], { encoding: 'utf8', windowsHide: true, timeout: 20_000 });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}

describe('read-only launcher terminal observation helper', () => {
  it.each([
    ['success', 'success:1:1'],
    ['refuse', 'Win32Exception:1:0'],
    ['timeout', 'TimeoutException:1:1'],
    ['failed', 'Win32Exception:1:1'],
    ['unexpected', 'InvalidOperationException:1:1'],
  ])('%s is fail-closed unless the process handle signals', (mode, expected) => expect(run(mode)).toBe(expected));

  it('routes timeout, cancellation, and parent death through the shared observed-wait helper', () => {
    expect(launcher.match(/TerminateAndObserveProcess\(job,process\.hProcess,11[67]\);return 12[45];/g)).toHaveLength(2);
    expect(launcher).toContain('TerminateAndObserveProcess(job, process.hProcess, 114);');
    expect(launcher).not.toMatch(/WaitForSingleObject\(process\.hProcess,5000\);return 12[45]/);
  });
});
