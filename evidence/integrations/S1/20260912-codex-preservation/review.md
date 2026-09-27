# S1 Unit 1 Codex adapter preservation independent review

Date: 2026-09-12 KST
Final reviewer verdict after correction 2/2: **PASS — offline component only**

The initial **BLOCKED** review and its exact counterexamples remain preserved later in this file. The final-cap correction resolves both counterexamples on the current hash-bound source. No further offline blocker was found.

## Final correction 2/2 independent re-review

The source/test hashes at handoff exactly matched `correction2.md`. I reran both prior counterexamples against the compiled adapter carrying those bytes:

```json
[{"field":"controllerArgs","hits":0,"launched":0,"error":"invalid_executor_controller_arg"},{"field":"egress","hits":0,"launched":0,"error":"invalid_executor_egress"},{"field":"allowed_actions","hits":0,"launched":0,"error":"invalid_executor_action"}]
```

All three array-bearing fields now reject an accessor element without invoking it or launching the backend. The shared validator checks native proxy identity, ordinary Array prototype, bounded own data length, exact own keys, density, and index data descriptors before copying descriptor values. The focused hostile test also confirms sparse/custom-prototype/oversized/symbol/extra-property arrays and trapping or revoked proxies are rejected with `launch=0` and proxy trap count `0`.

The prior asynchronous raw-sink fixture now produces:

```json
{"completion":"failed","stops":1,"unhandled":[]}
```

Both `onActivity` and `RuntimeContext.emitActivity` now accept `void | Promise<void>`. Synchronous throws, rejection, queue overflow, and bounded timeout poison completion and request the existing stop-once path. The completion path seals later callbacks, emits the unknown usage fact, drains the accepted pending queue, and decides success only afterward. Installing the stop Promise before `backend.stop()` prevents sink-failure re-entry from stopping twice. No unhandled rejection or false success remained in the direct reproduction or hostile suite.

The correction retains the default composition seam: `createDefaultCodexCandidate` constructs `createCodexExecutor(host)`, and the synthetic PassThrough controller test drives bounded output/terminal events through the candidate launch and waits for the async raw sink before success. Host-owned tool/model identity, launch snapshots, `cue_workspace`, goal verification, cancellation semantics, teardown order, `host-codex-controller-v1`, and `session:<handle>`/`session-handle-v1` remain intact.

### Independent commands

From `daemon`:

```text
npx --no-install vitest run test/integration-codex-adapter-preservation.test.ts test/integration-executors.test.ts test/host-codex-controller.test.ts test/p10c-host-controller.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
4 files / 36 tests PASS / exit 0

npx --no-install vitest run test/integration-runtime-contract.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
1 file / 18 tests PASS / exit 0

npx --no-install vitest run test/integration-codex-adapter-preservation.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1 -t "rejects hostile arrays|fails completion on goal-verification"
1 file / 2 selected tests PASS / 5 skipped / exit 0

npx --no-install tsc -p tsconfig.json --noEmit --pretty false
PASS / exit 0
```

I did not duplicate `npm run build --silent`: the user explicitly allowed the maker build to stand when verified hashes matched. All six current hashes match the correction evidence exactly, and the deployed adapter was independently inspected for the new descriptor-only validator and bounded activity queue before the direct Node counterexamples ran. Maker's hash-bound build result is PASS / exit 0.

Scoped diff and whitespace inspection found no error; only the repository's existing LF-to-CRLF notices appeared. Source/test hashes were unchanged after the independent commands:

| File | SHA-256 |
|---|---|
| `daemon/src/host-codex-controller.ts` | `d06b68bef5bc3158c89ae8883bbc3338bf1fe223b01647885a1e34db316539b7` |
| `daemon/src/host-codex-runtime.ts` | `22d2217b119f8762b165c8afd7b853f24370b9518e10b7565785ead85364ecaf` |
| `daemon/src/adapters/integration-executors.ts` | `5700abe40f8a1d33c32a75e8879331df96f2f9db6fbf51605f19ca07b771d94e` |
| `daemon/test/host-codex-controller.test.ts` | `fced2c6bcca430819067ba19b73529cbd9fd536a6b246b70efa4c798e300d55b` |
| `daemon/test/integration-executors.test.ts` | `87d083f515fe47d3c542402350fd3d27d5f753363225adbecfb6bcc7622e7071` |
| `daemon/test/integration-codex-adapter-preservation.test.ts` | `62d937542b83cb2f1f94cf70b50694bf400f2b3e0bb6702a8879520668e9e607` |

