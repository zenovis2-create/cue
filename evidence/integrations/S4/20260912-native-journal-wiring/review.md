# Independent review: native journal wiring

Date: 2026-09-12 KST  
Verdict: **PASS for the bounded S4 native journal wiring component**

## Reviewed contract

The review covered append-only migration 038, preapproval root/target registration, native prelaunch capture in the engine transaction, exact replay validation, fresh post-terminal observations, retry/acceptance blocking on missing or unknown journal state, and the retained restore/pass denials. Migration 037 was not edited by this unit. Packaging has a separate independent review.

The implementation obtains volume/file identity and helper metadata from the fixed native host. Request/configuration data cannot supply native identity or an executable path. Each task has one common byte cap; mixed caps and `targetCount * cap > 16 MiB` fail before helper identity lookup or contract insertion. Capture uses the persisted root identity and complete ordered target set, and the native scan plus change-set, entry, and binding inserts share the immediate transaction. Any uncertain result aborts the journal and the surrounding claim/reservation/stage/launch-intent transaction.

Replay does not invoke the helper again. It requires the same attempt/run/task/stage/launch/worktree/targets/limits, validates hashed change-set, root, binding, and entry payloads against their stored scalars, checks complete ordinals and preimages, and recomputes the manifest. Terminal reconciliation requires the journal for declared writable tasks, records a fresh monotonic complete observation batch, and blocks retry/acceptance when the set is missing or any observation is unknown. Known `modified`, `moved`, and `type-changed` facts remain available to later verification rather than being treated as missing freshness. Migration 038 also blocks observation insertion after a held case is sealed.

The runtime rechecks cancellation, effective deadline, and stage-envelope expiry after synchronous capture through `authorizeRun` and again in the candidate launch wrapper immediately before dispatch. The capture delay therefore cannot rely only on the earlier claim timestamp.

Legacy attempts present when migration 038 is installed are recorded as immutable `legacy-native-journal-unavailable`; they receive no root authority. Migration 037 remains at SHA-256 `40db0af5db2aad8bce52a4dfed1219a2a1ec68ba4a11d8e447237044d10c927a`. `restoreStoppedChangeSet` still returns `atomic-race-closure-unsupported` without an atomic host, and `verification_pass_disabled` remains installed.

## Correction history

The initial checker pass found and preserved these failures:

- driver replay skipped validation whenever any change set existed for the attempt;
- observation reused the first batch indefinitely;
- capture scanned outside its own immediate transaction;
- an external connection could seal a held case while the helper ran and append observations afterward;
- a writable terminal attempt could continue without its required change set;
- SQL binary order and JavaScript locale order could mismatch target caps;
- replay omitted scalar-to-payload checks for entry and native-binding fields.

The first hostile checker run was **0/3**: one valid mixed-order capture was rejected and two corrupted replay rows were accepted. After correction it was **3/3 PASS**. The byte-cap contract was then clarified to one common cap per task; the final checker test preserves uniform mixed-case ordering success and adds mixed-cap preapproval rejection, producing **4/4 PASS**.

The first broader consumer run was **46/48 PASS**. Both Core composition cases failed at the current public requirements shape before reaching journal code. The separately owned fixture correction retained the public requirement/acceptance path, and the final Core gate passed.

## Independent verification

- Required journal/driver/held/verification suite: 5 files, **52/52 PASS**.
- Broader driver-Core/acceptance/history/recovery/retry suite: initial **46/48**, then Core **4/4 PASS** after the fixture correction; the other **46/46** remained green.
- Final combined source gate: **103/104 PASS** with the sole failure being the checker script's expected error-string mismatch after the new common-cap rule. No product code failed. Correcting that checker expectation produced final hostile **4/4 PASS**; the other 103 tests were unchanged and already green.
- `npx --no-install tsc --noEmit`: PASS.
- `npm run build`: PASS, including required asset copy/validation.
- Scoped `git diff --check`: PASS.

The Windows helper tests invoke the reviewed real executable against owned temporary roots. The actual orchestration driver and Core composition are exercised, and the helper capture occurs before the candidate launch callback. Deterministic driver fixtures provide surrounding orchestration receipts and authority callbacks; those fixtures are not evidence of native executor, provider, model, or acceptance authority. No model call, network call, paid call, native executor sandbox gate, automatic restore, or direct SQL pass was used or claimed.

## Frozen hashes

| File | SHA-256 |
|---|---|
| `daemon/migrations/038_s4_native_change_journal.sql` | `3c7eb9a2887d950de8e9d130b451f136b1c1d9808438dd87e1cd7ec69a25828e` |
| `daemon/src/change-snapshot-host.ts` | `2ba258d3d2d52f740f1a5649cf427094d7b6d8b56f080202712d1b78b471a100` |
| `daemon/src/change-records.ts` | `2643a84c96144b9174cd39da4562ac2f932c667f22c1f10da5a23e89f0d31240` |
| `app/orchestration-driver.mjs` | `7e616e4474ff57a33c14608bd1c97d680a4bea62be65c92b9cf61e435d156a3b` |
| `daemon/test/integration-change-records-native.test.ts` | `f253e20da66716fd48c765c9f1db926d5da383b3688e6310aacb8a0dc53737a9` |
| `daemon/test/integration-change-records.test.ts` | `b76cb89cf8bc6246782449cec52f115f0cece5c22f35bc8ec354f08e777d35b6` |
| `daemon/test/integration-driver.test.ts` | `f6caa48286795beca457711cff454fdb840bd12d70f27866d757d479bc1945b7` |
| `daemon/test/integration-driver-core.test.ts` | `a290b5bf5201646bf3ea4f99f9bf22e885ac072e3c3040cb2a79b1cba7acd165` |
| `daemon/test/integration-native-journal-wiring-review.test.ts` | `7bf68044613f9eaa101b0ed8f2ccf81b000e60726bdf808df18c7106a7dd5125` |

These hashes describe the source used for the final checks above. The component proves bounded native preimage capture and fresh observation wiring. It does not prove publisher authentication, atomic hash-to-execute, native write/replace/delete CAS, automatic recovery, a real provider terminal receipt, or whole S4/S0-S7 completion.

## Final combined-gate addendum

After correcting only the checker-owned expected error string, the exact previously failed 11-file command was rerun once against the frozen product source:

```powershell
npx --no-install vitest run test/integration-native-journal-wiring-review.test.ts test/integration-change-records-native.test.ts test/integration-change-records.test.ts test/integration-driver.test.ts test/integration-driver-core.test.ts test/integration-held-recovery.test.ts test/integration-verification.test.ts test/integration-acceptance.test.ts test/integration-acceptance-history.test.ts test/integration-recovery.test.ts test/integration-retry-backend.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
```

Final raw summary:

```text
Test Files  11 passed (11)
Tests       104 passed (104)
Duration    32.21s
```

This is the authoritative unique combined count. The earlier 52 focused, 46 related, 4 Core, and 4 hostile figures overlap because the 52-file selection already includes driver tests also exercised by the broader selection. They must not be added together. The superseded combined receipt remains recorded as 103/104 with its single checker-expectation mismatch; the corrected final receipt is 104/104.
