import { createHash } from 'node:crypto';
import { types } from 'node:util';
import type { Ledger } from '../ledger.js';
import { validateTaskPlan } from '../orchestration/plan.js';
import { createStageEnvelopeBinder, type StageEnvelopeBinding } from '../orchestration/stage-envelope.js';
import { createRequirementContractStore } from './requirements.js';

export interface GeneratedOutputParameters {
  readonly version: 'cue-generated-output-v1'; readonly kind: 'generated-output';
  readonly targetId: string; readonly requirementId: string; readonly producerTaskId: string;
  readonly checkerId: string; readonly checkerRevision: string; readonly inputSha256: string; readonly maxBytes: number;
}
export interface GeneratedOutputTargetInput {
  runId: string; targetId: string; requirementId: string; producerTaskId: string;
  checkerId: string; checkerRevision: string; inputBytes: Uint8Array; maxBytes: number; boundAtMs: number;
}
export interface GeneratedOutputTarget extends GeneratedOutputParameters {
  readonly runId: string; readonly boundAtMs: number; readonly inputByteLength: number;
  readonly parametersDigest: string; readonly planDigest: string; readonly policyDigest: string;
  readonly requirementsDigest: string; readonly parentEnvelopeHash: string; readonly targetDigest: string;
}
export interface GeneratedOutputObservationInput {
  runId: string; targetId: string; attemptId: string; observationId: string; observedAtMs: number; bytes: Uint8Array;
}
export interface GeneratedOutputRecord {
  readonly version: 'cue-generated-output-v1'; readonly kind: 'generated-output';
  readonly runId: string; readonly targetId: string; readonly attemptId: string; readonly observationId: string; readonly observedAtMs: number;
  readonly requirementId: string; readonly producerTaskId: string; readonly candidateId: string;
  readonly targetDigest: string; readonly planDigest: string; readonly policyDigest: string; readonly requirementsDigest: string;
  readonly parentEnvelopeHash: string; readonly stageEnvelopeHash: string; readonly sha256: string; readonly byteLength: number; readonly digest: string;
}
export interface GeneratedOutputHost {
  now(): number;
  /** Host verifies the bytes came from this actual response/attempt. No model
   * success flag or content assertion is accepted. Must be synchronous. */
  authorizeObservation(context: Readonly<{ target: GeneratedOutputTarget; stage: StageEnvelopeBinding;
    record: GeneratedOutputRecord; bytes: Uint8Array }>): boolean;
}
const MAX_BYTES = 1_048_576, MAX_TARGETS = 128, MAX_INPUT_TOTAL = 8_388_608, MAX_OUTPUT_TOTAL = 16_777_216;
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const canonical = (value: object) => JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)));
function fail(reason: string): never { throw Error(`generated_output_${reason}`); }
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) fail('record');
  const d = Object.getOwnPropertyDescriptors(value); if (Reflect.ownKeys(d).length !== keys.length) fail('fields');
  const copy: Record<string, unknown> = {};
  for (const key of keys) { if (!d[key] || !Object.hasOwn(d[key], 'value') || !d[key].enumerable) fail('fields'); copy[key] = d[key].value; }
  return copy;
}
function id(value: unknown): string { if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/u.test(value)) fail('id'); return value; }
function targetId(value: unknown): string { const s = id(value); if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/u.test(s)) fail('target_id'); return s; }
function integer(value: unknown, max = Number.MAX_SAFE_INTEGER): number { if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > max) fail('number'); return value as number; }
function hash(value: unknown): string { if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) fail('hash'); return value; }
function bytes(value: unknown, limit = MAX_BYTES): Buffer {
  if (!value || types.isProxy(value) || !types.isUint8Array(value)) fail('bytes');
  // Intrinsics avoid caller-provided getters/iterators; shared mutable input is rejected.
  const proto = Object.getPrototypeOf(Uint8Array.prototype);
  const buffer = Object.getOwnPropertyDescriptor(proto, 'buffer')!.get!.call(value) as ArrayBuffer;
  const offset = Object.getOwnPropertyDescriptor(proto, 'byteOffset')!.get!.call(value) as number;
  const length = Object.getOwnPropertyDescriptor(proto, 'byteLength')!.get!.call(value) as number;
  if (types.isSharedArrayBuffer(buffer) || length < 1 || length > limit) fail('bytes_limit');
  return Buffer.from(new Uint8Array(buffer, offset, length));
}
function parameters(value: GeneratedOutputParameters): GeneratedOutputParameters {
  const p = record(value, ['version', 'kind', 'targetId', 'requirementId', 'producerTaskId', 'checkerId', 'checkerRevision', 'inputSha256', 'maxBytes']);
  if (p.version !== 'cue-generated-output-v1' || p.kind !== 'generated-output') fail('version');
  const maxBytes = integer(p.maxBytes, MAX_BYTES); if (!maxBytes) fail('bytes_limit');
  return Object.freeze({ version: 'cue-generated-output-v1', kind: 'generated-output', targetId: targetId(p.targetId), requirementId: id(p.requirementId),
    producerTaskId: id(p.producerTaskId), checkerId: id(p.checkerId), checkerRevision: id(p.checkerRevision), inputSha256: hash(p.inputSha256), maxBytes });
}
/** Compute before binding requirement criteria. Exact input/checker/target semantics
 * are approved by digest; a document kind alone never opts into generated output. */
