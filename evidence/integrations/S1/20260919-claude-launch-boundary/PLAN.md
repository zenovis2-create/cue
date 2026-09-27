# Claude owned launch boundary

Done gate: `p45.test.ts` S-1/S-3 architecture scan reports no direct `node:child_process` dependency outside `process-launch.ts`; Claude executor/protocol tests pass; Root's coordinated build passes. The Claude command still launches only via `spawnOwned` with explicit env, hidden window and three pipes, preserving session record, identity capture, cancellation, and streaming behavior. No provider/model/account/service call.

Attempt cap: two diagnosed production hypotheses. Every pass: run the named P45 architecture test and focused Claude adapter/protocol tests; inspect exact failures, then ask Root for build. On regression, restore the exact preimage and change hypothesis rather than weaken the architecture gate.

Exact before-edit bytes of `daemon/src/adapters/claude-cli-executor.ts` and its focused test are in `preimages/`. The sole production hypothesis is that the imported `SpawnOptions` type alone trips the architecture source scan even though process creation already uses the owned public spawn API. Remove that direct import and allow the `spawnOwned` call to contextually type the same inline options.
