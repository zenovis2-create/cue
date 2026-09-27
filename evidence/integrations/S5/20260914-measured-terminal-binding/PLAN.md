# Measured terminal binding implementation plan

Done means the stored-execution validator accepts only a synchronous, exact plain own-data `{ status, attemptId }` response from `terminalIntegrity`, requires `status === 'verified'` and `attemptId` equal to the stored attempt ID, and the focused integration gate passes with refusal/write-zero/replay/reopen coverage.

- Attempt cap: 2 completed focused test passes.
- Every pass: build `daemon`, then run `npx vitest run test/integration-evaluation-measured-fact-evidence-core.test.ts test/integration-evaluation-measured-facts.test.ts test/integration-evaluation-measured-facts-core-containment.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1` from `daemon`.
- Evidence: preserve build/test output in `maker/`, then pin the two changed source/test paths in `final-pins.json`.
- Failure handling: retry only with a new hypothesis; if two completed focused passes fail, stop and hand the remaining failure to the human/reviewer.

Scope is limited to `daemon/src/evaluation/measured-facts.ts`, `daemon/test/integration-evaluation-measured-fact-evidence-core.test.ts`, and this evidence directory. Existing fixture setup, fact payload/digest behavior, readiness defaults, and authority classes remain unchanged.
