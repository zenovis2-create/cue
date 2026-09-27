import { afterEach, expect, test } from 'vitest';
import { existsSync, lstatSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { observeProcessTree, terminateVerifiedTree } from '../src/process-termination.js';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { openLedger } from '../src/ledger.js';
import { normalizeEnvelope, envelopeHash } from '../src/envelope.js';
import { saveLocalSelectionPolicy } from '../src/selection/local-policy-store.js';
import { createIntegrationCatalog } from '../src/integration-catalog.js';
import { MODEL_PROBES } from '../src/capability-admission.js';
import { SUBJECT_FIELDS, subjectDigest, type MeasurementSubject } from '../src/measurement-subject.js';
import { createOrchestrationDriver, type LocalOrchestrationHost } from '../../app/orchestration-driver.mjs';
const compiledProjectionPath = '../dist/src/ui/orchestration.js';
const { readOrchestrationSnapshot: readCompiledOrchestrationSnapshot } = await import(compiledProjectionPath) as typeof import('../src/ui/orchestration.js');
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { const failures=[];for (const cleanup of cleanups.splice(0)) try{await cleanup()}catch(error){failures.push(error)}if(failures.length)throw new AggregateError(failures,'targeted_stop_cleanup_failed'); },30_000);
const childProgram=String.raw`
const {spawn}=require('node:child_process');const {appendFileSync}=require('node:fs');
const heartbeat=process.argv[1],grandchildProgram="const {appendFileSync}=require('node:fs');const p=process.argv[1];setInterval(()=>appendFileSync(p,'g\\n'),40)";
const grandchild=spawn(process.execPath,['-e',grandchildProgram,heartbeat],{stdio:'ignore',windowsHide:true});
console.log(JSON.stringify({controllerPid:process.pid,grandchildPid:grandchild.pid}));
setInterval(()=>appendFileSync(heartbeat,'c\n'),40);
`;
async function firstJson(child:ChildProcess):Promise<{controllerPid:number;grandchildPid:number}>{
  const lines=createInterface({input:child.stdout!});for await(const line of lines){lines.close();return JSON.parse(line)}throw Error('child_identity_missing');
}
async function eventually<T>(read:()=>T,accept:(value:T)=>boolean):Promise<T>{for(let i=0;i<240;i++){const value=read();if(accept(value))return value;await new Promise(r=>setTimeout(r,25))}throw Error('condition_timeout')}
const heartbeatSize=(path:string)=>existsSync(path)?statSync(path).size:0;
const raw=(value:Record<string,unknown>)=>process.stdout.write(`${JSON.stringify(value)}\n`);
async function cancellationCompletionFence(input:{request:()=>void;terminate:()=>void|Promise<void>;closed:Promise<unknown>;verifyAbsent:()=>void|Promise<void>;completed:()=>void}){
  input.request();await Promise.resolve(input.terminate());await input.closed;await input.verifyAbsent();input.completed();
}
const matchingIdentities=(records:{pid:number;createdAt:string}[])=>records.filter(expected=>observeProcessTree(expected.pid).descendants.some(row=>row.pid===expected.pid&&row.createdAt===expected.createdAt));
function fixture(limit = 4) {
  const work = mkdtempSync(join(tmpdir(), 'cue-local-driver-')), db = openLedger();
  const now = Date.now(), envelope = normalizeEnvelope({ run_id: 'workflow', worktree_realpath: work, allowed_actions: [], egress: [], expires_at: new Date(now + 180_000).toISOString(), autonomy_level: 'bounded' });
  const run = { runId: 'workflow', taskId: 'parent', envelopeHash: envelopeHash(envelope), envelope, goal: 'format JSON', scope: 'document' };
  db.prepare('INSERT INTO task VALUES(?,?,NULL,?)').run('parent', 'awaiting_approval', 'now');
  db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(run.envelopeHash, work, '[]', 'now');
  db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run(run.runId, run.taskId, run.envelopeHash, 0, 'now');
  const policy = saveLocalSelectionPolicy(db, { policyId: 'local', expectedRevision: null, createdAt: new Date(now).toISOString(), sourceVersion: 'fixture',
    policy: { version: 'cue-local-selection-v1', mode: 'efficiency', producerCandidateId: 'producer', checkerCandidateId: 'checker', limitAttempts: limit, timeoutMs: 120_000 } });
  const ref = 'local:1', truth = { clean: true, hold: true, launches: [] as string[], cancelRequests: 0, cancellationCompleted: new Set<string>(), invalidBudget: false, budgetExtra: false };
  const executions = new Map<string,{child:ChildProcess;identity:{controllerPid:number;grandchildPid:number};observed:{pid:number;createdAt:string}[];heartbeat:string}>();
  const subject = Object.fromEntries(SUBJECT_FIELDS.map(k => [k, k.endsWith('Sha256') ? 'a'.repeat(64) : k])) as MeasurementSubject;
  // Fixture-only synthetic admission data; no real qualification or model invocation.
  const bytes = new Map<string, Buffer>(), refs: Record<string, { id: string; sha256: string }> = {};
  for (const probe of MODEL_PROBES) { const value = Buffer.from(JSON.stringify({ probe, subjectDigest: subjectDigest(subject), measuredAt: new Date(now).toISOString(), kind: 'live', status: 'pass' })); bytes.set(probe, value); refs[probe] = { id: probe, sha256: createHash('sha256').update(value).digest('hex') }; }
  const catalog = createIntegrationCatalog({ now: () => now, maxAgeMs: 10000, currentSubjectDigest: () => subjectDigest(subject) }, ['producer', 'checker'].map(id => ({ canonicalId: id, toolId: id, kind: id === 'producer' ? 'model' as const : 'checker' as const, aliases: [], installation: 'installed' as const, protocol: 'verified' as const, authReference: null, authAvailable: true, sourceVersion: 'fixture', observedAt: new Date(now).toISOString(), subjectDigest: subjectDigest(subject), binding: id === 'producer' ? { endpointId: 'local', modelId: 'fixture' } : null })));
  const host: LocalOrchestrationHost = {
    accountingKind: 'local-invocation', now: () => now, catalog,
    resolveRequirementChecker: () => ({ id: 'json', revision: 'v1', kinds: ['document'], evidencePolicies: [{ requirementId: 'req', kind: 'document', producerTaskIds: ['make'],
      sourceRevision: 'approved-json-input', targetIds: ['output'], checkerId: 'json', checkerRevision: 'v1', parametersDigest: 'b'.repeat(64), hostileCheckIds: [],
      requiredSectionIds: ['json-document'], claimIds: [], requiresRender: false }] }),
    authority: { authorizePlan: () => true, authorizeClaim: () => true, authorizeStage: () => true,
      verifyReceipt: context => ({ outcomeVerified: true, cleanupVerified: truth.clean, ...(truth.clean ? { handoff: { handoffId: `handoff-${context.attemptId}`,
        identityId: (db.prepare('SELECT identity_id FROM orchestration_attempt_identity WHERE attempt_id=?').get(context.attemptId) as { identity_id: string }).identity_id,
        artifacts: [{ kind: 'output' as const, sourceRef: `artifact-${context.attemptId}` }] } } : {}) }),
      resolveHandoffArtifact: (sourceRef, attemptId) => sourceRef === `artifact-${attemptId}` ? Buffer.from('fixture handoff bytes') : null,
      authorizeHandoffArtifact: (sourceRef, attemptId) => sourceRef === `artifact-${attemptId}` },
    prepare: (activeRun:any) => ({ policy: { policyId: policy.policyId, revision: policy.revision, digest: policy.digest }, requirementIds: ['req'], scopes: [],
      proposedPlan: { revision: 'plan', policyRevision: ref, policyDigest: policy.digest, tasks: [
        { id: 'make', role: 'model-producer', ownerId: 'maker', requirementIds: ['req'], dependencyIds: [], candidateIds: ['producer'], scopeIds: [] },
        { id: 'verify', role: 'verifier', ownerId: 'reviewer', requirementIds: ['req'], dependencyIds: ['make'], candidateIds: ['checker'], scopeIds: [] },
      ] }, requirements: [{ id: 'req', text: 'format JSON', kind: 'document', required: true, checks: [{ checkerId: 'json', revision: 'v1', parametersDigest: 'b'.repeat(64), targetIds: ['output'] }] }],
      budget: { runId: activeRun.runId, limit: truth.invalidBudget ? limit + 1 : limit, policyRevision: ref, source: 'fixture-attempt-cap', observedAtMs: now,
        ...(truth.budgetExtra ? { currency: 'fake' } : {}) }, limits: { launchTimeoutMs: 30_000, taskTimeoutMs: 120_000, pollMs: 1 } }),
    stage: (_context:any,activeRun:any) => ({ worktreeRealpath: activeRun.envelope.worktree_realpath, allowedActions: [], egress: [], expiresAt: activeRun.envelope.expires_at, autonomyLevel: 'bounded' }),
    runtime: { evidence: { now: () => now, maxAgeMs: 10000, resolveEvidence: r => bytes.get(r.id) }, authorizeRun: () => true,
      resolveCandidate: (id, _attemptId, _role, binding) => ({ kind: id === 'producer' ? 'model' : 'checker', supportedRoles: ['model'], cancellation: 'supported', usage: 'unsupported', availability: 'ready',
        typedActivitySource: 'isolated-generated-v1', durableExecutionRef: 'session-handle-v1', buildCurrentSubject: () => subject, evidenceReferences: () => refs,
        async launch(context) { expect(db.inTransaction).toBe(false); expect(db.prepare('SELECT 1 FROM local_invocation_reservation WHERE attempt_id=?').get(context.runId)).toBeDefined();
          truth.launches.push(id); const handle = `session-${context.runId}`, heartbeat=join(work,`heartbeat-${binding.owner.run_id}.txt`);
          const child=spawn(process.execPath,['-e',childProgram,heartbeat],{stdio:['ignore','pipe','pipe'],windowsHide:true});
          const identity=await firstJson(child),tree=await eventually(()=>observeProcessTree(identity.controllerPid),value=>value.descendants.some(row=>row.pid===identity.grandchildPid));
          const observed=[identity.controllerPid,identity.grandchildPid].map(pid=>{const row=tree.descendants.find(value=>value.pid===pid);if(!row)throw Error('owned_identity_missing');return{pid:row.pid,createdAt:row.createdAt}});executions.set(binding.owner.run_id,{child,identity,observed,heartbeat});
          db.prepare('INSERT INTO session_handle VALUES(?,?,?,?,?,?)').run(handle,identity.controllerPid,observed[0]!.createdAt,binding.owner.cwd,binding.owner.task_id,binding.owner.run_id);
          let finish!:(value:'failed')=>void;const completion=new Promise<'failed'>(resolveCompletion=>{finish=resolveCompletion});
          return { durableRef: `session:${handle}`, completion, cancel: async () => { const current=observeProcessTree(identity.controllerPid);for(const expected of observed){const row=current.descendants.find(value=>value.pid===expected.pid);if(!row||row.createdAt!==expected.createdAt)throw Error('owned_identity_changed')}const closed=child.exitCode===null&&child.signalCode===null?once(child,'close'):Promise.resolve();await cancellationCompletionFence({request:()=>{truth.cancelRequests++},terminate:()=>terminateVerifiedTree(identity.controllerPid),closed,verifyAbsent:async()=>{await eventually(()=>matchingIdentities(observed),rows=>rows.length===0)},completed:()=>truth.cancellationCompleted.add(context.runId)});finish('failed'); } }; } }),
      verifyCleanup: async context => ({ runId: context.runId, subjectDigest: context.subjectDigest, result: truth.clean ? 'verified-clean' : 'unknown', evidenceRef: 'fixture-cleanup' }) },
    engine: { maxRequestAgeMs: 1000,
      observeCandidate: (_request, task) => ({ candidateId: task.candidateIds[0]!, eligible: true, authenticated: true, compatible: true, dataAllowed: true, resourceAvailable: true, quotaAvailable: true }), authorizeExecution: () => true,
      receipts: context => ({ execution: { runId: context.request.runId, taskId: context.task.id, attemptId: context.request.attemptId, receiptId: 'receipt-' + context.request.attemptId, revision: 1, outcome: 'succeeded', cleanup: truth.clean ? 'clean' : 'unknown', evidenceRef: 'fixture', observedAtMs: now } }) },
  };
  const driver = createOrchestrationDriver({ db, host });
  cleanups.push(async () => { try { await driver.close(); } catch { /* fixture uncertainty is checked below */ } for(const execution of executions.values()){const controller=execution.observed.find(value=>value.pid===execution.identity.controllerPid)!;const current=observeProcessTree(controller.pid),sameController=current.descendants.some(row=>row.pid===controller.pid&&row.createdAt===controller.createdAt);if(sameController){const closed=execution.child.exitCode===null&&execution.child.signalCode===null?once(execution.child,'close'):null;await Promise.resolve(terminateVerifiedTree(controller.pid));if(closed)await closed}const remaining=matchingIdentities(execution.observed);raw({kind:'targeted-stop-cleanup',observed:execution.observed,remaining});if(remaining.length)throw Error('owned_identity_still_alive')}db.close();const target=resolve(work),base=resolve(tmpdir());if(dirname(target)!==base||!basename(target).startsWith('cue-local-driver-')||lstatSync(target).isSymbolicLink())throw Error('cleanup-path');rmSync(target,{recursive:true,force:true});if(existsSync(target))throw Error('cleanup_incomplete'); });
  const approve = () => { db.prepare("INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,request_ordinal,decision,created_at) VALUES(?,?,'desktop','goal',0,'accept','now')").run(run.runId, run.envelopeHash); driver.activate(run); };
  return { db, run, truth, driver, host, approve, executions, work, policy, ref, now };
}

