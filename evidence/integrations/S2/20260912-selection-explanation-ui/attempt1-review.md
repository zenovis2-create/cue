# Attempt 1 — FAILED fixture state precondition

[Final verdict](actual-attempt1/final-verdict.json) is `passed:false`. The [runner](actual-attempt1/runner.json) exited 1 after 1.4270051 seconds. No screenshot or UI selection assertion was reached. No automatic retry was performed.

The [failure](actual-attempt1/failure.json) is `run_not_running` at compiled orchestration store claim. Real core.prepareGoal creates an awaiting-approval parent task. The source unit fixture that this proof adapted explicitly creates its parent task as running; the proof omitted that synthetic prerequisite. The engine's guard correctly refused the claim before runtime dispatch. This is a QA fixture mismatch, not evidence that selection persistence or rendering failed.

The next hypothesis, subject to separate root authorization, is to explicitly transition only the owned synthetic fixture task to running after pre-execution policy binding and before the direct compiled engine call. Such fixture state must be documented as synthetic; it must not imply a user approval or real execution. No production guard should change.

[Owned state](actual-attempt1/owned-state.json): PID 81892 closed with exit 1, independent SQLite backup verification passed, and only the owned root `D:\Temp\User\cue-selection-ui-gD9fRv` was removed with actual absence verified. Parent errors are empty. The original failure, backup, manifests and attempt marker remain. The run stopped before either synthetic runtime start or any actual adapter/helper/provider invocation. No UI PASS or current qualification is claimed.
