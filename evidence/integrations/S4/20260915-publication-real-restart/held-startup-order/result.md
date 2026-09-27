# Actual result

Verdict: PASS, sole actual attempt 1/1, no retry.

Command: `CUE_ACTUAL_PUBLICATION_RESTART=1 npx vitest run test/integration-driver-publication-real-restart.test.ts test/integration-driver-publication.test.ts test/integration-final-publication.test.ts test/integration-recovery.test.ts test/integration-orchestration.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`

Terminal result: 5 test files passed, 34 tests passed, exit 0.

The raw effect frame records exact child PID 83012/creation time, committed native existing-file replacement, publication intent count 1, result count 0, and resulting SHA-256 `539958af7ce9abb3bfa052361f8dcc5385349b73acf111a3667605c6a8104a4c`. The parent verified that exact identity absent after termination.

The raw reopen frame records distinct PID 67968/creation time, hold-before-reconcile result bound to the original attempt/change set, held state/revision/reason and payload digest, one initial transition, pending publication replay, blocked root/attempt, retained lease, real `AM final.txt`, preserved bytes/digest, and zero replacement/receipt/acceptance/result/decision/activation/authority/execute counts.

Source hashes before and after the command are identical. Cleanup ran as part of the passing Vitest lifecycle, but the harness emits no distinct cleanup JSON frame; the terminal pass is the available cleanup evidence.

This proves only the direct-store, synthetic-lineage boundary and explicit production hold/reconcile sequence. It does not prove public-driver or full daemon-ownership startup behavior and does not independently close all A04/S4-05 requirements.
