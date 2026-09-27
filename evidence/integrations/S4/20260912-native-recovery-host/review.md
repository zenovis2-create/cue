# Protected recovery host — independent review

Reviewer `/root/broker_review`, 2026-09-12 KST. PASS for this bounded protected host/Core/main composition and observer guard-cadence delta. Source read-only; no actual helper, native executor, model or qualification invocation.

## Independent gate

In `daemon`:

```text
npx vitest run test/integration-native-recovery-host.test.ts test/integration-native-recovery-observer.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
npx tsc --noEmit
```

Exit 0, 2 suites / 22 PASS, start 00:50:28 KST, duration 19.26 seconds. Typecheck exit 0. All eight entries in adjacent `hashes.json` independently matched the files during the frozen review. Root's combined build preceded this gate; reviewer did not rebuild.

The host tests use genuine installed-generation hashing and reopened SQLite, but replace observer OS operations with explicit fixtures. The generation is captured after imports in that test process; it is not an actual protected-entry startup proof.

## Findings and verified contract

No unresolved blocker.

- Host requires an authentic module-issued installation generation bound to the actual app root and dependency root. Protected main supplies its captured guard and exact daemon DB. Core creates the service inside its existing setup cleanup boundary; an owned daemon closes when factory setup throws. Without the service the new Core methods reject as unavailable.
- Listing and observation bind the selected workspace's parent run to the orchestration attempt, immutable plan/task role, stage task/run, canonical envelope hashes/request, exact owned session and stored identity. Dotted parent IDs remain supported. Model-producer/verifier roles must match the model/json-checker client kind. Historical stage paths are compared lexically, with containment checked, so a removed stage directory does not prevent observation.
- Observation re-resolves the full relational snapshot after the awaited observer result. Wrong workspace/reference/run/attempt, stage tampering, changed session, abort and source-generation drift fail rather than issue a result. Listing caps output at 64 entries and reports truncation.
- The returned projection exposes states and identity references, not raw PID/FileTime/path details. It retains `sourceKind` and `authority: observation-only`; test fixture observations cannot be presented as native. It writes no cleanup/acceptance receipt, clears no ownership, changes no execution state and does not consult provider health or settings. Reopened DB bytes and total_changes remain unchanged in the successful composition test.
- Full loaded-generation checks bracket OS observation exactly twice, at entry and publication. Their synchronous hashing time is separately reported and excluded from the five-second OS observation window; `totalResponseBounded` is explicitly false. Lightweight helper hash/DB identity checks remain around each await. A pending OS operation still fails at five seconds; initial guard failure starts no query, and final guard failure discards the result. This is a detection boundary, not an atomic lock against hostile write-and-revert.

## Preserved maker failures

The first fixture layout put the workspace under the ledger parent, so the existing production overlap guard correctly rejected it. The fixture moved the ledger to a sibling data folder. A later 5.160-second test exceeded Vitest's default five-second timeout while performing four full generation scans for list plus observe. The explicit finite test timeout is now 30 seconds; the product OS observation limit remains five seconds. Neither earlier failed gate is relabelled as passing.

## Source binding and limits

Principal SHA-256 values (complete eight-file set in `hashes.json`):

| File | SHA-256 |
| --- | --- |
| app/native-recovery-host.mjs | 78EE6A0ED1F98A3A9FBB84EAF2C53C2EAA2E8FAA43CE3E861CD90F381E024254 |
| app/core.mjs | 6A7BA4DB60D79CE4BF8B95EA366EB46379F8B75063D9B79EC65137B3ACFC8E04 |
| app/main.mjs | 99C213354EBDE7FAB547C0A57BF8B221B176DB4BF4FC0F64D1C7CC4C3AD530C7 |
| daemon/src/native-recovery-observer.ts | 3C5484E1568E05F18CD4D9B6118FF41234EAC27A9C261538469668582C3736D4 |
| daemon/test/integration-native-recovery-host.test.ts | A0B8C70EF0D1D1FB87C3F89A0F1A7BE60D866C3CED528608CDEF72BE32E75ACD |

The prior actual observer attempt used its own captured older observer hash and synthetic identities. It remains valid only for that historical scope and is not automatically proof of this new protected host composition. No historical failed workflow was repaired, no M receipt was issued, and no model-call allowance was reused.
