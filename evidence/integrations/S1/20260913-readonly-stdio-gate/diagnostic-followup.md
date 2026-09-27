# Stdio gate diagnostic follow-up

Status: read-only source diagnosis after the single authorized gate was consumed. No runner, client, launcher, production source, or native state was changed.

## Observed boundary

The retained result records launcher status `1`, PID `67984`, exactly one exit frame with exit `1`, exactly one nonce-bound cleanup frame, and `observed: null`. Launcher stderr is empty because the child stdout and stderr handles both target NUL. The post-observations record the original root identity and SDDL, profile count zero, unchanged fixture bytes, and zero accepted controlled-loopback connections. These facts establish that the worker was created and exited without producing `runtime/result.json`; they do not identify the worker-side failure.

## Source paths before `result.json`

The inline command sets `CUE_READONLY_PROBE_EXECUTE` and evaluates the pinned client. Loading the client, parsing/evaluating it, entering `runProbe`, resolving `cwd`/`TEMP`, every synchronous filesystem attempt, `parseProbePort(process.argv)`, and `net.connect(...)` all occur before the only result write. The client writes `runtime/result.json` only from the later socket `connect`, `error`, or timeout callback.

Consequently, any uncaught exception during module evaluation, synchronous setup, port validation, socket construction, or a callback prevents the result. A failure of the result write itself has the same retained shape. The per-operation `attempt` helper catches project/runtime mutation errors, but the initial reads, port parse, socket construction, callback body, and final result write are not covered by one top-level diagnostic boundary. Since both standard output streams are deliberately NUL, ordinary Node exception text cannot narrow these cases.

The changed exit from the earlier `0xC0000142` class to `1` is consistent with reaching a normal Node error path, but it does not prove which source path failed.

## Smallest future discriminator

Before any probe operation, install one top-level error boundary with an explicit stage variable. On a caught startup or callback error, write an exclusive `runtime/diagnostic.json` containing only a fixed schema/version, stage enum, error `name`, bounded `code`, and nonce. Use distinct fixed process exit codes for (a) diagnostic written and (b) diagnostic write failed, so absence of the file is distinguishable from failure to persist it. Register `uncaughtException` and `unhandledRejection` before evaluating the probe body, and route synchronous startup through the same recorder. Keep normal `result.json` exclusive and separate.

An offline test should inject failures at evaluation/setup, port parsing, socket construction, callback execution, and diagnostic writing; reopen the file; validate the exact schema and nonce; and prove the two exit classifications. A later native gate would still require a new reviewed authorization and closure pin. This proposal adds diagnostic evidence only and grants no readiness, permission-boundary, or acceptance authority.
