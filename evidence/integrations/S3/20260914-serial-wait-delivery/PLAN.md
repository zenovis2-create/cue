# Maker contract — serial wait-response delivery after failure

Recorded before product-source or test edits.

## Measurable done

The current 73-test baseline gains focused serial regressions proving that a task timeout and a serial execution exception with unresolved ownership retain the exact attempt/reservation, commit the wait-response claim, make zero new host delivery calls, create no delivery observation, and replay as `blocked-unresolved`. Existing successful serial delivery, delayed acknowledgement, historical replay, approved recovery, and parallel cancellation behavior remain passing.

The production gate is the exact prepared run's durable root-task state checked after the claim and immediately before host invocation. A new invocation is allowed only while that row is `running`; no attempt lifecycle or invented durable-reference field is added.

## Attempt cap

At most **2 implementation revisions**. A revision is a changed production/test candidate followed by the full required build and focused test gate. The pre-fix reproduction is diagnostic evidence and does not consume an implementation revision.

## Every implementation pass

From `daemon`, capture complete raw stdout/stderr and exit codes for:

1. `npm run build`
2. `npx vitest run test/integration-driver.test.ts test/integration-request-queue.test.ts test/integration-driver-core.test.ts test/integration-local-driver.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`

Keep a revision only if this measured gate improves or stays fully passing.

## Failure rule

On failure, preserve the raw first-run evidence and retry only with a new source-based hypothesis. If the same blocker survives two implementation revisions, stop and hand the exact failure and retained evidence to the human; do not rerun unchanged commands.

## Scope and exclusions

Owned product/test files are `app/orchestration-driver.mjs` and `daemon/test/integration-driver.test.ts`. Evidence is confined to this directory. No commit, push, network, live provider, native/Electron, or local-model execution is authorized.
