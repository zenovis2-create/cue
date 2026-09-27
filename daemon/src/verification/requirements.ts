import { createHash } from 'node:crypto';
import { types } from 'node:util';
import type { Ledger } from '../ledger.js';
import { validateTaskPlan, type ValidatedPlan } from '../orchestration/plan.js';
import { readRunPolicyIdentity } from '../selection/run-policy-identity.js';
import { validateEvidencePolicy, type EvidencePolicyDescriptor } from './evidence-policy.js';

export type RequirementKind = 'code' | 'research' | 'document' | 'external';
export interface RequirementCheck { readonly checkerId: string; readonly revision: string; readonly parametersDigest: string; readonly targetIds: readonly string[] }
export interface RequirementContract { readonly id: string; readonly text: string; readonly kind: RequirementKind; readonly required: boolean; readonly checks: readonly RequirementCheck[] }
export interface RegisteredRequirementChecker { readonly id: string; readonly revision: string; readonly kinds: readonly RequirementKind[]; readonly evidencePolicies?: readonly EvidencePolicyDescriptor[] }
export type RequirementCheckerResolver = (checkerId: string, revision: string) => RegisteredRequirementChecker | undefined;
export interface ValidatedRequirements {
  readonly schemaVersion: 'cue-requirements-v1'; readonly planDigest: string; readonly policyDigest: string;
  readonly contracts: readonly RequirementContract[]; readonly checkers: readonly RegisteredRequirementChecker[]; readonly evidencePolicies: readonly EvidencePolicyDescriptor[]; readonly digest: string;
}
export interface RequirementBinding {
  readonly runId: string; readonly envelopeHash: string; readonly requirements: ValidatedRequirements; readonly boundAt: string;
}
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const kinds: readonly RequirementKind[] = ['code', 'research', 'document', 'external'];
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
function fail(reason: string): never { throw Error(`invalid_requirements:${reason}`); }
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) fail('record');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length !== keys.length) fail('fields');
  const result: Record<string, unknown> = {};
  for (const key of keys) { const d = descriptors[key]; if (!d || !Object.hasOwn(d, 'value') || !d.enumerable) fail('accessor-or-fields'); result[key] = d.value; }
  return result;
}
function array(value: unknown, max = 256): unknown[] {
  if (!Array.isArray(value) || types.isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype || !value.length || value.length > max || Reflect.ownKeys(value).length !== value.length + 1) fail('array');
  const copy: unknown[] = [];
  for (let i = 0; i < value.length; i++) { const d = Object.getOwnPropertyDescriptor(value, String(i)); if (!d || !Object.hasOwn(d, 'value')) fail('array-accessor'); copy.push(d.value); }
  return copy;
}
function identifier(value: unknown): string { if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/u.test(value)) fail('id'); return value; }
function digest(value: unknown): string { if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) fail('digest'); return value; }
function checkerSnapshot(value: unknown): RegisteredRequirementChecker {
  const d = record(value, ['id', 'revision', 'kinds', 'evidencePolicies']);
  const supported = array(d.kinds, 4);
  if (supported.some(kind => !kinds.includes(kind as RequirementKind)) || new Set(supported).size !== supported.length) fail('checker-kinds');
  const policies = array(d.evidencePolicies, 2048).map(policy => validateEvidencePolicy(policy as EvidencePolicyDescriptor)).sort((a,b)=>compare(JSON.stringify(a),JSON.stringify(b)));
  if(new Set(policies.map(policy=>`${policy.requirementId}\0${policy.kind}\0${policy.checkerId}\0${policy.checkerRevision}\0${policy.parametersDigest}`)).size!==policies.length)fail('duplicate-evidence-policy');
  return Object.freeze({ id: identifier(d.id), revision: identifier(d.revision), kinds: Object.freeze((supported as RequirementKind[]).sort(compare)), evidencePolicies:Object.freeze(policies) });
}
function historicalResolver(value: unknown): RequirementCheckerResolver {
  const descriptors = array(value, 2048).map(checkerSnapshot);
  const map = new Map(descriptors.map(d => [`${d.id}\0${d.revision}`, d]));
  if (map.size !== descriptors.length) fail('duplicate-checker');
  return (id, revision) => map.get(`${id}\0${revision}`);
}
function planSnapshot(plan: ValidatedPlan): ValidatedPlan {
  const p = record(plan, ['revision', 'approval', 'tasks', 'topologicalOrder', 'digest']);
  const a = record(p.approval, ['policyRevision', 'policyDigest', 'requirementIds', 'allowedCandidateIds', 'allowedScopeIds']);
  const validated = validateTaskPlan(p.approval as ValidatedPlan['approval'], { revision: p.revision as string, policyRevision: a.policyRevision as string, policyDigest: a.policyDigest as string, tasks: p.tasks as ValidatedPlan['tasks'] });
  if (validated.digest !== digest(p.digest) || JSON.stringify(validated.topologicalOrder) !== JSON.stringify(array(p.topologicalOrder))) fail('plan-digest');
  return validated;
}

