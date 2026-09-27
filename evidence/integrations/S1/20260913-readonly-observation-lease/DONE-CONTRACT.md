# DONE contract — read-only observation lease hook

This contract was recorded immediately after the initial source insertion rather than before it; that process deviation is preserved. No verification had run when it was written.

Done means the new focused observation-lease test and the existing terminal-wait regression pass, the embedded C# compiles through the executable test, `npm run build` succeeds, source/dist launcher bytes match, and `git diff --check` passes. Behavioral cases must cover acquire readiness before resume, refusal/throw with zero resume, resume failure, normal/cancel/timeout/parent/error terminal release, termination/death failure retention, observer false/throw, dispose failure, and unchanged default null-provider invocation.

Correction cap: two total. Every pass runs both focused tests plus build/parity/diff checks. Failure requires a new measured hypothesis or handoff.

The hook is internal and optional. It supplies no concrete WFP provider, accepts no CLI/payload authority flag, and does not itself prove whole-job death. No live worker, WFP, network, model, provider, policy, or elevation operation is authorized.

A future provider must be exception-safe during acquisition: if it allocates observer state and throws before returning an owned lease, it must clean or quarantine that partial state itself. The launcher can terminate and verify its suspended process in this case, but cannot retain resources the provider never returned.
