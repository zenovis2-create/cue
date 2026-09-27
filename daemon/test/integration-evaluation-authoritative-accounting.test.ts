import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { openLedger, type Ledger } from '../src/ledger.js';
import { createBudgetManager, type BudgetReceipt, type BudgetReservation } from '../src/budget.js';
import { createLocalInvocationBudget } from '../src/local-invocation-budget.js';
import { validateTaskPlan } from '../src/orchestration/plan.js';
import { createAuthoritativeAccountingStore } from '../src/evaluation/authoritative-accounting.js';

const roots:string[]=[],dbs:Ledger[]=[];
afterEach(()=>{for(const db of dbs.splice(0))if(db.open)db.close();for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});
function fixture(){
  const root=mkdtempSync(join(tmpdir(),'cue-accounting-'));roots.push(root);const path=join(root,'ledger.sqlite'),db=openLedger(path);dbs.push(db);
  db.prepare("INSERT INTO task VALUES('root','running',NULL,'now')").run();db.prepare("INSERT INTO envelope VALUES('env',?,'[]','now')").run(root);
  db.prepare("INSERT INTO run VALUES('run','root','env',0,'now')").run();
  const approval={policyRevision:'p1',policyDigest:'a'.repeat(64),requirementIds:['r'],allowedCandidateIds:['candidate'],allowedScopeIds:[]};
  const plan=validateTaskPlan(approval,{revision:'one',policyRevision:'p1',policyDigest:approval.policyDigest,tasks:[
    {id:'make',role:'implementation',ownerId:'maker',requirementIds:['r'],dependencyIds:[],candidateIds:['candidate'],scopeIds:[]},
    {id:'check',role:'verifier',ownerId:'checker',requirementIds:['r'],dependencyIds:['make'],candidateIds:['candidate'],scopeIds:[]}]});
  db.prepare('INSERT INTO orchestration_plan VALUES(?,?,?,?)').run('run','env',plan.digest,JSON.stringify(plan));
  for(const task of plan.tasks)db.prepare('INSERT INTO orchestration_step VALUES(?,?,?)').run('run',task.id,'completed');
  const sort=(value:object)=>JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))));
  const contract=sort({runId:'run',requirementsDigest:'c'.repeat(64),maxAttemptsPerTask:3,maxAttemptsTotal:8,deadlineMs:100,boundAtMs:1,schemaVersion:'cue-retry-v1',envelopeHash:'env',planDigest:plan.digest,policyDigest:approval.policyDigest});
  const contractDigest=createHash('sha256').update(contract).digest('hex');
  db.prepare("INSERT INTO requirement_contract_binding VALUES('run','env',?,?,?,?,?)").run(plan.digest,approval.policyDigest,'c'.repeat(64),'{}','now');
  db.prepare('INSERT INTO orchestration_retry_contract VALUES(?,?,?)').run('run',contract,contractDigest);
  for(const [attempt,task] of [['base','make'],['prior','make'],['retry','make'],['verify','check']] as const)
    db.prepare("INSERT INTO orchestration_attempt VALUES(?,?,?,?,?,'{}',?,NULL,1)").run(attempt,'run',task,'candidate','completed',root);
  const priorReceipt={runId:'run',taskId:'make',attemptId:'prior',receiptId:'prior-receipt',revision:1,outcome:'failed',cleanup:'clean',evidenceRef:'test',observedAtMs:2};
  db.prepare("INSERT INTO orchestration_receipt VALUES('prior-receipt','prior',1,?)").run(JSON.stringify(priorReceipt));
  const retryRef={previousAttemptId:'prior',receiptId:'prior-receipt',contractDigest};
  db.prepare("INSERT INTO orchestration_retry_link VALUES('retry','prior','prior-receipt',?,?)").run(contractDigest,sort({request:retryRef,reason:{cause:'transient',sourceRef:'test',sourceDigest:'d'.repeat(64),observedAtMs:3}}));
  const manager=createBudgetManager(db,{verifyFinalReceipt:()=>true});manager.initialize({runId:'run',currency:'USD',unit:'minor',limitUnits:1000,policyRevision:'p1',source:'test',observedAtMs:1});
  const reserve=(requestId:string,attemptId:string,upperUnits:number):BudgetReservation=>({runId:'run',requestId,attemptId,currency:'USD',unit:'minor',upperUnits,source:'test',observedAtMs:2,scope:'verified-completion-attempt-total'});
  const receipt=(requestId:string,revision:number,units:number,edit:Partial<BudgetReceipt>={}):BudgetReceipt=>({runId:'run',requestId,receiptId:`${requestId}-${revision}`,revision,currency:'USD',unit:'minor',kind:'actual',units,providerFinal:true,source:'test',observedAtMs:3+revision,...edit});
  manager.reserve(reserve('one','base',60));manager.reserve(reserve('two','retry',60));manager.reserve(reserve('three','verify',20));
  manager.observe(receipt('one',1,40));manager.observe(receipt('two',1,50));manager.observe(receipt('three',1,10));
  return{db,path,manager,receipt};
}

