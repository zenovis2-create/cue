# Actual Electron recovery UI observation

Attempt 1 passed the aggregate [final verdict](actual-attempt1/final-verdict.json): child exit 0, normal close, independently verified SQLite backup, actual owned-root absence, and no parent finalization errors. [Runner receipt](actual-attempt1/runner.json) records 1.4163389 seconds. No rerun was performed.

The actual renderer, preload, IPC, core and SQLite ran with a synthetic recovery factory. Two intentional, unexecuted prepared runs exercised explicit list/observe requests, matching-alive / matching-exited / PID-reused / absent / unknown labels, three path states, fixed observation time, fixture provenance, discarded late run-A responses after run B, and unavailable/error handling. [Checks](actual-attempt1/checks.json) record task=2, run=2, sessions=0, attempts=0, identity rows=0, approvals=0, fetch=0, executor=0 and no non-file requests. Ownership and SQLite changes remained unchanged during the observation scenarios after preparation.

All three PNGs were opened and directly inspected on 2026-09-12:

- [First observation](actual-attempt1/first.png): long IDs wrap inside the panel; all six process/path labels and fixture timestamp are readable. The observation-only disclaimer and uncertain path provenance remain visible.
- [Second observation](actual-attempt1/stop-preserved.png): current run B and exited/absent states replace run A. This viewport focuses on the observation panel; Stop itself is outside its crop.
- [Error with Stop](actual-attempt1/error.png): generic failure text replaces observations, while the red execution-stop control remains visibly available. No hostile markup or sentinel path appears in the recovery panel.

Stop ownership coverage uses a labeled `renderCard` completion double, not a real running executor. No approve, execute or Stop API was invoked. No native recovery helper, AppContainer, model, provider or qualification ran. The fixture's real database remained released; this is not proof of native cleanup or live execution ownership release.

[Profile binding](actual-attempt1/profile-binding.json) confirms both userData and sessionData were bound before readiness to the exact owned paths. [Owned state](actual-attempt1/owned-state.json) records PID 61960 exit 0 and removal of only `D:\Temp\User\cue-recovery-ui-u0LqSu`, with actual ENOENT verification. [Backup](actual-attempt1/ledger-backup.sqlite) integrity is `ok`, SHA-256 `e6fb37ab41dc1893c5311376d7e64cf6d754a5e41ae1701fd59457347c481ec4`.

The approved proof SHA-256 was `402D69E337C03BF54737D053FABCA8154C71BB35C06D43EFA5316B63BD9ED9DA`. [Before](actual-attempt1/before.json) and [after](actual-attempt1/after.json) selected-file manifests matched. This guard covers only those selected files, not an entire installed generation or arbitrary write-and-revert detection. Product code was unchanged by this QA unit; preparation preimages and exclusive attempt marker are retained.
