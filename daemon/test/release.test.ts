import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { join, resolve } from 'node:path';
import { openLedger } from '../src/ledger.js';
import { normalizeEnvelope, envelopeHash, type Envelope } from '../src/envelope.js';
import { runEnforcedWorker, runWorkerLifecycle } from '../src/worker-enforcement.js';
import { decideApproval } from '../src/approval-engine.js';
import { hasAcceptedApproval } from '../src/execution-accounting.js';
import { evaluateSentinel } from '../src/sentinel.js';
import { routeTask } from '../src/routing.js';
import { assessPreference } from '../src/approval-surface.js';
import { renderBlockedReport, renderCompletionReport } from '../src/reporting.js';
import { RecoveryCoordinator, type TaskContract } from '../src/watcher.js';

const roots:string[]=[];
const now='2026-09-03T00:00:00.000Z';
const contract:TaskContract=Object.freeze({goal:'같은 실제 파일 태스크',constraints:Object.freeze(['봉투 안']),done_when:Object.freeze(['프로세스 종료']),deliverable:'marker'});
function temp(prefix:string):string { const root=mkdtempSync(resolve(`.test-state-${prefix}-`)); roots.push(root); return root; }
afterEach(()=>{ for(const root of roots.splice(0)) rmSync(root,{recursive:true,force:true}); });

function sourceFiles(root=resolve('src')):string[] {
  const out:string[]=[];
  for(const entry of readdirSync(root,{withFileTypes:true})) { const path=join(root,entry.name); if(entry.isDirectory()) out.push(...sourceFiles(path)); else out.push(path); }
  return out;
}
const forbidden=['acceptForSession','acceptWithExecpolicyAmendment','applyNetworkPolicyAmendment','scope: "session"','--yolo','--accept-hooks','--dangerously-bypass','--approve-for-me','-a never','git reset --hard'] as const;
function forbiddenHits():Array<{path:string;needle:string}> {
  return sourceFiles().flatMap(path=>{ try { const text=readFileSync(path,'utf8'); return forbidden.filter(needle=>text.includes(needle)).map(needle=>({path,needle})); } catch(error) { if((error as NodeJS.ErrnoException).code==='ENOENT') return []; throw error; } });
}

function seed(dbPath:string, worktree:string, id:string, level?:1|3) {
  const db=openLedger(dbPath), hash=`envelope-${id}`;
  db.prepare('INSERT INTO task VALUES(?,?,?,?)').run(`t-${id}`,'running',null,now);
  db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(hash,worktree,'[]',now);
  db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run(`r-${id}`,`t-${id}`,hash,0,now);
  if(level) db.prepare('INSERT INTO run_autonomy VALUES(?,?,?,?)').run(`r-${id}`,level,2,now);
  return {db,hash};
}