Checklist line 51 is now **implemented + independently PASS for this offline component**, while the checklist line itself remains open for live evidence. This review does not establish installed Codex binary compatibility, authentication, canonical live provider/model identity, real app-server/worktree behavior, current P13 qualification, provider terminal state, billing finality, remote cleanup, or restart behavior. A client cancel acknowledgement remains distinct from provider terminal and local cleanup. No installed Codex binary, provider/model, external network, native helper, worktree command, or Electron process was invoked.

## Initial review evidence (preserved; superseded by the final re-review above)

The prescribed offline suites, TypeScript gate, and build are green, and most of the preservation contract is present. The unit does not pass independent review because two hostile boundary cases contradict the done contract: an asynchronous raw activity sink can reject while the adapter reports success, and an accessor stored in an array input executes before validation rejects it.

## Initial blocking findings

### B1 — asynchronous `onActivity` rejection is ignored and can coexist with `succeeded`

`daemon/src/adapters/integration-executors.ts:100` declares the raw activity sink as returning `void`, but TypeScript permits an `async` callback where a void-returning callback is expected. At `:124-133`, `emit()` calls `onActivity` inside a synchronous `try/catch` and discards its return value. Only `context.emitActivity` is converted to a tracked Promise. An async `onActivity` rejection therefore never sets `activityFailed`.

An independent compiled-source fixture used a synthetic backend, invoked one bounded output event, made `onActivity` reject asynchronously, and then resolved a valid goal-verified backend result. It produced:

```json
{"completion":"succeeded","rejected":["Error: async sink failed"]}
```

This violates the required “synchronous or asynchronous sink failure cannot yield success” behavior and also leaves an unhandled rejection. The fix needs to type and track the raw sink Promise, include it in completion settlement, and add a hostile test specifically for asynchronous `onActivity` rejection. It must preserve ordinal ordering and prevent late sink settlement from restoring success.

### B2 — accessor array elements execute before the no-getter boundary rejects them

`daemon/src/adapters/integration-executors.ts:46-50` obtains array descriptors, but then calls `input.some(...)`. `Array.prototype.some` reads an element before invoking the callback that checks whether its descriptor has a data `value`; `input.map(...)` would read elements again on the accepted path. This affects `controllerArgs`, `egress`, and `allowed_actions`.

An independent compiled-source fixture supplied an accessor at `controllerArgs[0]`, a synthetic launch function, and no Codex/native/network path. The result was:

```json
{"hits":1,"launched":0,"error":"invalid_executor_controller_arg"}
```

The backend correctly did not launch, but the getter had already executed. That contradicts the done-contract requirement to reject getter inputs before launch/observation. The array copy should be built only from validated own data descriptors, while also rejecting sparse arrays, unexpected keys, custom array shape, and accessor elements. A regression should assert getter hit count `0` for all three array-bearing inputs.

## Preserved behavior verified