describe('authoritative accounting',()=>{
  it('enumerates every reservation, derives classes and totals, and performs no writes',()=>{
    const f=fixture(),store=createAuthoritativeAccountingStore(f.db),before=(f.db.prepare('SELECT total_changes() n').get() as {n:number}).n;
    const snapshot=store.captureCurrent('run');
    expect(snapshot.items.map(item=>[item.requestId,item.costClass])).toEqual([['one','base'],['three','verification'],['two','retry']]);
    expect(snapshot.items.map(item=>item.requestId)).toEqual(['one','three','two']);
    expect(snapshot).toMatchObject({kind:'monetary',committedUnits:'100',actualUnits:'100',totalUnits:'100',completeAtCutoff:true});
    expect((f.db.prepare('SELECT total_changes() n').get() as {n:number}).n).toBe(before);expect(Object.isFrozen(snapshot)).toBe(true);
  });
  it('separates known ledger totals from unknown terminal handoff cost coverage',()=>{
    const f=fixture(),store=createAuthoritativeAccountingStore(f.db),snapshot=store.captureCurrent('run'),coverage=store.inspectHandoffCostCoverage(snapshot);
    expect(snapshot).toMatchObject({totalUnits:'100',completeAtCutoff:true});
    expect(coverage).toMatchObject({version:'cue-handoff-cost-coverage-v1',accountingDigest:snapshot.digest,complete:false,dispositions:[]});
    expect(coverage.unknownReasons).toEqual(['handoff-lineage-unavailable:base','handoff-lineage-unavailable:retry','handoff-lineage-unavailable:verify']);
    expect(Object.isFrozen(coverage)).toBe(true);expect(coverage.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(store.inspectHandoffCostCoverage(snapshot)).toEqual(coverage);
  });
  it('keeps fixed-cutoff history immutable while disclosing a newer receipt from a second connection',()=>{
    const f=fixture(),store=createAuthoritativeAccountingStore(f.db),atCutoff=store.captureCurrent('run');
    const second=openLedger(f.path);dbs.push(second);createBudgetManager(second,{verifyFinalReceipt:()=>true}).observe(f.receipt('one',2,70));
    const projected=store.projectAt('run',atCutoff.cutoff);
    expect(projected.historical).toEqual(atCutoff);expect(projected.currentDisclosure.find(row=>row.requestId==='one')).toMatchObject({currentLatestRevision:2,newerThanCutoff:true});
    expect(store.captureCurrent('run').digest).not.toBe(atCutoff.digest);
  });
  it('retains pending obligations without fabricating a total and rejects old-row tampering',()=>{
    const f=fixture();f.manager.reserve({runId:'run',requestId:'pending',attemptId:'prior',currency:'USD',unit:'minor',upperUnits:80,source:'test',observedAtMs:2,scope:'verified-completion-attempt-total'});
    const store=createAuthoritativeAccountingStore(f.db),snapshot=store.captureCurrent('run');
    expect(snapshot.items.some(item=>item.requestId==='pending'&&item.latestAtCutoff===null)).toBe(true);
    expect(snapshot).toMatchObject({committedUnits:'180',actualUnits:'100',totalUnits:null,completeAtCutoff:false});
    f.db.prepare("UPDATE integration_budget_receipt SET payload='{}' WHERE request_id='one'").run();
    expect(()=>store.projectAt('run',snapshot.cutoff)).toThrow('authoritative_accounting_cutoff_integrity');
  });
  it('binds budget and retry authority, validates receipt IDs, and reports debt parity',()=>{
    const f=fixture(),store=createAuthoritativeAccountingStore(f.db),cutoff=store.captureCurrent('run').cutoff;
    f.db.exec('DROP TRIGGER integration_budget_immutable_update');f.db.prepare("UPDATE integration_budget SET limit_units=999 WHERE run_id='run'").run();
    expect(()=>store.projectAt('run',cutoff)).toThrow('cutoff_integrity');
    const g=fixture(),retryCutoff=createAuthoritativeAccountingStore(g.db).captureCurrent('run').cutoff;
    g.db.exec('DROP TRIGGER orchestration_retry_link_no_update');g.db.prepare("UPDATE orchestration_retry_link SET previous_attempt_id='base' WHERE attempt_id='retry'").run();
    expect(()=>createAuthoritativeAccountingStore(g.db).projectAt('run',retryCutoff)).toThrow('cutoff_integrity');
    const h=fixture();h.manager.observe(h.receipt('one',2,1200));expect(createAuthoritativeAccountingStore(h.db).captureCurrent('run')).toMatchObject({remainingUnits:'0',debtUnits:'260',totalUnits:null,completeAtCutoff:false});
    h.db.prepare("UPDATE integration_budget_receipt SET receipt_id='',payload=? WHERE request_id='three'").run('{"currency":"USD","kind":"actual","observedAtMs":4,"providerFinal":true,"receiptId":"","requestId":"three","revision":1,"runId":"run","source":"test","unit":"minor","units":10}');
    expect(()=>createAuthoritativeAccountingStore(h.db).captureCurrent('run')).toThrow('invalid_id');
  });
  it('discloses post-cutoff reservations and returns complete local count without monetary units',()=>{
    const f=fixture(),store=createAuthoritativeAccountingStore(f.db),historical=store.captureCurrent('run');f.manager.reserve({runId:'run',requestId:'later',attemptId:'prior',currency:'USD',unit:'minor',upperUnits:1,source:'test',observedAtMs:4,scope:'verified-completion-attempt-total'});
    const projection=store.projectAt('run',historical.cutoff);expect(projection.historical).toEqual(historical);expect(projection.currentDisclosure).toContainEqual({requestId:'later',currentLatestRevision:null,newerThanCutoff:true});
    f.db.prepare("INSERT INTO task VALUES('local-root','running',NULL,'now')").run();f.db.prepare("INSERT INTO run VALUES('local','local-root','env',0,'now')").run();
    const approval={policyRevision:'p2',policyDigest:'e'.repeat(64),requirementIds:['r'],allowedCandidateIds:['candidate'],allowedScopeIds:[]};
    const plan=validateTaskPlan(approval,{revision:'one',policyRevision:'p2',policyDigest:approval.policyDigest,tasks:[{id:'make',role:'model-producer',ownerId:'maker',requirementIds:['r'],dependencyIds:[],candidateIds:['candidate'],scopeIds:[]},{id:'check',role:'verifier',ownerId:'checker',requirementIds:['r'],dependencyIds:['make'],candidateIds:['candidate'],scopeIds:[]}]});
    f.db.prepare('INSERT INTO orchestration_plan VALUES(?,?,?,?)').run('local','env',plan.digest,JSON.stringify(plan));for(const task of plan.tasks)f.db.prepare("INSERT INTO orchestration_step VALUES(?,?,'pending')").run('local',task.id);
    f.db.prepare("INSERT INTO orchestration_attempt VALUES('local-attempt','local','make','candidate','running','{}',?,NULL,1)").run(f.db.prepare("SELECT worktree_realpath p FROM envelope WHERE envelope_hash='env'").get() && roots.at(-1));
    const local=createLocalInvocationBudget(f.db);local.initialize({runId:'local',limit:2,policyRevision:'p2',source:'test',observedAtMs:1});f.db.transaction(()=>local.reserve({runId:'local',requestId:'local-request',attemptId:'local-attempt',taskId:'make',candidateId:'candidate',kind:'producer',observedAtMs:2}))();
    expect(createAuthoritativeAccountingStore(f.db).captureCurrent('local')).toMatchObject({kind:'local-invocation',committedUnits:null,totalUnits:null,localCount:{limit:'2',committed:'1',remaining:'1'},completeAtCutoff:true});
  });
  it('bounds post-cutoff disclosure and dependency payloads before materialization',()=>{
    const f=fixture(),store=createAuthoritativeAccountingStore(f.db),cutoff=store.captureCurrent('run').cutoff;f.db.pragma('foreign_keys=OFF');
    const insert=f.db.prepare('INSERT INTO integration_budget_reservation VALUES(?,?,?,?,?)');f.db.transaction(()=>{for(let i=0;i<4097;i++){const requestId=`post-${String(i).padStart(4,'0')}`,attemptId=`post-attempt-${i}`;
      insert.run('run',requestId,attemptId,0,JSON.stringify({attemptId,currency:'USD',observedAtMs:5,requestId,runId:'run',scope:'verified-completion-attempt-total',source:'test',unit:'minor',upperUnits:0}));}})();
    expect(()=>store.projectAt('run',cutoff)).toThrow('inventory_limit');
    const g=fixture();g.db.exec('DROP TRIGGER orchestration_retry_link_no_update');g.db.prepare("UPDATE orchestration_retry_link SET payload=? WHERE attempt_id='retry'").run('x'.repeat(1_048_577));
    expect(()=>createAuthoritativeAccountingStore(g.db).captureCurrent('run')).toThrow('payload_limit');
  });
});
