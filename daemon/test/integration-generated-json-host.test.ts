import { afterEach, describe, it, expect, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, win32 } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createGeneratedJsonHost } from '../../app/generated-json-host.mjs';
import { createGeneratedJsonHandoffAuthority } from '../../app/generated-json-handoff-authority.mjs';
import { createGeneratedJsonRecoveryAuthority } from '../../app/generated-json-recovery-authority.mjs';
import { createOrchestrationDriver } from '../../app/orchestration-driver.mjs';
import { openLedger, type Ledger } from '../src/ledger.js';
import { normalizeEnvelope, envelopeHash } from '../src/envelope.js';
import { saveSelectionPolicy } from '../src/selection/policy-store.js';
import { SUBJECT_FIELDS, subjectDigest, type MeasurementSubject } from '../src/measurement-subject.js';
import { MODEL_PROBES } from '../src/capability-admission.js';
import { recordSession } from '../src/session-spawn.js';
import { createBudgetManager } from '../src/budget.js';
import { checkJsonFormat } from '../src/verification/json-format-checker.cjs';
import { createRequirementContractStore } from '../src/verification/requirements.js';
import type { ModelControlBundle } from '../src/model-control-bundle.js';
const roots: string[] = [], dbs: Ledger[] = [];
function canonicalJson(value:any):string { if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return `[${value.map(canonicalJson).join(',')}]`;return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`; }
it('loads the compiled host dependency graph in actual Node without test-runner CJS interop', () => {
  const entry = new URL('../../app/generated-json-host.mjs', import.meta.url).href;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e',
    'const host = await import(process.argv[1]); if (typeof host.createGeneratedJsonHost !== "function") throw Error("missing_host_factory"); process.stdout.write("host-imported");', entry],
  { encoding: 'utf8', timeout: 10000, windowsHide: true });
  expect(child.error).toBeUndefined();
  expect(child.signal).toBeNull();
  expect(child.stderr).toBe('');
  expect(child.status).toBe(0);
  expect(child.stdout).toBe('host-imported');
});
afterEach(() => { vi.restoreAllMocks(); for (const db of dbs.splice(0)) db.close(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function bundle(clientKind: 'model' | 'json-checker'): ModelControlBundle {
  const value = { version: 'cue-model-control-v1' as const, clientKind, nodeSha256: '1'.repeat(64), launcherSha256: '2'.repeat(64), guardianSha256: '3'.repeat(64),
    clientSha256: '4'.repeat(64), checkerCoreSha256: clientKind === 'model' ? null : '5'.repeat(64) };
  return { ...value, sha256: createHash('sha256').update(JSON.stringify(Object.values(value))).digest('hex') };
}
function fixture(persisted=false) {
  const root = mkdtempSync(join(tmpdir(), 'cue-json-host-')); roots.push(root); const work = join(root, 'work'); mkdirSync(work);
  const db = openLedger(persisted?join(root,'ledger.sqlite'):undefined); dbs.push(db); const now = Date.now();
  const envelope = normalizeEnvelope({ run_id: 'workflow', worktree_realpath: work, allowed_actions: ['command'], egress: ['http://127.0.0.1:8085/v1'],
    expires_at: new Date(now + 120000).toISOString(), autonomy_level: 'bounded' });
  const run: any = { runId: 'workflow', taskId: 'root', envelope, envelopeHash: envelopeHash(envelope), goal: '{"source":1}', scope: 'document', selectionMode: 'efficiency' };
  db.prepare("INSERT INTO task VALUES('root','awaiting_approval',NULL,'now')").run();
  db.prepare("INSERT INTO envelope VALUES(?,?,?,'now')").run(run.envelopeHash, work, JSON.stringify(envelope.egress));
  db.prepare("INSERT INTO run VALUES('workflow','root',?,0,'now')").run(run.envelopeHash);
  const subject = Object.fromEntries(SUBJECT_FIELDS.map(key => [key, key.endsWith('Sha256') ? 'a'.repeat(64) : key])) as MeasurementSubject;
  const refs: Record<string, { id: string; sha256: string }> = {}, evidence = new Map<string, Buffer>();
  // Deliberately trusted synthetic admission seam, not measured live qualification.
  for (const probe of MODEL_PROBES) {
    const bytes = Buffer.from(JSON.stringify({ probe, subjectDigest: subjectDigest(subject), measuredAt: new Date(now - 1).toISOString(), kind: 'live', status: 'pass' }));
    evidence.set(probe, bytes); refs[probe] = { id: probe, sha256: createHash('sha256').update(bytes).digest('hex') };
  }
  const policies: any = {};
  for (const mode of ['efficiency', 'performance', 'value', 'speed'] as const) {
    const p = saveSelectionPolicy(db, { policyId: mode, expectedRevision: null, sourceVersion: 'explicit-fixture', createdAt: new Date(now).toISOString(), policy: {
      version: 'cue-selection-v1', mode, qualityMinimum: 0.5, costBasis: 1, timeBasisMs: 1, currency: 'TEST', costLimit: null,
      remainingTimeMs: null, maxEstimateAgeMs: 60000, allowedCandidateIds: ['fixture-model', 'fixture-checker'], pinnedCandidateId: null } });
    policies[mode] = { policyId: p.policyId, revision: p.revision, digest: p.digest };
  }
  const controls = { launches: [] as string[], missingEvidence: false, unknownEstimate: false, badResult: false, badCleanup: false, diagnosticFailure: false, outputlessFailure: false };
  const candidates = Object.fromEntries(['model', 'checker'].map(kind => [kind, {
    record: { canonicalId: 'fixture-' + kind, toolId: 'fixture-' + kind, kind, aliases: [], installation: 'installed', protocol: 'verified', authReference: 'synthetic-test-account',
      authAvailable: true, sourceVersion: 'synthetic-only', observedAt: new Date(now).toISOString(), subjectDigest: subjectDigest(subject),
      binding: kind === 'model' ? { endpointId: 'fixed-localhost', modelId: 'qwen38-27b-unc' } : null },
    currentSubject: () => subject, evidenceReferences: () => refs,
    observeCandidate: () => ({ id: 'fixture-' + kind, checks: { eligible: true, authenticated: true, compatible: true, dataAllowed: true, resourceAvailable: true, quotaAvailable: true },
      estimate: controls.unknownEstimate ? null : { scope: 'verified-completion-total', quality: 1, expectedCost: 1, conservativeMaxCost: 1, expectedTimeMs: 1, conservativeMaxTimeMs: 2,
        currency: 'TEST', source: 'fixture-explicit-total', observedAtMs: now } }),
  }]));
  const installation = { nodeExecutable: process.execPath, nodeSha256: '1'.repeat(64), modelControlBundle: bundle('model'), checkerControlBundle: bundle('json-checker'),
    taskRootBase: win32.join(root, 'tasks'), profileRootBase: win32.join(root, 'profiles') };
  // Synthetic executor factories only. No process/model/network call occurs here.
  const executor = (kind: string) => (host: any) => async (context: any) => {
    const binding = host.resolveBinding(context); controls.launches.push(kind);
    const base = kind === 'model' ? 1900000000 : 1900000003;
    const session = { ...binding.owner, pid: base, start_time: 'synthetic-start', handle: 'session-' + context.runId }; recordSession(db, session);
    const profile = 'Cue.Model.' + (kind === 'model' ? 'a' : 'b').repeat(32), sid = 'S-1-15-2-1234-5678';
    const observations = controls.badCleanup ? {} : { CUE_MODEL_PID: String(base + 1), CUE_MODEL_GUARDIAN_PID: String(base + 2),
      CUE_MODEL_BOUNDARY: { sid, clientOnly: true, profile, taskRoot: win32.join(installation.taskRootBase, profile), profilePath: win32.join(installation.profileRootBase, profile, 'AC') },
      CUE_MODEL_OBSERVATION: { pid: base + 1, status: 'observed', phase: 'suspended-before-resume', createdFileTime: '133000000000000000', appContainer: true, appContainerSid: sid } };
    const text = kind === 'model' && !controls.outputlessFailure ? (controls.badResult ? '{}' : JSON.stringify(JSON.parse(run.goal), null, 2)) : null;
    const result = Promise.resolve({ outcome: controls.diagnosticFailure || controls.outputlessFailure ? 'failed' as const : 'succeeded' as const, attemptId: context.runId, requestId: 'request-' + context.runId, text, usage: null, terminal: null, observations,
      cleanup: 'unknown' as const, providerStopped: 'unknown' as const, ...(controls.diagnosticFailure ? { diagnosticCode: 'deadline-exceeded', ignoredSecret: 'raw-provider-secret' } : {}),
      ...(kind === 'checker' ? { checkerVerdict: checkJsonFormat(binding.inputBytes, binding.outputBytes) } : {}) });
    void result.then(value => { (controls as any).diagnosticResult = value; });
    return { session, result, completion: result.then(r => r.outcome), cancel: async () => {} };
  };
  const options: any = { db, now: () => Date.now(), inputForRun: (r: any) => r.goal, installation, candidates, policies,
    accounting: { currency: 'TEST', unit: 'micro', limitUnits: 100, unitsPerCost: 10, upperUnitsByKind: { model: 10, checker: 10 }, source: 'fixture-bounded-total', observedAtMs: now },
    evidence: { now: () => Date.now(), maxAgeMs: 60000, resolveEvidence: (ref: any) => controls.missingEvidence ? undefined : evidence.get(ref.id) },
    executorFactories: { model: executor('model'), checker: executor('checker') } };
  const approve = () => db.prepare("INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,request_ordinal,decision,created_at) VALUES('workflow',?,'desktop','goal',0,'accept','now')").run(run.envelopeHash);
  return { db, options, run, controls, approve };
}
describe('S4 default generated JSON host assembly, synthetic executor qualification only', () => {
  it('records a durable stop from an exact persisted diagnostic and launches no recovery attempt', async()=>{
    const f=fixture(true);f.controls.diagnosticFailure=true;const ready=createGeneratedJsonHost(f.options);if(!ready.available)throw Error(ready.reasons.join(','));
    const basePrepare=ready.host.prepare.bind(ready.host),deadlineMs=Date.now()+60000;
    const trustedHost=Object.freeze({...ready.host,
      authority:Object.freeze({...ready.host.authority,retry:Object.freeze({now:()=>Date.now(),authorizeContract:()=>true,classifyFailure:()=>null})}),
      prepare:(run:any)=>Object.freeze({...basePrepare(run),recoveryMode:'automatic-approved',retry:{maxAttemptsPerTask:2,maxAttemptsTotal:4,deadlineMs}})});
    const driver=createOrchestrationDriver({db:f.db,host:trustedHost});driver.prepare(f.run);f.approve();driver.activate(f.run);await driver.start(f.run);
    expect(f.controls.launches).toEqual(['model']);
    expect(driver.snapshot('workflow')).toMatchObject({state:'blocked',reason:'orchestration_evidence_unverified',acceptance:'unverified'});
    const attempt=f.db.prepare("SELECT attempt_id FROM orchestration_attempt WHERE task_id='produce-json'").get() as any;
    expect((f.db.prepare('SELECT count(*) n FROM orchestration_attempt').get() as any).n).toBe(1);
    const observationRow=f.db.prepare('SELECT cause,payload_sha256,payload FROM orchestration_failure_observation WHERE attempt_id=?').get(attempt.attempt_id) as any;
    const observation={...observationRow,...JSON.parse(Buffer.from(observationRow.payload).toString())};
    expect(observation).toMatchObject({cause:'unknown'});expect(observation.sourceRef).toMatch(/^generated-recovery:[a-f0-9]{64}$/);
    expect((f.db.prepare("SELECT action,selected_candidate_id FROM orchestration_recovery_decision WHERE prior_attempt_id=?").get(attempt.attempt_id) as any)).toEqual({action:'stop',selected_candidate_id:null});
    const authority=createGeneratedJsonRecoveryAuthority({db:f.db,now:()=>Date.now()});
    const recoveryContext={runId:'workflow',attemptId:attempt.attempt_id,receiptId:observation.receiptId,handoffId:observation.handoffId,candidateId:'fixture-model'};
    const terminal=f.db.prepare("SELECT payload FROM orchestration_activity WHERE attempt_id=? AND json_extract(payload,'$.kind')='terminal'").get(attempt.attempt_id) as any;
    expect(authority.readObservation(observation.sourceRef,attempt.attempt_id)).toEqual(Buffer.from(terminal.payload));
    expect(authority.readObservation(observation.sourceRef,'foreign-attempt')).toBeNull();
    expect(authority.observeFailure({runId:'workflow',attemptId:attempt.attempt_id,receiptId:'foreign',handoffId:'foreign',candidateId:'fixture-model'})).toBeNull();
    expect(authority.observeCandidate({runId:'workflow',taskId:'produce-json',priorCandidateId:'fixture-model',candidateId:'fixture-checker'})).toBeNull();
    await driver.close();f.db.close();dbs.splice(dbs.indexOf(f.db),1);
    const reopened=openLedger(join(roots[0],'ledger.sqlite'));dbs.push(reopened);const offline=createGeneratedJsonRecoveryAuthority({db:reopened,now:()=>Date.now()});
    expect(offline.readObservation(observation.sourceRef,attempt.attempt_id)).toEqual(Buffer.from(terminal.payload));
    reopened.exec('DROP TRIGGER orchestration_activity_no_update');
    const hostile={...JSON.parse(Buffer.from(terminal.payload).toString()),rawSecret:'must-not-authorize'};
    reopened.prepare('UPDATE orchestration_activity SET payload=? WHERE attempt_id=? AND ordinal=(SELECT MAX(ordinal) FROM orchestration_activity WHERE attempt_id=?)').run(canonicalJson(hostile),attempt.attempt_id,attempt.attempt_id);
    expect(offline.readObservation(observation.sourceRef,attempt.attempt_id)).toBeNull();
    expect(offline.observeFailure(recoveryContext)).toBeNull();
    const badEvent={...hostile};delete badEvent.rawSecret;badEvent.eventId='foreign-event';
    reopened.prepare('UPDATE orchestration_activity SET payload=? WHERE attempt_id=? AND ordinal=(SELECT MAX(ordinal) FROM orchestration_activity WHERE attempt_id=?)').run(canonicalJson(badEvent),attempt.attempt_id,attempt.attempt_id);
    expect(offline.observeFailure(recoveryContext)).toBeNull();
    const future={...badEvent,eventId:JSON.parse(Buffer.from(terminal.payload).toString()).eventId,observedAtMs:Date.now()+60000};
    reopened.prepare('UPDATE orchestration_activity SET payload=? WHERE attempt_id=? AND ordinal=(SELECT MAX(ordinal) FROM orchestration_activity WHERE attempt_id=?)').run(canonicalJson(future),attempt.attempt_id,attempt.attempt_id);
    expect(offline.observeFailure(recoveryContext)).toBeNull();
    expect(reopened.pragma('foreign_key_check')).toEqual([]);
  });
  it('terminalizes an outputless failed attempt from exact cleanup evidence without launching its dependent checker', async()=>{
    const f=fixture(true);f.controls.outputlessFailure=true;const ready=createGeneratedJsonHost(f.options);if(!ready.available)throw Error(ready.reasons.join(','));
    const driver=createOrchestrationDriver({db:f.db,host:ready.host});driver.prepare(f.run);f.approve();driver.activate(f.run);await driver.start(f.run);
    expect(f.controls.launches).toEqual(['model']);
    expect(driver.snapshot('workflow').acceptance).toBe('unverified');
    const attempt=f.db.prepare("SELECT attempt_id,state,cleanup_verified FROM orchestration_attempt WHERE task_id='produce-json'").get() as any;
    expect(attempt).toMatchObject({state:'failed',cleanup_verified:1});
    expect(f.db.prepare("SELECT state FROM orchestration_step WHERE run_id='workflow' AND task_id='verify-json'").get()).not.toEqual({state:'completed'});
    expect((f.db.prepare("SELECT count(*) n FROM generated_output_observation WHERE attempt_id=?").get(attempt.attempt_id) as any).n).toBe(0);
    const artifact=f.db.prepare("SELECT kind,source_ref FROM orchestration_handoff_artifact WHERE attempt_id=?").get(attempt.attempt_id) as any;
    expect(artifact.kind).toBe('cleanup-evidence');expect(artifact.source_ref).toMatch(/^cleanup-observation:[a-f0-9]{64}$/);
    const bytes=ready.host.authority.resolveHandoffArtifact!(artifact.source_ref,attempt.attempt_id);expect(bytes).toBeInstanceOf(Uint8Array);
    const successCleanup=(f.db.prepare("SELECT sha256 FROM cleanup_observation WHERE run_id=?").get(attempt.attempt_id) as any).sha256;
    expect(ready.host.authority.resolveHandoffArtifact!(`cleanup-observation:${successCleanup}`,'foreign-attempt')).toBeNull();
    await driver.close();f.db.close();dbs.splice(dbs.indexOf(f.db),1);
    const reopened=openLedger(join(roots[0],'ledger.sqlite'));dbs.push(reopened);const offline=createGeneratedJsonHandoffAuthority({db:reopened});
    expect(offline.resolveHandoffArtifact(artifact.source_ref,attempt.attempt_id)).toEqual(bytes);
    reopened.exec('DROP TRIGGER cleanup_observation_no_update');
    reopened.prepare('UPDATE cleanup_observation SET payload=? WHERE sha256=?').run(Buffer.from('{}'),artifact.source_ref.slice('cleanup-observation:'.length));
    expect(offline.resolveHandoffArtifact(artifact.source_ref,attempt.attempt_id)).toBeNull();
  });
  it('durably emits only the sanitized diagnostic code for a failed synthetic execution', async()=>{
    const f=fixture(true);f.controls.diagnosticFailure=true;const ready=createGeneratedJsonHost(f.options);if(!ready.available)throw Error(ready.reasons.join(','));
    const driver=createOrchestrationDriver({db:f.db,host:ready.host});driver.prepare(f.run);f.approve();driver.activate(f.run);await driver.start(f.run);
    const row=f.db.prepare("SELECT payload FROM orchestration_activity WHERE json_extract(payload,'$.kind')='terminal' ORDER BY rowid LIMIT 1").get() as any;
    expect(JSON.parse(row.payload.toString()).data).toEqual({diagnosticCode:'deadline-exceeded',handoffRef:'unknown',status:'failed'});
    expect(row.payload.toString()).not.toContain('raw-provider-secret');
    await driver.close();
    f.db.close();dbs.splice(dbs.indexOf(f.db),1);const reopened=openLedger(join(roots[0],'ledger.sqlite'));dbs.push(reopened);
    expect((reopened.prepare("SELECT payload FROM orchestration_activity WHERE json_extract(payload,'$.data.diagnosticCode')='deadline-exceeded'").get() as any).payload.toString()).not.toContain('raw-provider-secret');
  });
  it('binds immutable input-scoped evidence policies independently across runs', () => {
    const first=fixture(true),second=fixture(); second.run.goal='{"source":2}';
    const one=createGeneratedJsonHost(first.options),two=createGeneratedJsonHost(second.options);
    expect(one.available&&two.available).toBe(true); if(!one.available||!two.available)return;
    createOrchestrationDriver({db:first.db,host:one.host}).prepare(first.run);
    createOrchestrationDriver({db:second.db,host:two.host}).prepare(second.run);
    const read=(db:Ledger)=>JSON.parse(Buffer.from((db.prepare("SELECT payload FROM requirement_contract_binding WHERE run_id='workflow'").get() as any).payload).toString());
    const a=read(first.db),b=read(second.db),pa=a.evidencePolicies[0],pb=b.evidencePolicies[0];
    expect(pa.parametersDigest).not.toBe(pb.parametersDigest); expect(pa.sourceRevision).not.toBe(pb.sourceRevision);
    expect(pa.targetIds).toEqual(['formatted-json']); expect(pb.targetIds).toEqual(['formatted-json']);
    expect(a.checkers[0].evidencePolicies).toEqual([pa]); expect(b.checkers[0].evidencePolicies).toEqual([pb]);
    expect(Object.isFrozen(one.host.prepare(first.run).requirementCheckers![0].evidencePolicies)).toBe(true);
    first.db.close(); dbs.splice(dbs.indexOf(first.db),1); const reopened=openLedger(join(roots[0],'ledger.sqlite')); dbs.push(reopened);
    expect(createRequirementContractStore(reopened,{now:()=>Date.now(),resolveChecker:()=>undefined}).read('workflow')?.requirements.evidencePolicies).toEqual([pa]);
  });
  it('does not poll or promote unknown cleanup identity', async () => {
    const f = fixture(); f.controls.badCleanup = true;
    const ready = createGeneratedJsonHost(f.options); if (!ready.available) throw Error(ready.reasons.join(','));
    const driver = createOrchestrationDriver({ db: f.db, host: ready.host }); driver.prepare(f.run); f.approve(); driver.activate(f.run);
    const started = performance.now(); await driver.start(f.run);
    expect(performance.now() - started).toBeLessThan(2000);
    expect(f.controls.launches).toEqual(['model']);
    expect(driver.snapshot('workflow').acceptance).toBe('unverified');
    const evidence = f.db.prepare('SELECT payload FROM cleanup_observation').all().map((row: any) => JSON.parse(row.payload.toString()));
    expect(evidence).toHaveLength(1); expect(evidence[0].result).toBe('unknown');
    await expect(driver.close()).rejects.toThrow('orchestration_cleanup_unverified');
  });
  it.each(['delayed', 'persistent', 'cancel'] as const)('re-observes a %s guardian before issuing the terminal cleanup receipt', async mode => {
    const f = fixture(), ready = createGeneratedJsonHost(f.options); if (!ready.available) throw Error(ready.reasons.join(','));
    const driver = createOrchestrationDriver({ db: f.db, host: ready.host });
    let observations = 0, firstSeen!: () => void;
    const seen = new Promise<void>(resolve => { firstSeen = resolve; });
    const original = process.kill.bind(process);
    vi.spyOn(process, 'kill').mockImplementation(((pid: number, signal: any) => {
      if (pid === 1900000002 && signal === 0) {
        observations++; firstSeen();
        if (mode !== 'delayed' || observations < 4) return true;
      }
      return original(pid, signal);
    }) as typeof process.kill);
    driver.prepare(f.run); f.approve(); driver.activate(f.run);
    const started = performance.now(), running = driver.start(f.run);
    await seen;
    if (mode === 'cancel') driver.stop('workflow');
    await running;
    const elapsed = performance.now() - started;
    const evidence = f.db.prepare('SELECT payload FROM cleanup_observation ORDER BY rowid').all().map((row: any) => JSON.parse(row.payload.toString()));
    expect(evidence[0].result).toBe('residual');
    if (mode === 'delayed') {
      expect(observations).toBeGreaterThanOrEqual(4);
      expect(evidence.some(row => row.result === 'verified-clean')).toBe(true);
      expect(f.controls.launches).toEqual(['model', 'checker']);
      expect(driver.snapshot('workflow').acceptance).toBe('verified');
      await driver.close();
    } else {
      expect(evidence.every(row => row.result === 'residual')).toBe(true);
      expect(f.controls.launches).toEqual(['model']);
      expect(driver.snapshot('workflow').acceptance).toBe('unverified');
      if (mode === 'persistent') { expect(observations).toBeGreaterThan(2); expect(elapsed).toBeGreaterThanOrEqual(9900); }
      else expect(elapsed).toBeLessThan(2000);
      await expect(driver.close()).rejects.toThrow('orchestration_cleanup_unverified');
    }
  }, 15000);
  it('runs shared-ledger producer/checker/cleanup/acceptance and retains unknown billing reservations', async () => {
    const f = fixture(), ready = createGeneratedJsonHost(f.options); expect(ready.available, JSON.stringify(ready)).toBe(true); if (!ready.available) return;
    const diagnostics: unknown[] = [];
    for (const group of [ready.host.engine, ready.host.authority]) for (const key of Object.keys(group)) {
      const fn = (group as any)[key]; if (typeof fn !== 'function') continue;
      (group as any)[key] = (...args: any[]) => { try { const value = fn(...args); diagnostics.push({ key, value }); return value; } catch (error) { diagnostics.push({ key, error: String(error) }); throw error; } };
    }
    expect(ready.host.parentTemplate).toBe('generated-json-v1'); const driver = createOrchestrationDriver({ db: f.db, host: ready.host });
    expect(driver.prepare(f.run).generatedOutputs).toHaveLength(1); f.approve(); driver.activate(f.run); await driver.start(f.run);
    const cleanupEvidence = f.db.prepare('SELECT payload FROM cleanup_observation').all().map((row: any) => JSON.parse(row.payload.toString()));
    expect(f.controls.launches, JSON.stringify({ state: driver.snapshot('workflow'), diagnostics, cleanupEvidence, sessions: f.db.prepare('SELECT * FROM session_handle').all(), rawResult: (f.controls as any).diagnosticResult })).toEqual(['model', 'checker']); expect(driver.snapshot('workflow')).toMatchObject({ state: 'completed', acceptance: 'verified' });
    const activity = f.db.prepare('SELECT a.task_id,x.payload FROM orchestration_activity x JOIN orchestration_attempt a ON a.attempt_id=x.attempt_id ORDER BY a.task_id,x.ordinal').all()
      .map((row: any) => ({ taskId: row.task_id, ...JSON.parse(row.payload) }));
    for (const taskId of ['produce-json','verify-json']) {
      const facts = activity.filter((row: any) => row.taskId === taskId && row.eventId.startsWith('event-'));
      expect(facts.map((row: any) => row.kind)).toEqual(taskId === 'produce-json' ? ['output','usage','tool','artifact','terminal'] : ['usage','tool','artifact','terminal']);
      expect(facts.find((row: any) => row.kind === 'tool').data).toMatchObject({ status: 'unsupported', callRef: 'unknown' });
      expect(facts.find((row: any) => row.kind === 'usage').data.status).toMatch(/^(observed|unknown)$/);
      expect(JSON.stringify(facts)).not.toContain(f.run.goal);
    }
    const handoffs = f.db.prepare('SELECT attempt_id,payload FROM orchestration_handoff ORDER BY attempt_id').all().map((row: any) => ({ attemptId: row.attempt_id, value: JSON.parse(Buffer.from(row.payload).toString('utf8')) }));
    expect(handoffs).toHaveLength(2); expect(handoffs.every((row: any) => row.value.attemptId === row.attemptId && row.value.artifacts.length === 1)).toBe(true);
    for (const row of handoffs) {
      const artifact = row.value.artifacts[0], event = activity.find((fact: any) => fact.attemptId === row.attemptId && fact.kind === 'artifact');
      expect(event.data).toEqual(artifact);
    }
    const producer = handoffs.find((row: any) => row.value.artifacts[0].kind === 'generated-output')!, checker = handoffs.find((row: any) => row.value.artifacts[0].kind === 'verified-input')!;
    const observationId = producer.value.artifacts[0].sourceRef.slice('generated-output:'.length), verifiedRef = `verified-input:${observationId}`;
    expect(ready.host.authority.resolveHandoffArtifact!(verifiedRef,checker.attemptId)).toBeInstanceOf(Uint8Array);
    f.db.exec('DROP TRIGGER handoff_artifact_no_update');
    f.db.prepare("UPDATE orchestration_handoff_artifact SET sha256=? WHERE handoff_id=?").run('f'.repeat(64),producer.value.handoffId);
    expect(ready.host.authority.resolveHandoffArtifact!(verifiedRef,checker.attemptId)).toBeNull();
    expect(createBudgetManager(f.db, { verifyFinalReceipt: () => false }).summary('workflow').committedUnits).toBe(20n);
    expect((f.db.prepare('SELECT count(*) n FROM cleanup_observation').get() as any).n).toBeGreaterThanOrEqual(2); await driver.close();
  });
  it.each(['efficiency', 'performance', 'value', 'speed'])('honors the saved %s mode and strict readonly template', async mode => {
    const f = fixture(); f.run.selectionMode = mode; const ready = createGeneratedJsonHost(f.options); if (!ready.available) throw Error(ready.reasons.join(','));
    const driver = createOrchestrationDriver({ db: f.db, host: ready.host }), approval = driver.prepare(f.run);
    expect(approval.mode).toBe(mode); expect(approval.stages.map(s => s.role)).toEqual(['model-producer', 'verifier']);
    expect(approval.stages.map(s => s.scopeIds)).toEqual([['local-model-egress'], []]); expect(f.controls.launches).toEqual([]); await driver.close();
  });
  it('returns unavailable for missing evidence, estimates, policy, accounting and pins', () => {
    for (const mutate of [(f: any) => { f.controls.missingEvidence = true; }, (f: any) => { f.controls.unknownEstimate = true; },
      (f: any) => { delete f.options.policies.speed; }, (f: any) => { f.options.accounting.upperUnitsByKind.model = 1; },
      (f: any) => { f.options.installation.modelControlBundle.sha256 = 'f'.repeat(64); }]) {
      const f = fixture(); mutate(f); const ready = createGeneratedJsonHost(f.options); expect(ready.available).toBe(false); expect(f.controls.launches).toEqual([]);
    }
  });
  it('exposes only core-compatible reason codes, never callback exception paths', () => {
    const f = fixture(); f.options.candidates.model.observeCandidate = () => { throw Error('Cannot read C:\\private-account\\secret file'); };
    expect(createGeneratedJsonHost(f.options)).toEqual({ available: false, reasons: ['generated-host-invalid'] });
    const other = fixture(); other.controls.missingEvidence = true;
    expect(createGeneratedJsonHost(other.options)).toEqual({ available: false, reasons: ['generated-host-model-unqualified'] });
  });
  it('rejects invalid JSON and unapproved parent egress without persistence or launch', async () => {
    const f = fixture(), ready = createGeneratedJsonHost(f.options); if (!ready.available) throw Error(ready.reasons.join(','));
    const driver = createOrchestrationDriver({ db: f.db, host: ready.host }); f.run.goal = 'not JSON'; expect(() => driver.prepare(f.run)).toThrow();
    f.run.goal = '{}'; f.run.envelope.egress = []; f.run.envelopeHash = envelopeHash(f.run.envelope); expect(() => driver.prepare(f.run)).toThrow('parent-template');
    expect(f.controls.launches).toEqual([]); expect(f.db.prepare('SELECT count(*) n FROM generated_output_target').get()).toEqual({ n: 0 }); await driver.close();
  });
  it('guards nesting before pretty formatting and refuses known output larger than its approval budget', async () => {
    const f = fixture(); f.run.goal = '['.repeat(65) + '0' + ']'.repeat(65);
    const ready = createGeneratedJsonHost(f.options); if (!ready.available) throw Error(ready.reasons.join(','));
    const driver = createOrchestrationDriver({ db: f.db, host: ready.host });
    const original = JSON.stringify; let prettyCalls = 0;
    const spy = vi.spyOn(JSON, 'stringify').mockImplementation(((value: any, replacer: any, space: any) => {
      if (space === 2) prettyCalls++; return original(value, replacer, space);
    }) as typeof JSON.stringify);
    try { expect(() => driver.prepare(f.run)).toThrow('generated-host-input-contract'); expect(prettyCalls).toBe(0); } finally { spy.mockRestore(); }
    expect(f.controls.launches).toEqual([]); expect(f.db.prepare('SELECT count(*) n FROM generated_output_target').get()).toEqual({ n: 0 }); await driver.close();
    const other = fixture(); other.options.maxOutputBytes = 1; other.run.goal = '{"a":1}';
    const small = createGeneratedJsonHost(other.options); if (!small.available) throw Error(small.reasons.join(','));
    const second = createOrchestrationDriver({ db: other.db, host: small.host }); expect(() => second.prepare(other.run)).toThrow('generated-host-output-budget');
    expect(other.controls.launches).toEqual([]); expect(other.db.prepare('SELECT count(*) n FROM generated_output_target').get()).toEqual({ n: 0 });
    expect(other.db.prepare('SELECT count(*) n FROM approval_event').get()).toEqual({ n: 0 }); await second.close();
  });
  it('rechecks qualification immediately before launch and never promotes incorrect generated values', async () => {
    const f = fixture(), ready = createGeneratedJsonHost(f.options); if (!ready.available) throw Error(ready.reasons.join(','));
    const driver = createOrchestrationDriver({ db: f.db, host: ready.host }); driver.prepare(f.run); f.approve(); f.controls.missingEvidence = true;
    driver.activate(f.run); await driver.start(f.run); expect(f.controls.launches).toEqual([]); expect(driver.snapshot('workflow').acceptance).toBe('unverified'); await driver.close();
    const other = fixture(), host = createGeneratedJsonHost(other.options); if (!host.available) throw Error(host.reasons.join(','));
    other.controls.badResult = true; const second = createOrchestrationDriver({ db: other.db, host: host.host }); second.prepare(other.run); other.approve(); second.activate(other.run); await second.start(other.run);
    expect(other.controls.launches).toEqual(['model', 'checker']); expect(second.snapshot('workflow').acceptance).toBe('unverified'); await second.close();
  });
});
