# Scoped actual evaluation UI review

Attempt 2 passed the automated data/ownership gates and direct inspection of all three saved PNGs. Attempt 1 remains a visual **FAIL** in its separate [visual review](actual-attempt1/visual-review.md); its raw automated passed result has not been altered. Historical failures in the earlier evaluation UI unit also remain unchanged.

The diagnosed correction was confined to this QA harness: click the real evaluation panel summary, reject closed/hidden ancestors before each capture, require a nonzero target rectangle intersecting the viewport, then wait for two renderer animation frames and a bounded host settling interval. The pure [visibility preflight](visibility-preflight.json) tested closed-ancestor rejection and zero-rectangle rejection with explicitly synthetic JSDOM geometry; it does not prove actual paint. Both changed modules passed `node --check`.

Direct PNG inspection:

- [Registered form](actual-attempt2/form-registered.png): the form is visibly expanded and its populated policy/case/metric controls appear. The long form exceeds one viewport; the screenshot shows its middle portion, not every field. Complete values and locked controls are checked in the DOM scenario.
- [Observation revision 2](actual-attempt2/observation-revision2.png): revision 2, result `unknown`, quality `null`, elapsed `null`, and host observation timestamp are visible, with explicit no-success/no-improvement wording.
- [Current membership coverage](actual-attempt2/coverage-current-membership.png): expected 2 / registered 2, the observed evaluation member and unobserved holdout member, and the no-promotion/no-test/no-improvement qualification are visible.

Actual current renderer → preload → trusted IPC → Core → compiled evaluation stores ran against an isolated SQLite fixture. There were exactly 5 evaluation IPC calls and 9 Core evaluation calls; two pending runs, two enrollments and two observations. Replay did not add a row or database changes; revision 2 added the second observation. No approval, execution, Stop, native helper, adapter, provider, model, credential, or network operation occurred. The second pending member and local policy/plan bindings are explicitly test-created context, not actual user approval or measured task success.

The genuine installation guard was captured before dynamic Core/compiled imports, with 23 successful checks including cleanup; selected source/build/proof hashes were equal before and after. This is a frozen-generation QA check, not protection against arbitrary write-and-revert or qualification of live execution. Product files were unchanged by this unit.

PID 101916 exited 0. The final aggregate receipt confirms window/process closure, independently checked SQLite backup integrity/hash, and ENOENT-verified removal of exactly `D:\Temp\User\cue-evaluation-followup-Rkihpd`. Backup SHA256: `c48c7077d505ca602aafdfd1d12b15dcb54de8e00a9b06a5dd4da31680aa7182`. See [aggregate receipt](actual-attempt2/final-verdict.json), [owned state](actual-attempt2/owned-state.json), [checks](actual-attempt2/checks.json), and [runner](actual-attempt2/runner.json).

This maker-side visual inspection is recorded separately from the raw automated result and awaits the parent/independent artifact audit. Both authorized actual attempts are consumed; no further execution is proposed.
