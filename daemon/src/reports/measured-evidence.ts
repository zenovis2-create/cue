import type { Ledger } from '../ledger.js';
import type { EvaluationMeasuredFactEvidence } from '../evaluation/measured-fact-evidence.js';

const SCAN_LIMIT=64,REPORT_LIMIT=20,ATTEMPT_LIMIT=20;
type EvidenceReader={project(input:{factId:string}):EvaluationMeasuredFactEvidence};
const summaries=new WeakSet<object>();
const brand=<T extends object>(value:T):T=>{summaries.add(value);return value};
export function assertRunMeasuredEvidenceSummary(value:unknown):void{if(!value||typeof value!=='object'||!summaries.has(value))throw new TypeError('invalid_run_measured_evidence_summary')}

export function readRunMeasuredEvidenceSummary(db:Ledger,runId:string,reader:EvidenceReader|null){
  const unavailable=()=>brand(Object.freeze({version:'cue-run-measured-evidence-summary-v1',authority:'stored-measured-evidence-summary',availability:'unavailable',reason:'measured-evidence-host-unavailable',
    snapshotRelation:'separate-read-snapshot',scanLimit:SCAN_LIMIT,reportLimit:REPORT_LIMIT,attemptLimit:ATTEMPT_LIMIT,scannedCount:0,omittedCount:0,corruptCount:0,scanComplete:false,records:Object.freeze([]),trialReady:false,promotionEligible:false}));
  if(!reader)return unavailable();
  const candidates=db.prepare('SELECT rowid,fact_id FROM evaluation_measured_fact WHERE run_id=? ORDER BY rowid DESC LIMIT ?').all(runId,SCAN_LIMIT) as {rowid:number;fact_id:string}[];
  const records:any[]=[];let corruptCount=0,omittedCount=0;
  for(const candidate of candidates){
    try{
      const saved=reader.project({factId:candidate.fact_id});
      if(saved.runId!==runId)throw Error('foreign');
      const attempts=saved.attempts.slice(0,ATTEMPT_LIMIT);
      const record=Object.freeze({factId:saved.factId,producer:Object.freeze({class:saved.producer.class,revision:saved.producer.revision,recordedAtMs:saved.producer.recordedAtMs}),
        attemptCount:saved.attempts.length,attemptsOmittedCount:saved.attempts.length-attempts.length,attemptsComplete:saved.attempts.length===attempts.length,
        attempts:Object.freeze(attempts.map(attempt=>Object.freeze({toolId:attempt.toolId,toolRevision:attempt.toolRevision,modelId:attempt.modelId,modelRevision:attempt.modelRevision}))),
        measurements:Object.freeze({quality:Object.freeze({availability:saved.measurements.quality.availability}),
          timing:Object.freeze(saved.measurements.timing.availability==='available'?{availability:'available',elapsedMs:saved.measurements.timing.elapsedMs}:{availability:'unavailable'}),
          accounting:Object.freeze({availability:saved.measurements.accounting.availability})}),trialReady:false,promotionEligible:false});
      if(records.length<REPORT_LIMIT)records.push(record);else omittedCount++;
    }catch{corruptCount++}
  }
  const last=candidates.at(-1),more=Boolean(last&&db.prepare('SELECT 1 FROM evaluation_measured_fact WHERE run_id=? AND rowid<? LIMIT 1').get(runId,last.rowid));
  return brand(Object.freeze({version:'cue-run-measured-evidence-summary-v1',authority:'stored-measured-evidence-summary',availability:'available',snapshotRelation:'separate-read-snapshot',
    scanLimit:SCAN_LIMIT,reportLimit:REPORT_LIMIT,attemptLimit:ATTEMPT_LIMIT,scannedCount:candidates.length,omittedCount,corruptCount,scanComplete:!more,records:Object.freeze(records),trialReady:false,promotionEligible:false}));
}
