# S4 journal recovery maker done contract

Date: 2026-09-12 KST

## Done

The startup path durably creates an idempotent held-recovery case for every interrupted orchestration attempt in the canonical workspace before session fencing or profile cleanup. It never releases the workspace writer lease while any held attempt has missing, legacy, corrupt, root-replaced, cleanup-unknown, external-effect-unknown, or handoff-unknown facts. The registered native recovery host may append a fresh journal observation only after stored terminal cleanup evidence and its fresh guarded native observation narrow the attempt to confirmed-dead/clean. Reopen and replay produce one case per attempt and fresh observation batches without granting resume, start, restore, resend, acceptance, or direct-SQL pass authority.

## Attempt cap

Three maker passes. A failed pass must use a new evidence-backed hypothesis. Keep a mutation only when the focused gate improves; otherwise revert only that maker-owned mutation.

## Every-pass checks

1. `npx --no-install vitest run test/integration-journal-recovery.test.ts test/integration-held-recovery.test.ts test/integration-recovery.test.ts test/integration-native-recovery-host.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`
2. `npx --no-install tsc --noEmit`
3. `npm run build`
4. `git diff --check -- daemon/src/recovery.ts daemon/src/held-recovery.ts daemon/src/journal-recovery.ts daemon/src/daemon-ownership.ts app/native-recovery-host.mjs app/native-recovery-host.d.mts daemon/test/integration-journal-recovery.test.ts daemon/test/integration-native-recovery-host.test.ts evidence/integrations/S4/20260912-journal-recovery`

The focused test must cover close/reopen, clean and non-clean attempts, missing/legacy journal, journal tamper, root replacement, exact replay/idempotency, complete workspace inventory, and writer-lease retention. Real read-only helper use is limited to owned temporary roots. No provider/model/native-executor, process-kill gate, credential call, automatic recovery action, or direct SQL pass is allowed.

## Failure handoff

After three failed passes, preserve the receipts and hand the unresolved gate and latest hypothesis to `/root`.