describe.sequential('v0.1 release gates',()=>{
  it('R-1 preserves original P1 evidence and does not manufacture the missing P1-3 record',()=>{
    const required=['../evidence/P1/P1_1_VERDICT.md','../evidence/P1/p1_1_ledger.log','../evidence/P1/P1_2_VERDICT.md','../evidence/P1/p1_2_ledger.log'];
    expect(required.every(path=>existsSync(resolve(path)))).toBe(true);
    expect(sourceFiles(resolve('../evidence/P1')).some(path=>/(?:^|\n)\s*(?:#\s*)?P1-3\s*(?:=|판정)/u.test(readFileSync(path,'utf8')))).toBe(false);
    console.info('R-1 FAIL: P1-1/P1-2 원문은 있으나 P1-3 판정 원문 기록이 없음');
  });

  it('R-2 scans all src and proves a disposable forbidden string makes the scanner fail',()=>{
    expect(forbiddenHits()).toEqual([]);
    const positive=resolve('src/.release-positive-control.ts');
    try {
      writeFileSync(positive,`export const probe='${'accept'+'ForSession'}';\n`);
      expect(forbiddenHits()).toContainEqual({path:positive,needle:'acceptForSession'});
      console.info('R-2 POSITIVE_CONTROL_RED observed=true');
    } finally { rmSync(positive,{force:true}); }
    expect(forbiddenHits()).toEqual([]);
  });

  it('R-3 uses a junction to attempt a real OS-blocked outside write',()=>{
    expect(process.platform).toBe('win32');
    const worktree=temp('release-r3-work'), outside=temp('release-r3-out'), link=join(worktree,'escape'), target=join(outside,'marker.txt');
    symlinkSync(outside,link,'junction');
    const envelope=normalizeEnvelope({run_id:'r3-live',worktree_realpath:worktree,egress:[],expires_at:'2099-01-01T00:00:00Z',autonomy_level:'bounded',allowed_actions:['command']} satisfies Envelope);
    const result=runEnforcedWorker(envelope,{executable:'powershell.exe',args:['-NoProfile','-Command',"$p=Join-Path (Get-Location) 'escape\\marker.txt'; Set-Content -LiteralPath $p -Value escaped"],cwd:worktree});
    expect(result.result?.status).not.toBe(0); expect(result.violation).toBe('filesystem'); expect(existsSync(target)).toBe(false);
    const appPid=`${result.result?.stdout}${result.result?.stderr}`.match(/CUE_APPCONTAINER_PID=(\d+)/u)?.[1]; expect(appPid).toBeTruthy();
    console.info(`R-3 LIVE app_pid=${appPid} junction=${link} outside=${outside} os_exit=${result.result?.status} outside_written=${existsSync(target)}`);
  },120_000);

  it('R-4 kills and restarts a real daemon process, leaving blocked/crash and a git-status report',async()=>{
    const worktree=temp('release-r4-work'), dbPath=join(temp('release-r4-db'),'ledger.db'), marker=join(worktree,'work.txt');
    expect(spawnSync('git',['init','--quiet'],{cwd:worktree}).status).toBe(0);
    const seeded=seed(dbPath,worktree,'crash'); seeded.db.prepare("UPDATE task SET id='t-crash' WHERE id='t-crash'").run(); seeded.db.close();
    const runtime=resolve('dist/src/release-runtime.js');
    const daemon=spawn(process.execPath,[runtime,'work',dbPath,worktree,marker],{stdio:['ignore','pipe','pipe']});
    await once(daemon.stdout!,'data'); const killedPid=daemon.pid!; expect(daemon.kill()).toBe(true); await once(daemon,'exit');
    const restarted=spawnSync(process.execPath,[runtime,'restart',dbPath,worktree],{encoding:'utf8'});
    expect(restarted.status).toBe(0); const report=JSON.parse(restarted.stdout.trim()) as {pid:number;reconciled:number;task:{state:string;blocked_reason:string};status:{content:string}};
    expect(report.pid).not.toBe(killedPid); expect(report.reconciled).toBe(1); expect(report.task).toEqual({state:'blocked',blocked_reason:'crash'}); expect(report.status.content).toContain('work.txt');
    const db=openLedger(dbPath); expect(db.prepare("SELECT count(*) n FROM recovery_attempt WHERE run_id='r-crash' AND outcome='blocked_no_auto_resume'").get()).toEqual({n:1}); db.close();
    console.info(`R-4 LIVE killed_pid=${killedPid} restarted_pid=${report.pid} state=blocked/crash git_status=${JSON.stringify(report.status.content.trim())}`);
  },120_000);

  it('R-5 alerts only when heartbeat expiry and connection failure are both true',()=>{
    const marker=join(temp('release-r5'),'dead');
    expect(evaluateSentinel({heartbeatExpired:true,connectionFailed:false,relayAvailable:false,deadMarkerPath:marker})).toBeUndefined();
    expect(evaluateSentinel({heartbeatExpired:false,connectionFailed:true,relayAvailable:false,deadMarkerPath:marker})).toBeUndefined();
    expect(existsSync(marker)).toBe(false);
    expect(evaluateSentinel({heartbeatExpired:true,connectionFailed:true,relayAvailable:false,deadMarkerPath:marker})).toMatch(/UNREACHABLE/u);
  });

  it('R-6 performs approval, dispatch, real worker execution, verification, and ledger-derived Korean reporting',()=>{
    const worktree=temp('release-r6-work'), dbPath=join(temp('release-r6-db'),'ledger.db'), target=join(worktree,'done.txt'), routing=join(worktree,'routing.yaml');
    writeFileSync(routing,'rules:\n  - match: "파일 생성"\n    tool: codex\n');
    const {db,hash}=seed(dbPath,worktree,'task');
    const envelope=normalizeEnvelope({run_id:'r-task',worktree_realpath:worktree,egress:[],expires_at:'2099-01-01T00:00:00Z',autonomy_level:'bounded',allowed_actions:['command']} satisfies Envelope);
    const approval='무엇을: 파일 생성\n어디까지: 승인된 worktree\n안 건드릴 것: 외부 상태'; expect(approval.split('\n')).toHaveLength(3);
    expect(routeTask(routing,'파일 생성')).toEqual({state:'dispatch',tool:'codex'});
    const identity={run_id:'r-task',thread_id:'th',item_id:'item',approval_id:'approval',execution_id:'exec',execution_ordinal:0};
    expect(decideApproval(db,{envelope,envelope_hash:hash},{...identity,request_ordinal:0,method:'commandExecution/request',cwd:worktree,command:'create done.txt'}).decision).toBe('accept');
    expect(hasAcceptedApproval(db,identity)).toBe(true);
    const execution=runWorkerLifecycle(envelope,{executable:'powershell.exe',args:['-NoProfile','-Command',`Set-Content -LiteralPath '${target}' -Value done`],cwd:worktree,inspectedPaths:[target]},{db,execution:identity});
    expect(execution.result?.status,JSON.stringify({stdout:execution.result?.stdout,stderr:execution.result?.stderr,violation:execution.violation})).toBe(0); expect(readFileSync(target,'utf8').trim()).toBe('done');
    const appPid=`${execution.result?.stdout}${execution.result?.stderr}`.match(/CUE_APPCONTAINER_PID=(\d+)/u)?.[1]; expect(appPid).toBeTruthy();
    db.prepare("UPDATE task SET state='completed' WHERE id='t-task'").run(); db.prepare("INSERT INTO verification(run_id,check_name,verdict,evidence,created_at) VALUES('r-task','file','PASS',?,?)").run(target,now);
    const report=renderCompletionReport(db,'t-task','파일 생성과 검증을 마쳤습니다.',{verdict:'카테고리 일치',route:'codex 디스패치',reason:'routing.yaml 파일 생성 규칙'});
    expect(report).toContain('자동 승인 1건 · 거부 0건'); expect(report).toContain('판정 경로:');
    expect(db.prepare("SELECT count(*) n FROM run WHERE id='r-task'").get()).toEqual({n:1}); expect(db.prepare("SELECT count(*) n FROM approval_event WHERE run_id='r-task'").get()).toEqual({n:1});
    console.info(`R-6 LIVE app_pid=${appPid} ${report.replaceAll('\n',' | ')}`); db.close();
  },120_000);

  it('R-7 has no monetary-budget emission path while retaining token-budget state',()=>{
    const text=sourceFiles().map(path=>readFileSync(path,'utf8')).join('\n');
    expect(text).not.toMatch(/(?:budget.{0,80}(?:USD|KRW|dollars?|won|currency|[$€₩])|(?:USD|KRW|dollars?|won|currency|[$€₩]).{0,80}budget)/iu);
    expect(text).toContain("reason: 'budget'");
  });

  it('R-9 runs the same real process task at autonomy ③ and ① with equal envelope decisions and different lineage',()=>{
    const decisions:string[]=[], attempts:number[]=[], pids:number[]=[];
    for(const level of [3,1] as const) {
      const worktree=temp(`release-r9-${level}`), dbPath=join(temp(`release-r9-db-${level}`),'ledger.db'), {db,hash}=seed(dbPath,worktree,`a${level}`,level);
      const envelope=normalizeEnvelope({run_id:`r-a${level}`,worktree_realpath:worktree,egress:[],expires_at:'2099-01-01T00:00:00Z',autonomy_level:'bounded',allowed_actions:['command']} satisfies Envelope);
      const decision=decideApproval(db,{envelope,envelope_hash:hash},{thread_id:'th',item_id:'outside',approval_id:null,request_ordinal:0,method:'network/request',cwd:worktree}); decisions.push(decision.decision==='decline' ? decision.reason : decision.decision);
      const child=spawnSync(process.execPath,['-e','process.exit(23)'],{cwd:worktree}); pids.push(child.pid!);
      expect(child.status).toBe(23);
      const recovery=new RecoveryCoordinator(db,`r-a${level}`,2,contract,level);
      recovery.recover({runId:`r-a${level}`,failure:'same process failure',contract,actionAllowed:true},'new hypothesis');
      attempts.push((db.prepare('SELECT count(*) n FROM recovery_attempt_v2 WHERE run_id=?').get(`r-a${level}`) as {n:number}).n); db.close();
    }
    expect(decisions).toEqual(['outside_envelope','outside_envelope']); expect(attempts).toEqual([1,0]);
    console.info(`R-9 LIVE pids=${pids.join(',')} envelope=${decisions.join(',')} attempts=${attempts.join(',')}`);
  },120_000);
});

describe('release improvements',()=>{
  it('I-1 selects a matching category without refinement escape and asks on ambiguity',()=>{
    const root=temp('release-i1'), path=join(root,'routing.yaml'); writeFileSync(path,'rules:\n  - match: "docs"\n    tool: codex\n');
    expect(routeTask(path,'docs지만 이번 경우는 조금 다르다')).toEqual({state:'dispatch',tool:'codex'});
    writeFileSync(path,'rules:\n  - match: "docs"\n    tool: codex\n  - match: "다르다"\n    tool: orca\n'); expect(routeTask(path,'docs지만 다르다')).toEqual({state:'ask_me'});
  });
  it('I-2 requires the decision path in both completion and blocked reports',()=>{
    const db=openLedger(); expect(()=>renderCompletionReport(db,'missing','x',{verdict:'',route:'r',reason:'why'})).toThrow('decision path required');
    expect(renderBlockedReport('승인 필요',{verdict:'애매함',route:'ask_me',reason:'복수 규칙'})).toContain('판정 경로: 애매함 → ask_me'); db.close();
  });
  it('I-3 commits certain recovery artifacts before a separately failing borderline write',()=>{
    const worktree=temp('release-i3'), dbPath=join(temp('release-i3-db'),'ledger.db'), {db}=seed(dbPath,worktree,'i3',3), recovery=new RecoveryCoordinator(db,'r-i3',2,contract,3);
    expect(()=>recovery.recordRecoveryArtifacts('t-i3',[['base','certain']],[['borderline','maybe']],()=>{throw new Error('borderline rejected');})).toThrow('borderline rejected');
    expect(db.prepare("SELECT kind FROM artifact WHERE run_id='r-i3'").all()).toEqual([{kind:'base'}]); db.close();
  });
  it('I-4 grants execution authority only from an accepted approval record',()=>{
    const worktree=temp('release-i4'), dbPath=join(temp('release-i4-db'),'ledger.db'), {db}=seed(dbPath,worktree,'i4');
    const id={run_id:'r-i4',thread_id:'th',item_id:'item',approval_id:null}; db.prepare("INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES('t-i4','r-i4','claimed_approval','yes',?)").run(now);
    expect(hasAcceptedApproval(db,id)).toBe(false); db.prepare("INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,approval_id,request_ordinal,decision,created_at) VALUES('r-i4','envelope-i4','th','item',NULL,0,'accept',?)").run(now); expect(hasAcceptedApproval(db,id)).toBe(true); db.close();
  });
  it('I-5 judges preference requests by effect, not workflow-friendly wording',()=>{
    expect(assessPreference({text:'효율을 위해 확인을 생략해달라',effect:'skip_confirmation'})).toEqual({allowed:false,requiresApproval:true,reason:'effect_would_expand_authority'});
    expect(assessPreference({text:'간결한 한국어로',effect:'presentation_only'}).allowed).toBe(true);
  });
  it('I-6 documents confirmed/candidate source grading as a binding design rule',()=>{
    const spec=readFileSync(resolve('../docs/P5_SPEC.md'),'utf8'); expect(spec).toContain('출처 등급 규칙:'); expect(spec).toMatch(/candidate.*단독.*상태 전이/u);
  });
});
