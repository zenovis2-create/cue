import {afterEach,expect,test} from 'vitest';
import {openLedger,type Ledger} from '../src/ledger.js';
import {appendRunMeasuredEvidence,reportJson,sourceReport} from '../src/reports/ir.js';
import {readRunMeasuredEvidenceSummary} from '../src/reports/measured-evidence.js';
import {renderReportHtml} from '../src/reports/html.js';

const handles:Ledger[]=[];afterEach(()=>handles.splice(0).forEach(db=>db.close()));
function fixture(){const db=openLedger();handles.push(db);db.pragma('foreign_keys=OFF');const insert=db.prepare('INSERT INTO evaluation_measured_fact VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  for(let n=0;n<70;n++)insert.run(`fact-${n}`,`enrollment-${n}`,`observation-${n}`,'run','a'.repeat(64),'case','efficiency','b'.repeat(64),'host-observed','revision','c'.repeat(64),n,'d'.repeat(64),'{}');
  insert.run('foreign-fact','foreign-enrollment','foreign-observation','foreign','a'.repeat(64),'case','efficiency','b'.repeat(64),'host-observed','revision','c'.repeat(64),1,'d'.repeat(64),'{}');db.pragma('foreign_keys=ON');return db}
const view=(factId:string)=>({factId,runId:'run',producer:{class:'host-observed',revision:'producer-v1',recordedAtMs:40,digest:'private'},attempts:[{attemptId:'private-attempt',role:'implementation',state:'completed',retryOf:null,candidateDigest:'private-candidate',launchIntentDigest:'private-launch',identityDigest:'private-identity',handoffDigest:'private-handoff',toolId:'tool<&',toolRevision:'tool-v2',modelId:'model',modelRevision:'model-r3'}],measurements:{quality:{availability:'unavailable'},timing:{availability:'available',elapsedMs:3},accounting:{availability:'available',kind:'monetary',priceDigest:'private-price'}},uncertaintyReasons:['private-secret'],trialReady:false,promotionEligible:false}) as any;

test('bounded run scan reports exact within-scan omissions and corruption without leaking private evidence',()=>{
  const db=fixture(),summary=readRunMeasuredEvidenceSummary(db,'run',{project:({factId})=>{if(factId==='fact-68')throw Error('corrupt secret');return view(factId)}}),encoded=JSON.stringify(summary);
  expect(summary).toMatchObject({availability:'available',scanLimit:64,reportLimit:20,attemptLimit:20,scannedCount:64,omittedCount:43,corruptCount:1,scanComplete:false,trialReady:false,promotionEligible:false});
  expect(summary.records).toHaveLength(20);expect(encoded).not.toMatch(/private|uncertainty|score|price|attemptId|candidate|Digest|accounting.{0,40}kind/);
  expect(encoded).not.toContain('foreign-fact');
});

test('host absence is fixed unavailable while accessible empty run is explicitly complete',()=>{
  const db=fixture();expect(readRunMeasuredEvidenceSummary(db,'empty',null)).toEqual({version:'cue-run-measured-evidence-summary-v1',authority:'stored-measured-evidence-summary',availability:'unavailable',reason:'measured-evidence-host-unavailable',snapshotRelation:'separate-read-snapshot',scanLimit:64,reportLimit:20,attemptLimit:20,scannedCount:0,omittedCount:0,corruptCount:0,scanComplete:false,records:[],trialReady:false,promotionEligible:false});
  expect(readRunMeasuredEvidenceSummary(db,'empty',{project:({factId})=>view(factId)})).toMatchObject({availability:'available',scannedCount:0,omittedCount:0,corruptCount:0,scanComplete:true,records:[]});
});

test('branded extension preserves the original report digest and escapes safe metadata in HTML JSON',()=>{
  const original=sourceReport(JSON.stringify({identity:'source',revision:'a'.repeat(40),files:[],nodes:[],edges:[]})),summary=readRunMeasuredEvidenceSummary(fixture(),'run',{project:({factId})=>view(factId)}),extended=appendRunMeasuredEvidence(original,summary);
  expect((extended.details as any).measuredEvidenceBaseReportDigest).toBe(original.digest);expect(reportJson(original)).not.toContain('measuredEvidence');expect(extended.digest).not.toBe(original.digest);
  const html=renderReportHtml(extended).html;expect(html).toContain('tool&lt;&amp;');expect(html).not.toContain('tool<&');expect(()=>appendRunMeasuredEvidence(original,{raw:'secret'})).toThrow('invalid_run_measured_evidence_summary');
});
