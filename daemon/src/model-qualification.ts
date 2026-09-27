import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, createConnection, type Socket } from 'node:net';
import type { Ledger } from './ledger.js';
import { normalizeEnvelope, envelopeHash } from './envelope.js';
import { spawnOwnedPiped } from './process-launch.js';
import { subjectDigest, type MeasurementSubject } from './measurement-subject.js';
import { createModelMeasurementSubject, type ModelMeasurementInput } from './model-measurement-subject.js';
import { measureModelControlBundle, snapshotModelControlBundle, matchesModelControlObservation, type ModelControlBundle } from './model-control-bundle.js';
import { createCapabilityEvidenceStore } from './capability-store.js';
import { createCleanupObservationStore } from './cleanup-observation-store.js';
import { createIsolatedModelCleanup } from './adapters/isolated-model-cleanup.js';
import { createIsolatedLocalModelExecutor, type IsolatedModelExecution, type IsolatedModelResult } from './adapters/isolated-local-model.js';
import { createIsolatedJsonCheckerExecutor } from './adapters/isolated-json-checker.js';
import { createIsolatedGoalProposalCheckerExecutor } from './adapters/isolated-goal-proposal-checker.js';
import { snapshotNativeHostIdentity } from './adapters/native-identity-commit.js';
import type { streamLocalModel } from './adapters/local-model.js';
import type { RuntimeContext } from './integration-runtime.js';

const RECIPE = 'cue-client-recipe-v1';
const hash = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
const loadedCollectorPath = fileURLToPath(import.meta.url);
const loadedCollectorSha256 = hash(readFileSync(loadedCollectorPath));
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const sleep = (ms: number) => new Promise<void>(done => setTimeout(done, ms));
/** Fixed local vectors; no provider text or request-selected policy enters qualification. */
function goalQualificationVector(vector: 'pass' | 'fail' | 'unknown') {
  const goalSha256 = hash('Qualification fixture goal'), policyDigest = 'a'.repeat(64), parametersDigest = 'b'.repeat(64);
  const input = { version: 'cue-planning-input-v1', goalSha256,
    executionPolicy: { policyRevision: 'approved:1', policyDigest, mode: 'efficiency' },
    allowedCandidateIds: ['maker','checker'], allowedScopeIds: ['worktree'],
    checkerRegistry: [{ checkerId: 'trusted-code', revision: 'v1', kinds: ['code'], parametersDigest, targetIds: ['target'] }],
    targetLimits: { maxBytes: 65536, maxChangeTargets: 1 } };
  const proposal = { version: 'cue-goal-proposal-v1', goalSha256,
    plan: { policyRevision: 'approved:1', policyDigest, tasks: [
      { id: 'implement', role: 'implementation', ownerId: 'maker-owner', requirementIds: ['r1'], dependencyIds: [], candidateIds: ['maker'], scopeIds: ['worktree'] },
      { id: 'verify', role: 'verifier', ownerId: 'checker-owner', requirementIds: ['r1'], dependencyIds: ['implement'], candidateIds: ['checker'], scopeIds: [] }] },
    requirements: [{ id: 'r1', text: 'Check the fixture goal', kind: 'code', required: true,
      checks: [{ checkerId: vector === 'fail' ? 'untrusted-code' : 'trusted-code', revision: 'v1', parametersDigest, targetIds: ['target'] }] }],
    instructions: [{ taskId: 'implement', text: 'Implement fixture' }, { taskId: 'verify', text: 'Verify fixture' }],
    changeTargets: [{ taskId: 'implement', targetId: 'target', relativePath: 'src/fixture.ts', maxBackupBytes: 1000 }] };
  const canonical = (value: unknown) => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
  return { inputBytes: Buffer.from(vector === 'unknown' ? '{' : JSON.stringify(input)), outputBytes: Buffer.from(canonical(proposal)) };
}
type SubjectSnapshot = { subject: MeasurementSubject; subjectDigest: string; manifest: unknown };
export interface DiagnosticBundle {
  readonly version: 'cue-model-diagnostic-v1'; readonly productionBundleSha256: string;
  readonly clientSha256: string; readonly clientKind: ModelControlBundle['clientKind']; readonly recipeVersion: typeof RECIPE; readonly sha256: string;
}
export function measureModelDiagnosticBundle(controlRoot: string, production: ModelControlBundle): Readonly<DiagnosticBundle> {
  const value = { version: 'cue-model-diagnostic-v1' as const, productionBundleSha256: production.sha256,
    clientSha256: hash(readFileSync(join(controlRoot, 'model-boundary-probe.cjs'))), clientKind: production.clientKind, recipeVersion: RECIPE as typeof RECIPE };
  return Object.freeze({ ...value, sha256: hash(JSON.stringify(value)) });
}
interface QualificationHost {
  db: Ledger; measurement: ModelMeasurementInput; controlBundle: ModelControlBundle; diagnosticBundle: DiagnosticBundle;
  /** Protected loaded-installation guard. Strict synchronous true, checked before
   * collection and inside issuance. A callback is not itself a public proof. */
  assertInstallationCurrent?(): true;
  /** Test seams ALWAYS force fixture evidence. They cannot supply verdicts. */
  fixture?: { measureSubject(): SubjectSnapshot; transport?: typeof streamLocalModel; beforePublish?(): void };
}
type Journal = { id: number; content: string; sha256: string };
type NativeResult = IsolatedModelResult & { code: number | null; stderr: string; stdout: string };

