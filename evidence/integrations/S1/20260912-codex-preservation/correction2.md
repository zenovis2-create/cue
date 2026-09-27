# S1 Unit 1 Codex preservation correction 2 evidence

Date: 2026-09-12
Attempt: correction 2 of 2, final
Status: both independent-review counterexamples resolved in the offline component; independent re-review required

## Corrected boundaries

### Array inputs

`controllerArgs`, `egress`, and `allowed_actions` now pass one shared descriptor-only array validator. It checks, in order, object/null, native proxy identity, Array identity, exact `Array.prototype`, all own descriptors, the own data `length`, the 256-item bound, all `Reflect.ownKeys`, and one enumerable own data descriptor for each canonical index. Only after all structural checks pass does it copy descriptor values.

No caller `some`, `map`, `forEach`, spread, or iterator is used. The hostile fixture covers an accessor element in every array-bearing field and observes `hits=0`, `launch=0`. It also rejects sparse, custom-prototype, oversized, symbol-keyed, extra-property, trapping proxy, and revoked-proxy arrays. Proxy trap count is zero.

### Asynchronous activity sinks

Both `onActivity` and `RuntimeContext.emitActivity` may now return `void | Promise<void>`. Every returned value is normalized into a non-rejecting observed promise with a host-bounded timeout and a 256-entry pending queue. Synchronous throws, asynchronous rejection, queue overflow, and timeout mark activity failed and request the existing cancel path.

The stop promise is installed before invoking `backend.stop()`, so a sink failure caused by the cancel acknowledgement cannot re-enter and call stop twice. Sink failure before the backend is returned marks cancellation; the post-launch fence then stops the backend once. Completion emits its explicit unknown usage fact, seals further callbacks, drains the exact pending queue, and only then decides success. A callback accepted before sealing that rejects or times out makes completion failed. A callback arriving after sealing is ignored and cannot reverse an already returned decision.

The hostile fixture covers synchronous raw sink throw, asynchronous raw sink rejection, asynchronous context sink rejection, and raw sink timeout. Each returns `failed`, performs one stop, and leaves `unhandledRejection` count zero. Failed goal verification remains failed without an unnecessary stop.

### Product composition seam

A synthetic PassThrough app-server now drives `HostCodexRpcSession` through the `HostCodexRuntimeOptions.onEvent` supplied by `createDefaultCodexCandidate().launch()`. The result remains goal-verified, controller output leaves only its digest, raw async activity settles before completion, canonical tool/model inputs remain host-owned, and the candidate retains `host-codex-controller-v1` plus `session-handle-v1`.

No installed Codex binary, provider/model, native helper, Electron process, external network, or worktree command was executed.

## Final measured gates

```text
cwd daemon
npx --no-install vitest run test/integration-codex-adapter-preservation.test.ts test/integration-executors.test.ts test/host-codex-controller.test.ts test/p10c-host-controller.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
4 files / 36 tests PASS / exit 0

npx --no-install vitest run test/integration-runtime-contract.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
1 file / 18 tests PASS / exit 0

npx --no-install tsc -p tsconfig.json --noEmit --pretty false
PASS / exit 0

npm run build --silent
PASS / exit 0
```

The first typecheck within this correction identified only a TypeScript mapped-type interpretation of the array `length` descriptor and one fixture callback returning `Array.push()`'s number. The final code uses `Object.getOwnPropertyDescriptor(input, 'length')` and a void fixture callback. The hostile suite was already 36/36 green before that static correction and remained 36/36 green afterward.

Scoped `git diff --check` and explicit trailing-whitespace search passed. Git emitted only the existing LF-to-CRLF notices for the two tracked Codex files.

## Final source/test SHA-256

- `daemon/src/host-codex-controller.ts`: `d06b68bef5bc3158c89ae8883bbc3338bf1fe223b01647885a1e34db316539b7`
- `daemon/src/host-codex-runtime.ts`: `22d2217b119f8762b165c8afd7b853f24370b9518e10b7565785ead85364ecaf`
- `daemon/src/adapters/integration-executors.ts`: `5700abe40f8a1d33c32a75e8879331df96f2f9db6fbf51605f19ca07b771d94e`
- `daemon/test/host-codex-controller.test.ts`: `fced2c6bcca430819067ba19b73529cbd9fd536a6b246b70efa4c798e300d55b`
- `daemon/test/integration-executors.test.ts`: `87d083f515fe47d3c542402350fd3d27d5f753363225adbecfb6bcc7622e7071`
- `daemon/test/integration-codex-adapter-preservation.test.ts`: `62d937542b83cb2f1f94cf70b50694bf400f2b3e0bb6702a8879520668e9e607`

## Limits and review request

This final correction asks the same independent reviewer to rerun the exact accessor-array and asynchronous raw-sink counterexamples plus the prescribed gates. The maker claims only that the offline component counterexamples are resolved. Checklist line 51 remains open for actual installed Codex behavior, authentication, current P13, provider/model execution, provider terminal state, billing finality, remote cleanup, and restart evidence.

If independent re-review finds either counterexample unresolved, the correction cap is exhausted and the component must remain FINAL BLOCKED. There is no third mutation pass.
