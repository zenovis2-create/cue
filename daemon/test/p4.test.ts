import { afterEach, describe, expect, it } from 'vitest';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { once } from 'node:events';
import { createWorktree, parseOrcaJson, taskList, workerAbandon, workerStop, worktreePs, type OrcaExec } from '../src/adapters/orca.js';
import { WorkspaceLeases } from '../src/workspace-lease.js';
import { writeHeartbeat } from '../src/heartbeat.js';
import { Dispatcher } from '../src/dispatch.js';
import { openLedger } from '../src/ledger.js';
import { ledgerSessions, spawnOwned, type SessionRecord } from '../src/session-spawn.js';
import { closeTask } from '../src/task-close.js';
import { listOrphanSessions } from '../src/orphan-sessions.js';
import { routeTask } from '../src/routing.js';
import { spawnVendorCodexInAppContainer } from '../src/codex-session.js';

const roots: string[] = [];
const temp = (prefix: string): string => { mkdirSync(resolve('.test-state'), { recursive: true }); const value=mkdtempSync(resolve(`.test-state/${prefix}`)); roots.push(value); return value; };
afterEach(() => { for (const root of roots.splice(0)) rmSync(root,{recursive:true,force:true}); });
const now='2026-09-02T00:00:00.000Z';
function seeded() { const db=openLedger(); db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('t','running',null,now); db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run('e','C:/work','[]',now); db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('r','t','e',0,now); return db; }

describe('P4-1 Orca adapter', () => {
  it('tolerates literal JSON control characters inside strings', () => expect(parseOrcaJson('{"value":"a\u0001b"}')).toEqual({value:'a\u0001b'}));
  it('round-trips the exact create, ps, task-list, stop, and abandon argv', () => {
    const calls:string[][]=[]; const fake:OrcaExec=args=>{ calls.push([...args]); return '{"ok":true}'; };
    expect(createWorktree('cue-temp','path:C:/tmp/repo',fake)).toEqual({ok:true}); worktreePs(fake); taskList('run-1',fake); workerStop('dispatch-1',fake); workerAbandon('dispatch-1',fake);
    expect(calls).toEqual([
      ['worktree','create','--name','cue-temp','--repo','path:C:/tmp/repo','--setup','skip','--json'], ['worktree','ps','--json'],
      ['orchestration','task-list','--run','run-1','--json'], ['orchestration','worker-stop','--dispatch','dispatch-1','--json'],
      ['orchestration','worker-abandon','--dispatch','dispatch-1','--json'],
    ]);
    expect(calls.flat()).not.toContain('--run-id'); expect(calls.flat()).not.toContain('task-show');
  });
  it.runIf(Boolean(process.env.CUE_RUN_ORCA_READONLY))('round-trips the installed Orca worktree ps without mutation', () => expect(worktreePs()).toBeTruthy());
});

describe('P4-2 and P4-4 owned Codex sessions', () => {
  it('records the composite session identity and launches with the worktree cwd', async () => {
    const db=seeded(), cwd=temp('p4-session-'), marker=join(cwd,'cwd.txt');
    const {child,session}=spawnOwned(db,{cwd,task_id:'t',run_id:'r'},process.execPath,['-e',`require('fs').writeFileSync(${JSON.stringify(marker)},process.cwd());setTimeout(()=>{},30)`],{stdio:'ignore'});
    await once(child,'exit'); expect(readFileSync(marker,'utf8')).toBe(cwd); expect(ledgerSessions(db)).toEqual([session]); expect(session).toMatchObject({pid:child.pid,cwd,task_id:'t',run_id:'r'}); expect(session.start_time).toMatch(/^2026-|^20\d\d-/u); db.close();
  });
  it.runIf(process.platform==='win32' && Boolean(process.env.CUE_VENDOR_CODEX))('launches the real vendor Codex through the AppContainer supervisor', async () => {
    const db=seeded(), cwd=temp('p4-codex-'), home=temp('p4-home-'); writeFileSync(join(home,'config.toml'),'[features]\nhooks=false\nmcp=false\nplugins=false\nskills=false\n');
    const {child}=spawnVendorCodexInAppContainer(db,{cwd,task_id:'t',run_id:'r'},process.env.CUE_VENDOR_CODEX!,home,['--version']); let output=''; child.stdout?.on('data',x=>output+=String(x)); child.stderr?.on('data',x=>output+=String(x)); const [code]=await once(child,'exit');
    expect(code,output).toBe(0); expect(output).toMatch(/CUE_APPCONTAINER_PID=\d+;START_TIME=/u); expect(ledgerSessions(db)[0]).toMatchObject({pid:expect.any(Number),cwd,task_id:'t',run_id:'r'}); db.close();
  },30000);
  it('has one production spawn boundary and no direct spawn call elsewhere', () => {
    const files=execFileSync('rg',['-l',String.raw`\bspawn(?:Sync)?\s*\(`,'src'],{encoding:'utf8'}).trim().split(/\r?\n/u).map(x=>x.replaceAll('\\','/'));
    expect(files).toEqual(['src/process-launch.ts']);
  });
});