/** Protected host qualification, never a task/model/plugin tool. Production and
 * diagnostic executions are distinct owned runs. Controlled TCP is not B3 or
 * provider confinement. A supplied fixture seam can never publish live evidence. */
export function createModelQualification(host: QualificationHost) {
  const db = host.db, fixture = host.fixture, kind = host.measurement.kind;
  const guard = host.assertInstallationCurrent;
  if (guard !== undefined && typeof guard !== 'function') throw Error('qualification_installation_guard');
  const assertInstallation = () => {
    if (!guard) return;
    const result: unknown = guard();
    if (result instanceof Promise) void result.catch(() => {});
    if (result !== true) throw Error('qualification_installation_guard');
  };
  const controlRoot = fixture ? dirname(fileURLToPath(import.meta.url)) : join(host.measurement.installRoot, 'daemon', 'dist', 'src');
  const control = snapshotModelControlBundle(host.controlBundle, kind, host.controlBundle.nodeSha256);
  const diagnostic = Object.freeze({ ...host.diagnosticBundle });
  const measurement = Object.freeze({ ...host.measurement });
  const sourceKind = fixture ? 'fixture' as const : 'live' as const;
  if (fixture && kind === 'model' && !fixture.transport) throw Error('qualification_fixture_transport_required');
  if (resolve(measurement.powershellExecutable).toLowerCase() !== resolve(join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')).toLowerCase()) throw Error('qualification_powershell_mismatch');
  const measure = (): SubjectSnapshot => fixture ? fixture.measureSubject() : createModelMeasurementSubject(measurement);
  const assertPins = () => {
    if (!fixture && hash(readFileSync(loadedCollectorPath)) !== loadedCollectorSha256) throw Error('qualification_loaded_collector_drift');
    if (JSON.stringify(measureModelControlBundle({ controlRoot, nodeExecutable: measurement.nodeExecutable, clientKind: kind })) !== JSON.stringify(control)
      || JSON.stringify(measureModelDiagnosticBundle(controlRoot, control)) !== JSON.stringify(diagnostic)) throw Error('qualification_pin_drift');
  };
  let running = false;
  return Object.freeze({
    async collect(options: { signal?: AbortSignal } = {}) {
      if (db.inTransaction) throw Error('qualification_outer_transaction');
      if (running) throw Error('qualification_busy');
      options.signal?.throwIfAborted();
      assertInstallation();
      if (!fixture && realpathSync(fileURLToPath(import.meta.url)) !== realpathSync(join(controlRoot, 'model-qualification.js'))) throw Error('qualification_loaded_install_mismatch');
      running = true;
      try {
      const abort = new AbortController(), startedAt = new Date().toISOString(), startedMs = Date.now();
      const onAbort = () => abort.abort(); options.signal?.addEventListener('abort', onAbort, { once: true });
      if (options.signal?.aborted) abort.abort();
      const timer = setTimeout(() => abort.abort(), 180000);
      const taskId = 'qualification-' + randomUUID(), rootRunId = taskId + '-root';
      const root = join(tmpdir(), 'Cue.Qualification.' + randomUUID());
      const journals: Journal[] = [], legs: Record<string, any>[] = [];
      let before: SubjectSnapshot | undefined, after: SubjectSnapshot | undefined, initialized = false, allClean = true, failure: string | null = null;
      const check = () => { abort.signal.throwIfAborted(); if (Date.now() - startedMs > 180000) throw Error('qualification_timeout'); if (db.inTransaction) throw Error('qualification_outer_transaction'); };
      function journal(stage: string, value: unknown, runId = rootRunId) {
        const content = JSON.stringify({ stage, value });
        if (Buffer.byteLength(content) > 262144) throw Error('qualification_journal_limit');
        const row = db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)')
          .run(taskId, runId, 'model-qualification-raw', content, new Date().toISOString());
        journals.push({ id: Number(row.lastInsertRowid), content, sha256: hash(content) });
      }
      function makeRun(label: string) {
        const runId = taskId + '-' + label;
        const envelope = normalizeEnvelope({ run_id: runId, worktree_realpath: root, allowed_actions: [], egress: kind === 'model' ? ['http://127.0.0.1:8085'] : [],
          autonomy_level: 'bounded', expires_at: new Date(Date.now() + 180000).toISOString() });
        const digest = envelopeHash(envelope);
        db.transaction(() => { db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(digest, envelope.worktree_realpath, JSON.stringify(envelope.egress), startedAt);
          db.prepare('INSERT INTO run VALUES(?,?,?,0,?)').run(runId, taskId, digest, startedAt); })();
        const owner = Object.freeze({ task_id: taskId, run_id: runId, cwd: envelope.worktree_realpath });
        const context: RuntimeContext = Object.freeze({ runId, candidateId: 'qualification-' + kind, role: 'model', subjectDigest: before!.subjectDigest, signal: abort.signal });
        return { context, owner, envelope };
      }
      const cleanupStore = createCleanupObservationStore(db);
      async function leg(label: string, launch: (c: RuntimeContext, binding: ReturnType<typeof makeRun>) => Promise<IsolatedModelExecution>): Promise<Record<string, any>> {
        check(); const binding = makeRun(label);
        const observer = createIsolatedModelCleanup({ db, taskRootBase: tmpdir(), profileRootBase: join(process.env.LOCALAPPDATA!, 'Packages'),
          launch: c => launch(c, binding), persistObservation: async value => cleanupStore.persist(value) });
        let execution: IsolatedModelExecution | undefined;
        try {
          execution = await observer.launch(binding.context);
          const result = await execution.result;
          let receipt = await observer.verifyCleanup(binding.context, execution), until = Date.now() + 10000;
          while (receipt.result === 'residual' && Date.now() < until) { await sleep(50); receipt = await observer.verifyCleanup(binding.context, execution); }
          if (receipt.result !== 'verified-clean') allClean = false;
          const observed = { label, runId: binding.context.runId, session: execution.session, result, cleanup: receipt };
          legs.push(observed); journal(label, observed, binding.context.runId); return observed;
        } catch (error) {
          allClean = false; if (execution) try { await execution.cancel(); } catch { /* retained unknown */ }
          journal(label + '-failed', { error: String(error), session: execution?.session ?? null }, binding.context.runId); throw error;
        }
      }
      async function ownedOutput(owner: ReturnType<typeof makeRun>['owner'], args: string[], limit: number, timeout: number) {
        const { child, session } = spawnOwnedPiped(db, owner, measurement.powershellExecutable, args);
        return await new Promise<{ stdout: string; stderr: string; code: number | null; session: typeof session }>((done, reject) => {
          let stdout = '', stderr = '', exceeded = false; const kill = () => child.kill(); const timer = setTimeout(kill, timeout);
          abort.signal.addEventListener('abort', kill, { once: true });
          child.stdout.on('data', b => { stdout += b.toString(); if (Buffer.byteLength(stdout) > limit) { exceeded = true; kill(); } });
          child.stderr.on('data', b => { stderr += b.toString(); if (Buffer.byteLength(stderr) > limit) { exceeded = true; kill(); } });
          child.on('error', () => { exceeded = true; }); child.stdin.on('error', () => {}); child.stdin.end();
          child.on('close', code => { clearTimeout(timer); abort.signal.removeEventListener('abort', kill);
            if (exceeded) reject(Error('qualification_host_output_limit')); else done({ stdout, stderr, code, session }); });
        });
      }
      async function acl(owner: ReturnType<typeof makeRun>['owner'], paths: string[]) {
        const encoded = Buffer.from(JSON.stringify(paths)).toString('base64');
        const script = `$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; $paths=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'))|ConvertFrom-Json; @($paths | ForEach-Object { $a=[IO.File]::GetAccessControl($_); @{exists=(Test-Path -LiteralPath $_);content=[IO.File]::ReadAllText($_);packageRules=@($a.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]) | ForEach-Object { $sid=$_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value; if ($sid -like 'S-1-15-*') { @{sid=$sid;rights=[int]$_.FileSystemRights;type=$_.AccessControlType.ToString()} } })} }) | ConvertTo-Json -Depth 5 -Compress`;
        const result = await ownedOutput(owner, ['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script, 'utf16le').toString('base64')], 32768, 4000);
        if (result.code !== 0 || result.stderr) throw Error('qualification_acl_unavailable: ' + result.stderr);
        return { ...result, values: JSON.parse(result.stdout) };
      }
      function native(binding: ReturnType<typeof makeRun>, payload: Record<string, unknown>, qualification: boolean,
        onLine?: (key: string, frames: Record<string, any>) => Promise<void>): Promise<IsolatedModelExecution> {
        const metadata = { nodeExecutable: measurement.nodeExecutable, nodeSha256: control.nodeSha256, controlBundle: control,
          parentPid: process.pid, timeoutMs: 15000, clientKind: kind, ...payload };
        const { child, session } = spawnOwnedPiped(db, binding.owner, measurement.powershellExecutable,
          ['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',join(controlRoot,'model-only-launch.ps1'),'-PayloadBase64',
            Buffer.from(JSON.stringify(metadata)).toString('base64'), ...(qualification ? ['-QualificationHarness'] : [])]);
        let stdout = '', stderr = '', pending = '', failed = false, closed = false, chain = Promise.resolve(); const frames: Record<string, any> = {};
        const stop = () => { failed = true; child.stdin.destroy(); if (!closed) child.kill(); };
        const deadline = setTimeout(stop, 20000); abort.signal.addEventListener('abort', stop, { once: true }); if (abort.signal.aborted) stop();
        child.stdout.on('data', b => {
          stdout += b.toString(); pending += b.toString(); if (Buffer.byteLength(stdout) > 131072) { stop(); return; }
          let end; while ((end = pending.indexOf('\n')) >= 0) {
            const value = pending.slice(0, end).replace(/\r$/, ''); pending = pending.slice(end + 1);
            chain = chain.then(async () => { const match = /^(CUE_MODEL_[A-Z_]+)=(.*)$/.exec(value); if (!match || Object.hasOwn(frames, match[1]!)) throw Error('qualification_native_frame');
              const raw = match[2]!; frames[match[1]!] = raw.startsWith('{') ? JSON.parse(raw) : raw;
              if (match[1] === 'CUE_MODEL_HOST_IDENTITY') {
                const identity = snapshotNativeHostIdentity(frames[match[1]]);
                if (identity.launcher.pid !== session.pid || String(identity.guardian.pid) !== frames.CUE_MODEL_GUARDIAN_PID) throw Error('qualification_native_identity');
              }
              await onLine?.(match[1]!, frames); }).catch(error => { frames.hostFailure = String(error); stop(); });
          }
        });
        child.stderr.on('data', b => { stderr += b.toString(); if (Buffer.byteLength(stderr) > 8192) stop(); });
        child.on('error', stop); child.stdin.on('error', stop); child.stdin.end();
        const result = new Promise<NativeResult>(done => child.on('close', async code => {
          closed = true; clearTimeout(deadline); abort.signal.removeEventListener('abort', stop); await chain;
          done(Object.freeze({ code, stderr, stdout, outcome: !failed && !pending && code === 0 && frames.CUE_MODEL_HOST_IDENTITY ? 'succeeded' : 'failed', attemptId: binding.context.runId,
            requestId: binding.context.runId, text: null, usage: null, terminal: null, observations: Object.freeze(frames), cleanup: 'unknown', providerStopped: 'unknown' }));
        }));
        return Promise.resolve(Object.freeze({ session: Object.freeze(session), result, completion: result.then(v => v.outcome), cancel: async () => { stop(); await result; } }));
      }
      const recipe = (observed: Record<string, any>, diagnosticLeg: boolean) => {
        const f = observed.result.observations, b = f.CUE_MODEL_BOUNDARY, n = f.CUE_MODEL_OBSERVATION;
        return object(b) && object(n) && n.status === 'observed' && n.phase === 'suspended-before-resume' && n.appContainer === true
          && n.appContainerSid === b.sid && n.pid === Number(f.CUE_MODEL_PID) && Array.isArray(n.capabilities) && n.capabilities.length === 0
          && n.loopbackExempt === false && n.job?.flags === 0x2008 && n.job.activeProcessLimit === 1 && JSON.stringify(n.job.memberPids) === JSON.stringify([n.pid])
          && b.recipeVersion === RECIPE && b.preserveDependencySymlinks === (kind !== 'model')
          && (diagnosticLeg ? b.controlStatus === 'qualification-pinned' && b.controlBundleSha256 === control.sha256 && b.clientKind === kind
            && b.productionClientSha256 === control.clientSha256 && b.clientSha256 === diagnostic.clientSha256 && b.diagnosticClientSha256 === diagnostic.clientSha256
            && b.guardianSha256 === control.guardianSha256 && b.checkerCoreSha256 === control.checkerCoreSha256 : matchesModelControlObservation(control, b));
      };
      let m1 = false, m2 = false, m3 = false;
      try {
        check(); assertPins(); before = measure();
        if (before.subjectDigest !== subjectDigest(before.subject)) throw Error('qualification_subject_invalid');
        before = JSON.parse(JSON.stringify(before)) as SubjectSnapshot;
        mkdirSync(root); db.prepare('INSERT INTO task VALUES(?,?,NULL,?)').run(taskId, 'running', startedAt); initialized = true;
        makeRun('root'); journal('started', { before, control, diagnostic, sourceKind, root });
        const vectors = kind === 'model' ? ['model'] as const : ['pass', 'fail', 'unknown'] as const;
        const production = [];
        for (const vector of vectors) {
          const observed = await leg('production-' + vector, async (context, binding) => {
            const common = { db, taskRootBase: tmpdir(), profileRootBase: join(process.env.LOCALAPPDATA!, 'Packages'), controlBundle: control, nodeExecutable: measurement.nodeExecutable, nodeSha256: control.nodeSha256, timeoutMs: 15000 };
            if (kind === 'model') return createIsolatedLocalModelExecutor({ ...common, maxOutputTokens: 128, ...(fixture?.transport ? { transport: fixture.transport } : {}),
              resolveBinding: () => ({ owner: binding.owner, envelope: binding.envelope, prompt: 'Reply with exactly OK and nothing else. /no_think' }) })(context);
            if (kind === 'json-checker') return createIsolatedJsonCheckerExecutor({ ...common, resolveBinding: () => ({ owner: binding.owner, envelope: binding.envelope,
              inputBytes: Buffer.from(vector === 'unknown' ? '{' : '{"a":1}'), outputBytes: Buffer.from(vector === 'pass' ? '{\n  "a": 1\n}' : '{}') }) })(context);
            if (vector === 'model') throw Error('qualification_vector_kind');
            const bytes = goalQualificationVector(vector);
            return createIsolatedGoalProposalCheckerExecutor({ ...common, resolveBinding: () => ({ owner: binding.owner, envelope: binding.envelope, ...bytes }) })(context);
          });
          production.push(observed);
          if (observed.result.outcome !== 'succeeded' || !recipe(observed, false) || (kind === 'model' ? observed.result.text?.trim() !== 'OK' : observed.result.checkerVerdict?.status !== vector || (kind === 'goal-proposal-checker' && observed.result.checkerVerdict?.reason !== ({pass:'structural_match',fail:'checker_registry',unknown:'input_contract'} as Record<string,string>)[vector]))) throw Error('qualification_production_protocol');
        }
        const processLeg = await leg('process-limit', (_, b) => native(b, { diagnosticClientSha256: diagnostic.clientSha256,
          qualificationOperation: 'process-limit', request: JSON.stringify({ protocol: 'cue-boundary-probe-v1', operation: 'process-limit' }) }, true));
        const processFrames = processLeg.result.observations;
        const processResult = JSON.parse(Buffer.from(processFrames.CUE_MODEL_RESPONSE ?? '', 'base64').toString('utf8'));
        const limit = processFrames.CUE_MODEL_PROCESS_LIMIT;
        m1 = production.length === vectors.length && recipe(processLeg, true) && processLeg.result.outcome === 'succeeded'
          && processResult.protocol === 'cue-boundary-probe-v1' && processResult.operation === 'process-limit' && processResult.attempts === 1
          && limit?.status === 'observed' && limit.messageId === 3 && limit.eventCount === 1 && limit.ownedWorkerPid === processResult.pid
          && limit.createdFileTime === processFrames.CUE_MODEL_OBSERVATION?.createdFileTime && !processLeg.result.stdout.includes('UNEXPECTED_CHILD_MARKER');
        const received: string[] = [], sockets = new Set<Socket>();
        const server = createServer(socket => { sockets.add(socket); let data = ''; socket.on('close', () => sockets.delete(socket)); socket.on('error', () => {});
          socket.on('data', bytes => { data += bytes.toString(); if (data.length > 512) { socket.destroy(); return; } if (data.includes('\n')) { received.push(data.trim()); socket.end(data); } }); });
        const preNonce = 'pre-' + randomUUID(), postNonce = 'post-' + randomUUID(), nonce = 'child-' + randomUUID();
        let preAcl: any, postAcl: any, postFiles: any;
        try {
          await new Promise<void>((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
          const port = (server.address() as { port: number }).port;
          const controlTcp = (value: string) => new Promise<void>((done, reject) => {
            const socket = createConnection({ host: '127.0.0.1', port }); let data = '';
            socket.setTimeout(2000, () => socket.destroy(Error('qualification_tcp_timeout'))); socket.on('error', reject);
            socket.on('connect', () => socket.write(value + '\n')); socket.on('data', b => { data += b.toString(); if (data.length > 512) socket.destroy(Error('qualification_tcp_limit')); });
            socket.on('end', () => data.trim() === value ? done() : reject(Error('qualification_tcp_nonce')));
          });
          const outside = join(root, 'outside.txt'); writeFileSync(outside, 'outside-unchanged'); await controlTcp(preNonce);
          const fileLeg = await leg('filesystem-network', (_, binding) => native(binding, { diagnosticClientSha256: diagnostic.clientSha256,
            qualificationOperation: 'filesystem-network', qualificationHoldAfterExit: true,
            request: JSON.stringify({ protocol: 'cue-boundary-probe-v1', operation: 'filesystem-network', outsideFile: outside, port, nonce }) }, true, async (key, frames) => {
            const b = frames.CUE_MODEL_BOUNDARY;
            if (key === 'CUE_MODEL_PID') {
              const targets = [join(b.taskRoot, 'existing.txt'), join(b.profilePath, 'probe-existing.txt'), join(b.profilePath, 'Temp', 'probe-existing.txt')];
              for (const target of targets.slice(1)) writeFileSync(target, 'host-seeded-unchanged');
              preAcl = await acl(binding.owner, targets); journal('acl-before', preAcl, binding.context.runId); writeFileSync(join(b.taskRoot, 'host-ready'), 'ready');
            }
            if (key === 'CUE_MODEL_PROBE_WAIT') {
              const targets = [join(b.taskRoot, 'existing.txt'), join(b.profilePath, 'probe-existing.txt'), join(b.profilePath, 'Temp', 'probe-existing.txt')];
              postFiles = [...targets, outside].map(path => ({ text: readFileSync(path, 'utf8'), forbiddenAbsent: !existsSync(join(dirname(path), 'forbidden-new.txt')) }));
              postAcl = await acl(binding.owner, targets); journal('host-post-exit', { postFiles, postAcl }, binding.context.runId);
              writeFileSync(join(b.taskRoot, 'host-inspection-complete'), 'complete');
            }
          }));
          await controlTcp(postNonce);
          const frames = fileLeg.result.observations;
          if (frames.hostFailure) throw Error(frames.hostFailure);
          const result = JSON.parse(Buffer.from(frames.CUE_MODEL_RESPONSE ?? '', 'base64').toString('utf8'));
          const sameRecipe = recipe(fileLeg, true) && fileLeg.result.outcome === 'succeeded' && result.pid === frames.CUE_MODEL_OBSERVATION?.pid;
          const acls = preAcl?.values;
          const readOnly = Array.isArray(acls) && acls.length === 3 && acls.every(a => a.exists === true && a.packageRules?.some((r: any) => r.sid === frames.CUE_MODEL_BOUNDARY.sid && r.type === 'Allow' && (r.rights & 0x1200a9) === 0x1200a9)
            && a.packageRules.every((r: any) => r.type !== 'Allow' || (r.rights & 0x0d0156) === 0));
          m2 = sameRecipe && readOnly && JSON.stringify(preAcl.values) === JSON.stringify(postAcl?.values)
            && JSON.stringify(postFiles) === JSON.stringify(['unchanged','host-seeded-unchanged','host-seeded-unchanged','outside-unchanged'].map(text => ({ text, forbiddenAbsent: true })))
            && ['work','profile','temp','outside'].every(name => object(result.files?.[name]) && result.files[name].before === result.files[name].after
              && ['create','append','overwrite','delete'].every(op => ['EACCES','EPERM'].includes(result.files[name].operations?.[op])));
          m3 = sameRecipe && result.protocol === 'cue-boundary-probe-v1' && result.operation === 'filesystem-network' && result.network?.connected === false
            && result.network.sent === false && JSON.stringify(received) === JSON.stringify([preNonce, postNonce]);
          journal('controlled-tcp', { port, preNonce, postNonce, childNonce: nonce, received });
        } finally { for (const socket of sockets) socket.destroy(); await new Promise<void>(done => server.close(() => done())); }
        fixture?.beforePublish?.(); check(); assertPins(); after = measure();
        if (after.subjectDigest !== subjectDigest(after.subject) || JSON.stringify(before) !== JSON.stringify(after)) throw Error('qualification_subject_drift');
      } catch (error) {
        failure = String(error); m1 = m2 = m3 = false;
        if (initialized) journal('failed', { failure });
      } finally { clearTimeout(timer); options.signal?.removeEventListener('abort', onAbort); }
      if (!initialized || !before) throw Error(failure ?? 'qualification_not_initialized');
      if (!allClean || abort.signal.aborted) { m1 = m2 = m3 = false; failure ??= 'qualification_cleanup_or_abort'; }
      if (allClean && resolve(dirname(root)) === resolve(tmpdir()) && /^Cue\.Qualification\.[a-f0-9-]+$/.test(root.slice(dirname(root).length + 1))) {
        try { rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }
        catch { allClean = m1 = m2 = m3 = false; failure ??= 'qualification_fixture_cleanup'; }
      }
      const statuses = { M1: m1 ? 'pass' as const : 'unknown' as const, M2: m2 ? 'pass' as const : 'unknown' as const, M3: m3 ? 'pass' as const : 'unknown' as const };
      const observation = Buffer.from(JSON.stringify({ version: 'cue-model-qualification-v1', sourceKind, subjectBefore: before, subjectAfter: after ?? null,
        control, diagnostic, statuses, failure, allClean, journals, scope: ['fixed-production-protocol','same-recipe-pinned-diagnostic','controlled-loopback-tcp-only','not-B3','provider-outside-client-boundary'] }));
      if (observation.length > 1048576 || db.inTransaction) throw Error('qualification_publish_unavailable');
      const store = createCapabilityEvidenceStore(db, Date.now);
      const references = db.transaction(() => {
        for (const entry of journals) {
          const row = db.prepare('SELECT content FROM artifact WHERE id=? AND task_id=?').get(entry.id, taskId) as { content: string } | undefined;
          if (!row || row.content !== entry.content || hash(row.content) !== entry.sha256) throw Error('qualification_journal_drift');
        }
        assertInstallation();
        abort.signal.throwIfAborted();
        if (Date.now() - startedMs > 180000) throw Error('qualification_timeout');
        const refs = Object.fromEntries((['M1','M2','M3'] as const).map(probe => [probe, store.record({ probe, subjectDigest: before!.subjectDigest, measuredAt: startedAt, kind: sourceKind, status: statuses[probe], observation })]));
        db.prepare('UPDATE task SET state=?,blocked_reason=? WHERE id=?').run(failure ? 'failed' : 'completed', failure, taskId);
        return Object.freeze(refs);
      }).immediate();
      return Object.freeze({ taskId, runId: rootRunId, subjectDigest: before.subjectDigest, kind: sourceKind, statuses: Object.freeze(statuses), references, failure,
        eligible: sourceKind === 'live' && kind !== 'goal-proposal-checker' && m1 && m2 && m3, allClean });
      } finally { running = false; }
    },
  });
}
