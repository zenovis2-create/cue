# Actual Electron UI attempt 1 — independent artifact audit

Reviewer `/root/broker_review`, 2026-09-12 KST. PASS within the explicitly synthetic-host UI scope. Read existing artifacts, inspected all three screenshots, and reopened the archived SQLite backup read-only. No additional Electron/helper/model execution.

Final aggregate verdict is true: child exit 0 and closed, child checks passed, backup verified, owned root removed, no parent errors. Child PID is 61960. Profile receipt binds both userData and sessionData to the owned root before ready and matches actual Electron getPath values. Reviewer independently confirms that exact owned root now returns ENOENT.

Captured before/after selected-source manifests match, with reviewed proof SHA-256 `402d69e337c03bf54737d053fabca8154c71bb35c06d43efa5316b63bd9ed9da`. Earlier preflight required dual profile binding, exact state assertions, case-insensitive environment scrubbing, and robust parent finalization; the executed proof includes those changes. This selected manifest is not a full protected installation-generation proof.

## Findings from artifacts

- Real renderer/preload/IPC/Core/SQLite were exercised with a synthetic recovery factory. First observation distinguishes matching-alive, PID reuse and unknown; second distinguishes matching-exited, absent and unknown. Each includes present/absent/unknown path states, fixture attribution and observation-only provenance. Saved text matches the exact asserted state labels and timestamp.
- The script holds an A response, prepares/displays B, obtains B's second state, releases A and asserts B remains unchanged. The captured call sequence records the two distinct run IDs. These are synthetic replies, not OS process facts.
- Three screenshots show readable Korean labels and wrapping of maximum-length fixture IDs in the recovery panel. The captured window reports no horizontal overflow and no renderer `process` global. The error screenshot shows generic unavailability and the Stop control; no injected HTML/private error text appears. This is one tested window size, not responsive coverage of all narrow layouts.
- Stop preservation uses a synthetic `renderCard` running display. The script checks the visible/enabled control and current B run identity without invoking approve, execute or Stop. Core ownership remains its original released/zero-attempt state. This is not proof of terminating an active executor.
- Independent backup audit confirms task=2, run=2 (intentional prepare fixtures), and zero session_handle, orchestration_attempt, native_execution_identity and approval_event rows. SQLite integrity is `ok`; backup hash matches the result. The fixture records fetchCalls=0, forbiddenExecutorCalls=0 and no blocked non-file request attempts. No helper, native executor, model, qualification or recovery action was exercised.
- Screenshot hashes independently match `checks.json`. Before/after manifests are equal. No failed historical ledger was modified and no model-call allowance was reused.

## Artifact SHA-256

| Artifact | SHA-256 |
| --- | --- |
| result.json | 2c25dc500f327ad81642973cc3c326e9960da0311ef52607b3deb12a7ec0898a |
| final-verdict.json | a4cea787734dd64cb74b4b86906cadd08f0e8bc35c146a251a0844b2113fb65b |
| checks.json | a79aa058e9a5a4672c5681690c4934bfbcb0da13165f6bf1c48cc9c15979ec5c |
| before.json / after.json | 8e4c2884453afeb2b1145a4b6e12f6c169d432369f219d74649d066e46245d07 |
| ledger-backup.sqlite | e6fb37ab41dc1893c5311376d7e64cf6d754a5e41ae1701fd59457347c481ec4 |

The current prepared/displayed-run UI is covered. A historical-run picker, real protected recovery-host call through Electron, real OS observation and active execution cancellation are outside this proof.
