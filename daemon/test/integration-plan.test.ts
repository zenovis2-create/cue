import { describe, expect, it } from 'vitest';
import { deriveReadyTasks, validateTaskPlan, type PlanApproval, type ProposedPlan, type PlanTask, type HostTaskStatus } from '../src/orchestration/plan.js';

const approval = (): PlanApproval => ({ policyRevision: 'policy-1', policyDigest: 'a'.repeat(64),
  requirementIds: ['req-a'], allowedCandidateIds: ['candidate-a', 'candidate-b'], allowedScopeIds: ['scope-a'] });
const task = (id: string, role: PlanTask['role'], ownerId: string, dependencyIds: string[] = []): PlanTask => ({ id, role, ownerId,
  requirementIds: ['req-a'], dependencyIds, candidateIds: ['candidate-a', 'candidate-b'], scopeIds: ['scope-a'] });
const proposal = (): ProposedPlan => ({ revision: 'plan-1', policyRevision: 'policy-1', policyDigest: 'a'.repeat(64), tasks: [
  task('plan', 'planner', 'planner'), task('make', 'implementation', 'maker', ['plan']), task('check', 'verifier', 'checker', ['make']),
] });
const states = (plan: HostTaskStatus, make: HostTaskStatus, check: HostTaskStatus) => [{ taskId: 'plan', status: plan }, { taskId: 'make', status: make }, { taskId: 'check', status: check }];

describe('S3 immutable requirement task DAG', () => {
  it('canonicalizes order and digests without exposing mutable caller data', () => {
    const a = approval(); const p = proposal();
    const result = validateTaskPlan(a, p);
    // Recorded before model-producer was added; legacy canonical bytes stay stable.
    expect(result.digest).toBe('a9565c9dca9ae89213a5635640151e507b8c4355357e449ecbc5973ba0c59acc');
    const reversed = validateTaskPlan({ ...a, allowedCandidateIds: [...a.allowedCandidateIds].reverse() },
      { ...p, tasks: [...p.tasks].reverse().map(t => ({ ...t, candidateIds: [...t.candidateIds].reverse() })) });
    expect(result.digest).toBe(reversed.digest);
    expect(result.topologicalOrder).toEqual(['plan', 'make', 'check']);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.tasks[0].dependencyIds)).toBe(true);
    (a.requirementIds as string[]).push('later');
    expect(result.approval.requirementIds).toEqual(['req-a']);
    expect(() => (result.tasks as PlanTask[]).pop()).toThrow();
  });
  it('rejects duplicate IDs, missing/self dependencies and cycles', () => {
    const p = proposal();
    for (const tasks of [[...p.tasks, p.tasks[0]], p.tasks.map(t => t.id === 'make' ? { ...t, dependencyIds: ['missing'] } : t),
      p.tasks.map(t => t.id === 'make' ? { ...t, dependencyIds: ['make'] } : t),
      p.tasks.map(t => t.id === 'plan' ? { ...t, dependencyIds: ['check'] } : t)]) {
      expect(() => validateTaskPlan(approval(), { ...p, tasks })).toThrow();
    }
  });
  it('rejects orphan requirements, missing implementation/verification and independent verifier omissions', () => {
    const p = proposal();
    expect(() => validateTaskPlan({ ...approval(), requirementIds: ['req-a', 'req-orphan'] }, p)).toThrow(/coverage/);
    expect(() => validateTaskPlan(approval(), { ...p, tasks: p.tasks.filter(t => t.role !== 'verifier') })).toThrow(/coverage/);
    expect(() => validateTaskPlan(approval(), { ...p, tasks: [task('check', 'verifier', 'checker')] })).toThrow(/coverage/);
    expect(() => validateTaskPlan(approval(), { ...p, tasks: p.tasks.map(t => t.role === 'verifier' ? { ...t, dependencyIds: ['plan'] } : t) })).toThrow(/verification-dependency/);
    expect(() => validateTaskPlan(approval(), { ...p, tasks: p.tasks.map(t => t.role === 'verifier' ? { ...t, ownerId: 'maker' } : t) })).toThrow(/self-verification/);
  });
  it('requires verification after all implementations of a requirement, allowing transitive dependencies', () => {
    const p = proposal();
    expect(() => validateTaskPlan(approval(), { ...p, tasks: [...p.tasks, task('make-2', 'implementation', 'maker-2', ['plan'])] })).toThrow(/verification-dependency/);
    const tasks = [...p.tasks, task('bridge', 'planner', 'coordinator', ['make'])].map(t => t.id === 'check' ? { ...t, dependencyIds: ['bridge'] } : t);
    expect(validateTaskPlan(approval(), { ...p, tasks }).topologicalOrder).toEqual(['plan', 'make', 'bridge', 'check']);
  });
  it('permits model producers as makers without relaxing independent reviewer or all-maker dependencies', () => {
    const p = proposal();
    const model = { ...p, tasks: p.tasks.map(t => t.id === 'make' ? { ...t, role: 'model-producer' as const, scopeIds: [] } : t) };
    expect(validateTaskPlan(approval(), model).tasks.find(t => t.id === 'make')?.role).toBe('model-producer');
    expect(() => validateTaskPlan(approval(), { ...model, tasks: model.tasks.map(t => t.id === 'check' ? { ...t, ownerId: 'maker' } : t) })).toThrow('self-verification');
    expect(() => validateTaskPlan(approval(), { ...model, tasks: model.tasks.map(t => t.id === 'check' ? { ...t, dependencyIds: ['plan'] } : t) })).toThrow('verification-dependency');
    const mixed = [...model.tasks, task('native', 'implementation', 'native-maker', ['plan'])];
    expect(() => validateTaskPlan(approval(), { ...model, tasks: mixed })).toThrow('verification-dependency');
    expect(validateTaskPlan(approval(), { ...model, tasks: mixed.map(t => t.id === 'check' ? { ...t, dependencyIds: ['make', 'native'] } : t) }).tasks).toHaveLength(4);
  });
  it('rejects undeclared scope, candidates, requirements, privileges and policy changes', () => {
    const p = proposal();
    for (const field of ['scopeIds', 'candidateIds', 'requirementIds'] as const) {
      expect(() => validateTaskPlan(approval(), { ...p, tasks: p.tasks.map(t => ({ ...t, [field]: ['outside'] })) })).toThrow(/scope-expansion/);
    }
    expect(() => validateTaskPlan(approval(), { ...p, policyRevision: 'other' })).toThrow(/policy-mismatch/);
    expect(() => validateTaskPlan(approval(), { ...p, policyDigest: 'b'.repeat(64) })).toThrow(/policy-mismatch/);
    expect(() => validateTaskPlan(approval(), { ...p, allowUnsafe: true } as ProposedPlan)).toThrow(/fields/);
  });
  it('rejects hostile records, sparse/accessor arrays and bounded input overflow without invoking getters', () => {
    let getterCalls = 0;
    const hostile = { ...proposal(), get revision() { getterCalls++; return 'changed'; } };
    expect(() => validateTaskPlan(approval(), hostile)).toThrow(/accessor/);
    expect(getterCalls).toBe(0);
    expect(() => validateTaskPlan(approval(), Object.create(proposal()))).toThrow();
    expect(() => validateTaskPlan(approval(), new Proxy(proposal(), {}))).toThrow();
    expect(() => validateTaskPlan(approval(), { ...proposal(), tasks: new Array(3) })).toThrow();
    expect(() => validateTaskPlan(approval(), { ...proposal(), tasks: Array.from({ length: 257 }, (_, i) => task(`t-${i}`, 'implementation', 'maker')) })).toThrow(/array-size/);
  });
});

