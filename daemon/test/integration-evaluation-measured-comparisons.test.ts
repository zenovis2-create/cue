import {afterEach,expect,test,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {mkdirSync,mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {registerIpcHandlers} from '../../app/ipc.mjs';
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
import {createEvaluationBaselineStore} from '../src/evaluation/baseline.js';
import {readFixedBaselinePlan} from '../src/evaluation/baseline-plan.js';
import {createBudgetManager} from '../src/budget.js';
const roots:string[]=[],cores:CueCore[]=[];
afterEach(async()=>{vi.useRealTimers();for(const core of cores.splice(0))await core.close();for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});
const h=(v:string)=>createHash('sha256').update(v).digest('hex'),digest=(v:any)=>h(JSON.stringify(v));
/** Offline-only row/receipt/activity authorities; no actual execution. */
function fixture(options:{missingFacts?:boolean;missingObservations?:boolean;missingQuality?:boolean;noHost?:boolean;mixedMetric?:boolean}={}){
 vi.useFakeTimers();vi.setSystemTime(50);
 const root=mkdtempSync(join(tmpdir(),'cue-measured-comparison-'));roots.push(root);const workspace=join(root,'work');mkdirSync(workspace);
 const raws=new Map<string,any>(),partitions=new Map<string,any>();let now=10;
 const defs:any={metric:{scoreMinimum:0,scoreMaximum:1,algorithmRevision:'fixture-v1'},environment:{schemaRevision:'env-v1',complete:true,fields:{os:'fixture'}},accountLimits:{schemaRevision:'limits-v1',complete:true,fields:{limit:100}},price:{provider:'fixture',currency:'TEST',unit:'minor',effectiveAtMs:1}};
 const host={read:vi.fn((kind:string,id:string,revision:string)=>({id,revision,sourceRevision:'fixture-v1',...freezeMeasurementDefinition(defs[kind])})),nowMs:()=>now,capture:vi.fn((ids:any)=>raws.get(ids.factId)),captureHandoffAttribution:(ids:any)=>partitions.get(ids.factId),resolveEvidence:vi.fn((ref:string)=>Buffer.from(ref)),terminalIntegrity:(attemptId:string)=>({status:'verified',attemptId})};
 const config=initializeConfig(join(root,'data'),{worktreeRoot:workspace}),core=createCueCore(config,undefined,options.noHost?{}:{measuredFactHost:host});cores.push(core);const db=core.daemon.db;
 const contracts=createMeasurementContractStore(db,host,'offline-fixture'),metric=contracts.registerMetric({id:'metric',revision:'v1'}),environment=contracts.registerEnvironment({id:'environment',revision:'v1'}),limits=contracts.registerAccountLimits({id:'limits',revision:'v1'}),price=contracts.registerPrice({id:'price',revision:'v1'});
 const alternateMetric=options.mixedMetric?contracts.registerMetric({id:'other-metric',revision:'v1'}):metric;
 const policy=saveSelectionPolicy(db,{policyId:'policy',expectedRevision:null,createdAt:'2026-09-22T00:00:00.000Z',sourceVersion:'fixture',policy:{version:'cue-selection-v1',mode:'efficiency',qualityMinimum:.5,costBasis:1,timeBasisMs:100,currency:'TEST',costLimit:null,remainingTimeMs:null,maxEstimateAgeMs:100,allowedCandidateIds:['writer','checker'],pinnedCandidateId:null}});
 const dataset={id:'dataset',revision:'v1',cases:['e1','e2','h1','h2'].map(id=>({id,kind:'code',split:id[0]==='e'?'evaluation':'holdout',inputDigest:h('input-'+id)}))};
 for(const {name} of db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name IN ('orchestration_launch_intent','orchestration_attempt_identity','orchestration_handoff')").all() as {name:string}[])db.exec(`DROP TRIGGER "${name}"`);
 const baselineEnrollmentIds:string[]=[],candidateEnrollmentIds:string[]=[],budgets=new Map<string,ReturnType<typeof createBudgetManager>>();
 for(const item of dataset.cases)for(const arm of ['manual-baseline','efficiency'] as const){
  const selectedMetric=arm==='efficiency'?alternateMetric:metric;
  const runId=arm+'-'+item.id,enrollmentId='enroll-'+runId,observationId='obs-'+runId,factId='fact-'+runId;
  const env=normalizeEnvelope({run_id:runId,worktree_realpath:workspace,allowed_actions:['file_change'],egress:[],expires_at:'2027-01-01T00:00:00.000Z',autonomy_level:'bounded'}),eh=envelopeHash(env);
  db.prepare('INSERT INTO task VALUES(?,?,NULL,?)').run(runId,'awaiting_approval','now');db.prepare("INSERT INTO envelope VALUES(?,?,'[]','now')").run(eh,workspace);db.prepare('INSERT INTO run VALUES(?,?,?,0,?)').run(runId,runId,eh,'now');bindRunSelectionPolicy(db,{runId,policyId:'policy',revision:1,digest:policy.digest,boundAt:'2026-09-22T00:00:00.000Z'});
  const approval={policyRevision:'policy:1',policyDigest:policy.digest,requirementIds:['r'],allowedCandidateIds:['writer','checker'],allowedScopeIds:[]},plan=validateTaskPlan(approval,{revision:'v1',policyRevision:approval.policyRevision,policyDigest:approval.policyDigest,tasks:[{id:'make',role:'implementation',ownerId:'maker',requirementIds:['r'],dependencyIds:[],candidateIds:['writer'],scopeIds:[]},{id:'check',role:'verifier',ownerId:'reviewer',requirementIds:['r'],dependencyIds:['make'],candidateIds:['checker'],scopeIds:[]}]});db.prepare('INSERT INTO orchestration_plan VALUES(?,?,?,?)').run(runId,eh,plan.digest,JSON.stringify(plan));
  const input={enrollmentId,runId,dataset,caseId:item.id,policy:{kind:'monetary',policyId:'policy',revision:1,digest:policy.digest},metric:{id:selectedMetric.id,revision:selectedMetric.revision,digest:selectedMetric.digest},environment:{id:environment.id,revision:environment.revision,digest:environment.digest},accountLimits:{id:limits.id,revision:limits.revision,digest:limits.digest},enrolledAtMs:20};
  if(arm==='manual-baseline')createEvaluationBaselineStore(db,()=>true).declare({...input,baselineId:'baseline-'+runId,candidate:readFixedBaselinePlan(db,runId).candidate,planDigest:plan.digest,authorityRef:{id:'fixture-consent',revision:'v1',digest:h('consent')}});else createEvaluationEnrollmentStore(db).enroll({...input,arm});
  (arm==='manual-baseline'?baselineEnrollmentIds:candidateEnrollmentIds).push(enrollmentId);
  const subjects:any[]=[],activity:any[]=[];
  for(const [suffix,taskId,candidateId,role] of [['base','make','writer','implementation'],['verify','check','checker','verifier']]){
   const attemptId=runId+':'+suffix;db.prepare('INSERT INTO orchestration_step VALUES(?,?,?)').run(runId,taskId,'completed');db.prepare("INSERT INTO orchestration_attempt VALUES(?,?,?,?,?,'{}',?,NULL,1)").run(attemptId,runId,taskId,candidateId,'completed',workspace);
   db.prepare('INSERT INTO orchestration_launch_intent VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(attemptId,runId,taskId,candidateId,h('selection'),h('subject'),role+'-tool','tool-v1',role+'-model','model-v1',eh,h('stage'),plan.digest,policy.digest,h('launch-'+attemptId),Buffer.from('{}'));
   db.pragma('foreign_keys=OFF');db.prepare('INSERT INTO orchestration_attempt_identity VALUES(?,?,?,?,?,?,?)').run('identity-'+attemptId,attemptId,h('subject'),'session:'+attemptId,21,h('identity-'+attemptId),Buffer.from('{}'));db.pragma('foreign_keys=ON');
   db.prepare('INSERT INTO orchestration_receipt VALUES(?,?,1,?)').run('terminal-'+attemptId,attemptId,JSON.stringify({runId,taskId,attemptId,receiptId:'terminal-'+attemptId,revision:1,outcome:'succeeded',cleanup:'clean',evidenceRef:'fixture',observedAtMs:30}));const hp=JSON.stringify({attemptId});db.prepare('INSERT INTO orchestration_handoff VALUES(?,?,?,?,?,?,?,?,?)').run('handoff-'+attemptId,attemptId,'terminal-'+attemptId,1,'identity-'+attemptId,'succeeded','clean',h(hp),Buffer.from(hp));
   subjects.push({attemptId,role,state:'completed',retryOf:null,candidateDigest:h(candidateId),launchIntentDigest:h('launch-'+attemptId),identityDigest:h('identity-'+attemptId),handoffDigest:h(hp),toolId:role+'-tool',toolRevision:'tool-v1',modelId:role+'-model',modelRevision:'model-v1'});
   const events=['usage','tool','output','terminal'].map((kind,n)=>{const eventId=attemptId+'-'+kind,payload=JSON.stringify({kind});db.prepare('INSERT INTO orchestration_activity VALUES(?,?,?,?)').run(eventId,attemptId,n+1,payload);return{eventId,ordinal:n+1,kind,canonicalPayloadDigest:h(payload)};});activity.push({attemptId,terminalOrdinal:4,events,manifestDigest: digest(events)});
  }
  const budget=createBudgetManager(db,{verifyFinalReceipt:()=>true});budgets.set(runId,budget);budget.initialize({runId,currency:'TEST',unit:'minor',limitUnits:100,policyRevision:'policy:1',source:'fixture',observedAtMs:20});
  for(const [suffix,units] of [['base',20],['verify',30]] as const){const requestId=runId+':'+suffix;budget.reserve({runId,requestId,attemptId:requestId,currency:'TEST',unit:'minor',upperUnits:50,source:'fixture',observedAtMs:21,scope:'verified-completion-attempt-total'});budget.observe({runId,requestId,receiptId:requestId+'-1',revision:1,currency:'TEST',unit:'minor',kind:'actual',units,providerFinal:true,source:'fixture',observedAtMs:25});}
  db.prepare("UPDATE task SET state='failed' WHERE id=?").run(runId);
  if(!options.missingObservations)createEvaluationObservationStore(db).observe({enrollmentId,observationId,expectedPriorRevision:0},35);
  const accounting=createAuthoritativeAccountingStore(db).captureCurrent(runId),elapsed=arm==='manual-baseline'?120:100;
  raws.set(factId,{producerRevision:'fixture-v1',producerDigest:h('producer'),executedInput:{expectedDigest:item.inputDigest,actualDigest:item.inputDigest,matches:true,evidenceRef:'input-'+item.id,evidenceDigest:item.inputDigest},executionSubjects:subjects,activityCutoff:{attempts:activity,manifestDigest:digest(activity)},quality:options.missingQuality?null:{metricDigest:selectedMetric.digest,verifierProducerDigest:h('checker'),score:.8,evidenceRef:'quality',evidenceDigest:h('quality'),artifacts:[]},timing:{startMs:1,endMs:1+elapsed,elapsedMs:elapsed,clockId:'fixture-clock',clockRevision:'v1',clockDigest:h('clock'),evidenceRef:'timing',evidenceDigest:h('timing'),scope:'execution-queue-cleanup'},environmentDigest:environment.digest,accountLimitsDigest:limits.digest,priceDigest:price.digest,accounting:{kind:'monetary',currency:'TEST',unit:'minor',items:accounting.items.map(a=>({attemptId:a.attemptId,receiptId:a.latestAtCutoff!.receiptId,receiptRevision:1,receiptDigest:a.latestAtCutoff!.payloadDigest,providerFinal:true,actualUnits:a.latestAtCutoff!.units,currency:'TEST',unit:'minor',priceDigest:price.digest,priceObservedAtMs:10,usageAtMs:25,class:'fixture',evidenceRef:'invoice',evidenceDigest:h('invoice')})),totalUnits:50},uncertaintyReasons:options.missingQuality?['quality-unavailable']:[]});
  partitions.set(factId,{version:'cue-handoff-cost-attribution-batch-v1',runId,accountingDigest:accounting.digest,items:accounting.items.map(a=>({attributionId:'allocation-'+a.requestId,runId,requestId:a.requestId,attemptId:a.attemptId,budgetReceiptId:a.latestAtCutoff!.receiptId,budgetReceiptRevision:1,budgetReceiptDigest:a.latestAtCutoff!.payloadDigest,handoffId:'handoff-'+a.attemptId,handoffDigest:digest({attemptId:a.attemptId}),executionReceiptId:'terminal-'+a.attemptId,executionReceiptRevision:1,totalUnits:a.latestAtCutoff!.units,baseUnits:a.costClass==='base'?15:0,retryUnits:0,verificationUnits:a.costClass==='verification'?25:0,handoffUnits:5,currency:'TEST',unit:'minor',evidenceRef:'invoice',evidenceDigest:h('invoice'),observedAtMs:39}))});
  now=40;if(!options.missingFacts&&!options.missingObservations)createEvaluationMeasuredFactStore(db,host,'offline-fixture').capture({factId,enrollmentId,observationId});
 }
 const request={snapshotId:'snapshot',baselineEnrollmentIds,candidateEnrollmentIds,constraints:{mode:'efficiency' as const,baselinePolicyDigest:policy.digest,candidatePolicyDigest:policy.digest,maxPriceAgeMs:100,minPairsPerSplit:2,qualityFloor:.5,minSuccessRate:.5,maxUnknownRate:.5,costLimitUnits:null,costBasisUnits:1,timeBasisMs:100,minImprovement:0}};
 return{root,workspace,config,core,db,host,request,budgets,create:()=>core.createEvaluationMeasuredComparison(request)};
}

test('complete paired cohort saves measured receipts and numeric comparison, unchanged exact replay and callback-free reopen',async()=>{
 const f=fixture(),captures=f.host.capture.mock.calls.length,before=f.db.prepare('SELECT count(*) n FROM approval_event').get(),saved=f.create();
 expect(saved.numericInputs).toBe('complete-cohort');expect(saved.members).toHaveLength(8);expect(saved.members.every(m=>m.conversion?.source==='fixture')).toBe(true);expect(saved.comparison.measurementSource).toBe('fixture');expect(saved.improvementProven).toBe(false);expect(saved.promotionEligible).toBe(false);
 expect(saved.availability[0].baseline).toMatchObject({expectedCaseCount:2,trialCount:2,outcomeDenominator:2,outcomes:{fail:2,unavailable:0}});expect(saved.comparison.splits[0].baseline.cost?.mean).toBe(50);expect(saved.comparison.splits[0].candidate.elapsed?.mean).toBe(100);
 expect(f.db.prepare('SELECT count(*) n FROM approval_event').get()).toEqual(before);expect(f.host.capture).toHaveBeenCalledTimes(captures);
 f.host.resolveEvidence.mockImplementation(()=>{throw Error('historical read must not observe');});vi.setSystemTime(999);expect(f.create()).toEqual(saved);expect(f.core.readEvaluationMeasuredComparison('snapshot')).toEqual(saved);expect(f.core.inspectEvaluationMeasuredComparison('snapshot').current.status).toBe('unavailable');expect(f.db.prepare('SELECT count(*) n FROM evaluation_comparison_snapshot').get()).toEqual({n:1});
 await f.core.close();cores.splice(cores.indexOf(f.core),1);const reopened=createCueCore(f.config);cores.push(reopened);expect(reopened.readEvaluationMeasuredComparison('snapshot')).toEqual(saved);expect(reopened.inspectEvaluationMeasuredComparison('snapshot').current.status).toBe('unavailable');
});
test.each([{missingFacts:true},{missingObservations:true},{missingQuality:true}])('missing cohort data remains counted and no selected-subset numerical performance is reported: %j',options=>{
 const f=fixture(options),saved=f.create();expect(saved.numericInputs).toBe('withheld-incomplete-or-incompatible-cohort');expect(saved.comparison.status).toBe('insufficient');expect(saved.comparison.splits[0].baseline.n).toBe(0);expect(saved.availability[0].baseline.outcomeDenominator).toBe(2);expect(saved.availability[0].baseline.trialCount).toBe(0);expect(saved.members).toHaveLength(8);
 expect(saved.availability[0].baseline.outcomes).toMatchObject(options.missingObservations?{unavailable:2}:{fail:2});
});
test('complete facts using different metric contracts cannot be numerically compared',()=>{
 const f=fixture({mixedMetric:true}),saved=f.create();expect(saved.members.every(m=>m.conversion?.trial)).toBe(true);expect(saved.incompatibleMetric).toBe(true);expect(saved.numericInputs).toBe('withheld-incomplete-or-incompatible-cohort');expect(saved.comparison.status).toBe('insufficient');
});
test('source scalar tamper and wrong snapshot versions refuse without callbacks',()=>{
 const f=fixture();f.create();f.host.resolveEvidence.mockClear();expect(()=>f.core.readEvaluationComparison('snapshot')).toThrow();
 f.db.exec('DROP TRIGGER evaluation_measured_fact_update');f.db.prepare("UPDATE evaluation_measured_fact SET case_id='wrong' WHERE fact_id='fact-efficiency-e1'").run();expect(()=>f.core.readEvaluationMeasuredComparison('snapshot')).toThrow('source');expect(f.host.resolveEvidence).not.toHaveBeenCalled();
});
test('oversized, sparse and getter enrollment lists reject before capture',()=>{
 const f=fixture();f.host.resolveEvidence.mockClear();let touched=0;const getter=Object.defineProperty([f.request.baselineEnrollmentIds[0]],'0',{enumerable:true,get(){touched++;return 'x';}});
 for(const baselineEnrollmentIds of [Array.from({length:65},(_,n)=>'enroll-'+n),Array(2),getter])expect(()=>f.core.createEvaluationMeasuredComparison({...f.request,baselineEnrollmentIds})).toThrow();expect(touched).toBe(0);expect(f.host.resolveEvidence).not.toHaveBeenCalled();
});
test('omitted enrollment is explicitly unavailable in the full dataset denominator, even when all selected facts convert',()=>{
 const f=fixture();f.request.candidateEnrollmentIds=f.request.candidateEnrollmentIds.slice(1);const saved=f.create();expect(saved.availability[0].candidate).toMatchObject({expectedCaseCount:2,enrollmentCount:1,outcomeDenominator:2,outcomes:{fail:1,unavailable:1},missingEnrollmentCount:1});expect(saved.numericInputs).toBe('withheld-incomplete-or-incompatible-cohort');
});
test('newer observation without a fact never falls back to an older convertible fact',()=>{
 const f=fixture(),old=f.create(),enrollmentId=f.request.candidateEnrollmentIds[0];createEvaluationObservationStore(f.db).observe({enrollmentId,observationId:'later',expectedPriorRevision:1},45);
 expect(f.core.readEvaluationMeasuredComparison('snapshot')).toEqual(old);expect(f.core.inspectEvaluationMeasuredComparison('snapshot').current.status).toBe('changed');
 const next=f.core.createEvaluationMeasuredComparison({...f.request,snapshotId:'next'}),member=next.members.find(m=>m.enrollmentId===enrollmentId)!;expect(member).toMatchObject({observationId:'later',factId:null,conversion:null,reasons:['fact-missing'],outcome:'fail'});expect(next.numericInputs).toBe('withheld-incomplete-or-incompatible-cohort');
});
test('new billing leaves historical numbers immutable and is disclosed by separate inspection',()=>{
 const f=fixture(),old=f.create(),runId='efficiency-e1',requestId=runId+':base';f.budgets.get(runId)!.observe({runId,requestId,receiptId:'revised',revision:2,currency:'TEST',unit:'minor',kind:'actual',units:22,providerFinal:true,source:'fixture',observedAtMs:45});
 expect(f.core.readEvaluationMeasuredComparison('snapshot')).toEqual(old);expect(f.core.inspectEvaluationMeasuredComparison('snapshot').current.status).toBe('changed');
 const next=f.core.createEvaluationMeasuredComparison({...f.request,snapshotId:'next'});expect(next.members.find(m=>m.runId===runId)!.reasons).toContain('accounting-superseded');expect(next.numericInputs).toBe('withheld-incomplete-or-incompatible-cohort');
});
test('unreadable current evidence creates explicit unavailable slots rather than removing their failures',()=>{
 const f=fixture();f.host.resolveEvidence.mockImplementation(()=>{throw Error('missing bytes');});const saved=f.create();expect(saved.members.every(m=>m.reasons.includes('conversion-unavailable'))).toBe(true);expect(saved.availability[0].candidate.outcomes.fail).toBe(2);expect(saved.availability[0].candidate.nonConvertibleCount).toBe(2);
});
test('changed identity membership or constraints cannot reuse an immutable snapshot id; reordered sets replay',()=>{
 const f=fixture(),saved=f.create();expect(f.core.createEvaluationMeasuredComparison({...f.request,baselineEnrollmentIds:[...f.request.baselineEnrollmentIds].reverse()})).toEqual(saved);
 expect(()=>f.core.createEvaluationMeasuredComparison({...f.request,constraints:{...f.request.constraints,costLimitUnits:NaN}})).toThrow();
 expect(()=>f.core.createEvaluationMeasuredComparison({...f.request,candidateEnrollmentIds:f.request.candidateEnrollmentIds.slice(1)})).toThrow('replay-conflict');expect(()=>f.core.createEvaluationMeasuredComparison({...f.request,constraints:{...f.request.constraints,qualityFloor:.8}})).toThrow('replay-conflict');
 expect(()=>f.db.prepare('DELETE FROM evaluation_comparison_snapshot').run()).toThrow('immutable');expect(()=>f.db.prepare("UPDATE evaluation_comparison_snapshot SET payload='{}'").run()).toThrow('immutable');
});
test('invalid membership/constraints/shape are rejected before evidence callbacks and no snapshot is inserted',()=>{
 const f=fixture();f.host.resolveEvidence.mockClear();let touched=0;const getter=Object.defineProperty({},'x',{enumerable:true,get(){touched++;return 1;}});
 for(const input of [{...f.request,confirmed:true},{...f.request,recordedAtMs:50},{...f.request,baselineEnrollmentIds:[f.request.baselineEnrollmentIds[0],f.request.baselineEnrollmentIds[0]]},{...f.request,candidateEnrollmentIds:f.request.baselineEnrollmentIds},{...f.request,constraints:{...f.request.constraints,costBasisUnits:getter}},{...f.request,constraints:{...f.request.constraints,minPairsPerSplit:0}},new Proxy(f.request,{get(){touched++;throw Error('trap');}})])expect(()=>f.core.createEvaluationMeasuredComparison(input as any)).toThrow();
 expect(f.host.resolveEvidence).not.toHaveBeenCalled();expect(touched).toBe(0);expect(f.db.prepare('SELECT count(*) n FROM evaluation_comparison_snapshot').get()).toEqual({n:0});
});
test('Core missing host and foreign workspace deny new creation, historical read respects workspace too',()=>{
 const absent=fixture({noHost:true});expect(()=>absent.create()).toThrow('host-unavailable');
 const f=fixture();f.create();const foreign=join(f.root,'foreign');mkdirSync(foreign);const other=createCueCore({...f.config,worktreeRoot:foreign},f.core.daemon,{measuredFactHost:f.host});f.host.resolveEvidence.mockClear();expect(()=>other.createEvaluationMeasuredComparison({...f.request,snapshotId:'other'})).toThrow('scope');expect(()=>other.readEvaluationMeasuredComparison('snapshot')).toThrow('scope');expect(f.host.resolveEvidence).not.toHaveBeenCalled();
});
test('forged numeric trial is rejected even after recomputing conversion, snapshot and envelope hashes',()=>{
 const f=fixture();f.create();const row=f.db.prepare("SELECT payload FROM evaluation_comparison_snapshot WHERE snapshot_id='snapshot'").get() as any,p=JSON.parse(row.payload),c=p.members[0].conversion;c.trial.costs.baseUnits++;
 const {digest:_old,...body}=c;c.digest=digest(body);f.db.exec('DROP TRIGGER evaluation_comparison_snapshot_update');f.db.prepare("UPDATE evaluation_comparison_snapshot SET payload=?,payload_digest=?,membership_digest=? WHERE snapshot_id='snapshot'").run(JSON.stringify(p),digest(p),digest(p.members));expect(()=>f.core.readEvaluationMeasuredComparison('snapshot')).toThrow(/trial|integrity/);
 for(const mutate of [(m:any)=>{m.conversion=false;},(m:any)=>{m.observationId='';}]){const altered=JSON.parse(row.payload);mutate(altered.members[0]);f.db.prepare("UPDATE evaluation_comparison_snapshot SET payload=?,payload_digest=?,membership_digest=? WHERE snapshot_id='snapshot'").run(JSON.stringify(altered),digest(altered),digest(altered.members));expect(()=>f.core.readEvaluationMeasuredComparison('snapshot')).toThrow();}
});
test('changed original fact bytes invalidate historical linkage without observing the host',()=>{
 const f=fixture();f.create();f.host.resolveEvidence.mockClear();f.db.exec('DROP TRIGGER evaluation_measured_fact_update');f.db.prepare("UPDATE evaluation_measured_fact SET payload='{}' WHERE fact_id=?").run('fact-efficiency-e1');expect(()=>f.core.readEvaluationMeasuredComparison('snapshot')).toThrow('source');expect(f.host.resolveEvidence).not.toHaveBeenCalled();
});
test('same-connection changes during conversion cause snapshot refusal with no partial insert',()=>{
 const f=fixture();f.db.exec('CREATE TABLE probe(value INTEGER)');let once=false;f.host.resolveEvidence.mockImplementation(ref=>{if(!once){once=true;f.db.exec('INSERT INTO probe VALUES(1)');}return Buffer.from(ref);});expect(()=>f.create()).toThrow('concurrent-change');expect(f.db.prepare('SELECT count(*) n FROM evaluation_comparison_snapshot').get()).toEqual({n:0});
});
test('a separate connection committing during capture invalidates the entire snapshot',()=>{
 const f=fixture();f.db.exec('CREATE TABLE probe(value INTEGER)');const filename=(f.db.pragma('database_list') as any[]).find(x=>x.name==='main').file,other=openLedger(filename);let once=false;
 try{f.host.resolveEvidence.mockImplementation(ref=>{if(!once){once=true;other.exec('INSERT INTO probe VALUES(1)');}return Buffer.from(ref);});expect(()=>f.create()).toThrow('concurrent-change');expect(f.db.prepare('SELECT count(*) n FROM evaluation_comparison_snapshot').get()).toEqual({n:0});}finally{other.close();}
});
test('dedicated list pages only verified measured snapshots without observing evidence',()=>{
 const f=fixture();f.create();f.core.createEvaluationMeasuredComparison({...f.request,snapshotId:'second'});f.host.resolveEvidence.mockClear();
 const page=f.core.listEvaluationMeasuredComparisons({limit:1,cursor:null});expect(page.records.map(r=>r.snapshotId)).toEqual(['second']);expect(page.complete).toBe(false);
 const next=f.core.listEvaluationMeasuredComparisons({limit:2,cursor:page.nextCursor});expect(next.records.map(r=>r.snapshotId)).toEqual(['snapshot']);expect(next.complete).toBe(true);expect(f.core.listEvaluationComparisons({limit:20,cursor:null}).records).toEqual([]);expect(f.host.resolveEvidence).not.toHaveBeenCalled();
 const foreign=join(f.root,'foreign-list');mkdirSync(foreign);const other=createCueCore({...f.config,worktreeRoot:foreign},f.core.daemon);expect(other.listEvaluationMeasuredComparisons({limit:20,cursor:null}).records).toEqual([]);
 for(const input of [{limit:0,cursor:null},{limit:21,cursor:null},{limit:1,cursor:0},{limit:1,cursor:9999},{limit:1,cursor:null,runId:'injected'}])expect(()=>f.core.listEvaluationMeasuredComparisons(input)).toThrow();
});
test('list scans at most64 envelopes and advances across an empty corrupt/legacy page',()=>{
 const f=fixture();f.create();const row=f.db.prepare('SELECT * FROM evaluation_comparison_snapshot').get() as any;
 for(let n=0;n<64;n++)f.db.prepare('INSERT INTO evaluation_comparison_snapshot VALUES(?,?,?,?,?,?,?,?,?)').run('invalid-'+n,row.recorded_at_ms,row.dataset_digest,row.membership_digest,row.constraints_digest,row.result_digest,row.request_digest,row.payload_digest,n%2?'{}':JSON.stringify({version:'cue-evaluation-comparison-snapshot-v1'}));
 f.host.resolveEvidence.mockClear();const empty=f.core.listEvaluationMeasuredComparisons({limit:10,cursor:null});expect(empty.records).toHaveLength(0);expect(empty.nextCursor).toBe(2);expect(empty.complete).toBe(false);
 const final=f.core.listEvaluationMeasuredComparisons({limit:10,cursor:empty.nextCursor});expect(final.records.map(r=>r.snapshotId)).toEqual(['snapshot']);expect(final.complete).toBe(true);expect(f.host.resolveEvidence).not.toHaveBeenCalled();
});
test('actual IPC create/read/list/inspect preserves fixture provenance and redacts raw measurement lineage',()=>{
 const f=fixture(),api=registerIpcHandlers({handle:vi.fn()},f.core),before=f.db.prepare('SELECT count(*) n FROM approval_event').get();
 const created=api.invoke('cue:evaluation',{operation:'measured-comparison-create',...f.request});expect(created).toMatchObject({available:true,value:{snapshotId:'snapshot',measurementSource:'fixture',provenance:{fixture:8,observed:0,unavailable:0},promotionEligible:false,improvementProven:false}});
 expect(created.value.splits[0]).toMatchObject({baseline:{outcomeDenominator:2,outcomes:{fail:2}},numbers:{baseline:{costMeanUnits:50},candidate:{elapsedMeanMs:100}}});
 for(const key of ['members','digest','executionSubjects','evidenceRef','runId','factId','trial'])expect(JSON.stringify(created.value)).not.toContain('"'+key+'"');
 f.host.resolveEvidence.mockClear();expect(api.invoke('cue:evaluation',{operation:'measured-comparison-read',snapshotId:'snapshot'}).value).toEqual(created.value);expect(api.invoke('cue:evaluation',{operation:'measured-comparison-list',limit:10,cursor:null}).value.records).toHaveLength(1);expect(f.host.resolveEvidence).not.toHaveBeenCalled();
 const inspect=api.invoke('cue:evaluation',{operation:'measured-comparison-inspect',snapshotId:'snapshot'});expect(inspect).toMatchObject({available:true,value:{historical:created.value,current:{status:'unchanged',counts:{unchanged:8,changed:0,unavailable:0}}}});expect(f.host.resolveEvidence).toHaveBeenCalled();expect(f.db.prepare('SELECT count(*) n FROM approval_event').get()).toEqual(before);
});
test('IPC incomplete cohort withholds numeric subset and retains full denominator and missing reasons',()=>{
 const f=fixture({missingFacts:true}),api=registerIpcHandlers({handle:vi.fn()},f.core),v=api.invoke('cue:evaluation',{operation:'measured-comparison-create',...f.request}).value;
 expect(v.numericInputs).toBe('withheld-incomplete-or-incompatible-cohort');expect(v.splits.every((s:any)=>s.numbers===null)).toBe(true);expect(v.splits[0].candidate.outcomeDenominator).toBe(2);expect(v.reasonCounts).toEqual({'fact-missing':8});expect(v.provenance.unavailable).toBe(8);
});
test('IPC redacts producer-defined uncertainty text and blocks default-host new creation',()=>{
 const f=fixture({missingQuality:true}),saved=f.create(),copy=structuredClone(saved);(copy.reasonCounts as any)['fact:private-path-or-provider-message']=3;
 const api=registerIpcHandlers({handle:vi.fn()},{readEvaluationMeasuredComparison:()=>copy} as never),v=api.invoke('cue:evaluation',{operation:'measured-comparison-read',snapshotId:'snapshot'}).value;
 expect(v.reasonCounts['quality-unavailable']).toBe(8);expect(v.reasonCounts['other-measurement-uncertainty']).toBe(11);expect(JSON.stringify(v)).not.toContain('private-path');
 const absent=fixture({noHost:true}),noHost=registerIpcHandlers({handle:vi.fn()},absent.core);expect(noHost.invoke('cue:evaluation',{operation:'measured-comparison-create',...absent.request})).toEqual({available:false,reason:'evaluation-unavailable'});
});
test('IPC forbids injected authority, malformed scalar/array commands and does not execute getters or proxies',()=>{
 const create=vi.fn(),api=registerIpcHandlers({handle:vi.fn()},{createEvaluationMeasuredComparison:create} as never),base={operation:'measured-comparison-create',snapshotId:'x',baselineEnrollmentIds:['b'],candidateEnrollmentIds:['c'],constraints:{mode:'efficiency',baselinePolicyDigest:h('b'),candidatePolicyDigest:h('c'),maxPriceAgeMs:1,minPairsPerSplit:2,qualityFloor:.5,minSuccessRate:.5,maxUnknownRate:.5,costLimitUnits:null,costBasisUnits:1,timeBasisMs:1,minImprovement:0}};let touched=0;
 const getter=Object.defineProperty({...base},'snapshotId',{enumerable:true,get(){touched++;return 'x';}}),array=Object.defineProperty(['b'],'0',{enumerable:true,get(){touched++;return 'b';}});
 for(const command of [{...base,trial:{}},{...base,nowMs:50},{...base,constraints:{...base.constraints,costLimitUnits:NaN}},{...base,baselineEnrollmentIds:array},{...base,baselineEnrollmentIds:Array(2)},{...base,candidateEnrollmentIds:['b']},getter,new Proxy(base,{get(){touched++;throw Error('trap');}}),{operation:'measured-comparison-inspect',snapshotId:'x',confirmed:true}])expect(()=>api.invoke('cue:evaluation',command)).toThrow('input denied');
 expect(touched).toBe(0);expect(create).not.toHaveBeenCalled();
});
test('IPC fails closed on hostile output, scalar authority upgrades and mismatched snapshot without leaking failures',()=>{
 const f=fixture(),saved=f.create(),read=vi.fn(),api=registerIpcHandlers({handle:vi.fn()},{readEvaluationMeasuredComparison:read} as never);let touched=0;
 const getter=structuredClone(saved);Object.defineProperty(getter.members[0].conversion!,'trial',{enumerable:true,get(){touched++;return null;}});
 for(const output of [getter,{...saved,promotionEligible:true},{...saved,improvementProven:true},{...saved,request:{...saved.request,snapshotId:'other'}},new Proxy(saved,{get(){touched++;throw Error('secret');}})]){read.mockReturnValueOnce(output);expect(api.invoke('cue:evaluation',{operation:'measured-comparison-read',snapshotId:'snapshot'})).toEqual({available:false,reason:'evaluation-unavailable'});}
 read.mockImplementationOnce(()=>{throw Error('private-path');});expect(api.invoke('cue:evaluation',{operation:'measured-comparison-read',snapshotId:'snapshot'})).toEqual({available:false,reason:'evaluation-unavailable'});expect(touched).toBe(0);
});
test('IPC historical read without measurement host remains available while current inspection is unavailable',async()=>{
 const f=fixture();f.create();await f.core.close();cores.splice(cores.indexOf(f.core),1);const reopened=createCueCore(f.config);cores.push(reopened);const api=registerIpcHandlers({handle:vi.fn()},reopened);
 expect(api.invoke('cue:evaluation',{operation:'measured-comparison-read',snapshotId:'snapshot'}).available).toBe(true);expect(api.invoke('cue:evaluation',{operation:'measured-comparison-list',limit:10,cursor:null}).value.records).toHaveLength(1);
 expect(api.invoke('cue:evaluation',{operation:'measured-comparison-inspect',snapshotId:'snapshot'})).toMatchObject({available:true,value:{current:{status:'unavailable',counts:{unavailable:8}}}});
});
function desktop(core:CueCore){
 const dom=new JSDOM(readFileSync(new URL('../../app/renderer/index.html',import.meta.url),'utf8'),{runScripts:'outside-only',url:'http://localhost'}),bridge=registerIpcHandlers({handle:vi.fn()},core),evaluation=vi.fn(async(input:any)=>bridge.invoke('cue:evaluation',structuredClone(input)));
 (dom.window as any).cue={evaluation,resources:vi.fn(async()=>({available:false})),retrospective:vi.fn(async()=>({available:false})),prepare:vi.fn(async()=>({runId:'ui-run',taskId:'ui-task',threeLines:['a','b','c'],envelope:{expires_at:'2027-01-01T00:00:00Z',worktree_realpath:'fixture',allowed_actions:[]},orchestration:null})),planningAvailability:vi.fn(async()=>({available:false})),selectionPreferences:vi.fn(async()=>({available:false}))};
 dom.window.eval(readFileSync(new URL('../../app/renderer/renderer.js',import.meta.url),'utf8'));
 const el=(id:string)=>dom.window.document.getElementById('evaluation-measured-comparison-'+id) as any,submit=(id:string)=>el(id).dispatchEvent(new dom.window.Event('submit',{cancelable:true}));return{dom,evaluation,el,submit};
}
test('desktop serializes explicit create through IPC/Core/SQLite, then separately reads and inspects',async()=>{
 const f=fixture();vi.useRealTimers();const ui=desktop(f.core);
 try{
  expect(ui.evaluation).not.toHaveBeenCalled();const form=ui.el('create-form');for(const [key,value] of Object.entries(f.request.constraints))form.elements.namedItem(key).value=value===null?'':String(value);
  form.elements.snapshotId.value='snapshot';form.elements.baselineEnrollmentIds.value=f.request.baselineEnrollmentIds.join('\n');form.elements.candidateEnrollmentIds.value=f.request.candidateEnrollmentIds.join('\n');ui.submit('create-form');
  await vi.waitFor(()=>expect(ui.el('output').hidden).toBe(false));expect(ui.el('summary').textContent).toContain('오프라인 픽스처 8');expect(ui.el('splits').textContent).toContain('분모 2');expect(ui.el('splits').textContent).toContain('실패 2');expect(ui.el('current').textContent).toContain('재검사하지 않음');expect(f.db.prepare('SELECT count(*) n FROM evaluation_comparison_snapshot').get()).toEqual({n:1});
  ui.el('read-form').elements.snapshotId.value='snapshot';ui.el('inspect').click();await vi.waitFor(()=>expect(ui.el('current').textContent).toContain('unchanged'));f.host.resolveEvidence.mockClear();ui.submit('read-form');await vi.waitFor(()=>expect(ui.el('current').textContent).toContain('재검사하지 않음'));expect(f.host.resolveEvidence).not.toHaveBeenCalled();
  ui.el('refresh').click();await vi.waitFor(()=>expect(ui.el('records').children).toHaveLength(1));ui.el('records').querySelector('button').click();await vi.waitFor(()=>expect(ui.el('output').hidden).toBe(false));expect(ui.evaluation.mock.calls.at(-1)![0].operation).toBe('measured-comparison-read');
 }finally{ui.dom.window.close();}
});
test('desktop advances an empty measured-list page and does not submit missing performance cost limit',async()=>{
 const f=fixture();vi.useRealTimers();const ui=desktop(f.core);
 try{
  ui.evaluation.mockResolvedValueOnce({available:true,operation:'measured-comparison-list',value:{version:'cue-measured-comparison-list-v1',authority:'bounded-workspace-descriptive-index',order:'sqlite-insertion-desc',records:[],nextCursor:7,complete:false}});
  ui.el('refresh').click();await vi.waitFor(()=>expect(ui.el('next').disabled).toBe(false));expect(ui.el('status').textContent).toContain('빈 페이지');ui.el('next').click();await vi.waitFor(()=>expect(ui.evaluation).toHaveBeenCalledTimes(2));expect(ui.evaluation.mock.calls[1][0]).toEqual({operation:'measured-comparison-list',limit:10,cursor:7});await vi.waitFor(()=>expect(ui.el('status').textContent).toContain('사용할 수 없습니다'));expect(ui.el('next').disabled).toBe(true);
  const before=ui.evaluation.mock.calls.length;ui.el('create-form').elements.mode.value='performance';ui.submit('create-form');expect(ui.el('status').textContent).toContain('비용 상한');expect(ui.evaluation).toHaveBeenCalledTimes(before);
 }finally{ui.dom.window.close();}
});
test('desktop preserves withheld denominators, clears failure details and discards stale response after new run',async()=>{
 const f=fixture({missingFacts:true});f.create();vi.useRealTimers();const ui=desktop(f.core);
 try{
  ui.el('read-form').elements.snapshotId.value='snapshot';ui.submit('read-form');await vi.waitFor(()=>expect(ui.el('output').hidden).toBe(false));expect(ui.el('summary').textContent).toContain('수치 비교 보류');expect(ui.el('splits').textContent).toContain('사실 누락 2');expect(ui.el('splits').textContent).not.toContain('저장 수치');
  ui.evaluation.mockRejectedValueOnce(Error('private-path'));ui.submit('read-form');await vi.waitFor(()=>expect(ui.el('status').textContent).toContain('사용할 수 없습니다'));expect(ui.el('output').hidden).toBe(true);expect(ui.dom.window.document.body.textContent).not.toContain('private-path');
  let finish!:(v:any)=>void;ui.evaluation.mockImplementationOnce(()=>new Promise(resolve=>finish=resolve));ui.submit('read-form');expect(ui.el('inspect').disabled).toBe(true);
  const document=ui.dom.window.document;(document.getElementById('goal') as HTMLTextAreaElement).value='new';document.getElementById('goal-form')!.dispatchEvent(new ui.dom.window.Event('submit',{cancelable:true}));await vi.waitFor(()=>expect(document.getElementById('evaluation-current')!.textContent).toContain('ui-run'));
  finish({available:true,operation:'measured-comparison-read',value:{snapshotId:'stale'}});await Promise.resolve();await Promise.resolve();expect(ui.el('output').hidden).toBe(true);expect(ui.el('summary').textContent).toBe('');expect(ui.el('status').textContent).not.toContain('처리하고');
 }finally{ui.dom.window.close();}
});

test('outer transactions refuse and a denied nested create cannot insert a second snapshot',()=>{
 const f=fixture();f.db.exec('BEGIN');expect(()=>f.create()).toThrow('read_boundary');f.db.exec('ROLLBACK');let blocked=0;
 const secondCore=createCueCore(f.config,f.core.daemon,{measuredFactHost:f.host});
 f.host.resolveEvidence.mockImplementation(ref=>{try{secondCore.createEvaluationMeasuredComparison({...f.request,snapshotId:'nested'});}catch(error){expect(String(error)).toContain('reentrant');blocked++;}return Buffer.from(ref);});const saved=f.create();expect(blocked).toBeGreaterThan(0);expect(saved.members).toHaveLength(8);expect(f.db.prepare('SELECT count(*) n FROM evaluation_comparison_snapshot').get()).toEqual({n:1});
});