export const generatedOutputParametersDigest = (value: GeneratedOutputParameters): string => sha(canonical(parameters(value)));

/** Stores observations, not acceptance or execution authority. Late actual responses
 * may be retained by host authorization, without making them current or successful. */
export function createGeneratedOutputStore(db: Ledger, host: GeneratedOutputHost) {
  const requirements = createRequirementContractStore(db, { now: () => 0, resolveChecker: () => undefined });
  const stages = createStageEnvelopeBinder(db, { now: () => 0, authorizeStage: () => false, resolveScope: () => { throw Error('historical-only'); } });
  function now() { return integer(host.now()); }
  function targetData(runId: string, p: GeneratedOutputParameters, inputByteLength: number, boundAtMs: number): Omit<GeneratedOutputTarget, 'targetDigest'> {
    const bound = requirements.read(runId); if (!bound) fail('criteria_missing');
    const requirement = bound.requirements.contracts.find(c => c.id === p.requirementId);
    const parametersDigest = generatedOutputParametersDigest(p);
    if (!requirement || requirement.kind !== 'document' || !requirement.checks.some(check => check.checkerId === p.checkerId && check.revision === p.checkerRevision
        && check.parametersDigest === parametersDigest && check.targetIds.length === 1 && check.targetIds[0] === p.targetId)) fail('approved_output_contract_missing');
    const row = db.prepare('SELECT payload,digest FROM orchestration_plan WHERE run_id=?').get(runId) as { payload: string; digest: string } | undefined;
    if (!row) fail('plan_missing'); const stored = JSON.parse(row.payload);
    const plan = validateTaskPlan(stored.approval, { revision: stored.revision, policyRevision: stored.approval.policyRevision, policyDigest: stored.approval.policyDigest, tasks: stored.tasks });
    const producer = plan.tasks.find(task => task.id === p.producerTaskId);
    if (row.digest !== bound.requirements.planDigest || plan.digest !== row.digest || !producer || producer.role !== 'model-producer' || !producer.requirementIds.includes(p.requirementId)) fail('producer_mismatch');
    return Object.freeze({ ...p, runId, inputByteLength, boundAtMs, parametersDigest, planDigest: plan.digest,
      policyDigest: bound.requirements.policyDigest, requirementsDigest: bound.requirements.digest, parentEnvelopeHash: bound.envelopeHash });
  }
  function readTarget(runId: string, key: string): GeneratedOutputTarget | null {
    id(runId); targetId(key);
    const row = db.prepare('SELECT payload,digest,input_bytes FROM generated_output_target WHERE run_id=? AND target_id=?').get(runId, key) as { payload: string; digest: string; input_bytes: Buffer } | undefined;
    if (!row) return null;
    if (Buffer.byteLength(row.payload) > 16384 || sha(row.payload) !== row.digest) fail('target_integrity');
    const raw = JSON.parse(row.payload), input = bytes(row.input_bytes);
    const p = parameters({ version: raw.version, kind: raw.kind, targetId: key, requirementId: raw.requirementId, producerTaskId: raw.producerTaskId,
      checkerId: raw.checkerId, checkerRevision: raw.checkerRevision, inputSha256: sha(input), maxBytes: raw.maxBytes });
    const data = targetData(runId, p, input.length, integer(raw.boundAtMs));
    if (canonical(data) !== row.payload) fail('target_integrity');
    return Object.freeze({ ...data, targetDigest: row.digest });
  }
  function provenance(target: GeneratedOutputTarget, attemptId: string) {
    id(attemptId); const stage = stages.read(attemptId);
    const attempt = db.prepare('SELECT run_id,task_id,candidate_id,claim_payload FROM orchestration_attempt WHERE attempt_id=?').get(attemptId) as
      { run_id: string; task_id: string; candidate_id: string; claim_payload: string } | undefined;
    if (!stage || !attempt || stage.workflowRunId !== target.runId || stage.taskId !== target.producerTaskId || attempt.run_id !== target.runId || attempt.task_id !== target.producerTaskId
        || stage.policyDigest !== target.policyDigest || stage.parentEnvelopeHash !== target.parentEnvelopeHash) fail('attempt_lineage');
    if (stage.planDigest !== target.planDigest) {
      const revision = db.prepare(`SELECT 1 FROM orchestration_attempt_revision a
        JOIN orchestration_plan_revision p ON p.run_id=a.run_id AND p.revision=a.revision
        JOIN orchestration_recovery_scope s ON s.run_id=a.run_id
        WHERE a.attempt_id=? AND a.run_id=? AND a.revision=? AND a.task_id=?
          AND p.plan_digest=? AND p.policy_digest=? AND p.requirements_digest=? AND p.envelope_hash=?
          AND s.original_plan_digest=?`).get(attemptId, target.runId, stage.revision, target.producerTaskId,
          stage.planDigest, target.policyDigest, target.requirementsDigest, target.parentEnvelopeHash, target.planDigest);
      if (!revision || stage.revision === 0) fail('attempt_lineage');
    }
    const claim = JSON.parse(attempt.claim_payload);
    if (claim.runId !== target.runId || claim.taskId !== target.producerTaskId || claim.attemptId !== attemptId || claim.candidateId !== attempt.candidate_id) fail('claim_lineage');
    return { stage, candidateId: id(attempt.candidate_id), claimedAtMs: integer(claim.observedAtMs) };
  }
  function metadata(target: GeneratedOutputTarget, input: Omit<GeneratedOutputObservationInput, 'bytes'>, observed: Buffer): GeneratedOutputRecord {
    const lineage = provenance(target, input.attemptId);
    if (input.observedAtMs < lineage.claimedAtMs) fail('observation_time');
    const data = { version: 'cue-generated-output-v1' as const, kind: 'generated-output' as const, ...input,
      requirementId: target.requirementId, producerTaskId: target.producerTaskId, candidateId: lineage.candidateId, targetDigest: target.targetDigest,
      planDigest: lineage.stage.planDigest, policyDigest: target.policyDigest, requirementsDigest: target.requirementsDigest,
      parentEnvelopeHash: target.parentEnvelopeHash, stageEnvelopeHash: lineage.stage.envelopeHash, sha256: sha(observed), byteLength: observed.length };
    return Object.freeze({ ...data, digest: sha(canonical(data)) });
  }
  function read(runId: string, key: string, attemptId: string) {
    id(runId); targetId(key); id(attemptId);
    const row = db.prepare('SELECT observation_id,payload,digest,bytes FROM generated_output_observation WHERE run_id=? AND target_id=? AND attempt_id=?').get(runId, key, attemptId) as
      { observation_id: string; payload: string; digest: string; bytes: Buffer } | undefined;
    if (!row) return null;
    const target = readTarget(runId, key); if (!target) fail('target_missing');
    if (Buffer.byteLength(row.payload) > 16384 || sha(row.payload) !== row.digest) fail('observation_integrity');
    const raw = JSON.parse(row.payload), observed = bytes(row.bytes, target.maxBytes);
    const data = metadata(target, { runId, targetId: key, attemptId, observationId: id(row.observation_id), observedAtMs: integer(raw.observedAtMs) }, observed);
    const { digest, ...plain } = data;
    if (canonical(plain) !== row.payload || digest !== row.digest) fail('observation_integrity');
    // Typed arrays cannot be frozen. This copy is caller-owned, never a DB alias.
    return Object.freeze({ record: data, bytes: observed });
  }
  return Object.freeze({
    bindTarget(input: GeneratedOutputTargetInput): GeneratedOutputTarget {
      const r = record(input, ['runId', 'targetId', 'requirementId', 'producerTaskId', 'checkerId', 'checkerRevision', 'inputBytes', 'maxBytes', 'boundAtMs']);
      const original = bytes(r.inputBytes), runId = id(r.runId), boundAtMs = integer(r.boundAtMs);
      const p = parameters({ version: 'cue-generated-output-v1', kind: 'generated-output', targetId: targetId(r.targetId), requirementId: id(r.requirementId),
        producerTaskId: id(r.producerTaskId), checkerId: id(r.checkerId), checkerRevision: id(r.checkerRevision), inputSha256: sha(original), maxBytes: integer(r.maxBytes) });
      return db.transaction(() => {
        const data = targetData(runId, p, original.length, boundAtMs), encoded = canonical(data), targetDigest = sha(encoded);
        const existing = readTarget(runId, p.targetId);
        if (existing) { if (existing.targetDigest !== targetDigest) fail('target_replay_mismatch'); return existing; }
        const state = db.prepare('SELECT t.state FROM run r JOIN task t ON t.id=r.task_id WHERE r.id=?').get(runId) as { state: string };
        if (state.state !== 'awaiting_approval' || boundAtMs > now()) fail('target_too_late');
        const rows = db.prepare('SELECT payload,length(input_bytes) inputSize FROM generated_output_target WHERE run_id=?').all(runId) as { payload: string; inputSize: number }[];
        if (rows.length >= MAX_TARGETS || rows.reduce((sum, row) => sum + row.inputSize, original.length) > MAX_INPUT_TOTAL
            || rows.reduce((sum, row) => sum + Number(JSON.parse(row.payload).maxBytes), p.maxBytes) > MAX_INPUT_TOTAL) fail('target_storage_limit');
        db.prepare('INSERT INTO generated_output_target VALUES(?,?,?,?,?)').run(runId, p.targetId, encoded, targetDigest, original);
        return Object.freeze({ ...data, targetDigest });
      }).immediate();
    },
    readTarget(runId: string, key: string) { return db.transaction(() => readTarget(runId, key))(); },
    readInput(runId: string, key: string) { return db.transaction(() => {
      const target = readTarget(runId, key); if (!target) return null;
      const row = db.prepare('SELECT input_bytes FROM generated_output_target WHERE run_id=? AND target_id=?').get(runId, key) as { input_bytes: Buffer };
      return Object.freeze({ target, bytes: bytes(row.input_bytes) });
    })(); },
    record(input: GeneratedOutputObservationInput): GeneratedOutputRecord {
      const r = record(input, ['runId', 'targetId', 'attemptId', 'observationId', 'observedAtMs', 'bytes']);
      const observed = bytes(r.bytes), request = { runId: id(r.runId), targetId: targetId(r.targetId), attemptId: id(r.attemptId),
        observationId: id(r.observationId), observedAtMs: integer(r.observedAtMs) };
      return db.transaction(() => {
        const target = readTarget(request.runId, request.targetId); if (!target) fail('target_missing');
        if (observed.length > target.maxBytes) fail('bytes_limit');
        const result = metadata(target, request, observed), { digest, ...plain } = result, encoded = canonical(plain);
        const old = db.prepare('SELECT run_id,target_id,attempt_id FROM generated_output_observation WHERE observation_id=?').get(request.observationId) as { run_id: string; target_id: string; attempt_id: string } | undefined;
        if (old && (old.run_id !== request.runId || old.target_id !== request.targetId || old.attempt_id !== request.attemptId)) fail('observation_replay_mismatch');
        const existing = read(request.runId, request.targetId, request.attemptId);
        if (existing) { if (existing.record.digest !== digest) fail('observation_replay_mismatch'); return existing.record; }
        if (request.observedAtMs > now()) fail('observation_time');
        const authorization: unknown = host.authorizeObservation(Object.freeze({ target, stage: provenance(target, request.attemptId).stage, record: result, bytes: Buffer.from(observed) }));
        if (authorization !== true) { if (authorization instanceof Promise) void authorization.catch(() => {}); fail('observation_not_authorized'); }
        const current = readTarget(request.runId, request.targetId);
        if (!current || current.targetDigest !== target.targetDigest || metadata(current, request, observed).digest !== digest) fail('observation_lineage_changed');
        const size = db.prepare('SELECT COALESCE(SUM(length(bytes)),0) n FROM generated_output_observation WHERE run_id=?').get(request.runId) as { n: number };
        if (!Number.isSafeInteger(size.n) || size.n + observed.length > MAX_OUTPUT_TOTAL) fail('observation_storage_limit');
        db.prepare('INSERT INTO generated_output_observation VALUES(?,?,?,?,?,?,?)').run(request.observationId, request.runId, request.targetId, request.attemptId, encoded, digest, observed);
        return result;
      }).immediate();
    },
    read(runId: string, key: string, attemptId: string) { return db.transaction(() => read(runId, key, attemptId))(); },
  });
}
