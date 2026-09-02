import { afterEach, describe, expect, it } from 'vitest';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative, resolve } from 'node:path';
import { once } from 'node:events';
import { openLedger } from '../src/ledger.js';
import { spawnVendorCodexInAppContainer } from '../src/codex-session.js';
import { Dispatcher } from '../src/dispatch.js';
import { WorkspaceLeases } from '../src/workspace-lease.js';

const roots:string[]=[];
const temp=(prefix:string):string=>{ mkdirSync(resolve('.test-state'),{recursive:true}); const root=mkdtempSync(resolve(`.test-state/${prefix}`)); roots.push(root); return root; };
afterEach(()=>{ for (const root of roots.splice(0)) rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:200}); });
const now='2026-09-03T00:00:00.000Z';

function sourceFiles(root=resolve('src')):string[] {
  const files:string[]=[];
  for (const entry of readdirSync(root,{withFileTypes:true})) {
    const path=join(root,entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(path)); else if (entry.name.endsWith('.ts')) files.push(path);
  }
  return files;
}

function architectureViolations():string[] {
  const allowed=resolve('src/process-launch.ts'), violations:string[]=[];
  for (const path of sourceFiles()) {
    const source=readFileSync(path,'utf8'), name=relative(resolve('.'),path).replaceAll('\\','/');
    if (path!==allowed && /(?:import|require\s*\()[^\n]*node:child_process/u.test(source) && /\b(?:spawn|spawnSync|exec|execSync|execFile|execFileSync|fork)\b/u.test(source)) violations.push(`${name}: direct child_process use`);
    for (const match of source.matchAll(/export\s+function\s+((?:spawn|launch)\w*)\s*\(([^)]*)\)/gu)) {
      if (!/\bdb\s*:\s*Ledger\b/u.test(match[2]) || !/\bowner\s*:\s*SessionOwner\b/u.test(match[2])) violations.push(`${name}: unowned export ${match[1]}`);
    }
  }
  return violations;
}

function seedPair() {
  const db=openLedger();
  for (const id of ['1','2']) {
    db.prepare('INSERT INTO task VALUES(?,?,?,?)').run(`t${id}`,'running',null,now);
    db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(`e${id}`,'C:/work','[]',now);
    db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run(`r${id}`,`t${id}`,`e${id}`,0,now);
  }
  return db;
}

async function waitFor(path:string):Promise<void> {
  for (let i=0;i<100&&!existsSync(path);i++) await new Promise(resolvePromise=>setTimeout(resolvePromise,25));
  expect(existsSync(path)).toBe(true);
}

describe('Phase 4.5 launch-path seal',()=>{
  it('S-1/S-3 keeps one child_process boundary and only owned public spawn APIs',()=>{
    expect(architectureViolations()).toEqual([]);
    expect(readFileSync(resolve('src/tool-home.ts'),'utf8')).not.toMatch(/spawnVendorCodex/u);
    expect(readFileSync(resolve('src/process-launch.ts'),'utf8')).toMatch(/function launchProcess\(/u);
    expect(readFileSync(resolve('src/process-launch.ts'),'utf8')).not.toMatch(/export function launchProcess\(/u);
  });

  it('S-3 positive control rejects a newly introduced direct spawn',()=>{
    const violation=resolve('src/__p45_positive_control.ts');
    try {
      writeFileSync(violation,"import { spawn } from 'node:child_process';\nexport function spawnWorker(command:string) { return spawn(command); }\n");
      expect(architectureViolations()).toContain('src/__p45_positive_control.ts: direct child_process use');
      expect(architectureViolations()).toContain('src/__p45_positive_control.ts: unowned export spawnWorker');
    } finally { rmSync(violation,{force:true}); }
    expect(architectureViolations()).toEqual([]);
  });

  it.runIf(process.platform==='win32')('P4-2 asks the OS for the AppContainer worker parent PID',async()=>{
    const root=temp('p45-tree-'), vendor=join(root,'vendor'); mkdirSync(vendor); const binary=join(vendor,'codex.exe'); copyFileSync(process.execPath,binary);
    const home=join(root,'home'); mkdirSync(home); writeFileSync(join(home,'config.toml'),'[features]\nhooks=false\nmcp=false\nplugins=false\nskills=false\n');
    const db=seedPair(), marker=join(root,'cwd.txt');
    const {child}=spawnVendorCodexInAppContainer(db,{cwd:root,task_id:'t1',run_id:'r1'},binary,home,['-e',`require('fs').writeFileSync(${JSON.stringify(marker)},process.cwd());setTimeout(()=>{},8000)`]);
    const workerPid=await new Promise<number>((resolvePromise,reject)=>{ let output=''; child.stdout?.on('data',chunk=>{ output+=String(chunk); const match=output.match(/CUE_APPCONTAINER_PID=(\d+)/u); if(match) resolvePromise(Number(match[1])); }); child.once('error',reject); });
    const raw=execFileSync('powershell.exe',['-NoProfile','-Command',`Get-CimInstance Win32_Process -Filter "ProcessId=${workerPid}" | Select-Object ProcessId,ParentProcessId | ConvertTo-Json -Compress`],{encoding:'utf8'});
    expect(JSON.parse(raw)).toEqual({ProcessId:workerPid,ParentProcessId:child.pid});
    await once(child,'exit'); expect(readFileSync(marker,'utf8')).toBe(root); db.close();
  },30000);

  it.skipIf(process.platform==='win32')('P4-2 OS cwd query (SKIPPED on Windows: Win32_Process exposes no cwd)',()=>{
    expect(readFileSync(`/proc/${process.pid}/cwd`)).toBeTruthy();
  });

  it.runIf(process.platform==='win32')('P4-3/P4-5 automatically starts the owned queued request after lease promotion',async()=>{
    const root=temp('p45-dispatch-'), vendor=join(root,'vendor'); mkdirSync(vendor); const binary=join(vendor,'codex.exe'); copyFileSync(process.execPath,binary);
    const home=join(root,'home'); mkdirSync(home); writeFileSync(join(home,'config.toml'),'[features]\nhooks=false\nmcp=false\nplugins=false\nskills=false\n');
    const routing=join(root,'routing.yaml'); writeFileSync(routing,'rules:\n  - match: "work"\n    tool: codex\n');
    const second=join(root,'second.txt'), db=seedPair(), leases=new WorkspaceLeases(), dispatcher=new Dispatcher(db,leases);
    expect(leases.acquire({taskId:'t1',worktree:root,readOnly:false})).toBe('running');
    expect(dispatcher.dispatch({routingPath:routing,description:'work',taskId:'t2',runId:'r2',worktree:root,readOnly:false,binary,codexHome:home,args:['-e',`require('fs').writeFileSync(${JSON.stringify(second)},'second')`]})).toBe('queued');
    expect(dispatcher.finish({routingPath:routing,description:'work',taskId:'t1',runId:'r1',worktree:root,readOnly:false},()=>true)).toBe('succeeded');
    await waitFor(second);
    expect(db.prepare('SELECT state FROM task WHERE id=?').get('t2')).toEqual({state:'running'});
    expect((db.prepare('SELECT count(*) AS n FROM session_handle').get() as {n:number}).n).toBe(1);
    expect(Dispatcher.length).toBe(2); db.close(); await new Promise(resolvePromise=>setTimeout(resolvePromise,2500));
  },30000);
});
