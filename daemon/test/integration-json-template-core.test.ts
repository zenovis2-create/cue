import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { basename, dirname, join, resolve, win32 } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { AppDaemon, createCueCore, initializeConfig } from '../../app/core.mjs';
import { createGeneratedJsonHost, type LocalGeneratedJsonHostOptions } from '../../app/generated-json-host.mjs';
import type { OrchestrationRun } from '../../app/orchestration-driver.mjs';
import { saveLocalSelectionPolicy } from '../src/selection/local-policy-store.js';
import { SUBJECT_FIELDS, subjectDigest, type MeasurementSubject } from '../src/measurement-subject.js';
import { MODEL_PROBES } from '../src/capability-admission.js';
import { createGeneratedOutputStore } from '../src/verification/generated-output.js';
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
function fixture(explicit = true) {
  const root = mkdtempSync(join(tmpdir(), 'cue-json-template-')), workspace = join(root, 'workspace'); mkdirSync(workspace);
  const config = initializeConfig(join(root, 'data'), { worktreeRoot: workspace }), daemon = new AppDaemon(config), db = daemon.db, now = Date.now();
  const subject = Object.fromEntries(SUBJECT_FIELDS.map(key => [key, key.endsWith('Sha256') ? 'a'.repeat(64) : key])) as MeasurementSubject;
  // Synthetic qualified host composition only; no probe, native or model call.
  const refs: any = {}, evidence = new Map<string, Buffer>();
  for (const probe of MODEL_PROBES) {
    const bytes = Buffer.from(JSON.stringify({ probe, subjectDigest: subjectDigest(subject), measuredAt: new Date(now - 1).toISOString(), kind: 'live', status: 'pass' }));
    refs[probe] = { id: probe, sha256: hash(bytes) }; evidence.set(probe, bytes);
  }
  const policies: any = {};
  for (const mode of ['efficiency', 'performance', 'value', 'speed'] as const) {
    const saved = saveLocalSelectionPolicy(db, { policyId: mode, expectedRevision: null, createdAt: new Date(now).toISOString(), sourceVersion: 'fixture', policy: {
      version: 'cue-local-selection-v1', mode, producerCandidateId: 'model', checkerCandidateId: 'checker', limitAttempts: 2, timeoutMs: 30000 } });
    policies[mode] = { policyId: saved.policyId, revision: saved.revision, digest: saved.digest };
  }
  const bundle = (clientKind: 'model' | 'json-checker') => {
    const p = { version: 'cue-model-control-v1' as const, clientKind, nodeSha256: '1'.repeat(64), launcherSha256: '2'.repeat(64), guardianSha256: '3'.repeat(64),
      clientSha256: '4'.repeat(64), checkerCoreSha256: clientKind === 'model' ? null : '5'.repeat(64) };
    return { ...p, sha256: hash(JSON.stringify(Object.values(p))) };
  };
  const controls = { mismatch: false, launches: 0, legacy: 0, prepared: [] as OrchestrationRun[], pinsSeen: [] as number[] };
  const candidates: any = Object.fromEntries(['model', 'checker'].map(kind => [kind, {
    record: { canonicalId: kind, toolId: kind, kind, aliases: [], installation: 'installed', protocol: 'verified', authReference: null, authAvailable: true, sourceVersion: 'fixture',
      observedAt: new Date(now).toISOString(), subjectDigest: subjectDigest(subject), binding: kind === 'model' ? { endpointId: 'fixed-localhost', modelId: 'qwen38-27b-unc' } : null },
    currentSubject: () => subject, evidenceReferences: () => refs,
    observeCandidate: () => ({ candidateId: kind, eligible: true, authenticated: true, compatible: true, dataAllowed: true, resourceAvailable: true, quotaAvailable: true }),
  }]));
  const options: LocalGeneratedJsonHostOptions = { db, now: () => Date.now(), inputForRun: run => controls.mismatch ? '{"other":true}' : run.template?.inputText ?? run.goal,
    installation: { nodeExecutable: process.execPath, nodeSha256: '1'.repeat(64), modelControlBundle: bundle('model'), checkerControlBundle: bundle('json-checker'),
      taskRootBase: win32.join(root, 'tasks'), profileRootBase: win32.join(root, 'profiles') }, candidates, policies,
    evidence: { now: () => Date.now(), maxAgeMs: 60000, resolveEvidence: ref => evidence.get(ref.id) }, accounting: { kind: 'local-invocation', source: 'fixture-count', observedAtMs: now },
    executorFactories: { model: (() => async () => { controls.launches++; throw Error('unexpected fixture launch'); }) as any,
      checker: (() => async () => { controls.launches++; throw Error('unexpected fixture launch'); }) as any } };
  const assembled = createGeneratedJsonHost(options); if (!assembled.available) throw Error(assembled.reasons.join(','));
  const host = { ...assembled.host, ...(explicit ? { requiresExplicitTemplate: true as const } : {}), prepare(run: OrchestrationRun) {
    controls.prepared.push(run); controls.pinsSeen.push((db.prepare('SELECT count(*) n FROM resource_run_pin WHERE run_id=?').get(run.runId) as { n: number }).n);
    return assembled.host.prepare(run);
  } };
  const core = createCueCore(config, daemon, { orchestration: host, launchHost: () => { controls.legacy++; throw Error('unexpected legacy launch'); } });
  cleanups.push(async () => { await core.close(); const absolute = resolve(root); expect(dirname(absolute)).toBe(resolve(tmpdir())); expect(basename(absolute).startsWith('cue-json-template-')).toBe(true); rmSync(absolute, { recursive: true, force: true }); });
  const output = createGeneratedOutputStore(db, { now: () => Date.now(), authorizeObservation: () => false });
  const counts = () => Object.fromEntries(['task', 'run', 'envelope', 'artifact', 'resource_run_pin', 'orchestration_plan', 'orchestration_step', 'requirement_contract_binding', 'generated_output_target',
    'local_selection_run_policy', 'local_invocation_budget'].map(table => [table, (db.prepare(`SELECT count(*) n FROM ${table}`).get() as { n: number }).n]));
  return { core, db, controls, output, counts };
}
const input = (inputText = '{"privateMarker":"한글-value"}') => ({ templateId: 'generated-json-v1' as const, inputText, autonomy: 3 as const, selectionMode: 'efficiency' as const });
describe('explicit JSON preparation through actual core, driver and generated target ledger', () => {
  it('captures exact UTF8 input with frozen run.template and metadata-only public approval', () => {
    const f = fixture(), dto = input(), prepared = f.core.prepareJsonTemplate(dto);
    const run = f.controls.prepared[0]!;
    expect(Object.isFrozen(run)).toBe(true); expect(Object.isFrozen(run.template)).toBe(true);
    expect(run.template).toEqual({ id: 'generated-json-v1', inputText: dto.inputText });
    const stored = f.output.readInput(prepared.runId, 'formatted-json')!;
    expect(stored.bytes.toString()).toBe(dto.inputText);
    expect(stored.target).toMatchObject({ inputSha256: hash(dto.inputText), inputByteLength: Buffer.byteLength(dto.inputText), producerTaskId: 'produce-json', requirementId: 'json-format' });
    expect(prepared.orchestration?.generatedOutputs?.[0]).toMatchObject({ inputSha256: hash(dto.inputText), inputByteLength: Buffer.byteLength(dto.inputText) });
    expect(prepared).not.toHaveProperty('template'); expect(prepared).not.toHaveProperty('inputText');
    expect(JSON.stringify(prepared)).not.toContain('privateMarker'); expect(JSON.stringify(prepared)).not.toContain('한글-value');
    expect(f.controls.pinsSeen).toEqual([1]); expect(f.controls.launches).toBe(0); expect(f.controls.legacy).toBe(0);
  });
  it('keeps two different preparations and their policies stable after DTO mutation', () => {
    const f = fixture(), firstDto = input('{"first":1}'), first = f.core.prepareJsonTemplate(firstDto);
    firstDto.inputText = '{"mutated":true}';
    const second = f.core.prepareJsonTemplate({ ...input('{"second":2}'), selectionMode: 'value', autonomy: 1 });
    expect(second.runId).not.toBe(first.runId);
    expect(f.output.readInput(first.runId, 'formatted-json')?.bytes.toString()).toBe('{"first":1}');
    expect(f.output.readInput(second.runId, 'formatted-json')?.bytes.toString()).toBe('{"second":2}');
    expect(first.selectionMode).toBe('efficiency'); expect(second.selectionMode).toBe('value'); expect(second.autonomy).toBe(1);
    expect(() => { (f.controls.prepared[0]!.template as any).inputText = 'changed'; }).toThrow();
    expect(f.output.readInput(first.runId, 'formatted-json')?.bytes.toString()).toBe('{"first":1}');
  });
  it('rejects malformed exact DTO, UTF8, byte limits and invalid JSON before any writes', () => {
    const f = fixture(), before = f.counts(), total = f.db.prepare('SELECT total_changes() n').get(); let invoked = 0;
    const getter = Object.defineProperty(input(), 'inputText', { enumerable: true, get() { invoked++; return '{}'; } });
    const proxy = new Proxy(input(), { getOwnPropertyDescriptor() { invoked++; throw Error('proxy'); } });
    const malformed: unknown[] = [null, [], 'text', { ...input(), extra: true }, { ...input(), templateId: 'other' }, { ...input(), inputText: 1 },
      { ...input(), inputText: '' }, { ...input(), inputText: '{bad}' }, { ...input(), inputText: '\ud800' }, { ...input(), inputText: JSON.stringify('가'.repeat(350000)) },
      { ...input(), autonomy: 0 }, { ...input(), autonomy: '3' }, { ...input(), selectionMode: 'automatic' }, Object.assign(Object.create({ inherited: true }), input()), getter, proxy];
    for (const dto of malformed) expect(() => f.core.prepareJsonTemplate(dto as any)).toThrow();
    expect(invoked).toBe(0); expect(f.counts()).toEqual(before); expect(f.db.prepare('SELECT total_changes() n').get()).toEqual(total);
    expect(f.controls.prepared).toEqual([]); expect(f.controls.launches).toBe(0);
  });
  it('rolls back task, run, resource pin, plan, requirements and generated target when the host captures different input', () => {
    const f = fixture(), before = f.counts(); f.controls.mismatch = true;
    expect(() => f.core.prepareJsonTemplate(input())).toThrow('json_template_capture_mismatch');
    expect(f.controls.prepared).toHaveLength(1); expect(f.controls.pinsSeen).toEqual([1]);
    expect(f.counts()).toEqual(before);
    expect(f.output.readInput(f.controls.prepared[0]!.runId, 'formatted-json')).toBeNull();
    expect(() => f.core.approve(f.controls.prepared[0]!.runId)).toThrow('unknown run');
    f.controls.mismatch = false; const valid = f.core.prepareJsonTemplate(input());
    expect(f.output.readInput(valid.runId, 'formatted-json')?.bytes.toString()).toBe(input().inputText);
    expect(f.controls.launches).toBe(0); expect(f.controls.legacy).toBe(0);
  });
  it('requires explicit template on flagged hosts while an explicitly constructed legacy host retains freeform preparation', () => {
    const strict = fixture(); const before = strict.counts(); expect(() => strict.core.prepareGoal('{}')).toThrow('json_template_required'); expect(strict.counts()).toEqual(before);
    const legacy = fixture(false); const prepared = legacy.core.prepareGoal('{"legacy":true}', 3, 'efficiency');
    expect(legacy.controls.prepared[0]!).not.toHaveProperty('template');
    expect(legacy.output.readInput(prepared.runId, 'formatted-json')?.bytes.toString()).toBe('{"legacy":true}');
    expect(legacy.controls.launches).toBe(0);
  });
});