- `createDefaultCodexCandidate` in `daemon/src/adapters/integration-executors.ts:190-198` directly constructs its launch function with `createCodexExecutor(host)`. The golden fixture invokes `candidate.launch`, reaches that wrapper seam, retains host-owned tool/model identity, and exposes `host-codex-controller-v1` plus `session-handle-v1`. Repository search found no separate non-test invocation of the factory, so this proves the production-source factory seam, not application-wide activation.
- The wrapper snapshots host binary/model/tool data at construction and owner/envelope/options at per-attempt resolution, checks exact run/worktree binding, forwards the backend and raw result, and requires completed status, no failure kind, and passed goal verification for success.
- The current controller bounds thread/turn/call identifiers with the shared provider-ID grammar, hashes the tool call ID into `call:<sha256>` activity, suppresses foreign/duplicate/late output, rejects duplicate/concurrent/post-terminal calls, and emits no prompt, stderr, auth value, raw call ID, or absolute path in typed activity. Canonical tool/model labels come from the host snapshot rather than provider event labels.
- Pre-abort prevents launch. During-launch abort and repeated cancel make completion non-success and call backend `stop()` at most once. A successful stop emits only `cancel.status=client-cancel-acknowledged`; it does not emit provider terminal or cleanup. A throwing stop rejects cancellation and still cannot produce success.
- The runtime keeps the existing default `['-a', 'on-request', 'app-server']`, clean Codex home/controller workspace, sole `cue_workspace` dynamic tool, owner/envelope binding, before/after goal verification, and RPC → worker stop → worker completion → controller → credential cleanup ordering. Teardown errors convert the runtime result to failure.
- S3 durable identity behavior remains present: the executor exposes `session:<handle>` (`integration-executors.ts:176-178`), the default candidate declares `session-handle-v1`, runtime validates and records the durable reference (`daemon/src/integration-runtime.ts:217-220`), and the driver requires both typed-activity and durable-reference capabilities before returning a candidate. No S3 source was changed by this review.

The typed activity sequence is monotonic within the wrapper and controller late/terminal guards remain in place. Those facts do not cure B1 because the raw sink Promise is outside the tracked set.

## Independent gates

Executed from `daemon` with synthetic/in-memory/fixture paths only:

```text
npx --no-install vitest run test/integration-codex-adapter-preservation.test.ts test/integration-executors.test.ts test/host-codex-controller.test.ts test/p10c-host-controller.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
4 files / 34 tests PASS / exit 0

npx --no-install vitest run test/integration-runtime-contract.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
1 file / 18 tests PASS / exit 0

npx --no-install tsc -p tsconfig.json --noEmit --pretty false
PASS / exit 0

npm run build --silent
PASS / exit 0
```

The mandated `integration-executors` suite opened only its self-hosted `127.0.0.1` HTTP fixture. No external network, installed Codex binary, provider/model, native helper, worktree executor, or Electron process was used.

Scoped `git diff --check` reported no whitespace error; Git reported only the existing LF-to-CRLF warnings for the two tracked Codex source files. The tracked controller/runtime diff, complete new adapter/tests, and relevant P10C controller tests were reviewed. The six owned source/test hashes were identical before and after all gates:

| File | SHA-256 |
|---|---|
| `daemon/src/host-codex-controller.ts` | `d06b68bef5bc3158c89ae8883bbc3338bf1fe223b01647885a1e34db316539b7` |
| `daemon/src/host-codex-runtime.ts` | `22d2217b119f8762b165c8afd7b853f24370b9518e10b7565785ead85364ecaf` |
| `daemon/src/adapters/integration-executors.ts` | `165c78cfc6728003cc427ccd5224c220c2a423280b6390ae4e6af6961fab5f89` |
| `daemon/test/host-codex-controller.test.ts` | `fced2c6bcca430819067ba19b73529cbd9fd536a6b246b70efa4c798e300d55b` |
| `daemon/test/integration-executors.test.ts` | `87d083f515fe47d3c542402350fd3d27d5f753363225adbecfb6bcc7622e7071` |
| `daemon/test/integration-codex-adapter-preservation.test.ts` | `b906114a2c43e88f9f387970b435289080bab903147edf5c8463a3877e444414` |

## Initial checklist line 51 and evidence limits

Checklist line 51 remains **open: implementation present, offline component BLOCKED in independent review, live completion external-blocked**. The factory/wrapper, launch preservation, controller sanitization, cancellation semantics, goal verification, teardown, and S3 durable-reference path have offline evidence, but B1 and B2 prevent the Unit 1 component from being called PASS.

Even after those blockers are corrected, this unit cannot establish actual installed-Codex compatibility, canonical installed binary/provider/model identity, authentication behavior, app-server wire compatibility, real dynamic-tool execution, provider-side terminal state, billing finality, remote cleanup, restart behavior, or current P13 qualification. Those claims require a separately authorized, frozen live/P13 evidence unit. A client cancel acknowledgement remains distinct from provider terminal and local cleanup.
