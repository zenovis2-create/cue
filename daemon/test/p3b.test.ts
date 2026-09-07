import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { once } from 'node:events';
import { openLedger } from '../src/ledger.js';
import { envelopeHash, normalizeEnvelope, type Envelope } from '../src/envelope.js';
import { decideApproval, type ApprovalRequest, type RunEnvelope } from '../src/approval-engine.js';
import { completeTaskIfEnforced, isCanonicalContained, recordEnforcementViolation, runEnforcedWorker } from '../src/worker-enforcement.js';
import { completionApprovalLabel, recordExecution } from '../src/execution-accounting.js';
import { chooseDeadlock, initialDeadlockState, noteOutsideRequest } from '../src/deadlock.js';

const roots:string[]=[];
function temp(prefix='p3b-') { mkdirSync(resolve('.test-state'),{recursive:true}); const value=mkdtempSync(resolve(`.test-state/${prefix}`)); roots.push(value); return value; }
afterEach(()=>{ for(const root of roots.splice(0)) rmSync(root,{recursive:true,force:true}); });
const now=new Date('2026-09-02T01:00:00Z');

function setup(overrides:Partial<Envelope>={}) {
  const worktree=temp('p3b-work-');
  const envelope=normalizeEnvelope({run_id:'r3b',worktree_realpath:worktree,egress:[],expires_at:'2026-09-03T00:00:00Z',autonomy_level:'bounded',allowed_actions:['permissions','command'],...overrides});
  const hash=envelopeHash(envelope), db=openLedger(), iso=now.toISOString();
  db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('t3b','running',null,iso);
  db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(hash,envelope.worktree_realpath,JSON.stringify(envelope.egress),iso);
  db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('r3b','t3b',hash,0,iso);
  return {db,envelope,active:{envelope,envelope_hash:hash} satisfies RunEnvelope};
}
function approval(cwd:string, n=0):ApprovalRequest { return {method:'commandExecution/request',cwd,command:'worker command',thread_id:'thread',item_id:`item-${n}`,approval_id:null,request_ordinal:n}; }

describe('P3-9 canonical filesystem enforcement',()=>{
  it('contains paths by canonical realpath and has no string-prefix path comparison',()=>{
    const s=setup(), inside=join(s.envelope.worktree_realpath,'new.txt'), outside=join(temp('p3b-out-'),'new.txt');
    expect(isCanonicalContained(s.envelope.worktree_realpath,inside)).toBe(true);
    expect(isCanonicalContained(s.envelope.worktree_realpath,outside)).toBe(false);
    const source=['worker-enforcement.ts','permissions-response.ts'].map(x=>readFileSync(resolve('src',x),'utf8')).join('\n');
    expect(source).not.toContain('startsWith('); s.db.close();
  });
  it('blocks a write reached through a symlink or junction',({skip})=>{
    const s=setup(), outside=temp('p3b-link-out-'), link=join(s.envelope.worktree_realpath,'escape');
    try { symlinkSync(outside,link,process.platform==='win32'?'junction':'dir'); } catch(error) { s.db.close(); skip(`심볼릭 링크/junction 생성 불가: ${String(error)}`); return; }
    const target=join(link,'escaped.txt');
    expect(isCanonicalContained(s.envelope.worktree_realpath,target)).toBe(false);
    expect(runEnforcedWorker(s.envelope,{executable:process.execPath,args:['-e',`require('fs').writeFileSync(${JSON.stringify(target)},'bad')`],cwd:s.envelope.worktree_realpath,inspectedPaths:[target]}).violation).toBe('filesystem');
    expect(existsSync(join(outside,'escaped.txt'))).toBe(false); s.db.close();
  });
  it('reproduces P1-2: an accepted absolute outside write is stopped before the real process runs',()=>{
    const s=setup(), outside=temp('p3b-p1-out-'), target=join(outside,'must-not-exist.txt');
    expect(decideApproval(s.db,s.active,approval(s.envelope.worktree_realpath),now).decision).toBe('accept');
    const command=process.platform==='win32'
      ? {executable:'powershell.exe',args:['-NoProfile','-Command',`Set-Content -LiteralPath '${target}' -Value escape`]}
      : {executable:'/bin/sh',args:['-c',`printf escape > '${target}'`]};
    const enforced=runEnforcedWorker(s.envelope,{...command,cwd:s.envelope.worktree_realpath});
    expect(enforced.violation).toBe('filesystem'); expect(enforced.result).toBeUndefined(); expect(existsSync(target)).toBe(false); s.db.close();
  });
  it('does not complete a task after an outside-envelope change is detected',()=>{
    const s=setup(); recordEnforcementViolation(s.db,'r3b','filesystem',now); expect(completeTaskIfEnforced(s.db,'t3b')).toBe(false);
    expect(s.db.prepare('SELECT state FROM task WHERE id=?').get('t3b')).toEqual({state:'running'}); s.db.close();
  });
  it('blocks a runtime-computed outside path in a non-Node worker',()=>{
    const s=setup(), outside=temp('p3b-runtime-out-'), target=join(outside,'runtime-escape.txt');
    const encoded=Buffer.from(target).toString('base64');
    const result=runEnforcedWorker(s.envelope,{executable:'powershell.exe',args:['-NoProfile','-Command',`$p=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'));Set-Content -LiteralPath $p -Value escape`],cwd:s.envelope.worktree_realpath});
    // Required gate: this currently exposes that argv preflight is not a filesystem syscall boundary.
    expect(result.violation).toBe('filesystem'); expect(existsSync(target)).toBe(false); s.db.close();
  }, 30_000);
});

