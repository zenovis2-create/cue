import { createHash } from 'node:crypto';
import { types } from 'node:util';

export type PlanRole = 'planner' | 'implementation' | 'model-producer' | 'verifier';
/** Requirement responsibility only. Being a maker never grants write authority. */
export const isPlanMaker = (role: PlanRole): boolean => role === 'implementation' || role === 'model-producer';
export interface PlanApproval {
  policyRevision: string;
  policyDigest: string;
  requirementIds: readonly string[];
  allowedCandidateIds: readonly string[];
  allowedScopeIds: readonly string[];
}
export interface PlanTask {
  readonly id: string;
  readonly role: PlanRole;
  readonly ownerId: string;
  readonly requirementIds: readonly string[];
  readonly dependencyIds: readonly string[];
  readonly candidateIds: readonly string[];
  readonly scopeIds: readonly string[];
}
export interface ProposedPlan {
  revision: string;
  policyRevision: string;
  policyDigest: string;
  tasks: readonly PlanTask[];
}
export interface ValidatedPlan {
  readonly revision: string;
  readonly approval: Readonly<PlanApproval>;
  readonly tasks: readonly PlanTask[];
  readonly topologicalOrder: readonly string[];
  readonly digest: string;
}
export type HostTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'blocked';
export interface HostTaskState { taskId: string; status: HostTaskStatus }
export interface PlanReadiness {
  readonly phase: 'ready' | 'running' | 'blocked' | 'completed';
  readonly readyTaskIds: readonly string[];
  readonly blockedTasks: readonly Readonly<{ taskId: string; blockers: readonly Readonly<{ taskId: string; status: 'failed' | 'blocked' }>[] }>[];
  readonly acceptance: 'unverified';
  readonly executionAdmissionRequired: true;
}

const MAX_ITEMS = 256;
const MAX_EDGES = 4096;
const verifiedPlans = new WeakSet<object>();
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
function fail(reason: string): never { throw new TypeError(`invalid_plan:${reason}`); }

function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || types.isProxy(value)
      || Object.getPrototypeOf(value) !== Object.prototype) fail('record');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const own = Reflect.ownKeys(descriptors);
  if (own.length !== keys.length || own.some(key => typeof key !== 'string' || !keys.includes(key))) fail('fields');
  const copy: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) fail('accessor');
    copy[key] = descriptor.value;
  }
  return copy;
}
function array(value: unknown, allowEmpty = false): unknown[] {
  if (!Array.isArray(value) || types.isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype) fail('array');
  const length = Object.getOwnPropertyDescriptor(value, 'length')!.value as number;
  if (length > MAX_ITEMS || (!allowEmpty && !length) || Reflect.ownKeys(value).length !== length + 1) fail('array-size');
  const result: unknown[] = [];
  for (let i = 0; i < length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('array-accessor');
    result.push(descriptor.value);
  }
  return result;
}
function id(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/u.test(value)) fail('id');
  return value;
}
function ids(value: unknown, allowEmpty = false): readonly string[] {
  const result = array(value, allowEmpty).map(id).sort(compare);
  if (new Set(result).size !== result.length) fail('duplicate-id');
  return Object.freeze(result);
}
function digest(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/u.test(value)) fail('digest');
  return value;
}
function subset(values: readonly string[], approved: readonly string[]): void {
  if (values.some(value => !approved.includes(value))) fail('scope-expansion');
}

/** Approval is host supplied. IDs are opaque references, not filesystem permission checks.
 * Distinct owner IDs enforce structural separation only; runtime actor identity and
 * evidence quality must be independently verified before acceptance. */
