# Held startup-order correction

Recorded before source revision 3.

Done means the reopen child calls production `holdInterruptedJournalRecoveries` before production `reconcileInterruptedWrites`, and its raw frame plus parent assertions bind one held row to the original attempt/change set with state `held`, revision 0, reason `interrupted-native-journal`, valid stored payload digest, no final seal, and one initial held transition. Reconciliation must still leave the publication pending, root/attempt blocked, lease held, acceptance/receipt/result/replacement/execute zero, and actual bytes unchanged.

Scope is the existing two new test files plus this evidence directory. This remains a direct final-publication store fixture with synthetic SQLite lineage and an explicit production startup-function sequence; it does not exercise the public orchestration driver or full daemon ownership acquisition.

Correction cap: one offline revision. Every implementation pass runs fixture `node --check`, repository `tsc --noEmit`, and the environment-skipped focused Vitest file, preserving raw stdout/stderr and exit. Failure hands back with no actual run. Actual cap remains the original unused 1, only after independent clearance and root coordination.
