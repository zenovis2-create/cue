# Independent review — measured-fact evidence view

Status: PASS — bounded backend evidence view verified

The original blocked review is preserved byte-for-byte in [review-before-root.md](review-before-root.md). Root's bounded test-only correction history, including both failed correction passes and the exact rollback, is preserved in [root-correction.md](root-correction.md).

## Review contract

Done means an independent source and test review verifies the exact `factId`-only protected Core view, all pre-callback containment guards, bounded persisted provenance and availability projection, immutable false trial/promotion flags, actual populated SQLite attempt coverage, deterministic replay/reopen, rejection of tamper/changed evidence/foreign/malformed/unconfigured inputs with callback zero and write zero, and missing-measurement behavior. The focused suites and final daemon build must pass, with source/test hashes and preimage checks recorded.

Attempt cap: two focused review passes.

Every pass runs the new measured-fact-evidence Core suite together with the existing measured-facts and Core-containment suites. The final stable pass also checks `node --check app/core.mjs`; the maker owns the single final daemon build result.

On failure, the next pass requires a new concrete hypothesis. After two failed passes, preserve the evidence and hand off. A change is accepted only when the measured gate improves; this reviewer owns no product or documentation edits.

## Findings

Pass 1 command:

`npx vitest run test/integration-evaluation-measured-fact-evidence-core.test.ts test/integration-evaluation-measured-facts.test.ts test/integration-evaluation-measured-facts-core-containment.test.ts --maxWorkers=1`

Result: FAIL — 11 passed, 3 failed. All three new Core tests stopped in fixture setup at `invalid_plan:requirement-coverage`, before the evidence view was exercised. The correction requires a valid current orchestration plan fixture. The test must also exercise the outer-transaction guard with a local saved fact; its current foreign-fact assertion is rejected by workspace containment first and cannot prove that guard or callback-zero behavior.

The initially attempted `--minWorkers=1` flag is unsupported by this Vitest version and was removed before the substantive pass.

Maker pass 2 (reported, not duplicated by this reviewer): FAIL — the same 11 existing tests passed and all 3 new tests failed during fixture setup at `invalid_plan:array-size`. The changed fixture used empty approval/task requirement arrays; the current plan contract requires a valid covered requirement and maker/verifier structure. The maker stopped at its cap before a successful focused gate, final build, or final pins.

## Historical blocked findings (resolved by the bounded fixture correction)

🔴 The required actual SQLite Core positive is unproved. Although the fixture source now seeds a populated persisted attempt with `tool@tool-v2` and `model@model-r3`, every new test failed before capture/projection. No passing assertion currently demonstrates populated provenance, deterministic replay/reopen, changed-evidence rejection, tamper rejection, or missing-measurement projection through Core.

🔴 Containment is unproved for the new entry point. The corrected source orders configured-host/open/outer-transaction checks before parsing, workspace lookup, and host callbacks, and the test now targets a local fact inside an outer transaction. Those assertions remain unexecuted because fixture setup fails. Callback-zero and write-zero behavior for unconfigured, malformed, foreign, closed, and outer-transaction requests therefore cannot be accepted.

🔴 The offline producer-class case still needs a producer-compatible fixture. Its current `fixture()` registers host-observed measurement contracts and then constructs the offline fact store directly; once plan setup is repaired, the existing measured-fact authority checks are expected to reject that mismatch. The correction should create the contracts and fact under `offline-fixture` authority and preserve the existing rejection for mixed producer authority.

## Static observations

The projection is bounded by the existing measured-fact payload and subject limits, excludes evidence references and raw host bytes, deeply freezes the returned DTO, preserves producer revision/digest and persisted tool/model revisions, reports quality/timing/accounting availability, and fixes `trialReady` and `promotionEligible` to `false`. Core accepts the exact `{factId}` object only and has no default host activation. These source observations cannot replace the failed runtime gate.

## Evidence identity

- `daemon/src/evaluation/measured-fact-evidence.ts` — `60F19625904498FEE9735D8D430F85A805A1CC78E9E34232605DB15FBFFF5A6D`
- `app/core.mjs` — `B4A53C1B18FA07B3FF82BC500EC708B8AB38D8E0F9BC96A2B3FC113D5A0914A6`
- `app/core.d.mts` — `CEA705930D49879F9F7CFA8E9F0EF5334C9FE13487925D6D09DF8B1DCFAF24AE`
- `daemon/test/integration-evaluation-measured-fact-evidence-core.test.ts` — `E3D088ED70593B65CE7C8119B3E078E4888A6B9DDEB52851D72BBAECAF61F106`
- `ROOT-CONTRACT.md` — `9B06EA904170C3D84195DB7769AACE60A37BA8B6E481D0D60584034A4E1A5150`
- `preimages.json` — `60191230DDDAE0E82E39020E0179A51EBD01542C017ADB95F3245F8007F8A5A3`

Preimage copies match both recorded hashes: `app/core.mjs` `C1B86131DE6D8AA39BE21509723B7E901B80DC93177FF49F065B0CA4B4523789`; `app/core.d.mts` `42728B24805C788394EC41E50F84060C520A9558F607C0796D1CFC0D7DFCDF99`.

Historical checkpoint limit: at the blocked handoff, no final pins or final maker build existed and the remaining reviewer pass was reserved for a stable corrected handoff. That state is superseded by the final verification below.

## Final independent verification

Final pin verification: PASS, 4/4 exact SHA-256 matches.

Second and final independent pass command:

`npx vitest run test/integration-evaluation-measured-fact-evidence-core.test.ts test/integration-evaluation-measured-facts.test.ts test/integration-evaluation-measured-facts-core-containment.test.ts --maxWorkers=1`

Result: PASS — 3 files, 15 tests passed, 0 failed.

The successful new Core cases verify a disk-backed SQLite projection with one populated persisted attempt and exact `tool@tool-v2` / `model@model-r3` lineage; read-only projection with unchanged SQLite `total_changes()` and capture count; deterministic replay and reopen; closed Core rejection; host-absent, foreign-workspace, malformed accessor/extra-field, and local outer-transaction rejection before callbacks and writes; changed evidence and stored scalar tamper rejection; distinct `offline-fixture` producer authority; and explicit unavailable quality, timing, and accounting. The DTO remains deeply frozen, bounded, free of evidence references/raw host bytes, and permanently `trialReady:false` / `promotionEligible:false`.

The final test pin is `2C5297F14074E1B870C233062522D18B118180BE467C7A51C562E0F64B2638D9`; the other three product pins remain the hashes recorded above. Root reports the stable daemon build exit 0 (`9ae50a`) and Core syntax/scoped-diff exit 0 (`b0f580`); the reviewer did not duplicate that build. Independent `git diff --check` over the four pinned files returned exit 0 with only Git's existing LF-to-CRLF notices for the two Core files.

Scope limit: the fixture uses real SQLite and the real Core/store path, but deliberately disables lineage triggers and foreign keys while injecting terminal-integrity authority to seed bounded persisted attempt bytes. This proves the view and its containment/revalidation contract; it does not qualify runtime execution, native behavior, a provider/model, measurement correctness beyond the frozen stored fact, trials, promotion, UI, IPC, or broad S5 completion. No model/server/native/network/live Electron activity occurred.