export function validateTaskPlan(approved: PlanApproval, proposed: ProposedPlan): ValidatedPlan {
  const a = record(approved, ['policyRevision', 'policyDigest', 'requirementIds', 'allowedCandidateIds', 'allowedScopeIds']);
  const approval = Object.freeze({ policyRevision: id(a.policyRevision), policyDigest: digest(a.policyDigest),
    requirementIds: ids(a.requirementIds), allowedCandidateIds: ids(a.allowedCandidateIds), allowedScopeIds: ids(a.allowedScopeIds, true) });
  const p = record(proposed, ['revision', 'policyRevision', 'policyDigest', 'tasks']);
  const revision = id(p.revision);
  if (p.policyRevision !== approval.policyRevision || p.policyDigest !== approval.policyDigest) fail('policy-mismatch');
  let edgeCount = 0;
  const tasks: PlanTask[] = array(p.tasks).map(value => {
    const t = record(value, ['id', 'role', 'ownerId', 'requirementIds', 'dependencyIds', 'candidateIds', 'scopeIds']);
    if (!['planner', 'implementation', 'model-producer', 'verifier'].includes(t.role as string)) fail('role');
    const task = Object.freeze({ id: id(t.id), role: t.role as PlanRole, ownerId: id(t.ownerId),
      requirementIds: ids(t.requirementIds), dependencyIds: ids(t.dependencyIds, true),
      candidateIds: ids(t.candidateIds), scopeIds: ids(t.scopeIds, true) });
    subset(task.requirementIds, approval.requirementIds);
    subset(task.candidateIds, approval.allowedCandidateIds);
    subset(task.scopeIds, approval.allowedScopeIds);
    edgeCount += task.dependencyIds.length;
    if (edgeCount > MAX_EDGES) fail('edge-limit');
    return task;
  }).sort((x, y) => compare(x.id, y.id));
  const byId = new Map(tasks.map(task => [task.id, task]));
  if (byId.size !== tasks.length) fail('duplicate-task');
  for (const task of tasks) {
    if (task.dependencyIds.some(dep => !byId.has(dep) || dep === task.id)) fail('dependency');
  }
  // Bounded iterative topological sort; no caller-controlled recursive traversal.
  const order: string[] = [];
  const remaining = new Set(byId.keys());
  while (remaining.size) {
    const ready = [...remaining].filter(key => byId.get(key)!.dependencyIds.every(dep => !remaining.has(dep))).sort(compare);
    if (!ready.length) fail('cycle');
    for (const key of ready) { order.push(key); remaining.delete(key); }
  }
  const ancestors = new Map<string, Set<string>>();
  for (const key of order) {
    const set = new Set<string>();
    for (const dep of byId.get(key)!.dependencyIds) {
      set.add(dep);
      for (const ancestor of ancestors.get(dep)!) set.add(ancestor);
    }
    ancestors.set(key, set);
  }
  for (const requirement of approval.requirementIds) {
    const makers = tasks.filter(task => isPlanMaker(task.role) && task.requirementIds.includes(requirement));
    const verifiers = tasks.filter(task => task.role === 'verifier' && task.requirementIds.includes(requirement));
    if (!makers.length || !verifiers.length) fail('requirement-coverage');
    for (const verifier of verifiers) {
      if (makers.some(task => task.ownerId === verifier.ownerId)) fail('self-verification');
      if (makers.some(task => !ancestors.get(verifier.id)!.has(task.id))) fail('verification-dependency');
    }
  }
  const canonical = { revision, approval, tasks: Object.freeze(tasks), topologicalOrder: Object.freeze(order) };
  const plan = Object.freeze({ ...canonical, digest: createHash('sha256').update(JSON.stringify(canonical)).digest('hex') });
  verifiedPlans.add(plan);
  return plan;
}

/** Readiness only: host states must already be reconciled. No lease, budget or scheduler. */
export function deriveReadyTasks(plan: ValidatedPlan, hostStates: readonly HostTaskState[]): PlanReadiness {
  if (!plan || !verifiedPlans.has(plan)) fail('unvalidated-plan');
  const states = new Map<string, HostTaskStatus>();
  const byId = new Map(plan.tasks.map(task => [task.id, task]));
  for (const value of array(hostStates)) {
    const state = record(value, ['taskId', 'status']);
    const key = id(state.taskId);
    if (!byId.has(key) || states.has(key) || !['pending', 'running', 'completed', 'failed', 'blocked'].includes(state.status as string)) fail('host-state');
    states.set(key, state.status as HostTaskStatus);
  }
  if (states.size !== byId.size) fail('missing-host-state');
  const roots = new Map<string, Map<string, 'failed' | 'blocked'>>();
  const ready: string[] = [];
  for (const key of plan.topologicalOrder) {
    const task = byId.get(key)!;
    const status = states.get(key)!;
    if ((status === 'running' || status === 'completed') && task.dependencyIds.some(dep => states.get(dep) !== 'completed')) fail('inconsistent-host-state');
    const blockers = new Map<string, 'failed' | 'blocked'>();
    for (const dep of task.dependencyIds) for (const [root, reason] of roots.get(dep)!) blockers.set(root, reason);
    if (status === 'failed' || status === 'blocked') blockers.set(key, status);
    roots.set(key, blockers);
    if (status === 'pending' && !blockers.size && task.dependencyIds.every(dep => states.get(dep) === 'completed')) ready.push(key);
  }
  const blockedTasks = plan.tasks.filter(task => roots.get(task.id)!.size).map(task => Object.freeze({ taskId: task.id,
    blockers: Object.freeze([...roots.get(task.id)!].sort(([x], [y]) => compare(x, y)).map(([taskId, status]) => Object.freeze({ taskId, status }))) }));
  const values = [...states.values()];
  const phase = values.every(status => status === 'completed') ? 'completed'
    : ready.length ? 'ready' : values.includes('running') ? 'running' : 'blocked';
  return Object.freeze({ phase, readyTaskIds: Object.freeze(ready.sort(compare)), blockedTasks: Object.freeze(blockedTasks),
    acceptance: 'unverified', executionAdmissionRequired: true });
}
