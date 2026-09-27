import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { openLedger, type Ledger } from '../src/ledger.js';
import { saveSelectionPolicy, bindRunSelectionPolicy } from '../src/selection/policy-store.js';
import { validateTaskPlan } from '../src/orchestration/plan.js';
import { createOrchestrationStore } from '../src/orchestration/store.js';
import { createRequirementContractStore, validateRequirementContracts, type RequirementContract, type RequirementKind, type RegisteredRequirementChecker } from '../src/verification/requirements.js';
const roots: string[] = [], handles: Ledger[] = [];
afterEach(() => { for (const db of handles.splice(0)) if (db.open) db.close(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const kinds: RequirementKind[] = ['code', 'research', 'document', 'external'];
const contracts = (): RequirementContract[] => kinds.map(kind => ({ id: kind, text: `${kind} 요구사항 원문`, kind, required: kind === 'code', checks: [
  { checkerId: `check-${kind}`, revision: 'v1', parametersDigest: 'a'.repeat(64), targetIds: ['target-b', 'target-a'] },
] }));
const evidencePolicy=(kind:RequirementKind)=>({requirementId:kind,kind,producerTaskIds:['make'],sourceRevision:'approved-source',targetIds:['target-a','target-b'],checkerId:`check-${kind}`,checkerRevision:'v1',parametersDigest:'a'.repeat(64),hostileCheckIds:kind==='code'?['negative']:[],requiredSectionIds:kind==='document'?['section']:[],claimIds:kind==='research'?['claim']:[],requiresRender:kind==='document',...(kind==='external'?{remote:{accountId:'account',resourceId:'resource',operationId:'operation',idempotencyKey:'key',expectedTransition:'updated',observerId:'observer',observerRevision:'v1'}}:{})});
function resolver(id: string, revision: string): RegisteredRequirementChecker | undefined {
  const kind = kinds.find(kind => id === `check-${kind}`);
  return kind && revision === 'v1' ? { id, revision, kinds: [kind], evidencePolicies:[evidencePolicy(kind)] } : undefined;
}
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'cue-requirements-')); roots.push(root);
  const path = join(root, 'ledger.db'), db = openLedger(path); handles.push(db);
  for (const file of ['009_selection_policy.sql', '010_orchestration.sql', '013_requirement_contract.sql']) db.exec(readFileSync(resolve('migrations', file), 'utf8'));
  db.prepare("INSERT INTO task VALUES('task','awaiting_approval',NULL,'now')").run();
  db.prepare("INSERT INTO envelope VALUES('env',?,'[]','now')").run(root);
  db.prepare("INSERT INTO run VALUES('run','task','env',0,'now')").run();
  const policy = saveSelectionPolicy(db, { policyId: 'policy', expectedRevision: null, createdAt: '2026-09-11T00:00:00.000Z', sourceVersion: 'fixture', policy: {
    version: 'cue-selection-v1', mode: 'efficiency', qualityMinimum: .5, costBasis: 1, timeBasisMs: 1000, currency: 'TEST', costLimit: null, remainingTimeMs: null, maxEstimateAgeMs: 100, allowedCandidateIds: ['agent'], pinnedCandidateId: null,
  } });
  bindRunSelectionPolicy(db, { runId: 'run', policyId: 'policy', revision: 1, digest: policy.digest, boundAt: '2026-09-11T00:00:00.000Z' });
  const approval = { policyRevision: 'policy:1', policyDigest: policy.digest, requirementIds: kinds, allowedCandidateIds: ['agent'], allowedScopeIds: [] };
  const plan = validateTaskPlan(approval, { revision: 'plan1', policyRevision: approval.policyRevision, policyDigest: approval.policyDigest, tasks: [
    { id: 'make', role: 'implementation', ownerId: 'maker', requirementIds: kinds, dependencyIds: [], candidateIds: ['agent'], scopeIds: [] },
    { id: 'check', role: 'verifier', ownerId: 'checker', requirementIds: kinds, dependencyIds: ['make'], candidateIds: ['agent'], scopeIds: [] },
  ] });
  const orchestration = createOrchestrationStore(db, { authorizePlan: () => true, authorizeClaim: () => true, verifyReceipt: () => ({ outcomeVerified: true, cleanupVerified: true }) });
  orchestration.install('run', plan);
  const host = { available: true, now: 1000 };
  const storeHost = { now: () => host.now, resolveChecker: (id: string, revision: string) => host.available ? resolver(id, revision) : undefined };
  const store = createRequirementContractStore(db, storeHost);
  return { root, path, db, plan, orchestration, host, storeHost, store };
}
function accept(db: Ledger) { db.prepare("INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,request_ordinal,decision,created_at) VALUES('run','env','desktop','goal',0,'accept','now')").run(); }
describe('S4 approval-bound requirement contracts', () => {
  it('canonicalizes all four kinds, exact IDs and nested immutable checker snapshots', () => {
    const f = fixture(), input = contracts(), before = structuredClone(input);
    const first = validateRequirementContracts(f.plan, input, resolver);
    const shuffled = [...input].reverse().map(c => ({ ...c, checks: c.checks.map(ch => ({ ...ch, targetIds: [...ch.targetIds].reverse() })) }));
    expect(validateRequirementContracts(f.plan, shuffled, resolver)).toEqual(first); expect(input).toEqual(before);
    expect(first.digest).toMatch(/^[a-f0-9]{64}$/); expect(first.checkers).toHaveLength(4);
    expect(Object.isFrozen(first) && Object.isFrozen(first.checkers) && first.contracts.every(c => Object.isFrozen(c) && Object.isFrozen(c.checks[0].targetIds))).toBe(true);
    expect(first).not.toHaveProperty('verdict');
  });
  it('rejects missing/extra/duplicate IDs, all-optional and empty checks', () => {
    const f = fixture(), input = contracts();
    for (const invalid of [input.slice(1), [...input, { ...input[0], id: 'extra' }], [...input, input[0]], input.map(c => ({ ...c, required: false })), input.map(c => ({ ...c, checks: [] }))]) {
      expect(() => validateRequirementContracts(f.plan, invalid, resolver)).toThrow();
    }
  });
  it('only registered compatible checker revisions bind; names are never executable commands', () => {
    const f = fixture();
    expect(() => validateRequirementContracts(f.plan, contracts(), () => undefined)).toThrow('unsupported-checker');
    expect(() => validateRequirementContracts(f.plan, contracts(), (id) => ({ id, revision: 'v2', kinds, evidencePolicies:[evidencePolicy('code')] }))).toThrow('checker-incompatible');
    expect(() => validateRequirementContracts(f.plan, contracts(), (id, revision) => ({ id, revision, kinds: ['external'], evidencePolicies:[evidencePolicy('external')] }))).toThrow('checker-incompatible');
    const input = contracts(); input[0] = { ...input[0], checks: [{ ...input[0].checks[0], command: 'arbitrary command' } as never] };
    expect(() => validateRequirementContracts(f.plan, input, resolver)).toThrow('fields');
  });
  it('rejects oversized text, callbacks, unsafe getter/array shapes and malformed digests', () => {
    const f = fixture();
    for (const text of ['', ' '.repeat(3), 'x'.repeat(16385)]) {
      const input = contracts(); input[0] = { ...input[0], text }; expect(() => validateRequirementContracts(f.plan, input, resolver)).toThrow('text');
    }
    const input = contracts(); let called = false;
    Object.defineProperty(input[0], 'text', { get() { called = true; return 'forged'; } });
    expect(() => validateRequirementContracts(f.plan, input, resolver)).toThrow(); expect(called).toBe(false);
    expect(() => validateRequirementContracts(f.plan, new Proxy(contracts(), {}), resolver)).toThrow('array');
    const malformed = contracts(); malformed[0] = { ...malformed[0], checks: [{ ...malformed[0].checks[0], parametersDigest: 'not-a-hash' }] };
    expect(() => validateRequirementContracts(f.plan, malformed, resolver)).toThrow('digest');
  });
  it('binds before approval, reopens immutably and reads after checker uninstallation', () => {
    const f = fixture(), bound = f.store.bind('run', contracts()); accept(f.db); f.host.available = false; f.host.now = 9999;
    expect(f.store.bind('run', contracts())).toEqual(bound); expect(f.store.read('run')).toEqual(bound);
    f.db.close(); const db = openLedger(f.path); handles.push(db);
    const reopened = createRequirementContractStore(db, f.storeHost);
    expect(reopened.read('run')).toEqual(bound); expect(reopened.read('missing')).toBeNull();
    expect(reopened.read('run')?.boundAt).toBe(new Date(1000).toISOString());
  });
  it('first binding after accepted approval or an attempt is rejected', () => {
    const f = fixture(); accept(f.db); expect(() => f.store.bind('run', contracts())).toThrow('too-late');
    const g = fixture(); g.db.prepare("UPDATE task SET state='running' WHERE id='task'").run();
    g.orchestration.claim({ runId: 'run', taskId: 'make', attemptId: 'attempt', candidateId: 'agent', observedAtMs: 1000 });
    expect(() => g.store.bind('run', contracts())).toThrow('too-late');
  });
  it('late raw insertion is blocked by SQL, not just the API', () => {
    const f = fixture(); accept(f.db);
    expect(() => f.db.prepare("INSERT INTO requirement_contract_binding VALUES('run','env','p','q','d','{}','now')").run()).toThrow('too_late');
  });
  it('idempotent replay cannot change required status/text and SQL REPLACE cannot overwrite', () => {
    const f = fixture(), original = f.store.bind('run', contracts());
    const changed = contracts(); changed[1] = { ...changed[1], required: true };
    expect(() => f.store.bind('run', changed)).toThrow('replay-mismatch');
    expect(() => f.db.prepare('INSERT OR REPLACE INTO requirement_contract_binding SELECT * FROM requirement_contract_binding').run()).toThrow('immutable');
    expect(() => f.db.prepare("UPDATE requirement_contract_binding SET requirements_digest='x'").run()).toThrow('immutable');
    expect(f.store.read('run')).toEqual(original);
  });
  it('rollback leaves no binding and corruption or changed run lineage is detected', () => {
    const f = fixture();
    expect(() => f.db.transaction(() => { f.store.bind('run', contracts()); throw Error('rollback'); })()).toThrow('rollback');
    expect(f.store.read('run')).toBeNull(); f.store.bind('run', contracts());
    f.db.exec('DROP TRIGGER requirement_contract_no_update');
    f.db.prepare("UPDATE requirement_contract_binding SET requirements_digest=?").run('f'.repeat(64));
    expect(() => f.store.read('run')).toThrow('binding-integrity');
    const g = fixture(); g.store.bind('run', contracts()); g.db.prepare("UPDATE run SET envelope_hash='missing' WHERE id='run'").run();
    expect(() => g.store.read('run')).toThrow('run-plan-missing');
  });
});
