import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { openLedger } from '../src/ledger.js';
import { decideApproval } from '../src/approval-engine.js';
import { spawnOwned } from '../src/process-launch.js';
import { Dispatcher } from '../src/dispatch.js';
import { WorkspaceLeases } from '../src/workspace-lease.js';
import { classifyIdle, collectSignals, decisionGate, diagnoseCandidates, idleThresholdSpec, RecoveryCoordinator, validateHandoffPackage, type AutonomyLevel, type TaskContract } from '../src/watcher.js';

const roots:string[]=[];
afterEach(()=>{ for(const root of roots.splice(0)) rmSync(root,{recursive:true,force:true}); });
const now='2026-09-03T00:00:00.000Z';
const contract:TaskContract=Object.freeze({goal:'fix',constraints:Object.freeze(['inside']),done_when:Object.freeze(['tests']),deliverable:'patch'});

function seeded(level:AutonomyLevel=1, cap=3) {
  const db=openLedger();
  db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('t','running',null,now);
  db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run('e','C:/work','[]',now);
  db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('r','t','e',0,now);
  const recovery=new RecoveryCoordinator(db,'r',cap,contract,level,new Date(now));
  return {db,recovery};
}

function sourceFiles(root=resolve('src')):string[]{ const out:string[]=[]; for(const entry of readdirSync(root,{withFileTypes:true})){ const path=join(root,entry.name); if(entry.isDirectory()) out.push(...sourceFiles(path)); else if(entry.name.endsWith('.ts')) out.push(path); } return out; }
function sourceText():string { return sourceFiles().flatMap(path=>{ try { return [readFileSync(path,'utf8')]; } catch(error) { return (error as NodeJS.ErrnoException).code==='ENOENT' ? [] : (()=>{throw error;})(); } }).join('\n'); }

