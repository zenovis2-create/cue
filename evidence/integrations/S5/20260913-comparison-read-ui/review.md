# Independent comparison-read UI review

## Review contract

- **Done:** independently inspect the bounded comparison-read IPC/type/DOM/UI/test diff and record PASS or actionable findings; then run `node --test --import tsx daemon/test/integration-evaluation-ui.test.ts daemon/test/integration-evaluation-comparisons-core.test.ts` with exit code 0 after the maker declares the change final.
- **Attempt cap:** 2 review/test passes. A second pass is allowed only after a concrete fix or a new hypothesis.
- **Every pass:** check trusted-sender enforcement, workspace-scoped core delegation and cross-workspace rejection, pre-prepare lookup availability, current-run gating for enroll/observe/coverage, hostile getter/proxy containment, DTO field allowlisting and enum/count normalization, and truthful UI behavior for unknown/insufficient/error/stale responses without auto-fetch or action affordances.
- **Failure handling:** report a bounded, reproducible finding to the maker and retry only after the implementation changes; otherwise hand the unresolved issue to the root agent. Keep no reviewer-authored source change unless its measured gate improves.

## Verdict

**PASS.** No blocking source, DTO, workspace-boundary, or DOM truthfulness issue remains in the six-file unit.

## Independent evidence

- Focused safe gate: `npm exec vitest run -- test/integration-evaluation-ui.test.ts test/integration-evaluation-comparisons-core.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1` from `daemon/` — exit 0, 2 files / 9 tests passed.
- After the final product-copy-only revision, proportional DOM gate: `npm exec vitest run -- test/integration-evaluation-ui.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1` — exit 0, 1 file / 8 tests passed. The revised UI hashes match `maker.md`: `index.html` `f1b506d50f436fd9ad1c7e9c3458f1de0de208c9e982a399e7b13e43a393c7d7`, `renderer.js` `386db49d501a33b7e9b1fcd9fa634175784eca81456ca842fa8c40470cbe455a`, and UI test `f70da8c28d826f4e4bd45e4a61d5b7da8d911e11d2e343433f1d6f582e060d1a`.
- Scoped `git diff --check` — exit 0 with line-ending conversion warnings only.
- All six saved full preimages match `preimages.json`; all six final source hashes match `maker.md`.
- The first comparison fixture is available before `cue:prepare`; enroll, observe, and coverage retain the existing prepared/current-run gates.
- The production Core fixture creates a real SQLite comparison, passes its actual null-trial reason/count shape through the registered IPC projection, then reopens the ledger under a foreign worktree and receives only `{ available:false, reason:'evaluation-unavailable' }`.
- Registered IPC handlers retain the shared trusted-sender check. Exact command parsing rejects extra fields, accessors, proxies, invalid IDs, and invalid revisions before Core calls.
- Projection validation uses exact plain records and dense bounded arrays. It rejects accessors/proxies, extra fields, unknown status/mode/reason values, duplicate/missing splits, negative/non-safe counts, promotion eligibility other than false, and statistical qualification other than `not-performed`.
- The returned view omits membership, run/enrollment/observation identities, raw constraints, private source payloads, backend errors, and promotion actions. It retains only bounded descriptive dataset/time/mode/status/split/reason/count data and false promotion eligibility.
- DOM proof covers manual lookup before prepare with enrollment disabled, fixed Korean status/reason text, actual projection/trial/missing/outcome counts, non-promotion language, generic error redaction, and clearing/fencing an in-flight stale response when a new run is prepared. The page performs no automatic comparison lookup.

## Limits

No live Electron, screenshot, native helper, model, provider, network, or local-model QA was run or claimed. The maker-owned build and JavaScript syntax checks already passed after the final source change, so the reviewer did not duplicate them. The current real Core fixture is truthfully `insufficient` because stored projections contain null trials; the UI can describe the other fixed stored status values but grants no statistical or promotion authority.

Status: PASS
