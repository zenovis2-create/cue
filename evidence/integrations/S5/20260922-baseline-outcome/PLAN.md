# Batch91 — manual baseline recorded outcome and admission integrity

2026-09-22, direct implementation/self-review only. Qwen OFF, subscription4/4 exhausted, no live provider/account/model calls or delegation. Preserve dirty work and prior evidence.

Inspection before UI connection found a concrete prerequisite defect: trial projection compares recorded policy.mode to enrollment.arm even when arm is manual-baseline (not a mode). Reproduce with a real pinned-policy baseline declaration, installed plan, terminal task outcome and immutable observation. Fix without accepting forged baseline authority or weakening ordinary mode matching.

Also audit baseline admission: authority callbacks currently precede policy/run eligibility checks, and checks precede the write transaction. Require invalid candidate/policy/run/cohort requests to refuse before user authority; recheck inside IMMEDIATE transaction after external confirmation; contain reentrancy. No callback true may grant execution or overwrite prior state.

Tests: red positive baseline recorded-outcome chain; malicious/missing declaration; recorded wrong policy mode/digest; replay/reopen and comparison visibility; preflight callback0; callback changes DB, reentrant calls, post-callback run activity. Preserve failing logs. At most two correction hypotheses per unchanged failure. Build, focused and coupled evaluation/Core/UI regression, exact source hashes and docs overlay. No claim of measured trial/performance/manual-baseline UI completion or independent review. Parent33/44 unchanged unless full original requirements actually met.
