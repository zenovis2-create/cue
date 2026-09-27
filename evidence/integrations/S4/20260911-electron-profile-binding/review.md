# Independent applied profile-binding review

Reviewer: broker_review, 2026-09-11. PASS for this delta; the previously identified normal-session-profile blocker is resolved in the reviewed source and bounded tests. Completion criterion: source/hash review, focused compatibility tests, actual no-model helper probe, and typecheck. Draft correction: reverse-order patch hunks corrected before application. No reviewer product edits or live qualification/workflow execution.

## Independent verification

From daemon:

`npx vitest run test/integration-electron-profile.test.ts test/integration-electron-profile-runtime.test.ts test/integration-electron-profile-entry-order.test.ts test/integration-start-entry.test.ts test/integration-qualification-start.test.ts test/p9.test.ts test/integration-local-json-electron-gate.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`

Exit 0, 7 suites / 32 PASS, start 23:14:03 KST, duration 2.30 seconds. `npx tsc --noEmit`: exit 0. No rebuild by reviewer. The earlier 131-file / 931-PASS / 5-SKIP full regression belongs to the previous snapshot and is not presented as a full regression of this change.

Actual Electron helper-only subprocess observed Electron 44.2.0, profileMatched=true, configCreated=false, lateRebindDenied=true; exit 0, temporary path removed. It created no application window, AppDaemon, model client or qualification operation. Model calls 0. This proves actual getPath binding and late-ready refusal, not a full real application/qualification run.

## Reviewed identities

| File | SHA-256 |
| --- | --- |
| app/electron-profile.mjs | 786B024EC21825B0D73278A81B51C6ECE1506D3168B8248FAD98DD69D93D4ECA |
| app/electron-profile.d.mts | 3A92888531D7EAA3EC55E18100484396514B2574A9772239A3B88EC8D1DDEB4B |
| app/start.mjs | 9A09ED775725C9022773FC939EC67F6969B2A7C890C62EC67A2DDB321320DE78 |
| app/qualification-start.mjs | 2E4E83568C27D0B05D17271B0613E9D8118D23769C0D6157CC0AC9BC352E0BFD |
| daemon/test/p9.test.ts | 57FCF43CAF04C9CEF0D231B4BBAE5BD6F9DC903B000E799E8E07DA2B66F25873 |
| daemon/test/integration-electron-profile.test.ts | 3844697496943B7ED72B01FFCF2CC21F1EE44BBC76895C5527BBE2C5280A3185 |
| daemon/test/integration-electron-profile-runtime.test.ts | 7AAF2FECBC68253749A92FE12642514694788935CC9222D99B1CB69F6386C138 |
| daemon/test/integration-electron-profile-entry-order.test.ts | 891271C80C5D07B6B0ACD8A04D09CA55B8CF9B993EE2400E328913A78FACF75C |
| scripts/reuse/local-json-electron-gate.mjs | AD2E76151122492AC8FF1765823B384E5D559306F1B4D06C44673530A9655848 |
| daemon/test/integration-local-json-electron-gate.test.ts | A224F83045CC2E496CA8768E0A27D5DF289B579491804A8C826946889EB349B8 |

All ten hashes were independently compared to maker.json and matched.

## Contract conclusions

Builtin-only helper imports no protected application/dependency. Both entries call it synchronously inside the guarded loader after capture and before dynamic application import; initialization still follows post-import assertion. Specified profiles are rejected after ready. Absent/empty CUE_USER_DATA returns null without changing defaults, including when already ready. Relative nonexistent paths resolve and are created component-by-component; file/junction/symlink/canonical collisions fail. The helper does not create Cue config or ledger. Existing first-run behavior can subsequently create its normal config/ledger in the same resolved root.

userData binds to the host-selected root and sessionData to its electron-session child; both getPath values must match. Qualification summary includes the bound pair and verifies it again at termination. The gate now requires exact owned paths in both qualification summary and actual workflow observer. Negative profile fixtures reject missing/wrong/default-path receipts. Exact CLI flags, actual Electron runtime requirement, legacy-live denial, normal main identity and caller cleanup sequencing remain intact.

Existing entry VM mocks intentionally do not invoke the loader callback; they remain compatible. New entry-order tests explicitly execute it and verify capture, bind, definitions import, postassert, initialize order. P9's source assertion was updated for this concrete sequence. The applied declaration precedes its profile assignment, resolving the draft patch ordering concern.

## Limits

Host path ownership and trusted initial helper/builtins remain prerequisites; checks do not defeat concurrent hostile path replacement or OS tampering. Error handling preserves created host directories rather than deleting existing user data. No renderer authority is added. Actual full two-process profile receipts are still required during the separately authorized frozen gate. This helper test does not demonstrate browser storage contents, exhaustive absence of writes outside the selected roots, live qualification, current M evidence, checker/producer acceptance, or provider request telemetry.

This review supersedes the earlier harness review's unresolved default-profile limitation only for the exact current files above. Historical actual startup failures and the historical exhausted Node canary remain unchanged. A new frozen script/installation digest is required before the parent's distinct actual gate.