test('cancellation completion waits for delayed termination, close, and absence observation',async()=>{
  let requests=0,completed=0,terminateDone=false,closeDone=false,releaseTerminate!:()=>void,releaseClose!:()=>void;
  const termination=new Promise<void>(resolve=>{releaseTerminate=()=>{terminateDone=true;resolve()}}),closed=new Promise<void>(resolve=>{releaseClose=()=>{closeDone=true;resolve()}});
  const fenced=cancellationCompletionFence({request:()=>{requests++},terminate:()=>termination,closed,verifyAbsent:()=>{expect(terminateDone).toBe(true);expect(closeDone).toBe(true)},completed:()=>{completed++}});
  await new Promise(resolve=>setImmediate(resolve));expect(requests).toBe(1);expect(completed).toBe(0);
  releaseTerminate();await new Promise(resolve=>setImmediate(resolve));expect(completed).toBe(0);
  releaseClose();await fenced;expect(completed).toBe(1);
});

test.skipIf(process.platform!=='win32')('public driver Stop terminates only the selected active run process tree',async()=>{
  const f=fixture(),work2=mkdtempSync(join(tmpdir(),'cue-driver-targeted-stop-sibling-'));
  let siblingPrepared=false;
  cleanups.push(async()=>{const target=resolve(work2),base=resolve(tmpdir());if(dirname(target)!==base||!basename(target).startsWith('cue-driver-targeted-stop-sibling-')||lstatSync(target).isSymbolicLink())throw Error('sibling_cleanup_path');rmSync(target,{recursive:true,force:true});if(existsSync(target))throw Error('sibling_cleanup_incomplete')});
  const envelope2=normalizeEnvelope({...f.run.envelope,run_id:'workflow-sibling',worktree_realpath:work2}),run2={...f.run,runId:'workflow-sibling',taskId:'parent-sibling',envelope:envelope2,envelopeHash:envelopeHash(envelope2)};
  f.db.prepare('INSERT INTO task VALUES(?,?,NULL,?)').run(run2.taskId,'awaiting_approval','now');
  f.db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(run2.envelopeHash,work2,'[]','now');
  f.db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run(run2.runId,run2.taskId,run2.envelopeHash,0,'now');
  f.driver.prepare(f.run);f.driver.prepare(run2);siblingPrepared=true;
  for(const active of [f.run,run2]){f.db.prepare("INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,request_ordinal,decision,created_at) VALUES(?,?,'desktop','goal',0,'accept','now')").run(active.runId,active.envelopeHash);f.driver.activate(active)}
  const first=f.driver.start(f.run),second=f.driver.start(run2);
  await eventually(()=>f.executions.size,n=>n===2);
  const attemptFor=(runId:string)=>(f.db.prepare("SELECT attempt_id FROM orchestration_attempt WHERE run_id=? AND task_id='make'").get(runId) as {attempt_id:string}).attempt_id;
  const targetAttempt=attemptFor(f.run.runId),siblingAttempt=attemptFor(run2.runId),target=f.executions.get(targetAttempt)!,sibling=f.executions.get(siblingAttempt)!;
  const targetPreStop=f.driver.snapshot(f.run.runId),siblingPreStop=f.driver.snapshot(run2.runId),targetLifecycle=f.driver.lifecycle(targetAttempt),siblingLifecycle=f.driver.lifecycle(siblingAttempt);
  raw({kind:'targeted-stop-before',target:{runId:f.run.runId,attemptId:targetAttempt,observed:target.observed,snapshot:targetPreStop,lifecycle:targetLifecycle},sibling:{runId:run2.runId,attemptId:siblingAttempt,observed:sibling.observed,snapshot:siblingPreStop,lifecycle:siblingLifecycle},cancelRequests:f.truth.cancelRequests,cancellationCompleted:[...f.truth.cancellationCompleted]});
  expect(targetPreStop).toMatchObject({state:'running',reason:null});expect(siblingPreStop).toMatchObject({state:'running',reason:null});expect(f.truth.cancelRequests).toBe(0);expect([...f.truth.cancellationCompleted]).toEqual([]);expect(targetLifecycle.billing).toBe('unknown');expect(siblingLifecycle.billing).toBe('unknown');
  for(const record of [...target.observed,...sibling.observed])expect(record.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/u);
  const before=await eventually(()=>heartbeatSize(sibling.heartbeat),n=>n>0);
  expect(f.driver.stop(f.run.runId)).toBe(true);await eventually(()=>f.truth.cancellationCompleted.has(targetAttempt),Boolean);const targetRemaining=await eventually(()=>matchingIdentities(target.observed),rows=>rows.length===0);
  const siblingHeartbeat=await eventually(()=>heartbeatSize(sibling.heartbeat),n=>n>before),siblingAfter=observeProcessTree(sibling.identity.controllerPid);raw({kind:'targeted-stop-target-completed',targetAttempt,cancelRequests:f.truth.cancelRequests,cancellationCompleted:[...f.truth.cancellationCompleted],targetRemaining,siblingHeartbeatBefore:before,siblingHeartbeatAfter:siblingHeartbeat,siblingObserved:sibling.observed,siblingCurrent:siblingAfter.descendants});
  expect(targetRemaining).toEqual([]);expect(siblingHeartbeat).toBeGreaterThan(before);
  for(const expected of sibling.observed)expect(siblingAfter.descendants.find(row=>row.pid===expected.pid)?.createdAt).toBe(expected.createdAt);
  expect(f.driver.snapshot(f.run.runId)).toMatchObject({state:'blocked',reason:'cancelled'});expect(f.driver.snapshot(run2.runId).reason).not.toBe('cancelled');
  expect(f.driver.stop(run2.runId)).toBe(true);await eventually(()=>f.truth.cancellationCompleted.has(siblingAttempt),Boolean);const siblingRemaining=await eventually(()=>matchingIdentities(sibling.observed),rows=>rows.length===0);raw({kind:'targeted-stop-final',cancelRequests:f.truth.cancelRequests,cancellationCompleted:[...f.truth.cancellationCompleted],targetRemaining,siblingRemaining});expect(siblingRemaining).toEqual([]);
  await Promise.all([first,second]);expect(siblingPrepared).toBe(true);
// The fixture configures taskTimeoutMs 120_000, so the harness budget must exceed it;
// otherwise a slow host kills the test before its own deadline can produce a verdict.
},240_000);
