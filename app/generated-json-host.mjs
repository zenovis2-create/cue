import { createHash } from 'node:crypto';
import { isAbsolute, win32 } from 'node:path';
import { createCapabilityAdmission } from '../daemon/dist/src/capability-admission.js';
import { subjectDigest } from '../daemon/dist/src/measurement-subject.js';
import { createIntegrationCatalog } from '../daemon/dist/src/integration-catalog.js';
import { readSelectionPolicy } from '../daemon/dist/src/selection/policy-store.js';
import { readDeployedSelectionPolicy, readDeployedSelectionPolicyForRun } from '../daemon/dist/src/selection/policy-promotion.js';
import { selectCandidate } from '../daemon/dist/src/selection/policy.js';
import { readLocalSelectionPolicy, selectLocalCandidate } from '../daemon/dist/src/selection/local-policy-store.js';
import { validateTaskPlan } from '../daemon/dist/src/orchestration/plan.js';
import { envelopeHash } from '../daemon/dist/src/envelope.js';
import { snapshotModelControlBundle } from '../daemon/dist/src/model-control-bundle.js';
import { createIsolatedLocalModelExecutor, ISOLATED_LOCAL_ENDPOINT, ISOLATED_LOCAL_MODEL } from '../daemon/dist/src/adapters/isolated-local-model.js';
import { createIsolatedJsonCheckerExecutor } from '../daemon/dist/src/adapters/isolated-json-checker.js';
import { createGeneratedModelOutput } from '../daemon/dist/src/adapters/generated-model-output.js';
import { createIsolatedModelCleanup } from '../daemon/dist/src/adapters/isolated-model-cleanup.js';
import { createCleanupObservationStore } from '../daemon/dist/src/cleanup-observation-store.js';
import { createGeneratedAcceptanceHost, generatedJsonCheckerRevision, GENERATED_JSON_CHECKER_ID, assertGeneratedJsonTemplateBounds } from '../daemon/dist/src/verification/generated-acceptance-host.js';
import { createGeneratedOutputStore, generatedOutputParametersDigest } from '../daemon/dist/src/verification/generated-output.js';
import jsonFormatChecker from '../daemon/dist/src/verification/json-format-checker.cjs';
import { createGeneratedJsonHandoffAuthority } from './generated-json-handoff-authority.mjs';
import { createGeneratedJsonRecoveryAuthority } from './generated-json-recovery-authority.mjs';

const { checkJsonFormat } = jsonFormatChecker;

const MODES = ['efficiency', 'performance', 'value', 'speed'];
const sha = value => createHash('sha256').update(value).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const bounded = (n, max) => Number.isSafeInteger(n) && n > 0 && n <= max;

/** Protected main-process assembly. Supplied observations are trusted host inputs,
 * not renderer fields. Missing qualification/estimates never produce a fallback.
 * Executor factory seams exist for deterministic tests; defaults always use actual
 * pinned native executors. They must never be loaded from user/plugin config. */