describe('S3 readiness from reconciled host facts', () => {
  it('derives deterministic pending stages and never starts a task before dependencies complete', () => {
    const plan = validateTaskPlan(approval(), proposal());
    expect(deriveReadyTasks(plan, states('pending', 'pending', 'pending')).readyTaskIds).toEqual(['plan']);
    expect(deriveReadyTasks(plan, states('completed', 'pending', 'pending').reverse()).readyTaskIds).toEqual(['make']);
    expect(deriveReadyTasks(plan, states('completed', 'completed', 'pending')).readyTaskIds).toEqual(['check']);
    expect(deriveReadyTasks(plan, states('completed', 'running', 'pending')).phase).toBe('running');
  });
  it('propagates explicit failed and blocked dependency roots without declaring completion', () => {
    const plan = validateTaskPlan(approval(), proposal());
    for (const failure of ['failed', 'blocked'] as const) {
      const result = deriveReadyTasks(plan, states(failure, 'pending', 'pending'));
      expect(result.phase).toBe('blocked'); expect(result.readyTaskIds).toEqual([]);
      expect(result.blockedTasks.find(t => t.taskId === 'check')?.blockers).toEqual([{ taskId: 'plan', status: failure }]);
    }
  });
  it('distinguishes all tasks completed from acceptance and execution admission', () => {
    const result = deriveReadyTasks(validateTaskPlan(approval(), proposal()), states('completed', 'completed', 'completed'));
    expect(result).toEqual({ phase: 'completed', readyTaskIds: [], blockedTasks: [], acceptance: 'unverified', executionAdmissionRequired: true });
  });
  it('rejects missing/duplicate/foreign states, impossible execution and forged validated plans', () => {
    const plan = validateTaskPlan(approval(), proposal());
    const complete = states('completed', 'completed', 'completed');
    for (const invalid of [complete.slice(1), [...complete, complete[0]], [...complete.slice(1), { taskId: 'foreign', status: 'pending' as const }],
      states('pending', 'running', 'pending'), states('completed', 'pending', 'completed')]) {
      expect(() => deriveReadyTasks(plan, invalid)).toThrow();
    }
    expect(() => deriveReadyTasks({ ...plan }, complete)).toThrow(/unvalidated-plan/);
  });
});
