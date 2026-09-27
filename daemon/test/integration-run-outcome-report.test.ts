import {afterEach,test,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {openLedger,type Ledger} from '../src/ledger.js';
import {saveLocalSelectionPolicy,bindRunLocalSelectionPolicy} from '../src/selection/local-policy-store.js';
import {validateTaskPlan} from '../src/orchestration/plan.js';
import {readRunOutcomeReport,readRunReport,reportJson} from '../src/reports/ir.js';
import {renderReportHtml} from '../src/reports/html.js';
const handles:Ledger[]=[];afterEach(()=>handles.splice(0).forEach(db=>db.close()));
function fixture(){
 const db=openLedger();handles.push(db);const time='2026-09-12T00:00:00.000Z',eh='a'.repeat(64);
 db.prepare('INSERT INTO task VALUES(?,?,NULL,?)').run('task','completed',time);
 db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(eh,'C:/private/SECRET','[]',time);
 db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('run','task',eh,0,time);
 const p=saveLocalSelectionPolicy(db,{policyId:'local',expectedRevision:null,createdAt:time,sourceVersion:'fixture',policy:{version:'cue-local-selection-v1',mode:'efficiency',producerCandidateId:'producer',checkerCandidateId:'checker',limitAttempts:2,timeoutMs:1000}});
 bindRunLocalSelectionPolicy(db,{runId:'run',policyId:p.policyId,revision:p.revision,digest:p.digest,boundAt:time});
 const approval={policyRevision:'local:1',policyDigest:p.digest,requirementIds:['req'],allowedCandidateIds:['producer','checker'],allowedScopeIds:[]};
 const plan=validateTaskPlan(approval,{revision:'v1',policyRevision:'local:1',policyDigest:p.digest,tasks:[
 {id:'make',role:'model-producer',ownerId:'maker',requirementIds:['req'],dependencyIds:[],candidateIds:['producer'],scopeIds:[]},
 {id:'verify',role:'verifier',ownerId:'checker',requirementIds:['req'],dependencyIds:['make'],candidateIds:['checker'],scopeIds:[]}]});
 db.prepare('INSERT INTO orchestration_plan VALUES(?,?,?,?)').run('run',eh,plan.digest,JSON.stringify(plan));
 for(const task of plan.tasks)db.prepare('INSERT INTO orchestration_step VALUES(?,?,?)').run('run',task.id,'completed');return db;
}
test('real SQLite report includes separate outcome digest without upgrading completed task to acceptance',()=>{
 const db=fixture(),before=db.serialize(),base=readRunReport(db,'run')!,baseJson=reportJson(base),combined=readRunOutcomeReport(db,'run')!;
 expect(combined.details).toMatchObject({baseReportDigest:base.digest,outcomeSnapshotRelation:'separate-read-transaction',runOutcome:{status:'recorded',outcome:'unknown',quality:null,elapsedMs:null,authority:'evaluation-input-only'}});
 expect((combined.details as any).runOutcome.sourceDigest).toMatch(/^[a-f0-9]{64}$/);
 expect(combined.digest).not.toBe(base.digest);expect(reportJson(base)).toBe(baseJson);expect(readRunReport(db,'run')!.digest).toBe(base.digest);expect(db.serialize()).toEqual(before);
 const rendered=renderReportHtml(combined),dom=new JSDOM(rendered.html);try{
  expect(dom.window.document.querySelector('details pre')!.textContent).toContain('separate-read-transaction');
  expect(dom.window.document.querySelector('details pre')!.textContent).toContain('단계 관측과 별도 읽기 시점');
  expect(rendered.specificationSha256).toBe(createHash('sha256').update(reportJson(combined)).digest('hex'));
  expect(dom.window.document.querySelectorAll('script,img,iframe')).toHaveLength(0);expect(rendered.html).not.toContain('SECRET');
 }finally{dom.window.close();}
});
test('each explicit read refreshes outcome while original report remains independent',()=>{
 const db=fixture(),first=readRunOutcomeReport(db,'run')!;db.prepare("UPDATE task SET state='failed' WHERE id='task'").run();
 const next=readRunOutcomeReport(db,'run')!;expect((next.details as any).runOutcome.outcome).toBe('fail');expect(next.digest).not.toBe(first.digest);
 expect((next.details as any).baseReportDigest).toBe((first.details as any).baseReportDigest);
 expect(readRunOutcomeReport(db,'missing')).toBeNull();
});
test('outcome read error yields fixed unavailable without leaking data or fabricating outcome',()=>{
 const db=fixture();db.prepare("UPDATE task SET state='blocked',blocked_reason='SECRET' WHERE id='task'").run();
 const originalPrepare=db.prepare.bind(db);
 db.prepare=((sql:string)=>{if(sql.includes('cancel_requested'))throw Error('C:/SECRET sql');return originalPrepare(sql);}) as any;
 const report=readRunOutcomeReport(db,'run')!;
 expect((report.details as any).runOutcome).toMatchObject({status:'unavailable',reason:'stored-evidence-unavailable'});expect(reportJson(report)).not.toContain('SECRET');
 db.prepare=originalPrepare;
});
test('outer writer transaction is rejected before either report read',()=>{
 const db=fixture();db.exec('BEGIN');try{expect(()=>readRunOutcomeReport(db,'run')).toThrow('outcome_report_boundary');}finally{db.exec('ROLLBACK');}
});
