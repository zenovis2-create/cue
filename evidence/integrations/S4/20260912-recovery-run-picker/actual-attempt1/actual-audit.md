# Historical picker actual attempt 1 — independent audit

Reviewer `/root/broker_review`, 2026-09-12 KST. PASS within the synthetic persisted-metadata UI scope. Read existing proof, fixture/scenarios, Node preflight and Electron evidence; directly viewed all three PNGs; reopened archived SQLite read-only. No additional Electron, helper, native or model invocation.

## Verified evidence

- Final aggregate verdict true, child PID 41524 exit 0 and closed, backup verified, disposable root removed, no parent finalization errors. Both userData/sessionData profile bindings match actual Electron paths. Reviewer independently confirms the exact owned root currently returns ENOENT.
- The proof captures a genuine installation generation before dynamic Core/host imports (the builtin profile bootstrap was imported earlier). Guard receipt and final checks share digest `f76e3337aa0d4b32a277d394086efe34eaaa361bba67b4a1c4e526e931ef0d9e` and report current=true. The captured selected-source before/after manifests match. Executed proof SHA-256 is `31deb1294807f59ff80a19624d611949ccce0886fcb8c5b09310ad91f54caf06`.
- The genuine protected host performs exactly three run-list calls and one identity-list call. Observe and execute counters are zero; fetch calls and non-file request attempts are zero. The wrapper only delays delivery of one unchanged protected-host list result. It supplies no fabricated list payload.
- All three saved run lists contain only the two selected-workspace parent runs A/B. The foreign-workspace and structural child fixtures are excluded. Both entries correctly report no recorded native identity. A has one synthetic attempt with a structural stage link; B has none. Those are unverified metadata counts, not trustworthy stage provenance or OS state.
- The scenario checks that selecting A does not automatically read identities, explicitly reading A returns the empty-identity message, later current B updates do not reset historical A, and explicit follow returns to B. A delayed old list does not replace the new list. Stop is a renderCard display fixture: the current B identity remains unchanged while inspecting A, and no actual Stop is invoked.
- The script asserts unchanged total_changes over the read scenario. Independent backup inspection confirms task=4/run=4/orchestration_attempt=1 and session_handle/native_execution_identity/approval_event=0, plus SQLite integrity `ok`. Backup bytes match the final receipt. This supports read-only behavior; the four prepared/structural records are intentional fixture writes before the scenario.
- Node-only preflight result separately reports success, closed/removed owned state, backup integrity and zero fetch calls. It is a fixture/API prerequisite check, not the Electron result or native observation proof.

## Visual inspection

`run-list.png` shows two readable wrapped entries, metadata-only warning and explicit selection controls. `historical-empty.png` clearly marks historical A, allows return to current and states that no stored identity exists. `stop-historical.png` shows the Stop control alongside historical A, consistent with the separate current-run identity assertions. No additional arbitrary window sizes or real active-executor cancellation are covered.

The test exercises real Core/protected metadata host/IPC/preload/renderer with a synthetic database. It does not validate actual stage provenance, saved native identity resolution, OS cleanup, execution approval, full restart restoration or qualification. Nothing in this PASS resolves old failed workflows or grants recovery authority.

## SHA-256

| Artifact | SHA-256 |
| --- | --- |
| final-verdict.json | a4cea787734dd64cb74b4b86906cadd08f0e8bc35c146a251a0844b2113fb65b |
| checks.json | 2cd09883f5bbf32f9af5897f0ee02a88f28ba1506cbc0af7ef8d7786e88583c9 |
| scenario.json | e0921d24ece8bfe5709e32288f60049692a71b1d02985997c35854d235eebff8 |
| before.json / after.json | 32638766543c147388022e2b2501224cfc7049151ff5b22ada8d80a675011d23 |
| ledger-backup.sqlite | edcb0bcb3e453c696a2c1eacdf97fd78a6f9505d658ee2560901e33f6846fa27 |
| run-list.png | c6cdd4e0a852d22b1575ab96044a9cacf718b2f6a362db7f2ccfcaf36341a0f6 |
| historical-empty.png | 30376e585ecb39b9d6d06f94cb4bf656b6f0bbadbc5ab078349ff57b4dd3697b |
| stop-historical.png | 638885ca478096d39e03db66582ba28bfafa63feca4a55af737feccb6413a7a7 |
