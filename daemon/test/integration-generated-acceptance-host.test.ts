import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openLedger, type Ledger } from '../src/ledger.js';
import { normalizeEnvelope, envelopeHash } from '../src/envelope.js';
import { saveSelectionPolicy, bindRunSelectionPolicy } from '../src/selection/policy-store.js';
import { validateTaskPlan } from '../src/orchestration/plan.js';
import { createOrchestrationStore } from '../src/orchestration/store.js';
import { createHandoffActivityStore } from '../src/orchestration/handoff-activity.js';
import { createStageEnvelopeBinder } from '../src/orchestration/stage-envelope.js';
import { createRequirementContractStore, type RequirementKind } from '../src/verification/requirements.js';
import { createGeneratedOutputStore, generatedOutputParametersDigest, type GeneratedOutputParameters, type GeneratedOutputHost } from '../src/verification/generated-output.js';
import { createGeneratedAcceptanceHost, GENERATED_JSON_CHECKER_ID, generatedJsonCheckerRevision, generatedJsonEvidencePolicy, assertGeneratedJsonTemplateBounds } from '../src/verification/generated-acceptance-host.js';
import { createGeneratedModelOutput } from '../src/adapters/generated-model-output.js';
import { createAcceptanceVerifier } from '../src/verification/acceptance.js';
import { createRecoveryPolicyStore } from '../src/orchestration/recovery-policy.js';
import { createBudgetManager } from '../src/budget.js';
import type { ModelControlBundle } from '../src/model-control-bundle.js';
import { recordSession } from '../src/session-spawn.js';
import { checkJsonFormat } from '../src/verification/json-format-checker.cjs';
import type { IsolatedJsonCheckerResult } from '../src/adapters/isolated-json-checker.js';
const roots: string[] = [], handles: Ledger[] = [];
afterEach(() => { for (const db of handles.splice(0)) if (db.open) db.close(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function fixture(kind: RequirementKind = 'document', makerRole: 'model-producer' | 'implementation' = 'model-producer') {
  const root = mkdtempSync(join(tmpdir(), 'cue-generated-')); roots.push(root); const path = join(root, 'ledger.db');
  const db = openLedger(path); handles.push(db); db.pragma('foreign_keys=ON');
  const parent = normalizeEnvelope({ run_id: 'run', worktree_realpath: root, allowed_actions: [], egress: [], expires_at: new Date(10000).toISOString(), autonomy_level: 'bounded' });
  const hash = envelopeHash(parent);
  db.prepare("INSERT INTO task VALUES('root','awaiting_approval',NULL,'now')").run();
  db.prepare("INSERT INTO envelope VALUES(?,?,'[]','now')").run(hash, root);
  db.prepare("INSERT INTO run VALUES('run','root',?,0,'now')").run(hash);
  const policy = saveSelectionPolicy(db, { policyId: 'policy', expectedRevision: null, createdAt: new Date(1000).toISOString(), sourceVersion: 'fixture', policy: {
    version: 'cue-selection-v1', mode: 'efficiency', qualityMinimum: 0.5, costBasis: 1, timeBasisMs: 1, currency: 'TEST', costLimit: null,
    remainingTimeMs: null, maxEstimateAgeMs: 100, allowedCandidateIds: ['model'], pinnedCandidateId: 'model',
  } });
  bindRunSelectionPolicy(db, { runId: 'run', policyId: 'policy', revision: 1, digest: policy.digest, boundAt: new Date(1000).toISOString() });
  const plan = validateTaskPlan({ policyRevision: 'policy:1', policyDigest: policy.digest, requirementIds: ['req'], allowedCandidateIds: ['model'], allowedScopeIds: [] },
    { revision: 'plan1', policyRevision: 'policy:1', policyDigest: policy.digest, tasks: [
      { id: 'make', role: makerRole, ownerId: 'maker', requirementIds: ['req'], dependencyIds: [], candidateIds: ['model'], scopeIds: [] },
      { id: 'check', role: 'verifier', ownerId: 'reviewer', requirementIds: ['req'], dependencyIds: ['make'], candidateIds: ['model'], scopeIds: [] },
    ] });
  const artifactBytes=Buffer.from('generated-host-handoff');
  const scheduler = createOrchestrationStore(db, { authorizePlan: () => true, authorizeClaim: () => true,
    verifyReceipt: context => ({ outcomeVerified: true, cleanupVerified: true,handoff:{handoffId:`handoff-${context.attemptId}`,identityId:`identity-${context.attemptId}`,artifacts:[{kind:'output',sourceRef:`artifact-${context.attemptId}`}]}}),resolveHandoffArtifact:()=>artifactBytes,authorizeHandoffArtifact:()=>true, retry: { now: () => 1000, authorizeContract: () => true,
      classifyFailure: () => ({ cause: 'transient', sourceRef: 'host-proof', sourceDigest: 'a'.repeat(64), observedAtMs: 1000 }) } });
  const handoffs=createHandoffActivityStore(db,{resolveArtifact:()=>artifactBytes,authorizeArtifact:()=>true});
  scheduler.install('run', plan);
  const input = Buffer.from('{"message":"preserve this source value"}');
  const parameters: GeneratedOutputParameters = { version: 'cue-generated-output-v1', kind: 'generated-output', targetId: 'answer', requirementId: 'req', producerTaskId: 'make',
    checkerId: GENERATED_JSON_CHECKER_ID, checkerRevision: generatedJsonCheckerRevision(bundle('json-checker')), inputSha256: sha(input), maxBytes: 4096 };
  const requirementStore = createRequirementContractStore(db, { now: () => 1000, resolveChecker: (id, revision) => ({ id, revision, kinds: [kind],evidencePolicies:[kind==='document'?generatedJsonEvidencePolicy({...parameters,parametersDigest:generatedOutputParametersDigest(parameters)}):{requirementId:'req',kind,producerTaskIds:['make'],sourceRevision:parameters.inputSha256,targetIds:['answer'],checkerId:id,checkerRevision:revision,parametersDigest:generatedOutputParametersDigest(parameters),hostileCheckIds:[],requiredSectionIds:[],claimIds:kind==='research'?['claim']:[],requiresRender:false,...(kind==='external'?{remote:{accountId:'account',resourceId:'resource',operationId:'operation',idempotencyKey:'key',expectedTransition:'updated',observerId:'observer',observerRevision:'v1'}}:{})}] }) });
  const requirements = requirementStore.bind('run', [{ id: 'req', text: 'Produce the approved document response', kind, required: true,
    checks: [{ checkerId: parameters.checkerId, revision: parameters.checkerRevision, parametersDigest: generatedOutputParametersDigest(parameters), targetIds: ['answer'] }] }]);
  const retryContract=scheduler.bindRetryContract({runId:'run',requirementsDigest:requirements.requirements.digest,maxAttemptsPerTask:4,maxAttemptsTotal:8,boundAtMs:1000,deadlineMs:9000});
  const flags = { allowed: true, now: 1000, authorizations: 0, mutateCopy: false };
  const host: GeneratedOutputHost = { now: () => flags.now, authorizeObservation: context => {
    flags.authorizations++; expect(context.stage.owner.run_id).toBe(context.record.attemptId);
    expect(context.target.parametersDigest).toBe(generatedOutputParametersDigest(parameters));
    expect(Object.isFrozen(context.record)).toBe(true);
    if (flags.mutateCopy) context.bytes.fill(0);
    return flags.allowed;
  } };
  const output = createGeneratedOutputStore(db, host);
  const targetInput = { runId: 'run', targetId: 'answer', requirementId: 'req', producerTaskId: 'make', checkerId: parameters.checkerId,
    checkerRevision: parameters.checkerRevision, inputBytes: input, maxBytes: 4096, boundAtMs: 1000 };
  const approve = () => { db.prepare("INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,request_ordinal,decision,created_at) VALUES('run',?,'desktop','goal',0,'accept','now')").run(hash); db.prepare("UPDATE task SET state='running' WHERE id='root'").run(); };
  const binder = createStageEnvelopeBinder(db, { now: () => 1000, authorizeStage: () => true, resolveScope: () => { throw Error('no-scope'); } });
  const stage = (attemptId = 'first', taskId = 'make', retryDigest?: string,active?:{revision:number;planDigest:string;recoveryDecisionId?:string}) => {
    const request = { runId: 'run', taskId, attemptId, candidateId: 'model', observedAtMs: 1000,...active };
    if (retryDigest) scheduler.claimRetry({ ...request, retry: { previousAttemptId: 'first', receiptId: 'receipt-first', contractDigest: retryDigest } });
    else scheduler.claim(request);
    const bound=binder.bind({ workflowRunId: 'run', taskId, attemptId, parentEnvelope: parent,...(active?{revision:active.revision,planDigest:active.planDigest}:{}),
      stage: { worktreeRealpath: root, allowedActions: [], egress: [], expiresAt: parent.expires_at, autonomyLevel: 'bounded' } });
    if(!db.prepare('SELECT 1 FROM attempt_selection WHERE attempt_id=?').get(attemptId))db.prepare("INSERT INTO attempt_selection VALUES(?,'run',?,'monetary',?,'{}')").run(attemptId,`fixture-${attemptId}`,sha(Buffer.from(`selection-${attemptId}`)));
    const selection=db.prepare('SELECT digest FROM attempt_selection WHERE attempt_id=?').get(attemptId) as {digest:string};
    const subjectDigest=attemptId==='first'?'a'.repeat(64):'b'.repeat(64);
    handoffs.recordLaunchIntent({runId:'run',taskId,attemptId,candidateId:'model',selectionDigest:selection.digest,expectedSubjectDigest:subjectDigest,tool:{id:'fixture-tool',revision:'unknown'},model:null,parentEnvelopeHash:hash,stageEnvelopeHash:bound.envelopeHash,planDigest:bound.planDigest,policyDigest:bound.policyDigest});
    return bound;
  };
  const identity=(attemptId:string)=>{const session=db.prepare('SELECT handle FROM session_handle WHERE run_id=?').get(attemptId) as {handle:string};handoffs.recordAttemptIdentity({identityId:`identity-${attemptId}`,attemptId,subjectDigest:attemptId==='first'?'a'.repeat(64):'b'.repeat(64),durableRef:`session:${session.handle}`,observedAtMs:1000});};
  const finish = (outcome: 'failed' | 'succeeded' = 'failed') => {identity('first');return scheduler.finish({ runId: 'run', taskId: 'make', attemptId: 'first', receiptId: 'receipt-first', revision: 1, outcome, cleanup: 'clean', evidenceRef: 'host-receipt', observedAtMs: 1000 });};
  const observation = (attemptId = 'first') => ({ runId: 'run', targetId: 'answer', attemptId, observationId: `response-${attemptId}`, observedAtMs: flags.now, bytes: Buffer.from('actual response bytes') });
  return { db, path, output, host, flags, parameters, targetInput, approve, stage, finish, identity,observation, scheduler, requirements,retryContract,plan,parent,artifactBytes };
}

// Explicit synthetic pins only; no claim of installed artifact qualification.
function bundle(clientKind: 'model' | 'json-checker'): ModelControlBundle {
  const values = { version: 'cue-model-control-v1' as const, clientKind, nodeSha256: '1'.repeat(64), launcherSha256: '2'.repeat(64),
    guardianSha256: '3'.repeat(64), clientSha256: '4'.repeat(64), checkerCoreSha256: clientKind === 'model' ? null : '5'.repeat(64) };
  return { ...values, sha256: createHash('sha256').update(JSON.stringify(Object.values(values))).digest('hex') };
}
async function connected(options: { verdict?: 'pass' | 'fail'; processFailure?: boolean; hang?: boolean; noProducerPins?: boolean } = {}) {
  const f = fixture(); f.output.bindTarget(f.targetInput); f.approve(); const maker = f.stage();
  const modelPins = bundle('model');
  const producer = createGeneratedModelOutput({ db: f.db, now: () => 1000, ...(options.noProducerPins ? {} : { producerControlBundle: modelPins }),
    launch: async (_context, approved) => {
      const session = { ...approved.stage.owner, pid: 900001, start_time: 'maker-start', handle: 'maker-owned' }; recordSession(f.db, session);
      const result = Promise.resolve({ outcome: 'succeeded' as const, attemptId: 'first', requestId: 'model-request',
        text: options.verdict === 'fail' ? '{}' : JSON.stringify(JSON.parse(approved.inputText), null, 2), usage: null, terminal: null, observations: {}, cleanup: 'unknown' as const, providerStopped: 'unknown' as const });
      return { session, result, completion: result.then(v => v.outcome), cancel: async () => {} };
    } });
  const makerExecution = await producer.launch({ runId: 'first', candidateId: 'model', role: 'model', subjectDigest: 'a'.repeat(64), signal: new AbortController().signal });
  await makerExecution.completion; f.finish('succeeded');
  const verifierStage = f.stage('verify', 'check'), checkerPins = bundle('json-checker');
  let resolve!: (r: IsolatedJsonCheckerResult) => void;
  const flags = { launches: 0, cancels: 0, result: null as IsolatedJsonCheckerResult | null, collide: false };
  const native = createGeneratedAcceptanceHost({ db: f.db, now: () => f.flags.now, controlBundle: checkerPins,
    producerPrincipalForAttempt: stage => flags.collide ? 'native-json-checker:' + checkerPins.sha256 : producer.principalForAttempt(stage),
    launch: async (context, approved) => {
      flags.launches++; expect(approved.controlBundle).toEqual(checkerPins); expect(approved.stage.owner).toEqual(verifierStage.owner);
      expect(sha(approved.inputBytes)).toBe(f.parameters.inputSha256);
      const session = { ...approved.stage.owner, pid: 900002, start_time: 'checker-start', handle: 'checker-owned' }; recordSession(f.db, session);
      flags.result = { outcome: options.processFailure ? 'failed' : 'succeeded', attemptId: context.runId, requestId: 'checker-request', text: null,
        usage: null, terminal: null, observations: {}, cleanup: 'unknown', providerStopped: 'unknown', checkerVerdict: checkJsonFormat(approved.inputBytes, approved.outputBytes) };
      const result = options.hang ? new Promise<IsolatedJsonCheckerResult>(done => { resolve = done; }) : Promise.resolve(flags.result);
      return { session, result, completion: result.then(r => r.outcome), cancel: async () => { flags.cancels++; } };
    } });
  const context = { runId: 'verify', candidateId: 'model', role: 'model' as const, subjectDigest: 'b'.repeat(64), signal: new AbortController().signal };
  const execution = await native.launchVerifier(context);
  const finish = async () => {
    await execution.completion;
    f.identity('verify');
    f.scheduler.finish({ runId: 'run', taskId: 'check', attemptId: 'verify', receiptId: 'checked', revision: 1, outcome: 'succeeded', cleanup: 'clean', evidenceRef: 'fixture-host-checker-clean', observedAtMs: 1000 });
  };
  if (!options.hang) await finish();
  return { ...f, native, producer, maker, verifierStage, flags2: flags, execution, finishChecker: finish, context, release: () => resolve(flags.result!) };
}

describe('S4 actual owned native-checker acceptance host composition', () => {
  it('connects owned producer, fixed checker, raw evidence ledger and atomic acceptance without collection launches', async () => {
    const f = await connected(), errors: string[] = [];
    const acceptance = createAcceptanceVerifier(f.db, { ...f.native.acceptance, resolveChecker(id, revision) {
      const c = f.native.acceptance.resolveChecker(id, revision); return c ? { ...c, async collect(context, signal) {
        try { return await c.collect(context, signal); } catch (error) { errors.push(String(error)); throw error; }
      } } : undefined;
    } });
    expect(f.producer.principalForAttempt(f.maker)).toMatch(/^local-model:/);
    const result = await acceptance.collect('run'); const diagnostic=f.db.prepare('SELECT payload FROM acceptance_evaluation WHERE id=?').get(result.id) as {payload:string};expect(result.verdict, JSON.stringify({ outcomes: result.outcomes, errors,initialFailure:JSON.parse(diagnostic.payload).initialFailure })).toBe('pass');
    expect(acceptance.finalize(result).status).toBe('accepted'); expect(f.flags2.launches).toBe(1);
    expect(f.db.prepare("SELECT state FROM task WHERE id='root'").get()).toEqual({ state: 'completed' });
    expect(f.db.prepare('SELECT count(*) n FROM acceptance_blob').get()).toMatchObject({ n: expect.any(Number) });
  });
  it('accepts generated output through the exact explicit revision-one producer and checker attempts',async()=>{
    const f=fixture();f.output.bindTarget(f.targetInput);f.approve();
    createBudgetManager(f.db,{verifyFinalReceipt:()=>false}).initialize({runId:'run',currency:'TEST',unit:'micro',limitUnits:100,policyRevision:'policy:1',source:'fixture',observedAtMs:1000});
    const proof=Buffer.from('quality observation');
    const recovery=createRecoveryPolicyStore(f.db,{now:()=>1000,observeFailure:()=>({cause:'quality-failure',sourceRef:'quality-proof',observedAtMs:1000,externalEffects:'not-applicable',retryableHostCode:false,quotaResetAtMs:null,independentQualityFailure:true,priorCandidateEligible:true}),readObservation:ref=>ref==='quality-proof'?proof:null,observeCandidate:()=>null,resolveHandoffArtifact:()=>f.artifactBytes,authorizeHandoffArtifact:()=>true});
    const approvalId=(f.db.prepare("SELECT id FROM approval_event WHERE run_id='run'").get() as {id:number}).id;
    recovery.registerScope({runId:'run',approvalId,budgetKind:'monetary',budgetIdentity:'run',maxAttemptsTotal:8,deadlineMs:9000,createdAtMs:1000});
    const failed=f.stage('failed','make',undefined,{revision:0,planDigest:f.plan.digest});recordSession(f.db,{...failed.owner,pid:810001,start_time:'failed-start',handle:'failed-owned'});f.identity('failed');
    f.scheduler.finish({runId:'run',taskId:'make',attemptId:'failed',receiptId:'receipt-failed',revision:1,outcome:'failed',cleanup:'clean',evidenceRef:'quality-proof',observedAtMs:1000});
    const observation=recovery.observeFailure({runId:'run',attemptId:'failed'}),decision=recovery.recordDecision({decisionId:'decision-replan',observationId:observation.observationId});
    const revised=recovery.appendRevision({runId:'run',decisionId:decision.decisionId,approval:f.plan.approval,plan:{revision:'plan2',policyRevision:f.plan.approval.policyRevision,policyDigest:f.plan.approval.policyDigest,tasks:f.plan.tasks.map(task=>({...task}))},createdAtMs:1000});
    const active={revision:1,planDigest:revised.digest,recoveryDecisionId:decision.decisionId},maker=f.stage('second','make',undefined,active),modelPins=bundle('model');
    const producer=createGeneratedModelOutput({db:f.db,now:()=>1000,producerControlBundle:modelPins,launch:async(context,approved)=>{const session={...approved.stage.owner,pid:810002,start_time:'maker-rev1',handle:'maker-rev1'};recordSession(f.db,session);const result=Promise.resolve({outcome:'succeeded' as const,attemptId:context.runId,requestId:'model-rev1',text:JSON.stringify(JSON.parse(approved.inputText),null,2),usage:null,terminal:null,observations:{},cleanup:'unknown' as const,providerStopped:'unknown' as const});return{session,result,completion:result.then(value=>value.outcome),cancel:async()=>{}};}});
    const producerExecution=await producer.launch({runId:'second',candidateId:'model',role:'model',subjectDigest:'b'.repeat(64),signal:new AbortController().signal});await producerExecution.completion;f.identity('second');
    f.scheduler.finish({runId:'run',taskId:'make',attemptId:'second',receiptId:'receipt-second',revision:1,outcome:'succeeded',cleanup:'clean',evidenceRef:'maker-rev1',observedAtMs:1000});
    const verifierStage=f.stage('verify-rev1','check',undefined,{revision:1,planDigest:revised.digest}),checkerPins=bundle('json-checker');
    const native=createGeneratedAcceptanceHost({db:f.db,now:()=>1000,controlBundle:checkerPins,producerPrincipalForAttempt:stage=>producer.principalForAttempt(stage),launch:async(context,approved)=>{const session={...approved.stage.owner,pid:810003,start_time:'checker-rev1',handle:'checker-rev1'};recordSession(f.db,session);const result=Promise.resolve({outcome:'succeeded' as const,attemptId:context.runId,requestId:'checker-rev1',text:null,usage:null,terminal:null,observations:{},cleanup:'unknown' as const,providerStopped:'unknown' as const,checkerVerdict:checkJsonFormat(approved.inputBytes,approved.outputBytes)});return{session,result,completion:result.then(value=>value.outcome),cancel:async()=>{}};}});
    const verifier=await native.launchVerifier({runId:'verify-rev1',candidateId:'model',role:'model',subjectDigest:'b'.repeat(64),signal:new AbortController().signal});await verifier.completion;f.identity('verify-rev1');
    f.scheduler.finish({runId:'run',taskId:'check',attemptId:'verify-rev1',receiptId:'receipt-verify-rev1',revision:1,outcome:'succeeded',cleanup:'clean',evidenceRef:'checker-rev1',observedAtMs:1000});
    expect(f.output.readTarget('run','answer')!.planDigest).toBe(f.plan.digest);
    expect(f.output.read('run','answer','second')!.record.planDigest).toBe(revised.digest);
    expect(native.acceptance.principalForAttempt(maker)).toMatch(/^local-model:/);
    expect(native.acceptance.principalForAttempt(verifierStage)).toMatch(/^native-json-checker:/);
    const acceptance=createAcceptanceVerifier(f.db,native.acceptance);
    const evaluation=await acceptance.collect('run',{revision:1,planDigest:revised.digest});
    const diagnostic=f.db.prepare('SELECT payload FROM acceptance_evaluation WHERE id=?').get(evaluation.id) as {payload:string};
    expect(evaluation.verdict,JSON.stringify(JSON.parse(diagnostic.payload).initialFailure)).toBe('pass');expect(acceptance.finalize(evaluation,{revision:1,planDigest:revised.digest}).status).toBe('accepted');expect(verifierStage.revision).toBe(1);
  });
  it('records actual checker fail and does not confuse process success with passing criteria', async () => {
    const f = await connected({ verdict: 'fail' }), acceptance = createAcceptanceVerifier(f.db, f.native.acceptance);
    const result = await acceptance.collect('run'); expect(result.verdict).toBe('fail'); expect(acceptance.finalize(result).status).not.toBe('accepted');
  });
  it('rejects failed native process, missing producer pins and principal collision', async () => {
    for (const option of [{ processFailure: true }, { noProducerPins: true }, {}]) {
      const f = await connected(option); if (!Object.keys(option).length) f.flags2.collide = true;
      const a = createAcceptanceVerifier(f.db, f.native.acceptance); const result = await a.collect('run');
      expect(result.verdict).toBe('unknown'); expect(a.finalize(result).status).not.toBe('accepted');
    }
  });
  it('does not accept injected pass, missing owned execution, cancellation or a fresh host after restart', async () => {
    const f = await connected(), checker = f.native.acceptance.resolveChecker(GENERATED_JSON_CHECKER_ID, f.parameters.checkerRevision)!;
    expect(checker.evaluate({ digest: 'fake', verifierAttemptId: 'verify' } as any, { origin: 'model-report', bytes: Buffer.from('{"status":"pass"}') } as any)).toBe('unknown');
    const restarted = createGeneratedAcceptanceHost({ db: f.db, now: () => 1000, controlBundle: bundle('json-checker'), producerPrincipalForAttempt: () => null,
      launch: async () => { throw Error('collect must not launch'); } });
    expect((await createAcceptanceVerifier(f.db, restarted.acceptance).collect('run')).verdict).toBe('unknown');
    const abort = new AbortController(); abort.abort(); expect((await createAcceptanceVerifier(f.db, f.native.acceptance).collect('run', { signal: abort.signal })).verdict).toBe('unknown');
    expect(f.flags2.launches).toBe(1);
  });
  it('revalidates stored current response/session at collect and finalize', async () => {
    const f = await connected(), a = createAcceptanceVerifier(f.db, f.native.acceptance), result = await a.collect('run');
    expect(result.verdict).toBe('pass'); f.db.prepare("UPDATE session_handle SET start_time='changed' WHERE handle='checker-owned'").run();
    expect(a.finalize(result).status).not.toBe('accepted');
    const other = await connected(); other.db.exec('DROP TRIGGER generated_observation_no_update'); other.db.prepare('UPDATE generated_output_observation SET bytes=?').run(Buffer.from('drift'));
    expect((await createAcceptanceVerifier(other.db, other.native.acceptance).collect('run')).verdict).toBe('unknown');
  });
  it('retains late cancelled checker control without granting cleanup or collecting before stage settlement', async () => {
    const f = await connected({ hang: true }); await f.execution.cancel(); expect(f.flags2.cancels).toBe(1);
    expect((await createAcceptanceVerifier(f.db, f.native.acceptance).collect('run')).verdict).toBe('unknown');
    f.release(); await f.execution.completion;
    expect(f.db.prepare("SELECT state,cleanup_verified FROM orchestration_attempt WHERE attempt_id='verify'").get()).toEqual({ state: 'running', cleanup_verified: 0 });
  });
  it('exposes conservative preapproval carrier sizing and rejects bad pins', () => {
    expect(() => assertGeneratedJsonTemplateBounds(1024, 4096)).not.toThrow();
    for (const n of [0, -1, Infinity, 1_048_576]) expect(() => assertGeneratedJsonTemplateBounds(n, 4096)).toThrow();
    expect(() => generatedJsonCheckerRevision({ ...bundle('json-checker'), checkerCoreSha256: 'e'.repeat(64) })).toThrow('control_bundle_invalid');
  });
});