describe('P5 watcher and recovery',()=>{
  it('P5 ledger upgrades an existing pre-P5 database idempotently',()=>{
    const root=mkdtempSync(resolve('.test-state-p5-upgrade-')); roots.push(root); const path=join(root,'ledger.db');
    const legacy=new Database(path); legacy.exec("CREATE TABLE task(id TEXT PRIMARY KEY); CREATE TABLE run(id TEXT PRIMARY KEY);"); legacy.close();
    const db=openLedger(path); expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='run_autonomy'").get()).toEqual({name:'run_autonomy'}); db.close();
    const reopened=openLedger(path); expect(reopened.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='recovery_attempt_v2'").get()).toEqual({name:'recovery_attempt_v2'}); reopened.close();
  });
  it('P5-1 grades deterministic signal sources without treating worker-read as truth',()=>{
    expect(collectSignals({'gate-list':[], 'exit-code':0, 'terminal-wait':'quiet', 'worker-read':'done', 'task-list':['alive']})).toEqual([
      {source:'gate-list',grade:'conclusive',value:[]},{source:'exit-code',grade:'conclusive',value:0},{source:'terminal-wait',grade:'candidate',value:'quiet'},{source:'worker-read',grade:'candidate',value:'done'},{source:'task-list',grade:'conclusive',value:['alive']}
    ]);
  });

  it('P5-2 invokes diagnosis only after two candidate signals',()=>{
    let calls=0; const diagnose=()=>++calls;
    expect(diagnoseCandidates(collectSignals({'worker-read':'stalled'}),diagnose)).toBeUndefined(); expect(calls).toBe(0);
    expect(diagnoseCandidates(collectSignals({'worker-read':'stalled','terminal-wait':'timeout'}),diagnose)).toBe(1); expect(calls).toBe(1);
  });

  it('P5-2 production dispatcher integrates observation without adding a launch path',()=>{
    const {db}=seeded(), dispatcher=new Dispatcher(db,new WorkspaceLeases()); let calls=0;
    const result=dispatcher.inspectWorker({'worker-read':'blank','terminal-wait':'timeout'},{emptyPage:true,elapsedMs:idleThresholdSpec.coding,workerAlive:true,taskType:'coding'},()=>++calls);
    expect(result.state).toBe('blocked/idle'); expect(result.diagnosis).toBe(1); expect(calls).toBe(1); db.close();
  });

  it('P5-3 requires empty page, threshold exceeded, and live worker together',()=>{
    const base={emptyPage:true,elapsedMs:idleThresholdSpec.coding,workerAlive:true,taskType:'coding' as const};
    expect(classifyIdle({...base,emptyPage:false})).toBe('observing');
    expect(classifyIdle({...base,elapsedMs:idleThresholdSpec.coding-1})).toBe('observing');
    expect(classifyIdle({...base,workerAlive:false})).toBe('observing');
    expect(classifyIdle(base)).toBe('blocked/idle');
  });

  it('P5-4 uses task-type threshold data, with no global idle constant path',()=>{
    expect(new Set(Object.values(idleThresholdSpec)).size).toBeGreaterThan(1);
    expect(classifyIdle({emptyPage:true,workerAlive:true,elapsedMs:60_000,taskType:'interactive'})).toBe('blocked/idle');
    expect(classifyIdle({emptyPage:true,workerAlive:true,elapsedMs:60_000,taskType:'research'})).toBe('observing');
    expect(readFileSync(resolve('src/watcher.ts'),'utf8')).not.toMatch(/(?:GLOBAL|DEFAULT)_IDLE_THRESHOLD/u);
  });

  it('P5-5 records four-rung lineage and escalates at the immutable cap',()=>{
    const {db,recovery}=seeded(3,3), request={runId:'r',failure:'same',contract,actionAllowed:true};
    expect(recovery.recover(request,'hypothesis a').action).toBe('hypothesis_retry');
    expect(recovery.recover(request,'hypothesis b').action).toBe('change_approach');
    expect(recovery.recover(request,'hypothesis c').action).toBe('redecompose');
    expect(recovery.recover(request,'unused').action).toBe('human');
    const rows=db.prepare('SELECT id,parent_attempt_id,ordinal,rung,hypothesis FROM recovery_attempt_v2 ORDER BY ordinal').all() as Array<Record<string,unknown>>;
    expect(rows.map(row=>row.rung)).toEqual([1,2,3,4]); expect(rows.slice(1).map(row=>row.parent_attempt_id)).toEqual(rows.slice(0,-1).map(row=>row.id));
    expect(rows.every(row=>typeof row.hypothesis==='string' && row.hypothesis.length>0)).toBe(true); db.close();
  });

  it('P5-6 fences and hashes state before a real owned restart while preserving actual worker work',async()=>{
    const root=mkdtempSync(resolve('.test-state-p5-')); roots.push(root); const work=join(root,'worker.txt'), observedFile=join(root,'restarted.txt'); writeFileSync(work,'unfinished work');
    const {db,recovery}=seeded(3,1); let observed:string[]=[], child:ReturnType<typeof spawnOwned>['child']|undefined;
    recovery.fenceBeforeRestart('t','abc123','diff bytes',()=>{
      observed=(db.prepare('SELECT kind FROM artifact WHERE run_id=? ORDER BY id').all('r') as Array<{kind:string}>).map(row=>row.kind);
      child=spawnOwned(db,{task_id:'t',run_id:'r',cwd:root},process.execPath,['-e',`require('fs').writeFileSync(${JSON.stringify(observedFile)},require('fs').readFileSync(${JSON.stringify(work)},'utf8'))`],{stdio:'ignore'}).child;
    });
    expect(child).toBeDefined(); await once(child!,'exit');
    expect(observed).toEqual(['recovery_base_sha','recovery_diff_hash','restart_fence']);
    expect(db.prepare("SELECT content FROM artifact WHERE kind='recovery_diff_hash'").get()).toEqual({content:createHash('sha256').update('diff bytes').digest('hex')});
    expect(readFileSync(work,'utf8')).toBe('unfinished work'); expect(readFileSync(observedFile,'utf8')).toBe('unfinished work'); db.close();
    expect(sourceText()).not.toMatch(/git\s+(?:reset|checkout|clean)|checkout\s+--|discard/iu);
  });

  it('P5-7 validates handoff schema and has no automatic handoff executor',()=>{
    expect(validateHandoffPackage({version:1,run_id:'r',reason:'cap',evidence_refs:['a'],requested_human_action:'review'})).toBe(true);
    expect(validateHandoffPackage({version:1,run_id:'r'})).toBe(false);
    expect(sourceText()).not.toMatch(/(?:execute|dispatch|send|run|auto\w*)Handoff/u);
  });

  it('P5-8 always sends an open decision gate to a human, including autonomy 3',()=>{
    for(const level of [1,2,3] as const){
      const {db,recovery}=seeded(level); expect(decisionGate(recovery.autonomy())).toEqual({action:'human_required'});
      expect(recovery.recover({runId:'r',failure:'gate',contract,actionAllowed:true,decisionGateOpen:true},'must not run').action).toBe('human');
      expect((db.prepare('SELECT count(*) AS n FROM recovery_attempt_v2').get() as {n:number}).n).toBe(0); db.close();
    }
  });

  it.each([{level:1,actions:['stop'],attempts:0},{level:2,actions:['mechanical_retry','human'],attempts:2},{level:3,actions:['hypothesis_retry','change_approach'],attempts:2}] as const)('P5-9 autonomy $level has distinct lineage',({level,actions,attempts})=>{
    const {db,recovery}=seeded(level,3), request={runId:'r',failure:'same',contract,actionAllowed:true};
    const actual=[recovery.recover(request,'new a').action]; if(level!==1) actual.push(recovery.recover(request,'new b').action);
    expect(actual).toEqual(actions); expect((db.prepare('SELECT count(*) AS n FROM recovery_attempt_v2').get() as {n:number}).n).toBe(attempts); db.close();
  });

  it('P5-10 autonomy 3 cannot widen envelope, retry cap, or task contract',()=>{
    const root=mkdtempSync(resolve('.test-state-p5-envelope-')); roots.push(root); const {db,recovery}=seeded(3,1);
    const active={envelope:{run_id:'r',worktree_realpath:root,egress:[],expires_at:'2099-01-01T00:00:00.000Z',autonomy_level:'bounded' as const,allowed_actions:['command']},envelope_hash:'e'};
    const decision=decideApproval(db,active,{thread_id:'th',item_id:'i',approval_id:null,request_ordinal:0,method:'network/request',cwd:root});
    expect(decision).toMatchObject({decision:'decline',reason:'outside_envelope'});
    const before=JSON.stringify(contract), request={runId:'r',failure:'same',contract,actionAllowed:true}; recovery.recover(request,'new'); expect(JSON.stringify(contract)).toBe(before);
    expect(recovery.recover({...request,contract:{...contract,goal:'expanded'}},'changed contract').action).toBe('human');
    expect(recovery.recover(request,'another').action).toBe('human'); expect((db.prepare('SELECT retry_cap FROM run_autonomy WHERE run_id=?').get('r') as {retry_cap:number}).retry_cap).toBe(1);
    expect(sourceText()).not.toMatch(/(?:goal|constraints|done_when|deliverable)\s*=/u); db.close();
  });

  it('P5-11 rejects in-run increases and applies plus records decreases immediately',()=>{
    const {db,recovery}=seeded(3); expect(recovery.changeAutonomy(2)).toBe('lowered'); expect(recovery.autonomy()).toBe(2);
    expect(recovery.changeAutonomy(3)).toBe('stop_new_run'); expect(recovery.autonomy()).toBe(2);
    expect(db.prepare('SELECT from_level,requested_level,outcome FROM autonomy_change ORDER BY id').all()).toEqual([
      {from_level:3,requested_level:2,outcome:'lowered'},{from_level:2,requested_level:3,outcome:'stop_new_run'}
    ]); db.close();
  });

  it('P5-12 stores and retrieves the autonomy level for each run id',()=>{
    const {db,recovery}=seeded(2,4); expect(recovery.autonomy()).toBe(2); expect(db.prepare('SELECT level,retry_cap FROM run_autonomy WHERE run_id=?').get('r')).toEqual({level:2,retry_cap:4}); db.close();
  });
});
