# Independent checker contract — parallel wait-response delivery

Reviewer scope is read-only for product source and tests. Checker-owned artifacts are this review and `logs/independent-*`. Maker owns driver/tests.

## Completion criteria (recorded before checker evidence edits)

Attempt cap: **2** focused executions. Every execution must capture complete raw stdout/stderr and the process exit code at first execution; a failed execution is rerun only after a concrete changed candidate and a new source-based hypothesis.

The stable candidate must satisfy all of the following:

1. A committed wait-response dispatch remains claim-before-effect and is delivered only through the live attempt selected by the claim's exact attempt ID; the host callback fields must equal that attempt's trusted persisted identity and durable reference. `EngineAttempt` exposes no durable-reference API, so the checker does not invent a handle comparison.
2. A synchronous claim-authority callback that stops the owning driver may leave the durable claim committed, but causes zero new host delivery invocations.
3. Driver stop/closing before host invocation causes zero new host delivery invocations. A claim already committed in either case remains unresolved and cannot be resent or reopened into a send.
4. Once a host delivery invocation has occurred, a matching acknowledgement remains a factual delivered observation even if stop begins while that invocation is pending. Stop must not rewrite the fact as unknown or trigger a resend.
5. Historical/reopened delivery calls never invoke the host: an observed delivered claim replays `delivered-observed`; an unobserved/unknown committed claim replays `blocked-unresolved`.
6. Exact host acknowledgement validation remains bound to dispatch ID, attempt ID, identity ID, durable reference, and content SHA-256.
7. Final review inspects the full source/preimage diff and records final hashes. Focused gate: `npx vitest run test/integration-driver.test.ts test/integration-request-queue.test.ts test/integration-driver-core.test.ts test/integration-local-driver.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`, expected **70 baseline + new tests**, all passing.

This unit does not qualify live providers, native/Electron behavior, restart/resume, broad runtime behavior, or throughput.

## Preimage finding

In the inspected preimage, `deliverWaitResponse` calls `store.claimWaitResponse` first, then resolves `prepared`/`activeAttempts` and invokes `host.deliverWaitResponse` without checking `closing`, `entry.cancelled`, cancellation control for a retained parallel attempt, or whether claim authority synchronously changed driver ownership. Because `store.claimWaitResponse` invokes `host.authorizeClaim(ctx)` inside the claim transaction, an authorization callback can synchronously call `driver.stop(runId)`; the durable claim then commits and the old code can still invoke the host. Parallel failure/timeout also retains active-attempt entries for unknown ownership while `cancelActive` marks their `control`, so such a retained cancelling handle is not eligible for a new send. The durable claim itself is the correct no-resend fence, but the host effect needs a post-claim ownership/stop gate.

## Final independent review

**PASS** for this bounded parallel wait-response unit. No blocking finding remains in the inspected candidate.

The full product/preimage diff contains one production condition. After the durable claim commits, delivery now refuses a new host invocation when the owning prepared entry is absent, the run is cancelled, the driver is closing, the exact parallel attempt has cancellation control, the handle is absent, or the host delivery callback is unavailable. The attempt-keyed `activeAttempts` lookup selects the correct parallel execution. The claim carries identity ID and durable reference from the store's integrity-checked persisted identity row, and the host acknowledgement is still validated against dispatch ID, attempt ID, identity ID, durable reference, and content hash by `observeWaitDelivery`.

The full test/preimage diff adds fixture capture plus three tests and extends the existing timeout test:

- Two concurrently held reader attempts receive callback fields and bytes matching their distinct persisted attempt/identity/durable-reference rows. Each delivery is observed exactly once, and a reopened driver returns historical `delivered-observed` without another host call.
- A responder-authorization callback synchronously stops the driver during claim. The append-only dispatch claim remains, no delivery observation is fabricated, the host receives zero calls, and replay returns `blocked-unresolved` without a call.
- A host invocation already underway is allowed to finish. A valid delayed acknowledgement after stop is stored as `delivered`, preserving the factual external effect.
- A timed-out parallel wave keeps attempts running under deliberately unresolved cleanup while its retained active controls are set. A newly committed response claim returns `blocked-unresolved` with zero host calls.

Maker evidence records more than two total commands: a tool-only pre-fix reproduction and a preliminary build preceded the two declared full build/test passes. Full pass 1 failed 72/73 because the timeout fixture had already terminalized its attempts, so the test could not create a wait request (`wait_attempt_unavailable`). The concrete correction set `finish=false` only in that existing unknown-cleanup timeout fixture, preserving a running unresolved attempt so the cancellation-control delivery fence could be exercised. Full pass 2 passed build exit 0 and 73/73. The maker pass cap is exhausted.

The checker used one of its two allowed focused executions. Complete raw stdout/stderr was written directly on that first execution to `logs/independent-pass1-tests.log`; its exit code was written to `logs/independent-pass1-tests-exit.txt`. Result: exit **0**, **4 files passed, 73 tests passed**. Raw log SHA-256: `BFAFA04C1DB0A875EE2FD4F31C72EB7F6F1C067D313A10A81B416B8E3C7F67DF`; exit-file SHA-256: `13BF7B3039C63BF5A50491FA3CFD8EB4E699D1BA1436315AEF9CBE5711530354`. No second checker execution was needed.

Final inspected SHA-256 pins:

- `app/orchestration-driver.mjs`: `70B70B5823A6EB0EF58B3EF7F03CABD97721BC8C754658E6CBD17A43219122BA`
- `daemon/test/integration-driver.test.ts`: `262379FD434217976D6B54C2C81759DE063C8A91ECC8D88EF0E360BCBE3F3179`
- `daemon/test/integration-request-queue.test.ts`: `ED4A21F719903823D3E5110CAD144B4696717CC9931F98FECF62DED19F5B9ADB`
- `daemon/test/integration-driver-core.test.ts`: `A290B5BF5201646BF3EA4F99F9BF22E885AC072E3C3040CB2A79B1CBA7ACD165`
- `daemon/test/integration-local-driver.test.ts`: `5C17BC213F546E6D8BDA7AE85A5AD08244AA33B3AAA025059B942C4811926ABC`

The verified cancellation-control branch is specific to retained parallel `activeAttempts`. The serial path is covered here for ordinary stop/closing through `entry.cancelled`/`closing`, but a serial automatic failure with unresolved ownership and no stop is not separately exercised or claimed by this unit.
