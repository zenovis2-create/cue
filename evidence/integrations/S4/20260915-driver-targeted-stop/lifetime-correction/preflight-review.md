# Independent A03 lifetime-correction preflight

Verdict: **CLEAR for the single root-coordinated lifetime-correction OS attempt.**

The correction is confined to fixture lifetimes and pre-Stop evidence. The local policy and task window are now 120,000 ms, the launch window is 30,000 ms, and the envelope is valid for 180,000 ms. These values satisfy the driver's configured upper bounds and the local rule that launch/task limits do not exceed the policy timeout. They cover the previously observed multi-second Windows process-tree queries without changing any product timeout or claiming a product latency target.

Before the explicit Stop, the test now reads and synchronously records both driver snapshots and both attempt lifecycle records alongside exact process identities. It requires each run to be `running` with `reason:null`, requires `cancelRequests === 0`, requires the completion set to be empty, and requires billing to remain `unknown` for both attempts. Automatic deadline or task-timeout cancellation can therefore no longer be mistaken for the explicit per-run Stop result.

The previously reviewed completion fence remains unchanged: request entry is separate from per-attempt completion, which is published only after verified tree termination, child close, and exact PID/creation-time absence. Target absence, sibling exact PID/creation survival, sibling heartbeat advancement, second Stop, final absence, durable frames, and fail-closed canonical cleanup remain present.

Reviewed test SHA-256: `f3c7581f213d6851f6a2859c684b0c4c4a4d0a7fbc088f9a9ec80eb0cecae2ac`.

The 60-second Vitest bound is narrower than the fixture policy/envelope windows and is a harness cap. A timeout remains a failed attempt rather than evidence of product latency. No OS test, build, product edit, provider, model, Electron, or network call was performed during this review.