/** Only declarative approved references. A checker being registered is not a pass,
 * and target IDs / parameter hashes never become executable code in this module. */
export function validateRequirementContracts(plan: ValidatedPlan, input: readonly RequirementContract[], resolveChecker: RequirementCheckerResolver): ValidatedRequirements {
  const boundPlan = planSnapshot(plan);
  let checkCount = 0;
  const registry = new Map<string, RegisteredRequirementChecker>();
  const evidencePolicies: EvidencePolicyDescriptor[]=[];
  const contracts: RequirementContract[] = array(input).map(value => {
    const c = record(value, ['id', 'text', 'kind', 'required', 'checks']);
    const id = identifier(c.id);
    if (typeof c.text !== 'string' || !c.text.trim() || Buffer.byteLength(c.text) > 16384 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(c.text)) fail('text');
    if (!kinds.includes(c.kind as RequirementKind) || typeof c.required !== 'boolean') fail('kind-or-required');
    const kind = c.kind as RequirementKind;
    const checks = array(c.checks, 32).map(check => {
      if (++checkCount > 2048) fail('check-limit');
      const item = record(check, ['checkerId', 'revision', 'parametersDigest', 'targetIds']);
      const checkerId = identifier(item.checkerId), revision = identifier(item.revision), parametersDigest = digest(item.parametersDigest);
      const targetIds = array(item.targetIds, 128).map(identifier).sort(compare);
      if (new Set(targetIds).size !== targetIds.length) fail('duplicate-target');
      const registered = resolveChecker(checkerId, revision);
      if (!registered) fail('unsupported-checker');
      const descriptor = checkerSnapshot(registered);
      if (descriptor.id !== checkerId || descriptor.revision !== revision || !descriptor.kinds.includes(kind)) fail('checker-incompatible');
      const evidencePolicy=descriptor.evidencePolicies?.find(policy=>policy.requirementId===id&&policy.kind===kind&&policy.checkerId===checkerId&&policy.checkerRevision===revision&&policy.parametersDigest===parametersDigest&&JSON.stringify(policy.targetIds)===JSON.stringify(targetIds));
      if(!evidencePolicy)fail('evidence-policy-missing');
      evidencePolicies.push(evidencePolicy);
      const key = `${checkerId}\0${revision}`, previous = registry.get(key);
      if (previous && JSON.stringify(previous) !== JSON.stringify(descriptor)) fail('checker-registry-changed');
      registry.set(key, descriptor);
      return Object.freeze({ checkerId, revision, parametersDigest, targetIds: Object.freeze(targetIds) });
    }).sort((a, b) => compare(JSON.stringify(a), JSON.stringify(b)));
    if (new Set(checks.map(check => JSON.stringify(check))).size !== checks.length) fail('duplicate-check');
    return Object.freeze({ id, text: c.text, kind, required: c.required, checks: Object.freeze(checks) });
  }).sort((a, b) => compare(a.id, b.id));
  const ids = contracts.map(c => c.id);
  if (new Set(ids).size !== ids.length || JSON.stringify(ids) !== JSON.stringify([...boundPlan.approval.requirementIds].sort(compare))) fail('requirement-coverage');
  if (!contracts.some(c => c.required)) fail('required-empty');
  const canonical = { schemaVersion: 'cue-requirements-v1' as const, planDigest: boundPlan.digest, policyDigest: boundPlan.approval.policyDigest, contracts: Object.freeze(contracts),
    checkers: Object.freeze([...registry.values()].sort((a, b) => compare(a.id, b.id) || compare(a.revision, b.revision))), evidencePolicies:Object.freeze(evidencePolicies.sort((a,b)=>compare(JSON.stringify(a),JSON.stringify(b)))) };
  const serialized = JSON.stringify(canonical);
  if (Buffer.byteLength(serialized) > 1_048_576) fail('contract-size');
  return Object.freeze({ ...canonical, digest: hash(serialized) });
}