export function createGeneratedJsonHost(options) {
  const unavailable = reason => Object.freeze({ available: false, reasons: Object.freeze([
    typeof reason === 'string' && /^[a-zA-Z0-9._:-]{1,128}$/.test(reason) ? reason : 'generated-host-invalid',
  ]) });
  if (!options?.db || typeof options.now !== 'function' || typeof options.inputForRun !== 'function'
    || !options.installation || !options.candidates?.model || !options.candidates?.checker || !options.evidence || !options.accounting) return unavailable('generated-host-missing-authority');
  try {
    const { db } = options, now = () => { const n = options.now(); if (!Number.isSafeInteger(n) || n < 0) throw Error('generated-host-clock'); return n; };
    const installation = clone(options.installation), money = Object.freeze(clone(options.accounting));
    const local = money.kind === 'local-invocation';
    if (money.kind !== undefined && money.kind !== 'monetary' && !local) return unavailable('generated-host-accounting-kind');
    if (!isAbsolute(installation.nodeExecutable) || !win32.isAbsolute(installation.taskRootBase) || !win32.isAbsolute(installation.profileRootBase)) return unavailable('generated-host-installation-paths');
    const modelPins = snapshotModelControlBundle(installation.modelControlBundle, 'model', installation.nodeSha256);
    const checkerPins = snapshotModelControlBundle(installation.checkerControlBundle, 'json-checker', installation.nodeSha256);
    if (local) {
      if (!same(Object.keys(money).sort(), ['kind','observedAtMs','source']) || typeof money.source !== 'string' || !money.source || money.source.length > 256
        || !Number.isSafeInteger(money.observedAtMs) || money.observedAtMs < 0 || money.observedAtMs > now()) return unavailable('generated-host-local-accounting');
    } else if (!bounded(money.limitUnits, Number.MAX_SAFE_INTEGER) || !bounded(money.unitsPerCost, Number.MAX_SAFE_INTEGER)
      || !['minor', 'micro'].includes(money.unit) || typeof money.currency !== 'string' || !money.currency
      || typeof money.source !== 'string' || !money.source || !Number.isSafeInteger(money.observedAtMs) || money.observedAtMs < 0 || money.observedAtMs > now()
      || !['model', 'checker'].every(kind => bounded(money.upperUnitsByKind?.[kind], Number.MAX_SAFE_INTEGER))) return unavailable('generated-host-accounting-unknown');
    const maxBytes = options.maxOutputBytes ?? 65536, maxOutputTokens = options.maxOutputTokens ?? 2048;
    if (!bounded(maxBytes, 1_048_576) || !bounded(maxOutputTokens, 32768)) return unavailable('generated-host-output-limits');
    const candidates = Object.fromEntries(['model', 'checker'].map(kind => {
      const input = options.candidates[kind];
      if (input.record?.kind !== kind || typeof input.currentSubject !== 'function' || typeof input.evidenceReferences !== 'function' || typeof input.observeCandidate !== 'function') throw Error('generated-host-candidate-authority');
      return [kind, { ...input, record: Object.freeze(clone(input.record)) }];
    }));
    const ids = { model: candidates.model.record.canonicalId, checker: candidates.checker.record.canonicalId };
    if (ids.model === ids.checker || candidates.model.record.binding?.modelId !== ISOLATED_LOCAL_MODEL || candidates.checker.record.binding !== null) return unavailable('generated-host-candidate-identity');
    const admission = createCapabilityAdmission(options.evidence);
    const catalog = createIntegrationCatalog({ now, maxAgeMs: options.evidence.maxAgeMs,
      currentSubjectDigest: id => { const c = Object.values(candidates).find(c => c.record.canonicalId === id); return c ? subjectDigest(c.currentSubject()) : undefined; } }, Object.values(candidates).map(c => c.record));
    function qualify(kind) {
      const c = candidates[kind]; return catalog.lookup(ids[kind]).available && admission(c.currentSubject(), c.evidenceReferences()).modelOnlyEligible;
    }
    for (const kind of ['model', 'checker']) if (!qualify(kind)) return unavailable('generated-host-' + kind + '-unqualified');
    const policies = {}, deploymentChannels = {};
    for (const mode of MODES) {
      const ref = options.policies?.[mode];
      const deployment = ref && typeof ref === 'object' && Object.keys(ref).length === 1 && typeof ref.deploymentChannelId === 'string' ? ref.deploymentChannelId : null;
      if (deployment && local) return unavailable('generated-host-local-policy-' + mode);
      const p = deployment ? readDeployedSelectionPolicy(db,deployment)?.policy : ref && (local ? readLocalSelectionPolicy : readSelectionPolicy)(db, ref.policyId, ref.revision);
      if (local) {
        if (!p || p.digest !== ref.digest || p.policy.mode !== mode || p.policy.producerCandidateId !== ids.model || p.policy.checkerCandidateId !== ids.checker
          || !bounded(p.policy.limitAttempts, 1000) || p.policy.limitAttempts < 2 || !bounded(p.policy.timeoutMs, 3600000)) return unavailable('generated-host-local-policy-' + mode);
        policies[mode] = p;
        for (const kind of ['model','checker']) {
          const c = clone(candidates[kind].observeCandidate());
          if (!selectLocalCandidate(p.policy, kind === 'model' ? 'model-producer' : 'verifier', c).selected) return unavailable('generated-host-' + kind + '-local-checks-unavailable');
        }
        continue;
      }
      if (!p || (!deployment && p.digest !== ref.digest) || p.policy.mode !== mode || p.policy.currency !== money.currency || p.policy.pinnedCandidateId !== null
        || ![ids.model, ids.checker].every(id => p.policy.allowedCandidateIds.includes(id))) return unavailable('generated-host-policy-' + mode);
      policies[mode] = p;
      if(deployment)deploymentChannels[mode]=deployment;
      for (const kind of ['model', 'checker']) {
        const c = clone(candidates[kind].observeCandidate());
        if (c.id !== ids[kind] || !c.estimate || c.estimate.conservativeMaxCost === null || c.estimate.currency !== money.currency
          || Math.ceil(c.estimate.conservativeMaxCost * money.unitsPerCost) > money.upperUnitsByKind[kind]
          || selectCandidate(p.policy, [c], now()).selectedId !== c.id) return unavailable('generated-host-' + kind + '-estimate-unavailable');
      }
    }
    const cleanupStore = createCleanupObservationStore(db), persistObservation = async value => cleanupStore.persist(value);
    const generatedOutputs = createGeneratedOutputStore(db, { now, authorizeObservation: () => false });
    function handoffSource(attemptId, kind) {
      if (kind === 'model') {
        const row = db.prepare("SELECT observation_id FROM generated_output_observation WHERE attempt_id=? AND target_id='formatted-json'").get(attemptId);
        return row ? { kind: 'generated-output', sourceRef: `generated-output:${row.observation_id}` } : null;
      }
      const attempt = db.prepare('SELECT run_id,task_id FROM orchestration_attempt WHERE attempt_id=?').get(attemptId);
      if (!attempt || attempt.task_id !== 'verify-json') return null;
      const row = db.prepare(`SELECT o.observation_id FROM generated_output_observation o
        JOIN orchestration_handoff h ON h.attempt_id=o.attempt_id
        JOIN orchestration_handoff_artifact x ON x.handoff_id=h.handoff_id AND x.attempt_id=o.attempt_id
          AND x.kind='generated-output' AND x.source_ref='generated-output:'||o.observation_id
          AND x.sha256=json_extract(o.payload,'$.sha256') AND x.byte_length=json_extract(o.payload,'$.byteLength')
        WHERE o.run_id=? AND o.target_id='formatted-json' AND x.byte_length=length(o.bytes)
        ORDER BY o.rowid DESC LIMIT 1`).get(attempt.run_id);
      return row ? { kind: 'verified-input', sourceRef: `verified-input:${row.observation_id}` } : null;
    }
    function resolveHandoffSource(sourceRef, attemptId) {
      return handoffAuthority.resolveHandoffArtifact(sourceRef,attemptId);
    }
    const handoffAuthority=createGeneratedJsonHandoffAuthority({db});
    const recoveryAuthority=createGeneratedJsonRecoveryAuthority({db,now});
    const modelFactory = options.executorFactories?.model ?? createIsolatedLocalModelExecutor;
    const checkerFactory = options.executorFactories?.checker ?? createIsolatedJsonCheckerExecutor;
    const producer = createGeneratedModelOutput({ db, now, producerControlBundle: modelPins,
      launch(context, approved) {
        const prompt = 'Format this JSON exactly as JSON.stringify(value, null, 2). Preserve every value. Return only the JSON, without Markdown or commentary.\n' + approved.inputText;
        return modelFactory({ db, taskRootBase: installation.taskRootBase, profileRootBase: installation.profileRootBase, nodeExecutable: installation.nodeExecutable, nodeSha256: installation.nodeSha256, controlBundle: approved.controlBundle,
          maxOutputTokens, resolveBinding: () => ({ owner: approved.stage.owner, envelope: approved.stage.envelope, prompt }) })(context);
      } });
    const native = createGeneratedAcceptanceHost({ db, now, controlBundle: checkerPins, producerPrincipalForAttempt: producer.principalForAttempt,
      launch(context, approved) {
        return checkerFactory({ db, taskRootBase: installation.taskRootBase, profileRootBase: installation.profileRootBase, nodeExecutable: installation.nodeExecutable, nodeSha256: installation.nodeSha256, controlBundle: approved.controlBundle,
          resolveBinding: () => ({ owner: approved.stage.owner, envelope: approved.stage.envelope, inputBytes: approved.inputBytes, outputBytes: approved.outputBytes }) })(context);
      } });
    const cleanup = Object.fromEntries([['model', producer.launch], ['checker', native.launchVerifier]].map(([kind, launch]) => [kind,
      createIsolatedModelCleanup({ db, launch, taskRootBase: installation.taskRootBase, profileRootBase: installation.profileRootBase, persistObservation })]));
    const prepared = new Map(), executions = new WeakMap(), results = new Map(), clean = new Map(), receipts = new Map();
    function kindForTask(taskId) { return taskId === 'produce-json' ? 'model' : taskId === 'verify-json' ? 'checker' : null; }
    function expected(context) { const entry = prepared.get(context.runId ?? context.request?.runId); return entry && entry.plan.digest === context.plan.digest ? entry : null; }
    const host = {
      parentTemplate: 'generated-json-v1', now, catalog, acceptance: native.acceptance, recovery: recoveryAuthority,
      prepare(run) {
        const runSnapshot=clone(run),prior=prepared.get(run.runId);
        if(prior){if(!same(prior.run,runSnapshot))throw Error('generated-host-run-changed');return prior.config;}
        const mode = run.selectionMode ?? 'efficiency', deployed=deploymentChannels[mode] ? readDeployedSelectionPolicy(db,deploymentChannels[mode]) : null;
        const policy = deploymentChannels[mode] ? readDeployedSelectionPolicyForRun(db,deploymentChannels[mode],run.runId) : policies[mode];
        if (!policy || envelopeHash(run.envelope) !== run.envelopeHash || run.envelope.egress.length !== 1 || run.envelope.egress[0] !== ISOLATED_LOCAL_ENDPOINT
          || run.envelope.allowed_actions.includes('file_change')) throw Error('generated-host-parent-template');
        if(deploymentChannels[mode]&&(!deployed||deployed.mode!==mode||policy.policy.currency!==money.currency||policy.policy.pinnedCandidateId!==null
          ||![ids.model,ids.checker].every(id=>policy.policy.allowedCandidateIds.includes(id))))throw Error('generated-host-policy-deployment');
        if(deploymentChannels[mode])for(const kind of ['model','checker']){const c=clone(candidates[kind].observeCandidate());if(c.id!==ids[kind]||!c.estimate||c.estimate.conservativeMaxCost===null||c.estimate.currency!==money.currency
          ||Math.ceil(c.estimate.conservativeMaxCost*money.unitsPerCost)>money.upperUnitsByKind[kind]||selectCandidate(policy.policy,[c],now()).selectedId!==c.id)throw Error('generated-host-policy-deployment');}
        const inputText = options.inputForRun(run);
        if (typeof inputText !== 'string' || Buffer.byteLength(inputText) > 1_048_576) throw Error('generated-host-input');
        const input = Buffer.from(inputText);
        // The fixed core bounds depth and expected formatting size before the
        // main-process formatter can allocate indentation or recurse deeply.
        if (checkJsonFormat(input, Buffer.alloc(0)).status === 'unknown') throw Error('generated-host-input-contract');
        const formatted = Buffer.from(JSON.stringify(JSON.parse(inputText), null, 2));
        if (checkJsonFormat(input, formatted).status !== 'pass') throw Error('generated-host-input-contract');
        if (formatted.length > maxBytes) throw Error('generated-host-output-budget');
        assertGeneratedJsonTemplateBounds(input.length, maxBytes);
        const checkerRevision = generatedJsonCheckerRevision(checkerPins), targetId = 'formatted-json', requirementId = 'json-format';
        const parametersDigest = generatedOutputParametersDigest({ version: 'cue-generated-output-v1', kind: 'generated-output', targetId, requirementId,
          producerTaskId: 'produce-json', checkerId: GENERATED_JSON_CHECKER_ID, checkerRevision, inputSha256: sha(input), maxBytes });
        const ref = `${policy.policyId}:${policy.revision}`;
        const scopes = [{ id: 'local-model-egress', worktreeRealpath: run.envelope.worktree_realpath, allowedActions: [], egress: [ISOLATED_LOCAL_ENDPOINT] }];
        const tasks = [{ id: 'produce-json', role: 'model-producer', ownerId: 'local-json-producer', requirementIds: [requirementId], dependencyIds: [], candidateIds: [ids.model], scopeIds: ['local-model-egress'] },
          { id: 'verify-json', role: 'verifier', ownerId: 'native-json-verifier', requirementIds: [requirementId], dependencyIds: ['produce-json'], candidateIds: [ids.checker], scopeIds: [] }];
        const proposedPlan = { revision: 'generated-json-v1', policyRevision: ref, policyDigest: policy.digest, tasks };
        const plan = validateTaskPlan({ policyRevision: ref, policyDigest: policy.digest, requirementIds: [requirementId], allowedCandidateIds: local ? [ids.model,ids.checker] : policy.policy.allowedCandidateIds, allowedScopeIds: ['local-model-egress'] }, proposedPlan);
        const config = { policy: { policyId: policy.policyId, revision: policy.revision, digest: policy.digest }, requirementIds: [requirementId], proposedPlan, scopes,
          requirements: [{ id: requirementId, text: 'Format the supplied JSON with two-space indentation and preserve its values exactly.', kind: 'document', required: true,
            checks: [{ checkerId: GENERATED_JSON_CHECKER_ID, revision: checkerRevision, parametersDigest, targetIds: [targetId] }] }],
          requirementCheckers: [native.requirementChecker({ requirementId, producerTaskId: 'produce-json', targetId, checkerId: GENERATED_JSON_CHECKER_ID,
            checkerRevision, parametersDigest, inputSha256: sha(input) })],
          generatedOutputs: [{ targetId, requirementId, producerTaskId: 'produce-json', checkerId: GENERATED_JSON_CHECKER_ID, checkerRevision, inputText, maxBytes }],
          budget: local ? { runId: run.runId, limit: policy.policy.limitAttempts, policyRevision: ref, source: money.source, observedAtMs: money.observedAtMs }
            : { runId: run.runId, currency: money.currency, unit: money.unit, limitUnits: money.limitUnits, policyRevision: ref, source: money.source, observedAtMs: money.observedAtMs },
          limits: { launchTimeoutMs: local ? Math.min(60000,policy.policy.timeoutMs) : 60000, taskTimeoutMs: local ? Math.min(60000,policy.policy.timeoutMs) : 60000, pollMs: 25 } };
        prepared.set(run.runId, { run: runSnapshot, plan, config }); return config;
      },
      verifyFinalBilling: () => false,
      authority: {
        authorizePlan(runId, hash, plan) { const e = prepared.get(runId); return Boolean(e && e.run.envelopeHash === hash && e.plan.digest === plan.digest); },
        authorizeClaim(context) { return Boolean(expected(context) && ids[kindForTask(context.task.id)] === context.candidateId); },
        authorizeStage(context) { const e = prepared.get(context.parent.run_id), kind = kindForTask(context.task.id); return Boolean(e && e.plan.digest === context.plan.digest
          && ids[kind] === context.candidateId && context.stage.allowed_actions.length === 0 && same(context.stage.egress, kind === 'model' ? [ISOLATED_LOCAL_ENDPOINT] : [])); },
        verifyReceipt(context, receipt) { const issued = receipts.get(context.attemptId), exact = Boolean(issued && same(issued, receipt));
          let source = exact ? handoffSource(context.attemptId, kindForTask(context.task.id)) : null;
          const failedResult=results.get(context.attemptId);
          if(!source&&exact&&kindForTask(context.task.id)==='model'&&issued.outcome==='failed'&&issued.cleanup==='clean'&&failedResult?.text==null) {
            const candidate={kind:'cleanup-evidence',sourceRef:issued.evidenceRef.replace(/^cue-cleanup:/,'cleanup-observation:')};
            if(handoffAuthority.authorizeHandoffArtifact(candidate.sourceRef,context.attemptId))source=candidate;
          }
          const identity = db.prepare('SELECT identity_id FROM orchestration_attempt_identity WHERE attempt_id=?').get(context.attemptId);
          return { outcomeVerified: exact, cleanupVerified: Boolean(exact && issued.cleanup === 'clean'),
            ...(source && identity ? { handoff: { handoffId: `handoff-${sha(context.attemptId + '\0' + receipt.receiptId).slice(0,48)}`, identityId: identity.identity_id, artifacts: [source] } } : {}) }; },
        authorizeHandoffArtifact(sourceRef, attemptId) { return handoffAuthority.authorizeHandoffArtifact(sourceRef,attemptId); },
        resolveHandoffArtifact(sourceRef, attemptId) { return resolveHandoffSource(sourceRef, attemptId); },
      },
      stage(context, run) { return { worktreeRealpath: run.envelope.worktree_realpath, allowedActions: [], egress: context.task.id === 'produce-json' ? [ISOLATED_LOCAL_ENDPOINT] : [], expiresAt: run.envelope.expires_at, autonomyLevel: run.envelope.autonomy_level }; },
      runtime: {
        evidence: options.evidence,
        authorizeRun(attemptId, candidateId, role, binding) { const kind = kindForTask(binding.taskId), e = prepared.get(binding.workflowRunId); return Boolean(e && role === 'model'
          && binding.attemptId === attemptId && ids[kind] === candidateId && binding.planDigest === e.plan.digest && qualify(kind)); },
        resolveCandidate(id, _attemptId, role, binding) {
          const kind = kindForTask(binding.taskId), candidate = candidates[kind]; if (!candidate || id !== ids[kind] || role !== 'model') return undefined;
          return { kind, supportedRoles: ['model'], cancellation: 'supported', usage: 'unsupported', availability: 'ready', typedActivitySource:'isolated-generated-v1',durableExecutionRef:'session-handle-v1',
            buildCurrentSubject: () => candidate.currentSubject(), evidenceReferences: () => candidate.evidenceReferences(),
            async launch(context) {
              const execution = await cleanup[kind].launch(context);
              const handle=execution?.session?.handle;
              if(typeof handle!=='string'||!handle||handle.length>120||!db.prepare('SELECT 1 FROM session_handle WHERE handle=? AND run_id=?').get(handle,context.runId))throw Error('generated-host-durable-identity');
              const exposed=Object.freeze({completion:execution.completion,cancel:execution.cancel.bind(execution),durableRef:`session:${handle}`});
              executions.set(exposed, { kind, context, execution });
              void execution.result.then(async result => {
                try {
                  const source = handoffSource(context.runId, kind);
                  if (typeof result.text === 'string') { const bytes=Buffer.from(result.text,'utf8'); await context.emitActivity?.('output',{contentRef:source?.sourceRef??'unknown',sha256:sha(bytes),byteLength:bytes.byteLength,truncated:false}); }
                  const usage = result.usage, known = usage?.totalTokens !== null && usage?.totalTokens !== undefined;
                  await context.emitActivity?.('usage',{unit:'token',quantity:known?usage.totalTokens:0,status:known?'observed':'unknown'});
                  await context.emitActivity?.('tool',{toolId:candidate.record.toolId,toolRevision:candidate.record.sourceVersion||'unknown',callRef:'unknown',status:'unsupported'});
                  if (source) { const bytes=resolveHandoffSource(source.sourceRef,context.runId); if(bytes) await context.emitActivity?.('artifact',{kind:source.kind,sourceRef:source.sourceRef,sha256:sha(bytes),byteLength:bytes.byteLength}); }
                  await context.emitActivity?.('terminal',{status:result.outcome,handoffRef:'unknown',
                    ...(result.outcome === 'failed' && typeof result.diagnosticCode === 'string' ? { diagnosticCode: result.diagnosticCode } : {})});
                } catch { /* Terminal/cancelled attempts quarantine late activity. */ }
                results.set(context.runId, result);
              }, () => {}); return exposed;
            } };
        },
        async verifyCleanup(context, execution) {
          const owned = executions.get(execution); if (!owned || owned.context !== context) throw Error('generated-host-execution-ownership');
          const until = performance.now() + 10000;
          let receipt = await cleanup[owned.kind].verifyCleanup(context, owned.execution);
          while (receipt.result === 'residual' && !context.signal.aborted && performance.now() < until) {
            await new Promise(resolve => {
              const finish = () => { clearTimeout(timer); context.signal.removeEventListener('abort', finish); resolve(); };
              const timer = setTimeout(finish, Math.min(50, Math.max(0, until - performance.now())));
              context.signal.addEventListener('abort', finish, { once: true });
              if (context.signal.aborted) finish();
            });
            if (context.signal.aborted || performance.now() >= until) break;
            receipt = await cleanup[owned.kind].verifyCleanup(context, owned.execution);
          }
          clean.set(context.runId, receipt); return receipt;
        },
      },
      engine: {
        observeCandidates(_request, task) { const kind = kindForTask(task.id), c = clone(candidates[kind].observeCandidate());
          if (c.id !== ids[kind]) throw Error('generated-host-candidate-drift'); c.checks.eligible = c.checks.eligible && qualify(kind); return [c]; },
        reservation(context) { const kind = kindForTask(context.task.id), c = candidates[kind].observeCandidate();
          if (!c.estimate || !Number.isFinite(c.estimate.conservativeMaxCost) || c.estimate.conservativeMaxCost < 0 || c.estimate.currency !== money.currency
            || Math.ceil(c.estimate.conservativeMaxCost * money.unitsPerCost) > money.upperUnitsByKind[kind]) throw Error('generated-host-cost-unknown');
          return { runId: context.request.runId, attemptId: context.request.attemptId, requestId: context.request.requestId, currency: money.currency, unit: money.unit,
            upperUnits: money.upperUnitsByKind[kind], source: money.source, observedAtMs: context.request.observedAtMs, scope: 'verified-completion-attempt-total' }; },
        verifyBudgetMapping(policy, budget) { return policy.policy.currency === money.currency && budget.currency === money.currency && budget.unit === money.unit
          && budget.limitUnits === money.limitUnits && (policy.policy.costLimit === null || Math.ceil(policy.policy.costLimit * money.unitsPerCost) >= money.limitUnits); },
        authorizeExecution(context) { return Boolean(expected(context) && ids[kindForTask(context.task.id)] === context.candidateId); },
        receipts(context) {
          const result = results.get(context.request.attemptId), cleanup = clean.get(context.request.attemptId);
          if (!result || !['succeeded', 'failed'].includes(result.outcome) || !cleanup || !cleanupStore.read(cleanup.evidenceRef)) return { execution: null, billing: null };
          const prior = receipts.get(context.request.attemptId); if (prior) return { execution: prior, billing: null };
          const receipt = Object.freeze({ runId: context.request.runId, taskId: context.task.id, attemptId: context.request.attemptId,
            receiptId: 'generated-receipt-' + sha(context.request.attemptId), revision: 1, outcome: result.outcome,
            cleanup: cleanup.result === 'verified-clean' ? 'clean' : 'unknown', evidenceRef: cleanup.evidenceRef, observedAtMs: now() });
          receipts.set(context.request.attemptId, receipt); return { execution: receipt, billing: null };
        },
      },
    };
    if (local) {
      host.accountingKind = 'local-invocation';
      delete host.verifyFinalBilling;
      const receiptsFor = host.engine.receipts, authorizeExecution = host.engine.authorizeExecution;
      host.engine = {
        maxRequestAgeMs: Math.min(60000, ...Object.values(policies).map(p => p.policy.timeoutMs)),
        observeCandidate(_request, task) {
          const kind = kindForTask(task.id);
          if (!kind) throw Error('generated-host-local-task');
          const c = clone(candidates[kind].observeCandidate());
          if (c.candidateId !== ids[kind]) throw Error('generated-host-candidate-drift');
          c.eligible = c.eligible === true && qualify(kind);
          return c;
        },
        authorizeExecution,
        receipts(context) { return { execution: receiptsFor(context).execution }; },
      };
    }
    return Object.freeze({ available: true, host: Object.freeze(host) });
  } catch (error) { return unavailable(error instanceof Error ? error.message : 'generated-host-invalid'); }
}
