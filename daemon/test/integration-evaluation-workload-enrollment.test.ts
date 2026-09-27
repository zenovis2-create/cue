import {createHash} from 'node:crypto';
import {mkdtempSync,realpathSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect,test} from 'vitest';
import {openLedger} from '../src/ledger.js';
import {saveSelectionPolicy,bindRunSelectionPolicy} from '../src/selection/policy-store.js';
import {createEvaluationEnrollmentStore} from '../src/evaluation/enrollment.js';
import {createEvaluationBaselineStore} from '../src/evaluation/baseline.js';
import {readExistingFileWorkload} from '../src/evaluation/workload-release.js';
import {prepareEvaluationWorkloadCase} from '../src/evaluation/workload.js';
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
const ref=(id:string)=>({id,revision:'fixture-v1',digest:hash(id)});
const at='2026-09-22T00:00:00.000Z';

test('eight frozen inputs prepare forty isolated slots with explicit fixture baseline authority and durable enrollment only',()=>{
  const root=realpathSync.native(mkdtempSync(join(tmpdir(),'cue-workload-cohort-'))),file=join(root,'ledger.db');
  let db=openLedger(file);
  try{
    const suite=readExistingFileWorkload(),arms=['manual-baseline','efficiency','performance','value','speed'] as const;
    const enrollments=createEvaluationEnrollmentStore(db),paths=new Set<string>(),saved:ReturnType<typeof enrollments.enroll>[]=[];
    let approvals=0;
    const baselines=createEvaluationBaselineStore(db,request=>{
      approvals++;
      return request.authorityRef.id==='fixture-explicit-baseline'&&request.candidate.id==='baseline-agent'
        &&request.dataset.digest===suite.dataset.digest;
    });
    for(const arm of arms){
      const policy=saveSelectionPolicy(db,{policyId:`policy-${arm}`,expectedRevision:null,createdAt:at,sourceVersion:'offline-fixture',policy:{
        version:'cue-selection-v1',mode:arm==='manual-baseline'?'efficiency':arm,qualityMinimum:1,costBasis:1,timeBasisMs:1000,
        currency:'TEST',costLimit:null,remainingTimeMs:null,maxEstimateAgeMs:100,allowedCandidateIds:['baseline-agent','auto-agent'],
        pinnedCandidateId:arm==='manual-baseline'?'baseline-agent':null,
      }});
      for(const item of suite.cases){
        const prepared=prepareEvaluationWorkloadCase(suite,{caseId:item.id,split:item.split,parent:root});paths.add(prepared.worktreePath);
        const runId=`${arm}-${item.id}`;
        db.prepare('INSERT INTO task VALUES(?,?,NULL,?)').run(`task-${runId}`,'awaiting_approval',at);
        db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(`env-${runId}`,prepared.worktreePath,'[]',at);
        db.prepare('INSERT INTO run VALUES(?,?,?,0,?)').run(runId,`task-${runId}`,`env-${runId}`,at);
        bindRunSelectionPolicy(db,{runId,policyId:policy.policyId,revision:policy.revision,digest:policy.digest,boundAt:at});
        const input={enrollmentId:`enroll-${runId}`,runId,dataset:prepared.dataset,caseId:item.id,arm,
          policy:{kind:'monetary' as const,policyId:policy.policyId,revision:policy.revision,digest:policy.digest},
          metric:ref('fixture-exact-artifacts'),environment:ref('fixture-environment'),accountLimits:ref('fixture-limits'),enrolledAtMs:1000};
        if(arm==='manual-baseline'){
          expect(()=>enrollments.enroll(input)).toThrow('manual_baseline_unsupported');
          const {arm:ignored,...base}=input;
          const declaration={...base,baselineId:`baseline-${item.id}`,candidate:ref('baseline-agent'),authorityRef:ref('fixture-explicit-baseline')};
          expect(()=>createEvaluationBaselineStore(db).declare(declaration)).toThrow('authority_unavailable');
          saved.push(baselines.declare(declaration).enrollment);
        }else saved.push(enrollments.enroll(input));
      }
    }
    expect(paths.size).toBe(40);expect(approvals).toBe(8);expect(saved).toHaveLength(40);
    for(const item of suite.cases){
      const slots=saved.filter(value=>value.caseId===item.id);
      expect(new Set(slots.map(value=>value.inputDigest))).toEqual(new Set([item.inputDigest]));
      expect(new Set(slots.map(value=>value.arm))).toEqual(new Set(arms));
      expect(slots.every(value=>value.inputBinding==='claimed-not-verified')).toBe(true);
    }
    expect(db.prepare('SELECT count(*) n FROM evaluation_dataset').get()).toEqual({n:1});
    expect(db.prepare('SELECT count(*) n FROM approval_event').get()).toEqual({n:0});
    expect(db.prepare('SELECT count(*) n FROM execution_event').get()).toEqual({n:0});
    expect(db.prepare('SELECT count(*) n FROM orchestration_attempt').get()).toEqual({n:0});
    db.close();db=openLedger(file);
    for(const enrollment of saved)expect(createEvaluationEnrollmentStore(db).read(enrollment.enrollmentId)).toEqual(enrollment);
    expect(db.prepare('SELECT count(*) n FROM evaluation_baseline_declaration').get()).toEqual({n:8});
    expect(db.prepare('SELECT count(*) n FROM evaluation_enrollment').get()).toEqual({n:40});
  }finally{if(db.open)db.close();rmSync(root,{recursive:true,force:true});}
});