type Row = { run_id: string; envelope_hash: string; plan_digest: string; policy_digest: string; requirements_digest: string; payload: string; bound_at: string };
export function createRequirementContractStore(db: Ledger, host: { now(): number; resolveChecker: RequirementCheckerResolver }) {
  function binding(runId: string) {
    identifier(runId);
    const row = db.prepare('SELECT r.envelope_hash,p.digest,p.payload FROM run r JOIN envelope e ON e.envelope_hash=r.envelope_hash JOIN orchestration_plan p ON p.run_id=r.id AND p.envelope_hash=r.envelope_hash WHERE r.id=?').get(runId) as { envelope_hash: string; digest: string; payload: string } | undefined;
    if (!row) fail('run-plan-missing');
    const plan = planSnapshot(JSON.parse(row.payload) as ValidatedPlan);
    const policy = readRunPolicyIdentity(db, runId);
    if (!policy || row.digest !== plan.digest || plan.approval.policyDigest !== policy.digest || plan.approval.policyRevision !== `${policy.policyId}:${policy.revision}`) fail('policy-plan-mismatch');
    return { plan, envelopeHash: row.envelope_hash };
  }
  function decode(row: Row): RequirementBinding {
    const current = binding(row.run_id);
    const raw = record(JSON.parse(row.payload), ['schemaVersion', 'planDigest', 'policyDigest', 'contracts', 'checkers', 'evidencePolicies', 'digest']);
    const requirements = validateRequirementContracts(current.plan, raw.contracts as RequirementContract[], historicalResolver(raw.checkers));
    if (JSON.stringify(requirements) !== row.payload || raw.schemaVersion !== 'cue-requirements-v1' || row.envelope_hash !== current.envelopeHash
        || row.plan_digest !== requirements.planDigest || row.policy_digest !== requirements.policyDigest || row.requirements_digest !== requirements.digest) fail('binding-integrity');
    if (typeof row.bound_at !== 'string' || !Number.isFinite(Date.parse(row.bound_at)) || new Date(row.bound_at).toISOString() !== row.bound_at) fail('binding-time');
    return Object.freeze({ runId: row.run_id, envelopeHash: row.envelope_hash, requirements, boundAt: row.bound_at });
  }
  return Object.freeze({
    bind(runId: string, contracts: readonly RequirementContract[]): RequirementBinding {
      return db.transaction(() => {
        const current = binding(runId);
        const existing = db.prepare('SELECT * FROM requirement_contract_binding WHERE run_id=?').get(runId) as Row | undefined;
        if (existing) { const decoded = decode(existing); const repeated = validateRequirementContracts(current.plan, contracts, historicalResolver(decoded.requirements.checkers)); if (decoded.requirements.digest !== repeated.digest) fail('replay-mismatch'); return decoded; }
        const requirements = validateRequirementContracts(current.plan, contracts, host.resolveChecker);
        if (db.prepare("SELECT 1 FROM approval_event WHERE run_id=? AND decision='accept'").get(runId)
            || db.prepare('SELECT 1 FROM orchestration_attempt WHERE run_id=?').get(runId)) fail('too-late');
        const now = host.now(); if (!Number.isSafeInteger(now) || now < 0 || !Number.isFinite(new Date(now).getTime())) fail('clock');
        const boundAt = new Date(now).toISOString();
        db.prepare('INSERT INTO requirement_contract_binding VALUES(?,?,?,?,?,?,?)').run(runId, current.envelopeHash, requirements.planDigest, requirements.policyDigest, requirements.digest, JSON.stringify(requirements), boundAt);
        return Object.freeze({ runId, envelopeHash: current.envelopeHash, requirements, boundAt });
      }).immediate();
    },
    read(runId: string): RequirementBinding | null {
      identifier(runId);
      return db.transaction(() => { const row = db.prepare('SELECT * FROM requirement_contract_binding WHERE run_id=?').get(runId) as Row | undefined; return row ? decode(row) : null; })();
    },
  });
}