describe('P3-16 process network gate',()=>{
  it('reproduces P1-2: example.com fails with no egress in the envelope',()=>{
    const s=setup(); const code="fetch('https://example.com').then(()=>process.exit(0),()=>process.exit(2))";
    const enforced=runEnforcedWorker(s.envelope,{executable:process.execPath,args:['-e',code],cwd:s.envelope.worktree_realpath});
    expect(enforced.violation).toBe('network_gate'); expect(enforced.result?.status).not.toBe(0); s.db.close();
  });
  it('allows only the named host and blocks another host using a real local socket',async()=>{
    const server=createServer(socket=>socket.end('ok')); server.listen(0,'127.0.0.1'); await once(server,'listening');
    const address=server.address(); if(typeof address!=='object'||!address) throw new Error('listener missing');
    const allowed=setup({egress:['127.0.0.1']});
    const connect=`const n=require('node:net');const s=n.connect(${address.port},'127.0.0.1',()=>{s.end();process.exit(0)});s.on('error',()=>process.exit(2))`;
    expect(runEnforcedWorker(allowed.envelope,{executable:process.execPath,args:['-e',connect],cwd:allowed.envelope.worktree_realpath}).result?.status).toBe(0);
    const blocked=`require('node:net').connect(${address.port},'localhost')`;
    expect(runEnforcedWorker(allowed.envelope,{executable:process.execPath,args:['-e',blocked],cwd:allowed.envelope.worktree_realpath}).violation).toBe('network_gate');
    server.close(); await once(server,'close'); allowed.db.close();
  });
  it('prevents completion when gate failure is detected',()=>{
    const s=setup(); recordEnforcementViolation(s.db,'r3b','network_gate',now); expect(completeTaskIfEnforced(s.db,'t3b')).toBe(false); s.db.close();
  });
  it('blocks a non-Node worker from a real local socket when egress is empty',async()=>{
    const server=createServer(socket=>socket.end()); server.listen(0,'127.0.0.1'); await once(server,'listening');
    const address=server.address(); if(typeof address!=='object'||!address) throw new Error('listener missing');
    const s=setup();
    const result=runEnforcedWorker(s.envelope,{executable:'powershell.exe',args:['-NoProfile','-Command',`$c=[Net.Sockets.TcpClient]::new();$c.Connect('127.0.0.1',${address.port});$c.Close()`],cwd:s.envelope.worktree_realpath});
    server.close(); await once(server,'close');
    // Required gate: NODE_OPTIONS cannot constrain a native/PowerShell worker.
    expect(result.violation).toBe('network_gate'); expect(result.result?.status).not.toBe(0); s.db.close();
  });
});

