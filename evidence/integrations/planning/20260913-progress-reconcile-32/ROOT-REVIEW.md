# Root reconciliation audit 32

PASS for the documented bounded changes. Maker and independent checker remained separate for both implementation units and the static source refresh.

- Driver early change exclusion: independent 2 files / 41 tests. Actual moved and modified observations use the production driver and real SQLite/change stores. Unverified cleanup already prevents ultimate retry; the new assertion proves earlier change-specific exclusion, while modified reaches the existing downstream evidence gate. Other unsafe statuses are source-inspected, not additional actual-driver scenarios.
- Held admission: independent policy/admission 12 tests plus maker related held/retry 12 distinct tests. Shared integrity and deterministic-seal checks cover decision issuance, replay, revision application, and final decision-backed replacement claim. This does not establish live reconciliation, eligibility creation, or complete driver dispatch.
- Shared daemon build: tool `74192e`, exit 0; receipt is retained in `../../S7/20260913-recovery-source-refresh/build.json`. The six scoped test files contain 65 distinct passing tests; this is not a current full-suite result.
- Static source refresh: one invocation `4e0633`, exit 0, ready true, reused false. Independent review verifies generation `5454b1feec206768a1ad3845310e224d9285499acb41a22364293820c68d3b3a`, 165 current source files, 374 declared edges, five artifacts, stable 127-entry Git basis, and 48 unchanged historical files. C#/PowerShell and runtime behavior are excluded.
- Root audit `57d95d` independently matched all four document hashes to RESULTS.md, all three final review hashes, and 373 local document references with zero missing targets. Scoped document whitespace check `a5f9ff` exited 0. Scoped source whitespace check `bd4f07` also exited 0; hash and artifact reviews cover the shared untracked sources beyond Git diff visibility.

The previous WFP smoke remains FAILED/CLOSED with its one-shot consumed and retained evidence. No native/model gate was rerun. GOAL was read again and remains usageLimited and unfinished; no broad S0-S7 completion is claimed.
