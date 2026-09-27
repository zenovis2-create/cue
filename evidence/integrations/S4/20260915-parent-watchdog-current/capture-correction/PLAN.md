# Parent-watchdog raw capture correction

## Diagnosis

Installed Vitest 4.1.11 reports `--disableConsoleIntercept` with default `false`. The project config does not override console interception. The first successful gate used the default, so the passing test's `P12_PARENT_DEATH_IDENTITY` console record was absent from parent stdout despite 10/10 success.

The prior runner, result, and log are preserved under `preimages/`.

## Changed capture contract

One new OS attempt is allowed only after root's next final build/freeze signal.

- Invoke the same five tests with `--disableConsoleIntercept --reporter=verbose --fileParallelism=false --maxWorkers=1`.
- Require exactly one full `P12_PARENT_DEATH_IDENTITY <json>` line.
- Validate positive parent/wrapper/worker PIDs, bounded nonnegative latency, nonempty before identities, and `originalWrapperAlive:false`, `originalWorkerAlive:false`, `wrapperAlive:false`, `workerAlive:false`.
- Query the count of `cue.worker.*` AppContainer profiles immediately before and after the gate through a read-only PowerShell registry query. Require both queries to succeed and counts to match.
- Preserve full stdout/stderr and the parsed identity/profile observations.
- Use a new canonical direct-child `cue-parent-watchdog-capture-*` TEMP/TMP base. Remove only that verified non-reparse base after all gate and profile assertions pass.
- Re-pin selected source/dist/tests before and after and require equality.

No product/test/build changes, provider/model/network/native change helper, or broad process cleanup.

