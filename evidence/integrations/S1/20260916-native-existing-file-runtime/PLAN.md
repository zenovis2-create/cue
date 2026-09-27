# Native existing-file runtime plan

Done means the coordinated build passes, then the focused direct Vitest command passes with real top-level host launch fixtures: `npx --no-install vitest run test/integration-native-existing-file-runtime.test.ts test/integration-native-verifier.test.ts test/integration-native-implementation-host.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1 --testTimeout=20000` from `daemon`, and final SHA-256 values are recorded for every changed file.

Attempt cap: 2 hypotheses.

Every pass checks exact `[file_change]`/empty-egress admission, persisted attempt staging root identity, approved existing-target snapshots and CAS writes, generic command refusal, no create fallback, lifecycle teardown, and unchanged verifier/default runtime behavior.

On failure, retry only with a new source-backed hypothesis; otherwise hand the failure to root. Keep only a change whose focused gate improves.
