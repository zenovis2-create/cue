# S4 recovery handoff authority done contract

Date: 2026-09-12 KST

## Done

The protected native recovery host constructs the existing terminal-integrity reader with the same trusted `authorizeHandoffArtifact` and `resolveHandoffArtifact` provenance used by orchestration. Held recovery may consume only `readTerminalIntegrity(exactAttemptId).status === 'verified'`, revalidated inside the final CAS after observer awaits. Missing, corrupt, changed, or wrong-attempt artifact bytes remain held. Missing exhaustive external-effect authority also remains held. No automatic disposition, resume, restore, lease release, cleanup, or provider/model/native execution is added.

False done: an `EXISTS orchestration_handoff` query, caller boolean, cached integrity status, fixture artifact resolver in production, or a passing helper-only test without the protected host seam.

## Correction cap

Two maker correction passes. Each failed pass must use a new evidence-backed hypothesis. A change is retained only when the focused passed-gate count improves without weakening held behavior.

## Every-pass checks

1. `npx --no-install vitest run test/integration-recovery-handoff.test.ts test/integration-held-recovery.test.ts test/integration-native-recovery-host.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1 --testTimeout=90000`
2. `npx --no-install tsc --noEmit`
3. `npm run build`
4. `git diff --check -- daemon/src/held-recovery.ts app/native-recovery-host.mjs app/native-recovery-host.d.mts daemon/test/integration-recovery-handoff.test.ts daemon/test/integration-native-recovery-host.test.ts evidence/integrations/S4/20260912-recovery-handoff`

The focused regression matrix covers a valid exact-attempt handoff and missing, corrupt, changed, unauthorized, and wrong-attempt artifact provenance. Reopen must preserve the same verdict. Tests use owned temporary artifacts and deterministic resolvers only; they do not call a model, provider, native executor, process kill, credential service, or cleanup gate.

## Failure handoff

After two failed correction passes, preserve receipts and hand the unresolved authority seam and current hypothesis to `/root`.
