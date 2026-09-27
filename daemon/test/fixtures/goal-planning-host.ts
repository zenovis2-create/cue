import {mkdtempSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,win32} from 'node:path';
import {createHash} from 'node:crypto';
import {openLedger,type Ledger} from '../../src/ledger.js';
import {normalizeEnvelope,envelopeHash} from '../../src/envelope.js';
import {saveSelectionPolicy} from '../../src/selection/policy-store.js';
import {SUBJECT_FIELDS,subjectDigest,type MeasurementSubject} from '../../src/measurement-subject.js';
import {MODEL_PROBES} from '../../src/capability-admission.js';
import {recordSession} from '../../src/session-spawn.js';
import {checkGoalProposal} from '../../src/verification/goal-proposal-checker.cjs';
import type {ModelControlBundle} from '../../src/model-control-bundle.js';
const roots:string[]=[];const dbs:Ledger[]=[];
function canonicalJson(value:any):string { if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return `[${value.map(canonicalJson).join(',')}]`;return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`; }
export const fixtureResources={roots,dbs};
function bundle(clientKind: 'model' | 'goal-proposal-checker'): ModelControlBundle {
  const value = { version: 'cue-model-control-v1' as const, clientKind, nodeSha256: '1'.repeat(64), launcherSha256: '2'.repeat(64), guardianSha256: '3'.repeat(64),
    clientSha256: '4'.repeat(64), checkerCoreSha256: clientKind === 'model' ? null : '5'.repeat(64) };
  return { ...value, sha256: createHash('sha256').update(JSON.stringify(Object.values(value))).digest('hex') };
}
export function makeAcceptedPlanningFixture(config: {db?:Ledger;root?:string;runId?:string;taskId?:string;goal?:string;executionContract?:{executionPolicies:any;approvedExecution:any};proposalBody?:(goal:string)=>unknown;seedRun?:boolean} = {}) {
  const root = config.root??mkdtempSync(join(tmpdir(), 'cue-planning-host-'));if(!config.root)roots.push(root);
  const work = join(root, 'work');mkdirSync(work,{recursive:true});
  const db = config.db??openLedger();if(!config.db)dbs.push(db); const now = Date.now();
  const runId=config.runId??'workflow',taskId=config.taskId??'root';
  const envelope = normalizeEnvelope({ run_id: runId, worktree_realpath: work, allowed_actions: [], egress: ['http://127.0.0.1:8085/v1'],
    expires_at: new Date(now + 120000).toISOString(), autonomy_level: 'bounded' });
  const run: any = { runId, taskId, envelope, envelopeHash: envelopeHash(envelope), goal: config.goal??'Improve the parser safely', scope: 'document', selectionMode: 'efficiency' };
  if(config.seedRun!==false){db.prepare("INSERT INTO task VALUES(?,'awaiting_approval',NULL,'now')").run(taskId);
    db.prepare("INSERT INTO envelope VALUES(?,?,?,'now')").run(run.envelopeHash, work, JSON.stringify(envelope.egress));
    db.prepare("INSERT INTO run VALUES(?,?,?,0,'now')").run(runId,taskId,run.envelopeHash);}
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
  const installation = { nodeExecutable: process.execPath, nodeSha256: '1'.repeat(64), modelControlBundle: bundle('model'), checkerControlBundle: bundle('goal-proposal-checker'),
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
    const text = kind === 'model' && !controls.outputlessFailure ? (controls.badResult ? '{}' : canonicalJson(config.proposalBody?.(run.goal)??{version:'cue-goal-proposal-v1',goalSha256:createHash('sha256').update(run.goal).digest('hex'),plan:{policyRevision:'approved:1',policyDigest:'a'.repeat(64),tasks:[
      {id:'implement',role:'implementation',ownerId:'maker-owner',requirementIds:['r1'],dependencyIds:[],candidateIds:['fixture-model'],scopeIds:[]},
      {id:'verify',role:'verifier',ownerId:'checker-owner',requirementIds:['r1'],dependencyIds:['implement'],candidateIds:['fixture-checker'],scopeIds:[]}]},
      requirements:[{id:'r1',text:'Parser handles input',kind:'document',required:true,checks:[{checkerId:'trusted-document',revision:'v1',parametersDigest:'b'.repeat(64),targetIds:['report']}]}],
      instructions:[{taskId:'implement',text:'Improve parser'},{taskId:'verify',text:'Check parser'}],changeTargets:[]})) : null;
    const result = Promise.resolve({ outcome: controls.diagnosticFailure || controls.outputlessFailure ? 'failed' as const : 'succeeded' as const, attemptId: context.runId, requestId: 'request-' + context.runId, text, usage: null, terminal: null, observations,
      cleanup: 'unknown' as const, providerStopped: 'unknown' as const, ...(controls.diagnosticFailure ? { diagnosticCode: 'deadline-exceeded', ignoredSecret: 'raw-provider-secret' } : {}),
      ...(kind === 'checker' ? { checkerVerdict: checkGoalProposal(binding.inputBytes, binding.outputBytes) } : {}) });
    void result.then(value => { (controls as any).diagnosticResult = value; });
    return { session, result, completion: result.then(r => r.outcome), cancel: async () => {} };
  };
  const options: any = { db, now: () => Date.now(), installation, candidates, policies,
    executionPolicies:Object.fromEntries(['efficiency','performance','value','speed'].map(mode=>[mode,{policyRevision:'approved:1',policyDigest:'a'.repeat(64)}])),
    approvedExecution:{allowedCandidateIds:['fixture-model','fixture-checker'],allowedScopeIds:[],checkerRegistry:[{checkerId:'trusted-document',revision:'v1',kinds:['document'],parametersDigest:'b'.repeat(64),targetIds:['report']}],maxChangeTargets:0},
    accounting: { currency: 'TEST', unit: 'micro', limitUnits: 100, unitsPerCost: 10, upperUnitsByKind: { model: 10, checker: 10 }, source: 'fixture-bounded-total', observedAtMs: now },
    evidence: { now: () => Date.now(), maxAgeMs: 60000, resolveEvidence: (ref: any) => controls.missingEvidence ? undefined : evidence.get(ref.id) },
    executorFactories: { model: executor('model'), checker: executor('checker') } };
  if(config.executionContract){options.executionPolicies=config.executionContract.executionPolicies;options.approvedExecution=config.executionContract.approvedExecution;}
  const approve = () => db.prepare("INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,request_ordinal,decision,created_at) VALUES(?,?,'desktop','goal',0,'accept','now')").run(runId,run.envelopeHash);
  return { db, options, run, controls, approve };
}