describe('P4-3 workspace lease', () => {
  it('queues a second writer, then admits it after release', () => { const x=new WorkspaceLeases(); expect(x.acquire({taskId:'a',worktree:'w',readOnly:false})).toBe('running'); expect(x.acquire({taskId:'b',worktree:'w',readOnly:false})).toBe('queued'); expect(x.release('w','a')).toBe('b'); expect(x.holder('w')).toBe('b'); });
  it('does not lease reads and reaps an expired holder', () => { const x=new WorkspaceLeases(); expect(x.acquire({taskId:'read',worktree:'w',readOnly:true})).toBe('running'); x.acquire({taskId:'a',worktree:'w',readOnly:false}); x.acquire({taskId:'b',worktree:'w',readOnly:false}); expect(x.reapExpired('w',true)).toBe('b'); expect(x.holder('w')).toBe('b'); });
  it('reclaims a writer through the P2 heartbeat age primitive', () => { const root=temp('p4-heartbeat-'), path=join(root,'heartbeat.json'), x=new WorkspaceLeases(); writeHeartbeat(path,{pid:1,start_time:now},new Date(0)); x.acquire({taskId:'a',worktree:'w',readOnly:false}); x.acquire({taskId:'b',worktree:'w',readOnly:false}); expect(x.reapStaleHeartbeat('w',path,100,Date.now()+1000)).toBe('b'); });
});

describe('P4-5 close is part of success', () => {
  it('records still_unsafe and does not succeed when close fails', () => { const db=seeded(); expect(closeTask(db,'t','r',()=>false)).toBe('still_unsafe'); expect(db.prepare('SELECT state FROM task').get()).toEqual({state:'failed'}); expect(db.prepare("SELECT kind FROM artifact WHERE kind='still_unsafe'").get()).toEqual({kind:'still_unsafe'}); db.close(); });
  it('succeeds only after a successful close', () => { const db=seeded(); expect(closeTask(db,'t','r',()=>true)).toBe('succeeded'); expect(db.prepare('SELECT state FROM task').get()).toEqual({state:'completed'}); db.close(); });
});

describe('P4-6 orphan detection only', () => {
  it('lists an unowned live process after ledger reopen and leaves it alive', async () => {
    const path=join(temp('p4-ledger-'),'ledger.db'); let db=openLedger(path); db.close(); db=openLedger(path);
    const child=spawn(process.execPath,['-e','setTimeout(()=>{},1000)'],{stdio:'ignore'}); if (!child.pid) throw new Error('pid missing');
    const orphan:SessionRecord={pid:child.pid,start_time:new Date().toISOString(),handle:'not-owned',cwd:resolve('.'),task_id:'outside',run_id:'outside'};
    expect(listOrphanSessions(db,[orphan])).toEqual([orphan]); expect(child.kill(0)).toBe(true); child.kill(); await once(child,'exit'); db.close();
  });
  it('contains no automatic orphan kill path', () => { const source=readFileSync(resolve('src/orphan-sessions.ts'),'utf8'); expect(source).not.toMatch(/\.kill\s*\(|taskkill|Stop-Process/iu); });
});

describe('P4-7 fail-closed routing', () => {
  it('dispatches a match and asks for an unmatched task without spawning', () => { const root=temp('p4-route-'), path=join(root,'routing.yaml'); writeFileSync(path,'rules:\n  - match: "docs"\n    tool: codex\n'); expect(routeTask(path,'update docs')).toEqual({state:'dispatch',tool:'codex'}); expect(routeTask(path,'deploy prod')).toEqual({state:'ask_me'}); });
  it('asks when routing.yaml is missing or malformed', () => { const root=temp('p4-route-bad-'), missing=join(root,'missing.yaml'), broken=join(root,'routing.yaml'); writeFileSync(broken,'default: codex\n'); expect(routeTask(missing,'anything')).toEqual({state:'ask_me'}); expect(routeTask(broken,'anything')).toEqual({state:'ask_me'}); });
  it('wires ask_me into dispatch and proves no tool is spawned', () => { const db=seeded(), dispatcher=new Dispatcher(db,new WorkspaceLeases()); expect(dispatcher.dispatch({routingPath:'missing.yaml',description:'unknown',taskId:'t',runId:'r',worktree:'C:/work',readOnly:false})).toBe('ask_me'); expect(db.prepare('SELECT count(*) AS n FROM session_handle').get()).toEqual({n:0}); expect(db.prepare("SELECT kind FROM artifact WHERE kind='ask_me'").get()).toEqual({kind:'ask_me'}); db.close(); });
});
