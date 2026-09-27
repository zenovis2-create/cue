# Automatic approved recovery result

PASS for the bounded opt-in driver feature. The independent review passed the declared four-file, 61-test gate and the root daemon build exited 0 (`8b9e9b`, build.json).

Prepare-time `recoveryMode: automatic-approved` is frozen into the approval summary and requires existing retry/requirement authority and a trusted recovery host. The driver derives and persists receipt-bound decisions, continues approved retries/switches within the current promise, waits for quota reset, and blocks on stop or a replan needing an explicit plan. Deferred replan metadata supports explicit continuation. Shared admission fences preserve cancellation, reentrancy, held/evidence checks, cumulative limits and the original absolute deadline.

The default is manual. The default generated-JSON host has no trusted recovery observation callbacks and gains no automatic recovery qualification from this change. Tests use real SQLite and the driver with injected runtimes; they do not prove live provider execution, billing, native cancellation or whole-project completion.

The original maker.md is historical incomplete-phase evidence (58/59 then 60/61). The deterministic deadline-fixture handoff corrected the timing test and passed 61/61; prior failures are preserved. Document scorecard values in contract-check.md are historical drafting checks, not current readiness or runtime evidence.

Final independent review SHA-256: `F02200163E2D7AF048E825815F56D7FF80CAE7A0543AB1F8FFDAF40839A7680C`.
