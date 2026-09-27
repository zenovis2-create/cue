# Attempt 2 — partial observed path, overall FAILED

[Final verdict](actual-attempt2/final-verdict.json) remains `passed:false`; [runner](actual-attempt2/runner.json) exit 1 after 1.6465958 seconds. Both Electron attempts are consumed. No source correction or rerun followed this failure.

The actual stored local and TEST monetary decisions reached real core completion, preload/IPC and renderer. All assertions before `scenarios.mjs:33` passed: exact completion equality with the real core projection, local fixed-pair/no-ranking text, dependent not-started state, unverified acceptance, same-run open-details preservation, other-run closed details, monetary recorded reason and unknown-estimate exclusion, and sentinel source exclusion. This establishes only those reached assertions, not the later overall counts/read/Stop/escaping gates.

Both saved PNGs were opened and directly inspected on 2026-09-12:

- [Local](actual-attempt2/local.png) visibly shows local count uncertainty, unverified acceptance, historical-only disclaimer and the selected producer's fixed pair/no ranking explanation in attempt history.
- [Monetary](actual-attempt2/monetary.png) visibly shows TEST/micro budget with unknown final cost and the stored policy comparison explanation, explicitly not measured quality.

The panel's stage/history lists scroll internally. The first visible stage is the not-started checker. Some lower candidate details are outside these captures, so they are DOM-assertion coverage only. Neither display-fixtures.png nor stop-display.png was produced.

[Failure](actual-attempt2/failure.json) occurs in the subsequent explicitly synthetic rendering fixture's label assertion. Source diagnosis: `base=synthetic.orchestration.stages[0]` selects the checker (observed first in both PNGs), whose selection status is `not-started`. The `many` fixture spreads that status without changing it to `recorded`; the renderer correctly returns before showing assessment count/truncation. This is a fixture construction defect, not evidence that a recorded 50-row projection renders incorrectly. The grouped assertion did not preserve the particular missing label; no claim of an independently rerun diagnosis is made.

[Owned state](actual-attempt2/owned-state.json): PID 83168 closed with exit 1; backup verified, only `D:\Temp\User\cue-selection-ui-df52NL` removed with actual absence, parentErrors empty. [Backup](actual-attempt2/ledger-backup.sqlite) integrity is ok; SHA `b639b8226fce035d2763ea488d6d81cda459fb8dcbcca5e8bdd9d41139fa0b06`. Selected manifest comparison completed without error. No actual adapter/helper/provider was instantiated; two synthetic runtime denials generated the historical decisions. Counts were subsequently read from the retained backup, independently of the unreached final checks.

All original attempt-1 and attempt-2 evidence is retained. No whole UI PASS, genuine execution qualification, live Stop ownership test, or native cleanup claim follows these results.
