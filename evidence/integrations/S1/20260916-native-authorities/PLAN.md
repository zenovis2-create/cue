# Native existing-file authority implementation gate

## Done

Implement one fixed production constructor for `approved-existing-file-artifacts-v1`. It calls `createNativeImplementationHost` only after exact current installation/subject/live capability and source-bound authentication facts resolve. It supplies ledger-bound plan, claim, stage, launch, execution, cleanup, accounting, checker, acceptance and publication authorities. The deterministic checker commits ordered target path, maximum bytes, expected final SHA-256 and expected byte length; it never equates a mechanical artifact match with an arbitrary user goal.

Migration 050 durably stores canonical host runtime results bound to run/task/attempt/candidate/subject/session. Missing billing produces an unknown, non-final receipt and releases zero reservation. No caller-supplied success, generic callback, provider call, network call, setup schema or startup resolver is added.

## Owned files

- new `app/native-existing-file-authorities.mjs` and `.d.mts`
- new `daemon/src/orchestration/native-runtime-receipts.ts`
- new `daemon/src/native-process-cleanup.ts`
- new `daemon/src/verification/native-existing-file-checker.ts`
- new `daemon/migrations/050_native_runtime_receipt.sql`
- migration-only edits to `daemon/src/ledger.ts` and `daemon/scripts/copy-assets.mjs`
- focused tests named in `PREIMAGES.tsv`, plus bounded additions to `integration-native-implementation-host.test.ts`

## Per-pass measurement

After the coordinated root build, from `daemon/`:

```text
npx --no-install vitest run test/integration-native-runtime-receipts.test.ts test/integration-native-process-cleanup.test.ts test/integration-native-existing-file-checker.test.ts test/integration-native-existing-file-authorities.test.ts test/integration-native-implementation-host.test.ts
npx --no-install tsc -p tsconfig.json --noEmit
```

Done requires both commands exit 0, exact changed-file hashes, retained raw logs, and independent review. Maximum two passes per hypothesis. A deterministic failure is recorded and followed only by a new hypothesis; no unchanged retry. A change is retained only if the focused gate improves or remains fully passing.

## Preconditions and trust

Current live capability evidence and an exact account observation are required independently. An account reference is identity lineage only and is never interpreted as authentication or entitlement. Runtime success comes only from the adapter-owned `CodexExecution.result`, captured by the fixed candidate wrapper and persisted with its exact session lineage. Cleanup is a fresh host observation of exact created process identities and owned resources. Fixture seams substitute OS/provider transport only and cannot grant authority through caller callbacks.

### Discovered production blocker

The repository has no pre-launch trusted authentication/entitlement observation producer or store for a native provider account. `ProviderInstallationDescriptor` explicitly remains unqualified, unauthenticated and unentitled; capability probes do not establish account authentication; `orchestration_account_identity` is downstream run lineage copied from a catalog record; authenticated provider-lifecycle evidence exists only after launch. Therefore the complete constructor and Core positive path cannot truthfully become reachable in this unit without first implementing that protected producer. This batch retains only independently valid runtime-receipt, cleanup and explicit deterministic-artifact checker foundations and must not claim the Unit 1 production path complete.
