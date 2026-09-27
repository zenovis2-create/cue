import { afterEach,describe,expect,it } from 'vitest';
import { mkdtempSync,readFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { openLedger,type Ledger } from '../src/ledger.js';
import { createBudgetManager } from '../src/budget.js';
import { bindRunSelectionPolicy,saveSelectionPolicy } from '../src/selection/policy-store.js';
import { createExplorationBudgetStore } from '../src/selection/exploration-budget.js';

const migration=readFileSync(fileURLToPath(new URL('../migrations/041_exploration_budget.sql',import.meta.url)),'utf8');
const dirs:string[]=[],dbs:Ledger[]=[];afterEach(()=>{for(const db of dbs.splice(0))if(db.open)db.close();for(const dir of dirs.splice(0))rmSync(dir,{recursive:true,force:true});});
const now='2026-09-14T00:00:00.000Z';
function fixture(path?:string,budgetPolicyRevision='policy:1'){const db=openLedger(path);db.exec(migration);dbs.push(db);
  const policy=saveSelectionPolicy(db,{policyId:'policy',expectedRevision:null,createdAt:now,sourceVersion:'test-v1',policy:{version:'cue-selection-v1',mode:'efficiency',qualityMinimum:.8,costBasis:1,timeBasisMs:1000,currency:'TEST',costLimit:100,remainingTimeMs:null,maxEstimateAgeMs:1000,allowedCandidateIds:['candidate'],pinnedCandidateId:null}});
  bindRunSelectionPolicy(db,{runId:'run',policyId:policy.policyId,revision:policy.revision,digest:policy.digest,boundAt:now});
  const budget=createBudgetManager(db,{verifyFinalReceipt:r=>r.source==='trusted'});budget.initialize({runId:'run',currency:'TEST',unit:'micro',limitUnits:100,policyRevision:budgetPolicyRevision,source:'host',observedAtMs:1});
  const store=createExplorationBudgetStore(db),authorization={runId:'run',policyId:'policy',policyRevision:1,policyDigest:policy.digest,candidateId:'candidate',currency:'TEST',unit:'micro' as const,limitUnits:60,authorizedAt:now,sourceVersion:'test-v1'};
  return{db,budget,store,authorization};}
function ordinary(id:string,upperUnits:number){return{runId:'run',requestId:id,attemptId:`attempt-${id}`,currency:'TEST',unit:'micro' as const,upperUnits,source:'fixture',observedAtMs:2,scope:'verified-completion-attempt-total' as const};}
function explore(id:string,upperUnits:number){return{runId:'run',requestId:id,attemptId:`attempt-${id}`,candidateId:'candidate',upperUnits};}
function reserveBoth(f:ReturnType<typeof fixture>,id:string,units:number){return f.db.transaction(()=>{f.budget.reserve(ordinary(id,units));return f.store.reserve(explore(id,units));}).immediate();}

describe('S2 explicit exploration budget store',()=>{
  it('rejects an ordinary budget bound to a different selection policy revision',()=>{const f=fixture(undefined,'policy:other');expect(()=>f.store.preauthorize(f.authorization)).toThrow(/exploration budget mismatch/);expect(f.store.readAuthorization('run')).toBeNull();expect(f.budget.summary('run').committedUnits).toBe(0n);});
  it('binds one candidate to exact current policy and smaller positive ordinary-budget sublimit',()=>{const f=fixture();const a=f.store.preauthorize(f.authorization);expect(Object.isFrozen(a)).toBe(true);expect(f.store.preauthorize(f.authorization)).toEqual(a);
    expect(()=>f.store.preauthorize({...f.authorization,candidateId:'other'})).toThrow(/mismatch/);
    for(const limitUnits of [0,101])expect(()=>fixture().store.preauthorize({...fixture().authorization,limitUnits})).toThrow();
  });
  it('rejects new grants after approval, first attempt, reservation, or receipt including raw inserts',()=>{for(const late of ['approval','attempt','reservation','receipt'] as const){const f=fixture();
    if(late==='approval'){f.db.prepare("INSERT INTO task VALUES('task','running',NULL,?)").run(now);f.db.prepare("INSERT INTO envelope VALUES('env','C:/work','[]',?)").run(now);f.db.prepare("INSERT INTO run VALUES('run','task','env',0,?)").run(now);f.db.prepare("INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,approval_id,request_ordinal,decision,created_at) VALUES('run','env','t','i',NULL,0,'accept',?)").run(now);}
    if(late==='attempt'){f.db.pragma('foreign_keys=OFF');f.db.prepare("INSERT INTO orchestration_attempt VALUES('attempt','run','task','candidate','running','{}','C:/work',NULL,0)").run();f.db.pragma('foreign_keys=ON');}
    if(late==='reservation'||late==='receipt'){f.budget.reserve(ordinary('one',1));if(late==='receipt')f.budget.observe({runId:'run',requestId:'one',receiptId:'r',revision:1,currency:'TEST',unit:'micro',kind:'unknown',units:null,providerFinal:false,source:'stop',observedAtMs:3});}
    expect(()=>f.store.preauthorize(f.authorization)).toThrow(/too late/);
    const payload=JSON.stringify(Object.fromEntries(Object.entries(f.authorization).sort(([a],[b])=>a.localeCompare(b))));
    expect(()=>f.db.prepare('INSERT INTO exploration_budget_authorization VALUES(?,?,?,?,?,?,?,?,?,?,?,cue_sha256(?))').run('run','policy',1,f.authorization.policyDigest,'candidate','TEST','micro',60,now,'test-v1',payload,payload)).toThrow();
  }});
  it('requires an outer transaction and exact existing ordinary reservation without double charging it',()=>{const f=fixture();f.store.preauthorize(f.authorization);expect(()=>f.store.reserve(explore('one',20))).toThrow(/transaction_required/);
    f.db.transaction(()=>expect(()=>f.store.reserve(explore('one',20))).toThrow(/ordinary reservation mismatch/)).immediate();
    const state=reserveBoth(f,'one',20);expect(state.committedUnits).toBe(20n);expect(f.budget.summary('run').committedUnits).toBe(20n);
    f.db.transaction(()=>expect(f.store.reserve(explore('one',20)).committedUnits).toBe(20n)).immediate();
    f.db.transaction(()=>expect(()=>f.store.reserve({...explore('one',20),attemptId:'changed'})).toThrow(/request_mismatch/)).immediate();
  });
  it('rolls back ordinary and exploration reservations together',()=>{const f=fixture();f.store.preauthorize(f.authorization);expect(()=>f.db.transaction(()=>{f.budget.reserve(ordinary('one',20));f.store.reserve(explore('one',20));throw Error('rollback');}).immediate()).toThrow('rollback');
    expect(f.db.prepare('SELECT count(*) n FROM integration_budget_reservation').get()).toEqual({n:0});expect(f.db.prepare('SELECT count(*) n FROM exploration_budget_reservation').get()).toEqual({n:0});
  });
  it('uses ordinary receipt truth for pending, actual, unknown, overrun debt, and next denial',()=>{const f=fixture();f.store.preauthorize(f.authorization);reserveBoth(f,'one',40);
    f.budget.observe({runId:'run',requestId:'one',receiptId:'estimate',revision:1,currency:'TEST',unit:'micro',kind:'estimated',units:50,providerFinal:false,source:'meter',observedAtMs:3});expect(f.store.summary('run').committedUnits).toBe(50n);
    f.budget.observe({runId:'run',requestId:'one',receiptId:'unknown',revision:2,currency:'TEST',unit:'micro',kind:'unknown',units:null,providerFinal:false,source:'stop',observedAtMs:4});expect(f.store.summary('run').committedUnits).toBe(50n);
    f.budget.observe({runId:'run',requestId:'one',receiptId:'actual',revision:3,currency:'TEST',unit:'micro',kind:'actual',units:75,providerFinal:true,source:'trusted',observedAtMs:5});const debt=f.store.summary('run');expect(debt.actualUnits).toBe(75n);expect(debt.debtUnits).toBe(15n);
    f.db.transaction(()=>{f.budget.reserve(ordinary('two',1));expect(()=>f.store.reserve(explore('two',1))).toThrow(/limit_exceeded/);}).immediate();
  });
  it('rejects foreign candidate, exhausted subcap, reset, mutation, and REPLACE',()=>{const f=fixture();f.store.preauthorize(f.authorization);reserveBoth(f,'one',60);
    f.db.transaction(()=>{f.budget.reserve(ordinary('two',1));expect(()=>f.store.reserve(explore('two',1))).toThrow(/limit_exceeded/);}).immediate();
    f.db.transaction(()=>expect(()=>f.store.reserve({...explore('two',1),candidateId:'foreign'})).toThrow(/candidate_mismatch/)).immediate();
    expect(()=>f.db.prepare('UPDATE exploration_budget_authorization SET limit_units=100').run()).toThrow(/immutable/);expect(()=>f.db.prepare('DELETE FROM exploration_budget_authorization').run()).toThrow(/immutable/);
    expect(()=>f.db.prepare('INSERT OR REPLACE INTO exploration_budget_authorization SELECT * FROM exploration_budget_authorization').run()).toThrow(/immutable/);
    expect(()=>f.db.prepare('UPDATE exploration_budget_reservation SET upper_units=59').run()).toThrow(/immutable/);expect(()=>f.db.prepare('DELETE FROM exploration_budget_reservation').run()).toThrow(/immutable/);
    expect(()=>f.db.prepare('INSERT OR REPLACE INTO exploration_budget_reservation SELECT * FROM exploration_budget_reservation').run()).toThrow(/immutable/);
  });
  it('reopens with canonical immutable rows and fails closed on corrupt payload lineage',()=>{const dir=mkdtempSync(join(tmpdir(),'cue-explore-'));dirs.push(dir);const path=join(dir,'ledger.db'),f=fixture(path);f.store.preauthorize(f.authorization);reserveBoth(f,'one',20);f.db.close();const reopened=openLedger(path);reopened.exec(migration);dbs.push(reopened);const store=createExplorationBudgetStore(reopened);expect(store.summary('run').committedUnits).toBe(20n);
    reopened.exec('DROP TRIGGER exploration_budget_reservation_no_update');reopened.prepare("UPDATE exploration_budget_reservation SET payload='{}'").run();expect(()=>store.summary('run')).toThrow(/corrupt/);
  });
  it('rejects proxies, accessors, extra fields, zero values and raw payload mismatches before authority changes',()=>{const f=fixture();let calls=0;expect(()=>f.store.preauthorize(new Proxy(f.authorization,{}))).toThrow();expect(()=>f.store.preauthorize({...f.authorization,get candidateId(){calls++;return'candidate';}})).toThrow(/accessor/);expect(calls).toBe(0);expect(()=>f.store.preauthorize({...f.authorization,extra:true} as never)).toThrow(/fields/);
    const payload=JSON.stringify(Object.fromEntries(Object.entries(f.authorization).sort(([a],[b])=>a<b?-1:a>b?1:0)));expect(()=>f.db.prepare('INSERT INTO exploration_budget_authorization VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run('run','policy',1,f.authorization.policyDigest,'candidate','TEST','micro',60,now,'test-v1',payload,'0'.repeat(64))).toThrow(/payload mismatch/);expect(f.store.readAuthorization('run')).toBeNull();f.db.prepare('INSERT INTO exploration_budget_authorization VALUES(?,?,?,?,?,?,?,?,?,?,?,cue_sha256(?))').run('run','policy',1,f.authorization.policyDigest,'candidate','TEST','micro',60,now,'test-v1',payload,payload);expect(f.store.readAuthorization('run')).toMatchObject(f.authorization);
  });
  it('serializes concurrent ordinary plus exploration reservations so only one fits the subcap',async()=>{const dir=mkdtempSync(join(tmpdir(),'cue-explore-race-'));dirs.push(dir);const path=join(dir,'ledger.db'),f=fixture(path);f.store.preauthorize({...f.authorization,limitUnits:40});
    const workers:Worker[]=[],results:Promise<string>[]=[];try{for(const id of ['a','b']){const worker=new Worker(`const{parentPort,workerData}=require('node:worker_threads');(async()=>{const fs=require('node:fs');const{openLedger}=await import(workerData.ledger);const{createBudgetManager}=await import(workerData.budget);const{createExplorationBudgetStore}=await import(workerData.exploration);const db=openLedger(workerData.path);db.exec(fs.readFileSync(workerData.migration,'utf8'));const budget=createBudgetManager(db,{verifyFinalReceipt:()=>false}),store=createExplorationBudgetStore(db);parentPort.once('message',()=>{let result='reserved';try{db.transaction(()=>{budget.reserve(workerData.ordinary);store.reserve(workerData.explore);}).immediate();}catch(e){result=e.message}finally{db.close()}parentPort.postMessage(result);parentPort.close();});parentPort.postMessage('ready');})().catch(e=>parentPort.postMessage(e.message));`,{eval:true,workerData:{path,migration:fileURLToPath(new URL('../migrations/041_exploration_budget.sql',import.meta.url)),ledger:pathToFileURL(resolve('dist/src/ledger.js')).href,budget:pathToFileURL(resolve('dist/src/budget.js')).href,exploration:pathToFileURL(resolve('dist/src/selection/exploration-budget.js')).href,ordinary:ordinary(id,30),explore:explore(id,30)}});workers.push(worker);
      await new Promise<void>((ok,bad)=>{worker.once('error',bad);worker.once('message',m=>m==='ready'?ok():bad(Error(String(m))));});results.push(new Promise<string>((ok,bad)=>{worker.once('error',bad);worker.once('message',ok);}));}
      workers.forEach(worker=>worker.postMessage('go'));expect((await Promise.all(results)).sort()).toEqual(['exploration_budget_limit_exceeded','reserved']);expect(f.store.summary('run').committedUnits).toBe(30n);
    }finally{await Promise.all(workers.map(worker=>worker.terminate()));}
  },15000);
});
