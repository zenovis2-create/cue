# Independent budget regression check

PASS for the two test-fixture corrections and current related offline regression gate.

Root inspected worker initialization and results. Schema opening finishes serially; both reservation transactions then receive `go`. Monetary results must be exactly `budget_limit_exceeded` and `reserved`. Local results require one `committed`, one limit rejection, one committed count and one attempt. Busy is not accepted as a successful contention result. This does not prove concurrent migration opening.

Current combined gate from daemon:

```text
npx --no-install vitest run test/integration-recovery-policy.test.ts test/integration-retry-backend.test.ts test/integration-budget.test.ts test/integration-local-invocation-budget.test.ts test/integration-evaluation-authoritative-accounting.test.ts test/integration-evaluation-measured-facts-core-containment.test.ts test/integration-driver.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
```

Exit 0, 7 files, 75/75 tests, 16.85 seconds (`0be0e3` then `e6b0d0`). The accounting component's separate semantic review is still required; inclusion here does not unquarantine Core or approve S5.
