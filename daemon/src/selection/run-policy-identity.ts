import type { Ledger } from '../ledger.js';
import { readRunSelectionPolicy, type StoredSelectionPolicy } from './policy-store.js';
import { readRunLocalSelectionPolicy, type StoredLocalSelectionPolicy } from './local-policy-store.js';

export type RunPolicyIdentity = Readonly<{
  kind: 'monetary'; policyId: string; revision: number; digest: string; snapshot: StoredSelectionPolicy;
} | {
  kind: 'local-invocation'; policyId: string; revision: number; digest: string; snapshot: StoredLocalSelectionPolicy;
}>;

/** Historical approval identity only: validates existing immutable snapshots, not
 * current eligibility, pricing, resource availability or permission to execute.
 * Local fixed-pair policy is never converted into a monetary selection policy. */
export function readRunPolicyIdentity(db: Ledger, runId: string): RunPolicyIdentity | null {
  return db.transaction(() => {
    const monetary = readRunSelectionPolicy(db, runId)?.snapshot;
    // Read-only compatibility for genuine historical ledgers predating 022.
    const hasLocal = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='local_selection_run_policy'").get();
    const local = hasLocal ? readRunLocalSelectionPolicy(db, runId)?.snapshot : undefined;
    if (monetary && local) throw Error('run_policy_identity_conflict');
    if (monetary) return Object.freeze({ kind: 'monetary' as const, policyId: monetary.policyId, revision: monetary.revision, digest: monetary.digest, snapshot: monetary });
    if (local) return Object.freeze({ kind: 'local-invocation' as const, policyId: local.policyId, revision: local.revision, digest: local.digest, snapshot: local });
    return null;
  })();
}
