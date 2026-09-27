# Independent Sol artifact audit — evaluation UI follow-up attempt 2

Date: 2026-09-12 KST  
Verdict: **PASS for the existing evaluation enrollment / observation / coverage UI path**

## Review contract

Done means an artifact-only comparison of the attempt-2 proof, checks, manifests, guards, backup/cleanup receipts, scenario assertions, and three saved PNGs against the approved narrow QA scope. Current relevant file hashes and screenshot hashes must match the frozen manifests. Maximum review corrections: 2. Each pass checks the written claims against the JSON receipts and direct PNG inspection. No Electron, preflight, model, helper, provider, native, or network process is executed. Only this review file is owned.

## Independent findings

The three PNGs support the declared visual behavior:

- `form-registered.png` visibly shows the evaluation panel expanded and populated with case, holdout, policy, metric, environment, and account-limit fields. The long form extends beyond one viewport, so the image proves the visible middle section rather than every field; the scenario supplies the complete locked-field assertion.
- `observation-revision2.png` visibly shows observation `qa-observation-2`, revision 2, outcome `unknown`, quality `null`, elapsed `null`, and the host-recorded timestamp. The adjacent copy explicitly avoids claiming success or improvement.
- `coverage-current-membership.png` visibly shows current membership with expected 2 and registered 2, the observed evaluation member, and holdout member `qa-unobserved-member` marked unobserved. The copy explicitly says this is not promotion, testing, or an improvement decision.

All screenshot SHA-256 values independently match `checks.json`. Visibility receipts report nonzero targets intersecting the 939-pixel viewport. The registered-form target spans beyond the viewport, consistent with the declared partial-form limitation rather than a hidden or closed panel.

The machine-readable receipts agree on the exercised boundary. `checks.json` records exactly 5 evaluation IPC calls and 9 Core evaluation calls, with 2 tasks, 2 runs, 2 enrollments, and 2 observations. Approval events, orchestration attempts, session handles, native execution identities, approve calls, execute calls, stop calls, and fetch calls are all zero. The request list is empty. Replay preserves one observation row and unchanged `total_changes`; revision 2 creates the second row.

The 23 ordered guard calls cover post-import state, both synthetic policy/enrollment preparations, all five IPC calls, all nine Core evaluation calls, final acceptance, and cleanup. `result.json`, `final-verdict.json`, and `owned-state.json` agree that PID 101916 exited 0, the window/process closed, backup integrity passed with SHA-256 `c48c7077d505ca602aafdfd1d12b15dcb54de8e00a9b06a5dd4da31680aa7182`, and the exact owned root `D:\\Temp\\User\\cue-evaluation-followup-Rkihpd` was removed. No parent errors are recorded.

The complete current relevant source/build/proof file set independently matches `after.json`; `before.json` and `after.json` are identical. This supports the frozen-source and no-product-mutation claim for the unit. The empty `process.log` does not independently prove absence of external calls, but the zero counters, empty request list, guard sequence, database counts, scoped harness receipts, and successful owned cleanup are mutually consistent and disclose no contradictory activity.

Attempt 1 remains a historical visual FAIL because its three images showed a closed panel. The earlier offline realm-adapter failure also remains preserved. Attempt 2 does not rewrite or convert either historical failure.

## Scope boundary

This PASS covers the existing current renderer → preload → trusted IPC → Core enrollment, observation replay/revision, and current-membership coverage UI against an isolated synthetic pending-run fixture. It does not establish user approval, execution qualification, measured task success, a real trial, improvement, promotion, provider/model behavior, or network behavior.

It also does not review or approve the new authoritative-accounting component, wire accounting into Core, remove Core containment, or complete S5 measurement. The synthetic holdout and policy bindings remain QA context with `claimed-not-verified` input binding.

`requiresIndependentSolArtifactAudit` is satisfied by this separate review artifact. No product or preexisting evidence file was changed by this checker.
