import {afterEach,expect,test,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createCueCore,initializeConfig,type CueCore} from '../../app/core.mjs';
import {openLedger} from '../src/ledger.js';
import {saveSelectionPolicy,bindRunSelectionPolicy} from '../src/selection/policy-store.js';
import {validateTaskPlan} from '../src/orchestration/plan.js';
import {normalizeEnvelope,envelopeHash} from '../src/envelope.js';
import {createMeasurementContractStore,freezeMeasurementDefinition} from '../src/evaluation/measurement-contracts.js';
import {createEvaluationEnrollmentStore} from '../src/evaluation/enrollment.js';
import {createEvaluationObservationStore} from '../src/evaluation/observations.js';
import {createEvaluationMeasuredFactStore} from '../src/evaluation/measured-facts.js';
import {createAuthoritativeAccountingStore} from '../src/evaluation/authoritative-accounting.js';
import {createMeasuredTrialConverter} from '../src/evaluation/measured-trial.js';
import {createEvaluationStudy} from '../src/evaluation/comparison.js';
import {createEvaluationBaselineStore} from '../src/evaluation/baseline.js';
import {readFixedBaselinePlan} from '../src/evaluation/baseline-plan.js';
import {createBudgetManager} from '../src/budget.js';
const roots:string[]=[],cores:CueCore[]=[];
afterEach(async()=>{for(const core of cores.splice(0))await core.close();for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});
const h=(v:string)=>createHash('sha256').update(v).digest('hex');
/** Synthetic host/receipts/activity, never real provider or user evidence. */
function fixture(options:{outcome?:'fail'|'cancelled'|'unknown';offline?:boolean;baseline?:boolean;complete?:boolean;domain?:boolean;noHost?:boolean}={}){
 const root=mkdtempSync(join(tmpdir(),'cue-measured-trial-'));roots.push(root);const workspace=join(root,'work');mkdirSync(workspace);
 let raw:any,now=10,batch:any;
 const defs:any={metric:{scoreMinimum:0,scoreMaximum:options.domain?100:1,algorithmRevision:'test-metric-v1'},environment:{schemaRevision:'env-v1',complete:options.complete!==false,fields:{os:'fixture'}},accountLimits:{schemaRevision:'limits-v1',complete:true,fields:{limit:100}},price:{provider:'fixture',currency:'TEST',unit:'minor',effectiveAtMs:1}};
 const host={read:vi.fn((kind:string,id:string,revision:string)=>({id,revision,sourceRevision:'fixture-v1',...freezeMeasurementDefinition(defs[kind])})),nowMs:()=>now,capture:vi.fn(()=>raw),captureHandoffAttribution:()=>batch,resolveEvidence:vi.fn((ref:string)=>['input','quality','timing','invoice'].includes(ref)?Buffer.from(ref):null),terminalIntegrity:(attemptId:string)=>({status:'verified',attemptId})};
 const config=initializeConfig(join(root,'data'),{worktreeRoot:workspace}),core=createCueCore(config,undefined,options.noHost?{}:{measuredFactHost:host});cores.push(core);const db=core.daemon.db;
 const authority=options.offline===false?'host-observed':'offline-fixture',contracts=createMeasurementContractStore(db,host,authority),metric=contracts.registerMetric({id:'metric',revision:'v1'}),environment=contracts.registerEnvironment({id:'environment',revision:'v1'}),limits=contracts.registerAccountLimits({id:'limits',revision:'v1'}),price=contracts.registerPrice({id:'price',revision:'v1'});
 const env=normalizeEnvelope({run_id:'run',worktree_realpath:workspace,allowed_actions:['file_change'],egress:[],expires_at:'2027-01-01T00:00:00.000Z',autonomy_level:'bounded'}),eh=envelopeHash(env);
 db.prepare("INSERT INTO task VALUES('task','awaiting_approval',NULL,'now')").run();db.prepare("INSERT INTO envelope VALUES(?,?,'[]','now')").run(eh,workspace);db.prepare("INSERT INTO run VALUES('run','task',?,0,'now')").run(eh);
 const policy=saveSelectionPolicy(db,{policyId:'policy',expectedRevision:null,createdAt:'2026-09-22T00:00:00.000Z',sourceVersion:'fixture',policy:{version:'cue-selection-v1',mode:'efficiency',qualityMinimum:.5,costBasis:1,timeBasisMs:1,currency:'TEST',costLimit:null,remainingTimeMs:null,maxEstimateAgeMs:100,allowedCandidateIds:['writer','checker'],pinnedCandidateId:null}});bindRunSelectionPolicy(db,{runId:'run',policyId:'policy',revision:1,digest:policy.digest,boundAt:'2026-09-22T00:00:00.000Z'});
 const approval={policyRevision:'policy:1',policyDigest:policy.digest,requirementIds:['r'],allowedCandidateIds:['writer','checker'],allowedScopeIds:[]},plan=validateTaskPlan(approval,{revision:'v1',policyRevision:approval.policyRevision,policyDigest:approval.policyDigest,tasks:[{id:'make',role:'implementation',ownerId:'maker',requirementIds:['r'],dependencyIds:[],candidateIds:['writer'],scopeIds:[]},{id:'check',role:'verifier',ownerId:'reviewer',requirementIds:['r'],dependencyIds:['make'],candidateIds:['checker'],scopeIds:[]}]});db.prepare('INSERT INTO orchestration_plan VALUES(?,?,?,?)').run('run',eh,plan.digest,JSON.stringify(plan));
 const input={enrollmentId:'enrollment',runId:'run',dataset:{id:'dataset',revision:'v1',cases:[{id:'eval',kind:'code',split:'evaluation',inputDigest:h('input')},{id:'hold',kind:'code',split:'holdout',inputDigest:h('hold')}]},caseId:'eval',policy:{kind:'monetary',policyId:'policy',revision:1,digest:policy.digest},metric:{id:metric.id,revision:metric.revision,digest:metric.digest},environment:{id:environment.id,revision:environment.revision,digest:environment.digest},accountLimits:{id:limits.id,revision:limits.revision,digest:limits.digest},enrolledAtMs:20};
 const enrollment=options.baseline?createEvaluationBaselineStore(db,()=>true).declare({...input,baselineId:'baseline',candidate:readFixedBaselinePlan(db,'run').candidate,planDigest:plan.digest,authorityRef:{id:'fixture-consent',revision:'v1',digest:h('consent')}}).enrollment:createEvaluationEnrollmentStore(db).enroll({...input,arm:'efficiency'});
 // Deliberately synthetic launch/identity/handoff rows; fixture terminal authority
 // stands in for native receipt qualification. Removed guards are test-only.
 for(const {name} of db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name IN ('orchestration_launch_intent','orchestration_attempt_identity','orchestration_handoff')").all() as {name:string}[])db.exec(`DROP TRIGGER "${name}"`);
 const subjects:any[]=[],activity:any[]=[];
 for(const [attemptId,taskId,candidateId,role] of [['base','make','writer','implementation'],['verify','check','checker','verifier']]){
  db.prepare('INSERT INTO orchestration_step VALUES(?,?,?)').run('run',taskId,'completed');db.prepare("INSERT INTO orchestration_attempt VALUES(?,?,?,?,?,'{}',?,NULL,1)").run(attemptId,'run',taskId,candidateId,'completed',workspace);
  db.prepare('INSERT INTO orchestration_launch_intent VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(attemptId,'run',taskId,candidateId,h('selection'),h('subject'),role+'-tool','tool-v1',role+'-model','model-v1',eh,h('stage'),plan.digest,policy.digest,h('launch-'+attemptId),Buffer.from('{}'));
  db.pragma('foreign_keys=OFF');db.prepare('INSERT INTO orchestration_attempt_identity VALUES(?,?,?,?,?,?,?)').run('identity-'+attemptId,attemptId,h('subject'),'session:'+attemptId,21,h('identity-'+attemptId),Buffer.from('{}'));db.pragma('foreign_keys=ON');
  db.prepare('INSERT INTO orchestration_receipt VALUES(?,?,1,?)').run('terminal-'+attemptId,attemptId,JSON.stringify({runId:'run',taskId,attemptId,receiptId:'terminal-'+attemptId,revision:1,outcome:'succeeded',cleanup:'clean',evidenceRef:'fixture',observedAtMs:30}));
  const hp=JSON.stringify({attemptId});db.prepare('INSERT INTO orchestration_handoff VALUES(?,?,?,?,?,?,?,?,?)').run('handoff-'+attemptId,attemptId,'terminal-'+attemptId,1,'identity-'+attemptId,'succeeded','clean',h(hp),Buffer.from(hp));
  subjects.push({attemptId,role,state:'completed',retryOf:null,candidateDigest:h(candidateId),launchIntentDigest:h('launch-'+attemptId),identityDigest:h('identity-'+attemptId),handoffDigest:h(hp),toolId:role+'-tool',toolRevision:'tool-v1',modelId:role+'-model',modelRevision:'model-v1'});
  const events=['usage','tool','output','terminal'].map((kind,n)=>{const eventId=attemptId+'-'+kind,payload=JSON.stringify({kind});db.prepare('INSERT INTO orchestration_activity VALUES(?,?,?,?)').run(eventId,attemptId,n+1,payload);return{eventId,ordinal:n+1,kind,canonicalPayloadDigest:h(payload)};});activity.push({attemptId,terminalOrdinal:4,events,manifestDigest:h(JSON.stringify(events))});
 }
 const budget=createBudgetManager(db,{verifyFinalReceipt:()=>true});budget.initialize({runId:'run',currency:'TEST',unit:'minor',limitUnits:100,policyRevision:'policy:1',source:'fixture',observedAtMs:20});
 for(const [requestId,attemptId,units] of [['one','base',20],['two','verify',30]] as const){budget.reserve({runId:'run',requestId,attemptId,currency:'TEST',unit:'minor',upperUnits:50,source:'fixture',observedAtMs:21,scope:'verified-completion-attempt-total'});budget.observe({runId:'run',requestId,receiptId:requestId+'-1',revision:1,currency:'TEST',unit:'minor',kind:'actual',units,providerFinal:true,source:'fixture',observedAtMs:25});}
 const outcome=options.outcome??'fail';db.prepare('UPDATE task SET state=?,blocked_reason=?').run(outcome==='fail'?'failed':'blocked',outcome==='cancelled'?'cancelled':null);
 const observation=createEvaluationObservationStore(db).observe({enrollmentId:'enrollment',observationId:'observation',expectedPriorRevision:0},35);expect(observation.outcome?.status).toBe('recorded');
 const accounting=createAuthoritativeAccountingStore(db).captureCurrent('run');
 raw={producerRevision:'fixture-v1',producerDigest:h('producer'),executedInput:{expectedDigest:h('input'),actualDigest:h('input'),matches:true,evidenceRef:'input',evidenceDigest:h('input')},executionSubjects:subjects,activityCutoff:{attempts:activity,manifestDigest:h(JSON.stringify(activity))},quality:{metricDigest:metric.digest,verifierProducerDigest:h('independent-checker'),score:.8,evidenceRef:'quality',evidenceDigest:h('quality'),artifacts:[]},timing:{startMs:1,endMs:101,elapsedMs:100,clockId:'fixture-clock',clockRevision:'v1',clockDigest:h('clock'),evidenceRef:'timing',evidenceDigest:h('timing'),scope:'execution-queue-cleanup'},environmentDigest:environment.digest,accountLimitsDigest:limits.digest,priceDigest:price.digest,accounting:{kind:'monetary',currency:'TEST',unit:'minor',items:accounting.items.map(item=>({attemptId:item.attemptId,receiptId:item.latestAtCutoff!.receiptId,receiptRevision:item.latestAtCutoff!.revision,receiptDigest:item.latestAtCutoff!.payloadDigest,providerFinal:true,actualUnits:item.latestAtCutoff!.units,currency:'TEST',unit:'minor',priceDigest:price.digest,priceObservedAtMs:10,usageAtMs:25,class:'untrusted-class',evidenceRef:'invoice',evidenceDigest:h('invoice')})),totalUnits:50},uncertaintyReasons:[]};
 batch={version:'cue-handoff-cost-attribution-batch-v1',runId:'run',accountingDigest:accounting.digest,items:accounting.items.map(item=>({attributionId:'allocation-'+item.requestId,runId:'run',requestId:item.requestId,attemptId:item.attemptId,budgetReceiptId:item.latestAtCutoff!.receiptId,budgetReceiptRevision:1,budgetReceiptDigest:item.latestAtCutoff!.payloadDigest,handoffId:'handoff-'+item.attemptId,handoffDigest:h(JSON.stringify({attemptId:item.attemptId})),executionReceiptId:'terminal-'+item.attemptId,executionReceiptRevision:1,totalUnits:item.latestAtCutoff!.units,baseUnits:item.costClass==='base'?15:0,retryUnits:0,verificationUnits:item.costClass==='verification'?25:0,handoffUnits:5,currency:'TEST',unit:'minor',evidenceRef:'invoice',evidenceDigest:h('invoice'),observedAtMs:39}))};
 now=40;const facts=createEvaluationMeasuredFactStore(db,host,authority),capture=()=>facts.capture({factId:'fact',enrollmentId:'enrollment',observationId:'observation'}),convert=()=>core.convertEvaluationMeasuredTrial({factId:'fact'});
 return{root,workspace,config,core,db,host,raw,defs,enrollment,budget,accounting,capture,convert,omitPartition:()=>{batch=null;raw.uncertaintyReasons=['handoff-cost-disposition-unavailable:base','handoff-cost-disposition-unavailable:verify'];},reopen:()=>{const next=createCueCore(config,undefined,{measuredFactHost:host});cores.push(next);return next;}};
}

test('complete fixture converts failure with all cost partitions, source lineage and zero writes/captures, survives reopen',async()=>{
 const f=fixture(),fact=f.capture(),before=f.db.prepare('SELECT total_changes() n').get(),captures=f.host.capture.mock.calls.length,view=f.convert();
 expect(view).toMatchObject({status:'convertible',source:'fixture',outcome:'fail',reasons:[],promotionEligible:false,trial:{source:'fixture',outcome:'fail',quality:.8,elapsedMs:100,costs:{currency:'TEST',unit:'minor',baseUnits:15,retryUnits:0,verificationUnits:25,handoffUnits:10}}});
 expect(view.executionIdentity.members).toHaveLength(2);expect(view.factDigest).toBe(fact.digest);expect(fact.trialReady).toBe(false);expect(Object.isFrozen(view.trial!.costs)).toBe(true);
 expect(createEvaluationStudy(f.enrollment.dataset).record(view.trial).totalCostUnits).toBe(50);expect(f.db.prepare('SELECT total_changes() n').get()).toEqual(before);expect(f.host.capture).toHaveBeenCalledTimes(captures);expect(f.convert()).toEqual(view);
 expect(f.db.prepare('SELECT count(*) n FROM evaluation_trial_projection').get()).toEqual({n:0});await f.core.close();cores.splice(cores.indexOf(f.core),1);expect(f.reopen().convertEvaluationMeasuredTrial({factId:'fact'})).toEqual(view);
});
test.each(['cancelled','unknown'] as const)('complete %s is retained rather than counted as success or dropped',outcome=>{const f=fixture({outcome});f.capture();expect(f.convert()).toMatchObject({status:'convertible',outcome,trial:{outcome,source:'fixture'}});});
test('host-observed label is retained without giving promotion authority (host itself is synthetic in this test)',()=>{const f=fixture({offline:false});f.capture();expect(f.convert()).toMatchObject({source:'observed',status:'convertible',trial:{source:'observed'},promotionEligible:false});});
test('manual fixed-plan baseline uses real saved declaration and original task candidate identities',()=>{const f=fixture({baseline:true});f.capture();expect(f.convert()).toMatchObject({status:'convertible',trial:{arm:'manual-baseline'}});});
test.each([
 ['quality',(f:any)=>{f.raw.quality=null;f.raw.uncertaintyReasons=['quality-unavailable'];},'quality-unavailable'],
 ['timing',(f:any)=>{f.raw.timing=null;f.raw.uncertaintyReasons=['timing-unavailable'];},'timing-unavailable'],
 ['partial timing',(f:any)=>{f.raw.timing.scope='execution';},'timing-scope-incomplete'],
 ['clock revision',(f:any)=>{f.raw.timing.clockRevision='unknown';},'clock-revision-unavailable'],
 ['producer revision',(f:any)=>{f.raw.producerRevision='unknown';},'producer-revision-unavailable'],
 ['tool revision',(f:any)=>{f.db.prepare("UPDATE orchestration_launch_intent SET tool_revision='unknown' WHERE attempt_id='base'").run();f.raw.executionSubjects[0].toolRevision='unknown';},'execution-revision-unavailable'],
 ['model revision',(f:any)=>{f.db.prepare("UPDATE orchestration_launch_intent SET model_revision=NULL WHERE attempt_id='base'").run();f.raw.executionSubjects[0].modelRevision=null;},'execution-revision-unavailable'],
 ['input mismatch',(f:any)=>{f.raw.executedInput.actualDigest=h('quality');f.raw.executedInput.evidenceRef='quality';f.raw.executedInput.evidenceDigest=h('quality');f.raw.executedInput.matches=false;},'executed-input-mismatch'],
 ['partition',(f:any)=>f.omitPartition(),'cost-partition-unavailable'],
 ['unknown cost',(f:any)=>{f.raw.accounting={kind:'unknown'};f.raw.priceDigest=null;f.raw.uncertaintyReasons=['accounting-unavailable'];f.host.captureHandoffAttribution=()=>null;},'final-monetary-accounting-unavailable'],
 ['uncertainty',(f:any)=>{f.raw.uncertaintyReasons=['provider-usage-unknown'];},'fact:provider-usage-unknown'],
] as const)('incomplete %s returns no trial and an explicit reason',(_name,mutate,reason)=>{const f=fixture();mutate(f);f.capture();expect(f.convert()).toMatchObject({status:'insufficient',trial:null,promotionEligible:false});expect(f.convert().reasons).toContain(reason);});
test.each([{complete:false},{domain:true}])('unsupported measurement contracts never normalize or fabricate scores: %j',options=>{const f=fixture(options);f.capture();expect(f.convert()).toMatchObject({status:'insufficient',trial:null});});
test('outer transaction and nonexistent fact are refused without creating data',()=>{
 const f=fixture();f.capture();f.db.exec('BEGIN');expect(()=>f.convert()).toThrow('unavailable');f.db.exec('ROLLBACK');
 expect(()=>createMeasuredTrialConverter(f.db,f.host).convert({factId:'missing'})).toThrow('missing');expect(f.db.prepare('SELECT count(*) n FROM evaluation_trial_projection').get()).toEqual({n:0});
});
test('newer final billing invalidates conversion without rewriting historical fact',()=>{const f=fixture(),saved=f.capture();expect(f.convert().status).toBe('convertible');f.budget.observe({runId:'run',requestId:'one',receiptId:'one-2',revision:2,currency:'TEST',unit:'minor',kind:'actual',units:22,providerFinal:true,source:'fixture',observedAtMs:45});const view=f.convert();expect(view.factDigest).toBe(saved.digest);expect(view.reasons).toContain('accounting-superseded');expect(view.trial).toBeNull();});
test.each(['writer-flag','writer-lease','running'])('unsettled run %s never yields a trial despite completed attempt rows',state=>{
 const f=fixture();f.capture();
 if(state==='writer-flag')f.db.prepare('UPDATE run SET write_in_progress=1').run();
 else if(state==='writer-lease')f.db.prepare('INSERT INTO workspace_write_lease VALUES(?,?,?)').run(f.workspace,'run','now');
 else f.db.prepare("UPDATE task SET state='running'").run();
 expect(f.convert()).toMatchObject({status:'insufficient',trial:null});expect(f.convert().reasons).toContain('execution-unsettled');
});
test('changed terminal outcome invalidates the old observation',()=>{const f=fixture();f.capture();f.db.prepare("UPDATE task SET state='blocked',blocked_reason='cancelled'").run();expect(f.convert().reasons).toContain('outcome-superseded');});
test('altered evidence and corrupted stored fact fail rather than becoming convertible',()=>{const f=fixture();f.capture();f.host.resolveEvidence.mockImplementation(()=>Buffer.from('drift'));expect(()=>f.convert()).toThrow('input_match');f.host.resolveEvidence.mockImplementation(ref=>Buffer.from(ref));f.db.exec('DROP TRIGGER evaluation_measured_fact_update');f.db.prepare("UPDATE evaluation_measured_fact SET case_id='different'").run();expect(()=>f.convert()).toThrow('integrity');});
test('Core denies missing host, foreign workspace and hostile request before evidence callbacks',()=>{
 const absent=fixture({noHost:true});absent.capture();expect(()=>absent.convert()).toThrow('unavailable');
 const f=fixture();f.capture();f.host.resolveEvidence.mockClear();let touched=0;
 for(const input of [{factId:'fact',quality:1},new Proxy({factId:'fact'},{get(){touched++;throw Error('trap');}}),Object.defineProperty({},'factId',{enumerable:true,get(){touched++;return'fact';}})])expect(()=>f.core.convertEvaluationMeasuredTrial(input as any)).toThrow();
 const foreign=join(f.root,'foreign');mkdirSync(foreign);
 const foreignCore=createCueCore({...f.config,worktreeRoot:foreign},f.core.daemon,{measuredFactHost:f.host});
 expect(()=>foreignCore.convertEvaluationMeasuredTrial({factId:'fact'})).toThrow('unavailable');expect(touched).toBe(0);expect(f.host.resolveEvidence).not.toHaveBeenCalled();
});
test('same-connection host mutations or cross-store reentry cannot produce a conversion',()=>{
 const f=fixture();f.capture();f.db.exec('CREATE TABLE probe(value INTEGER)');let once=false;
 f.host.resolveEvidence.mockImplementation(ref=>{if(!once){once=true;f.db.exec('INSERT INTO probe VALUES(1)');}return Buffer.from(ref);});expect(()=>f.convert()).toThrow('concurrent-change');
 f.host.resolveEvidence.mockImplementation(ref=>{createMeasuredTrialConverter(f.db,f.host).convert({factId:'fact'});return Buffer.from(ref);});expect(()=>f.convert()).toThrow('reentrant');
 f.host.resolveEvidence.mockImplementation(ref=>Buffer.from(ref));expect(f.convert().status).toBe('convertible');
});
test('separate SQLite connection commits during validation are detected, even unrelated writes',()=>{
 const f=fixture();f.capture();f.db.exec('CREATE TABLE probe(value INTEGER)');const file=(f.db.pragma('database_list') as any[]).find(row=>row.name==='main').file,other=openLedger(file);let once=false;
 try{f.host.resolveEvidence.mockImplementation(ref=>{if(!once){once=true;other.exec('INSERT INTO probe VALUES(1)');}return Buffer.from(ref);});expect(()=>f.convert()).toThrow('concurrent-change');}finally{other.close();}
});
