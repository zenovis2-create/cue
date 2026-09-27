# Independent A03 lifetime-correction actual review

Verdict: **PASS for the bounded A03 public-driver targeted-Stop claim.**

The sole lifetime-correction Windows invocation exited 0. Vitest reports one actual test passed and the platform-independent completion-fence test was filtered/skipped by the exact `-t` selection. The executed test and driver pins match the reviewed sources.

Before Stop, the durable frame identifies two distinct approved runs and their persisted attempt IDs. Each owns an exact controller/grandchild PID plus OS creation timestamp. Both driver snapshots are `running` with null reason, both lifecycles report billing `unknown`, cancellation requests are zero, and the completion set is empty. This rules out the earlier automatic-expiry false start.

After `driver.stop('workflow')`, the target-completed frame records exactly one cancellation request, completion only for the target attempt, and no remaining original target PID/creation identity. During that interval the sibling heartbeat advanced from 416 to 1888 bytes. The sibling's explicit controller and grandchild PIDs remain present with exactly the original creation timestamps. Additional PIDs in the current sibling tree are descendants observed by the Windows process query; they do not replace or weaken the explicit identity checks.

After the sibling's own Stop, the final frame records two requests, both exact attempt IDs completed, and empty original-identity sets for target and sibling. The cleanup frames independently record `remaining: []` for both captured trees, and no cleanup-hook failure occurred. This demonstrates per-run Stop routing through the public driver, completion only after verified local tree termination/child close/exact absence, and survival of the concurrent sibling until its own Stop.

## Limits

The runtime adapter and admission evidence are controlled fixtures. The processes are real local Windows Node trees, but no provider or model was invoked. Lifecycle billing, provider terminal state, provider death, native controller authority, and cleanup remain `unknown`; this evidence does not establish provider cancellation, billing cessation, production model behavior, a Stop latency SLA, or non-Windows behavior. The test duration was 56.918 seconds and is harness timing, not a product performance qualification.

## Evidence pins

- actual log: `b1e6cbc8a2155bb63a448575bf168566a69cf77800de33e15b92301dd23d6553`
- exit receipt: `13bf7b3039c63bf5a50491fa3cfd8eb4e699d1ba1436315aef9cbe5711530354`
- executed test: `f3c7581f213d6851f6a2859c684b0c4c4a4d0a7fbc088f9a9ec80eb0cecae2ac`
- executed driver: `2ed110d994e22910cd9b95deaf5d7a0167c033165c6a41cd7512221277a050f0`
