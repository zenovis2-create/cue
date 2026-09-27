# S5 Unit 1 done contract

Date: 2026-09-12 KST

- Done means: migration 034 is registered and source/dist identical; the Unit 1 focused six-test suite, `npm run build`, `tsc --noEmit`, fresh and pre-034 file-backed close/reopen plus `foreign_key_check`, tamper probes, and owned-file `git diff --check` pass.
- Attempt cap: 2 correction passes.
- Every pass runs the complete gate above.
- Failure handling: record a new concrete counterexample and hypothesis before retrying. Keep a change only when the measured gate improves; roll back a regression. After two failed correction passes, preserve the blocker for human review.
- Scope: Unit 1 files only. No provider/model/native/Electron/network/paid calls, credentials, campaign, trial-v2, comparison-v2, promotion, or rollback changes.