describe('P3-17 approval and execution accounting',()=>{
  it('records them separately and alerts when one permissions approval precedes three executions',()=>{
    const s=setup();
    expect(decideApproval(s.db,s.active,{...approval(s.envelope.worktree_realpath),method:'permissions/request',entries:[{path:join(s.envelope.worktree_realpath,'x'),access:'write'}]},now).decision).toBe('accept');
    for(let n=0;n<3;n++) recordExecution(s.db,{run_id:'r3b',thread_id:'thread',item_id:null,approval_id:null,execution_id:`exec-${n}`,execution_ordinal:n},now);
    expect(s.db.prepare('SELECT count(*) n FROM approval_event').get()).toEqual({n:1}); expect(s.db.prepare('SELECT count(*) n FROM execution_event').get()).toEqual({n:3});
    expect((s.db.prepare("SELECT count(*) n FROM artifact WHERE kind='execution_over_approval'").get() as {n:number}).n).toBe(2); s.db.close();
  });
  it('uses a composite null-safe execution replay key, not itemId alone',()=>{
    const s=setup(), base={run_id:'r3b',thread_id:'thread',item_id:null,approval_id:null,execution_id:'exec',execution_ordinal:0}; recordExecution(s.db,base,now);
    expect(()=>recordExecution(s.db,{...base,execution_ordinal:1},now)).not.toThrow(); expect(()=>recordExecution(s.db,base,now)).toThrow(/UNIQUE/); s.db.close();
  });
});

describe('P3-11 decline without killing task',()=>{
  it('keeps the task running after an outside-envelope request',()=>{ const s=setup({allowed_actions:[]}); expect(decideApproval(s.db,s.active,approval(s.envelope.worktree_realpath),now).decision).toBe('decline'); expect(s.db.prepare('SELECT state FROM task').get()).toEqual({state:'running'}); s.db.close(); });
});

describe('P3-12 deadlock choice model',()=>{
  it('blocks after the same digest twice',()=>{ let s=initialDeadlockState(); s=noteOutsideRequest(s,'d'); s=noteOutsideRequest(s,'d'); expect(s.status).toBe('막힘 — 봉투 밖'); });
  it('blocks when an approval stalls',()=>expect(noteOutsideRequest(initialDeadlockState(),'d',true).status).toBe('막힘 — 봉투 밖'));
  it('offers exactly three choices',()=>expect(initialDeadlockState().choices).toEqual(['이 상태로 계속','범위 넓히기','중단']));
  it('does not focus expand by default',()=>expect(initialDeadlockState().defaultChoice).not.toBe('expand'));
  it('continue suppresses the same digest',()=>{ const chosen=chooseDeadlock(noteOutsideRequest(initialDeadlockState(),'d',true),'continue','d'); expect(noteOutsideRequest(chosen,'d',true)).toBe(chosen); });
});

describe('P3-15 ledger-derived completion counter',()=>{
  it('renders approval totals from ledger queries',()=>{ const s=setup(); decideApproval(s.db,s.active,approval(s.envelope.worktree_realpath,0),now); decideApproval(s.db,s.active,approval(s.envelope.worktree_realpath,1),now); decideApproval(s.db,s.active,{...approval(s.envelope.worktree_realpath,2),method:'unknown'},now); expect(completionApprovalLabel(s.db,'t3b')).toBe('자동 승인 2건 · 거부 1건'); s.db.close(); });
});
