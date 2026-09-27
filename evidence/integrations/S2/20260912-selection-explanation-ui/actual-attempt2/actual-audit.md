# Selection UI attempt 2 — independent partial-evidence audit

Reviewer `/root/broker_review`, 2026-09-12 KST. Overall FAIL preserved; the two-attempt cap is exhausted. No repeat Electron/helper/model invocation. Read-only backup audit and visual inspection of local.png and monetary.png completed.

## Supported partial path

Two compiled-engine decisions were stored using denied synthetic runtime callbacks. Their database payload SHA-256 values and separate digest columns match both saved snapshots in stored-decisions.json. Local selection records `ranking: not-performed`; monetary selection records ranked producer plus unknown-estimate exclusion using synthetic TEST policy values. These are historical explanations, not measured model quality/cost or execution qualification.

The script reached both actual Core completion → IPC → renderer comparisons and screenshots before failing later. The screenshots visibly distinguish local fixed-pair/no-ranking explanation from monetary policy comparison, retain unverified acceptance and unknown cleanup, and show the check stage not started. Repeated local status preserves open disclosures; switching to the second run closes them according to the assertions that precede the failure. The screenshots contain nested scroll areas and do not expose all candidate rows at once; they are partial visible evidence, not full visual coverage.

## Failure diagnosis

Failure occurs at scenarios.mjs:33 in the explicit display-fixture label loop, before its bounded-row/privacy assertions, display-fixture screenshot or Stop-display scenario. The individual missing label is not recorded in failure.json.

Source and database corroborate the fixture ordering diagnosis: ui/orchestration.ts sorts stages by task_id, so `check` precedes `make`; the backup has check pending without an attempt. `base = synthetic.orchestration.stages[0]` therefore supplies selection status `not-started`. The later 61-assessment `many` object spreads that selection and never overrides its status. The renderer deliberately returns before assessment rendering unless status is `recorded`; therefore the fixture cannot display the expected 61/count-truncation labels. This supports a fixture construction error rather than a demonstrated production truncation defect. No actual retry was made to test a correction.

## Independent data and finalization checks

- Backup: task=2, run=2, orchestration_attempt=2, attempt_selection=2; approval_event/session_handle/native_execution_identity each zero. Local invocation reservation=1 is committed synthetic intent, not a provider request count.
- SQLite integrity is `ok`; stored payload hashes and saved snapshots agree. Initial reviewer comparison incorrectly expected digest inside the payload; corrected comparison uses the schema's separate digest column and verifies the payload SHA. This was an audit-script correction, not an artifact change.
- Selected-source before/after manifests agree. Final verdict is false, child exit 1 and closed, backup verified, root removed, no finalization errors. Exact owned root currently returns ENOENT.
- No production executor/helper/provider was invoked by this proof. Later final no-network counters and complete scenario summary were not reached, so they are not presented as completed final assertions.

The primary stored-decision explanation path has partial real Electron evidence. Legacy/invalid/truncated display, privacy edge checks, Stop display and the complete combined UI proof remain incomplete in this attempt. Neither attempt 1 nor attempt 2 is relabelled PASS.

| Artifact | SHA-256 |
| --- | --- |
| failure.json | 28237e47184d556bf72c3487315b8f3adc6a8e373f614f24cb0500ad7d448804 |
| final-verdict.json | c7c80a4e0eea24a3d45088d2d2d167a4863476ea468060d3a6c46d139e0a63a2 |
| stored-decisions.json | 3ca15f4790cd6535be47189827e6c44a68adb523554a8330e39ad71c913bc7f6 |
| local.png | dc132ddfa7819824b3aa2ceadcd58bc7ad051505cbd12a96a37122c1aaa09896 |
| monetary.png | 10c0270ff094cc62c42deb68934abfe1cc942a03af0a1d7e32e484b8c91a4b2b |
| ledger-backup.sqlite | b639b8226fce035d2763ea488d6d81cda459fb8dcbcca5e8bdd9d41139fa0b06 |
