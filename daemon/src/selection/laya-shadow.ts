import { createHash } from 'node:crypto';
import { types } from 'node:util';
import type { Ledger } from '../ledger.js';
import { createAttemptDecisionStore } from './attempt-decision-store.js';
import type { SelectionDecision } from './policy.js';

// An explicit, post-attempt observation seam. Never called by admission, routing or dispatch.
// The caller supplies only text it has separately cleared for local inference; this module
// performs no I/O except reading the immutable attempt selection history.
export interface LayaShadowInput {
  attemptId: string;
  taskSummary: string;
  options: readonly { id: string; description: string }[];
}
export type LayaShadowPreparation = Readonly<{
  version: 'cue-laya-shadow-v1'; authority: 'none'; promotionEligible: false;
  attemptId: string; selectionDigest: string | null; baselineId: string | null;
  status: 'ready' | 'unavailable'; reason: 'ready' | 'legacy-not-recorded' | 'fixed-pair-or-pinned' | 'insufficient-options' | 'too-many-options';
  request: Readonly<{ state: { task: string; mode: string }; questions: { candidate: { type: 'choice'; instructions: string; criteria: Record<string, string> } } }> | null;
  requestDigest: string | null;
}>;
export type LayaShadowComparison = Readonly<{
  version: 'cue-laya-shadow-comparison-v1'; authority: 'none'; promotionEligible: false;
  attemptId: string; selectionDigest: string | null; requestDigest: string | null;
  baselineId: string | null; proposedId: string | null;
  disposition: 'agree' | 'disagree' | 'invalid-response' | 'unavailable';
  // Not a calibrated quality claim. A response and its provenance are not authenticated here.
  evidence: 'unverified-response';
}>;

function fail(): never { throw new TypeError('laya_shadow_input'); }
function fields(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) fail();
  const d = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(d).length !== keys.length || keys.some(k => !d[k]?.enumerable || !Object.hasOwn(d[k], 'value'))) fail();
  return Object.fromEntries(keys.map(k => [k, d[k]!.value]));
}
function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/u.test(value)) fail();
  return value;
}
function digest(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function input(value: unknown): LayaShadowInput {
  const v = fields(value, ['attemptId', 'taskSummary', 'options']);
  const attemptId = text(v.attemptId, 256), taskSummary = text(v.taskSummary, 1024);
  if (!Array.isArray(v.options) || types.isProxy(v.options) || v.options.length > 1000
    || Reflect.ownKeys(v.options).length !== v.options.length + 1) fail();
  const options: { id: string; description: string }[] = [];
  for (let i = 0; i < v.options.length; i++) {
    const d = Object.getOwnPropertyDescriptor(v.options, String(i));
    if (!d || !Object.hasOwn(d, 'value')) fail();
    const option = fields(d.value, ['id', 'description']);
    options.push({ id: text(option.id, 256), description: text(option.description, 256) });
  }
  if (new Set(options.map(o => o.id)).size !== options.length) fail();
  return { attemptId, taskSummary, options };
}
export function snapshotLayaShadowInput(value: unknown): LayaShadowInput { return input(value); }

function validResponse(value: unknown, eligible: readonly string[]): string | null {
  try {
    const root = fields(value, ['model', 'answers', 'usage']);
    if (root.model !== 'laya-rl-agent') return null;
    const answers = fields(root.answers, ['candidate']);
    const choice = fields(answers.candidate, ['type', 'choice', 'probabilities', 'confidence', 'action']);
    if (choice.type !== 'choice' || typeof choice.choice !== 'string' || !eligible.includes(choice.choice)) return null;
    const probabilities = fields(choice.probabilities, eligible);
    let total = 0;
    for (const id of eligible) {
      const p = probabilities[id];
      if (typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 1) return null;
      total += p;
    }
    if (Math.abs(total - 1) > 0.002 || eligible.some(id => (probabilities[id] as number) > (probabilities[choice.choice as string] as number))) return null;
    if (typeof choice.confidence !== 'number' || !Number.isFinite(choice.confidence) || choice.confidence < 0 || choice.confidence > 1) return null;
    const action = fields(choice.action, ['act_probability']);
    if (typeof action.act_probability !== 'number' || !Number.isFinite(action.act_probability) || action.act_probability < 0 || action.act_probability > 1) return null;
    const usage = fields(root.usage, ['input_tokens', 'output_tokens']);
    if (!Number.isSafeInteger(usage.input_tokens) || (usage.input_tokens as number) < 0 || (usage.input_tokens as number) > 1_000_000 || usage.output_tokens !== 0) return null;
    return choice.choice;
  } catch { return null; }
}

export function createLayaShadowAdapter(db: Ledger) {
  function prepare(raw: LayaShadowInput): LayaShadowPreparation {
    const { attemptId, taskSummary, options } = input(raw);
    const stored = createAttemptDecisionStore(db).read(attemptId);
    const snapshot = stored.snapshot;
    const selection = snapshot?.policy.kind === 'monetary' ? snapshot.decision as SelectionDecision : null;
    const baselineId = snapshot?.candidateId ?? null;
    const eligible = selection?.assessments.filter(a => a.score !== null).map(a => a.id) ?? [];
    const reason = !snapshot ? 'legacy-not-recorded'
      : !selection || selection.reason !== 'ranked' ? 'fixed-pair-or-pinned'
      : eligible.length < 2 ? 'insufficient-options'
      : eligible.length > 8 ? 'too-many-options' : 'ready';
    if (reason === 'ready') {
      // Descriptions cannot add, omit or reorder host-qualified historical options.
      if (options.length !== eligible.length || options.some((o, i) => o.id !== eligible[i])) fail();
    } else if (options.length !== 0) fail();
    const request = reason === 'ready' ? Object.freeze({
      state: Object.freeze({ task: taskSummary, mode: selection!.mode }),
      questions: Object.freeze({ candidate: Object.freeze({ type: 'choice' as const,
        instructions: 'Which of these already eligible candidates best fits the task? Choose one option; this is a non-executing shadow comparison.',
        criteria: Object.freeze(Object.fromEntries(options.map(o => [o.id, o.description]))) }) }),
    }) : null;
    return Object.freeze({ version: 'cue-laya-shadow-v1', authority: 'none', promotionEligible: false, attemptId,
      selectionDigest: snapshot?.digest ?? null, baselineId, status: reason === 'ready' ? 'ready' : 'unavailable', reason,
      request, requestDigest: request ? digest(request) : null });
  }
  return Object.freeze({
    prepare,
    compare(raw: LayaShadowInput, response: unknown): LayaShadowComparison {
      // Re-read the immutable lineage; a caller-provided preparation is never trusted.
      const prepared = prepare(raw);
      const ids = prepared.request ? Object.keys(prepared.request.questions.candidate.criteria) : [];
      const proposedId = prepared.status === 'ready' ? validResponse(response, ids) : null;
      return Object.freeze({ version: 'cue-laya-shadow-comparison-v1', authority: 'none', promotionEligible: false,
        attemptId: prepared.attemptId, selectionDigest: prepared.selectionDigest, requestDigest: prepared.requestDigest,
        baselineId: prepared.baselineId, proposedId,
        disposition: prepared.status !== 'ready' ? 'unavailable' : proposedId === null ? 'invalid-response'
          : proposedId === prepared.baselineId ? 'agree' : 'disagree', evidence: 'unverified-response' });
    },
  });
}
