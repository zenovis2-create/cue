# Offline validation

Commands were run from `daemon/` without the package `pretest` hook and without a build:

```text
npx vitest run test/codex-usage-producer.test.ts test/host-codex-controller.test.ts test/integration-executors.test.ts test/integration-codex-adapter-preservation.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
```

Result: 4 files passed, 24 tests passed.

```text
npx tsc -p tsconfig.json --noEmit
```

Result: exit 0, no diagnostics.

Focused coverage includes correlated thread/turn acceptance, foreign identifiers, duplicate and lower reordered cumulative snapshots, malformed numeric fields, post-terminal quarantine, a real in-memory SQLite `orchestration_activity` row bound to the expected run/task/attempt, and suppression of the fallback unknown fact after observed usage. Existing cancellation, activity observer failure, output, terminal, and adapter preservation suites also passed.

Capability consistency follow-up:

```text
npx vitest run test/integration-executors.test.ts test/integration-codex-adapter-preservation.test.ts test/codex-usage-producer.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
npx tsc --project tsconfig.json --noEmit --pretty false
```

Result: 3 files and 17 tests passed; typecheck exited 0 with no diagnostics.

Independent-review resolution:

```text
npx vitest run test/codex-usage-producer.test.ts test/integration-executors.test.ts test/integration-codex-adapter-preservation.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
npx tsc -p tsconfig.json --noEmit --pretty false --incremental false
```

Result: 3 files and 18 tests passed; typecheck exited 0. The real SQLite assertion proves cumulative snapshots `5 -> 8` persist deltas `5,3` and sum to `8`. Additional coverage proves equal-total changed breakdowns are dropped, retry attempts have independent delta state and attempt identity, and usage delivered after cancellation is ignored.
