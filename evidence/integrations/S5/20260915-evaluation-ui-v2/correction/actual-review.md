# Independent actual Electron artifact review

## Verdict

**PASS for the original S5-01 condition: actual Electron visual verification of the existing evaluation enrollment, observation, coverage, unavailable comparison, and stale-response UI.** This replaces the old failed harness condition through the separately reviewed changed fixture. It does not complete S5 evaluation, produce an actual trial, establish a manual baseline, measure performance/cost, or authorize promotion.

The one allowed attempt ended with parent exit 0. `final-verdict.json` reports child pass, child exit 0, closed process, verified backup, removed owned root, and no parent errors. `result.json` reports a clean Core close, SQLite integrity `ok`, the full expected 26-tag sequence, and no cleanup errors. Selected source, compiled modules, Electron/Node executables, plan, fixture, scenario, and proof hashes are identical before and after.

## Behavioral receipts

- The current renderer loaded through the sandboxed preload and trusted current IPC/Core path in the isolated pre-ready Electron profile.
- Seven evaluation IPC operations occurred: enrollment; successful revision-1 observation; refused/no-write resubmission of the same observation ID with an advanced expected-prior revision; successful revision-2 observation; coverage; unavailable comparison; and a delayed unavailable comparison.
- Nine expected guarded Core evaluation calls occurred.
- Stored state contains three synthetic pending tasks/runs, two enrollments, and two observations. Approval events, orchestration attempts, session handles, and native identities are all zero.
- Approval, execute, and Stop counters are zero. Fetch calls and non-file network requests are zero.
- The delayed public comparison reply returned only after a replacement run was prepared. After two renderer frames, the old unavailable result remained discarded and the current run identity was the replacement identity.
- Backup SHA-256 matches the parent-verified artifact and its SQLite integrity result is `ok`. The exact child closed and the canonical direct temporary root was verified removed.

## Independent visual inspection

All six PNG files were opened at original resolution.

- `form-registered.png` shows a visible portion of the disabled registered evaluation form with the fixed cohort, evaluation/holdout identifiers, local policy identity, metric/environment/account-limit bindings, and disabled enrollment action. It is intentionally a visible-portion artifact, not proof that the entire long form fit one viewport.
- `observation-revision2.png` visibly shows observation `qa-observation-2`, revision 2, result `unknown`, quality `null`, elapsed time `null`, and the warning that the stored observation does not claim success or improvement.
- `coverage-current-membership.png` visibly shows expected 2/enrolled 2, the evaluation member as `unknown`, and the holdout member as unobserved, together with language denying promotion/test/improvement conclusions.
- `comparison-unavailable.png` visibly shows the explicit missing comparison ID, the bounded unavailable message, and no comparison output.
- `comparison-stale-discarded.png` visibly shows the delayed missing ID while the status has reset to the neutral explicit-read instruction rather than displaying the stale unavailable response.
- `comparison-stale-current.png` visibly shows the replacement current run ID. The two compact stale targets were recorded fully inside the viewport.

The captures are narrow and vertically centered with large blank margins. They are legible and sufficient for the tested states, but they are not a general visual-design or accessibility audit.

## Scope limitations

All run, policy, enrollment, and observation data are synthetic. Outcomes remain unknown/unavailable. The resubmitted observation is a refusal with no write, not a successful exact replay. No provider, model, native helper, approval, execution, Stop, external network, real billing, real evaluation cohort, or qualification occurred. The result closes only the UI verification prerequisite described by S5-01; the broader live-required S5 and launch criteria remain open.

## Exact artifact SHA-256

- `734f2580ed2d7e75f6d2b261777c482a1753f9a8450193250fb525f1366eb03e` final-verdict.json
- `8b8ded1f755c07f3773ae4bf3d3f1dc8dce7883f25b6e414c9ee0ee40974ddd5` result.json
- `7aeeee20929a2c549e243e2b273f9856ad05a7ddf5b27ff7a410276d06f17087` checks.json
- `f0e9bbff33c5bdbeb79cec8176e9fc90ad553b1431b9865d7c33f317e9fc56ca` scenario.json
- `6cb3ae0849878bf11813d180fcd233d3c25e8a7a88c949f09e62d9f4460077ba` ipc-evaluation.json
- `ea7d5b7ce8368c2127b9ef00f1322550d8f8ba3b105d1065c5a27a5ac0c8ea0c` guard-calls.json
- `9f3bb1a9c2b2344bbf8e0e8b082d84cabd8bc90460f7b868ed4c6de9038ae6e4` ledger-backup.sqlite
- `682dbdfa5983ab5a465aa4d951d4a4f468e035788190ceae9f3f5291f4cdc604` form-registered.png
- `207070202f82dba8708e12d78ef4aa1f44d6b26eb783d1ecc1f3082efa5247c5` observation-revision2.png
- `35ca19a19ebdcce6a068e40b1c030c58f3378a54d589dcc45a42ee8a65b0086d` coverage-current-membership.png
- `55cee98a14f05111106111a891e1dc217c9b6314ae44d9ff43663148438d9c5b` comparison-unavailable.png
- `bee1a9d660c5c729cf7bbfad3ad1941fc866d39cbd99ef838c5cc14842261fdf` comparison-stale-discarded.png
- `face4574f09ef8aca138a65e67cbb317af243a22a83bc74c4b7b483fa88e7954` comparison-stale-current.png
