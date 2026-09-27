# S3 handoff integrity disposition and bounded replan

Date: 2026-09-12 KST  
Status: **PROPOSED NEW HYPOTHESIS; implementation not performed**

## Disposition

The S3 handoff/activity correction cap remains exhausted at **2 of 2** and its verdict remains **FINAL BLOCKED**. This document does not reinterpret correction 2 as a pass and does not authorize a third edit of the same migration-031 trigger hypothesis.

A different bounded approach is technically viable because the host ledger now registers deterministic `cue_sha256` on every `openLedger` connection before migrations run. The observed inputs for this replan are:

- `daemon/migrations/031_orchestration_handoff_activity.sql` SHA-256 `0e13b1b4d9e9483a807bfcc8d34bdd51c5434f6c2eb2734bedf7ef6bf6336233`;
- `daemon/migrations/032_provider_execution_lifecycle.sql` SHA-256 `d33b6ecb9498e4264de4fe35408634c871e224550786392d93bdf7667faefb67`;
- `daemon/src/ledger.ts` SHA-256 `89c837c71414f3311a355537c5151eae96f591b1e4981a6b6d6f18874ab31462`, with `cue_sha256` registered as a deterministic function before migrations 001–032.

The new hypothesis has four parts: an additive max+1 migration, conservative fencing of every attempt that predates that migration, a connection-local one-shot capability that binds the terminal SQL update to a host validation in the same transaction, and one host-backed terminal-integrity reader shared by completion, driver readiness, UI, and derived report reads. Migration 031 stays byte-for-byte historical.

This closes the actual correction-2 counterexample within the product trust boundary: a structurally valid handoff whose stored `payload_sha256` is `444...` cannot be inserted through a current ledger connection because SQL recomputes the hash; a connection lacking `cue_sha256` cannot perform a current handoff write; and a hash-correct but unresolvable artifact cannot be called verified by readiness or UI. It does not make a SHA-256 string proof of provenance and does not claim resistance to a principal that can replace the database file, register a dishonest SQL function, drop triggers, or rewrite product code.

## Trust boundaries and invariants

Three judgments must stay separate.

1. **Stored-byte integrity** means `cue_sha256(payload) = payload_sha256`, the canonical decoded fields equal the typed columns, the artifact manifest is complete and ordered, and the launch intent, identity, receipt, and handoff share the exact attempt lineage. Migration triggers can enforce and recheck these facts on the product connection.
2. **Artifact and receipt provenance** means the trusted host authorizes the exact `sourceRef` for the producer attempt, resolves the actual bytes, recomputes their digest and length, and rechecks the persisted receipt/handoff/identity lineage. A matching raw hash is only a comparison value. It is never authority by itself.
3. **OS and database trust** means the application binary, native process, ledger file, registered SQL function, and triggers have not been replaced by an actor with equivalent write authority. This unit does not establish that boundary. It also does not prove provider behavior, remote billing cessation, native process identity, arbitrary file-write prevention, or trigger-drop prevention.

The current authority invariant is therefore:

```text
terminal verified
  = post-migration attempt
  + SQL byte/shape/lineage integrity
  + exact receipt lineage
  + host authorization and resolution of every artifact at the read

terminal state write
  = the same host validation
  + a matching connection-local one-shot capability
  + the same immediate transaction
```

Row existence, terminal state, `cleanup_verified=1`, a stored digest, or an integrity-row marker alone is insufficient.

## Additive migration design

Implementation must first enumerate both `daemon/migrations` and `daemon/dist/migrations`, inspect the registration order in `daemon/src/ledger.ts`, and reserve exactly `max(existing source number, existing dist number) + 1`. At this review point both maxima are 032, so the proposed name is `daemon/migrations/033_orchestration_handoff_integrity.sql`. If any 033 or higher migration exists when work begins, the maker must use the newly computed max+1 everywhere and must not overwrite, reorder, or repurpose another migration.

Migration 031 must remain byte-identical to the hash above. The new migration must not drop, replace, or edit any 031 table or trigger. It adds:

- an immutable singleton marker, versioned independently from `cue-handoff-activity-v1`;
- an immutable `orchestration_handoff_integrity_legacy` fence keyed by `attempt_id`, populated **before the marker is first inserted** from every `orchestration_attempt` that exists at migration time;
- a fixed reason such as `pre-current-handoff-integrity-unavailable`; it records unavailability and does not change or delete the old attempt, receipt, handoff, artifact, state, or cleanup columns;
- no positive “verified” seal table. A durable marker writable with mutually consistent values would recreate the row-existence mistake;
- additive `BEFORE INSERT` hash triggers for `orchestration_launch_intent`, `orchestration_attempt_identity`, and `orchestration_handoff`, each requiring `cue_sha256(NEW.payload)=NEW.payload_sha256`;
- an additive current-attempt handoff trigger that rejects attempts in the new legacy fence;
- an additive terminal-transition trigger that rejects fenced attempts, requires hash-valid launch-intent, identity, and handoff payloads plus the existing exact receipt and manifest lineage, and requires a matching connection-local one-shot host-validation capability before `completed` or `failed` can be stored.

Fencing all pre-migration attempts is intentional. SQL can detect a payload hash mismatch, but it cannot retroactively prove that a hash-matching artifact was authorized and resolved by the host before 033 existed. Treating only obvious mismatches as legacy would incorrectly promote the remaining pre-033 rows by absence. A pre-033 completed row therefore remains physically `completed` for audit, while current scheduling and UI expose it as unavailable. The migration must not rewrite it to `blocked`, set cleanup to zero, synthesize a receipt, delete its artifacts, or claim a repaired completion.

`openLedger` should also register a non-deterministic SQL predicate such as `cue_handoff_terminal_authorized(attempt_id,payload_sha256)`. Its closure starts unarmed, returns true for one exact tuple only after the trusted store arms it, consumes that authorization once, and is cleared in `finally`. The arming helper rejects a closed database, absence of an active immediate transaction, nesting, tuple mismatch, or reuse. It is an in-process capability, never a value persisted in SQLite and never accepted from a DTO. The 033 terminal trigger invokes this predicate after its structural checks.

Because every current insert trigger invokes `cue_sha256`, a raw `better-sqlite3` connection that did not register the function receives `no such function: cue_sha256` (or the stable wrapped equivalent) and writes zero launch-intent, identity, handoff, artifact, or terminal rows. A raw statement on an ordinary `openLedger` connection sees the terminal predicate but it is unarmed and the update aborts. The migration should not add a fallback hash implementation or skip either check when a function is absent.

## One terminal-integrity path

`createHandoffActivityStore` should own one read-only validator returning an explicit result such as `verified`, `legacy-handoff-unavailable`, or `integrity-unavailable`. It must not mutate, repair, or cache a successful verdict across reads. For a current attempt it must:

1. reject the 031 legacy set and the new pre-current fence;
2. recompute and compare the launch-intent, identity, and handoff payload hashes;
3. parse bounded canonical payloads and compare every typed field to its relational column;
4. recheck session-handle ownership, latest exact receipt revision/outcome/cleanup, and the complete ordered relational artifact manifest;
5. for every member, call the host authorization and resolver with the exact `(sourceRef, attemptId)`, then recompute byte digest and length;
6. return `verified` only when all checks pass; any missing callback, throw, missing bytes, mismatch, oversize payload, fence, or corrupt predecessor returns an unavailable result to read consumers and throws at a write/terminal boundary.

`prepareHandoff` must also deduplicate by canonical `sourceRef` alone, matching the database `UNIQUE(handoff_id,source_ref)` rule. A caller cannot obtain a prepared branded object containing the same logical source under two caller-controlled kinds.

`finish` must keep receipt insert, handoff insert, manifest insert, shared terminal validation, attempt update, and step update in the same immediate transaction. It invokes the same validator after all candidate rows exist, then arms the exact `(attemptId,handoffPayloadSha256)` capability immediately before the one terminal update. The SQL trigger consumes it; `finally` clears it whether the update succeeds or throws. Step state changes only after the authorized attempt update. Any validation or capability failure rolls back the whole transaction. Exact replay also reruns the validator; it does not return success from stored terminal state alone and does not arm a capability when no terminal update is needed.

`createOrchestrationStore.states/readiness` must consume only that validator's result. `createOrchestrationDriver.snapshot` must use the same store/readiness instance and expose a read-only integrity projection for the UI. `readOrchestrationSnapshot` must stop deriving `handoffStatus:'verified'` from `EXISTS(orchestration_handoff)`. The Core call must pass the active driver's integrity reader; when no current host/driver is available, the UI must default to unavailable rather than construct a database-only verified result. Any report path derived from `readOrchestrationSnapshot` inherits the same unavailable default unless Core supplies the active integrity reader.

For a fenced or corrupt terminal row, the DTO must preserve audit truth without presenting authority: expose the persisted attempt state separately, make effective stage/readiness state blocked or unavailable, set `handoffStatus` to the specific unavailable status, and show cleanup as unknown. Attempt history follows the same rule. Only `verified` may produce a completed/failed effective terminal state and `verified-clean` cleanup.

The current source-to-consumer chain is required and must be traced in review:

```text
host artifact resolver/authorizer
  -> handoff terminal validator
  -> orchestration store finish + states/readiness
  -> orchestration driver snapshot/integrity reader
  -> Core completion
  -> orchestration UI and derived report projection
```

No branch in that chain may substitute SQL `EXISTS`, stored state, cleanup flags, or raw hashes for the shared verdict.

## Bounded implementation ownership and sequencing

Root assigned Phase A to `/root/sol_s3_integrity_boundary`; it may run without overlapping the active S1 Unit 3 owner. That S3 integrity maker owns only:

- new max+1 handoff-integrity migration;
- `daemon/src/ledger.ts` and `daemon/scripts/copy-assets.mjs` for ordered registration/copy only;
- `daemon/src/orchestration/handoff-activity.ts` and `daemon/src/orchestration/store.ts`;
- `daemon/src/ui/orchestration.ts`;
- `daemon/test/integration-handoff-activity.test.ts`, `daemon/test/integration-orchestration.test.ts`, `daemon/test/integration-generated-json-host.test.ts`, `daemon/test/integration-selection-explanation-ui.test.ts`, and one narrowly named new migration/read-integrity test only if the existing files cannot express the upgrade matrix;
- the maker evidence file for this new unit.

Phase A does not own `daemon/src/integration-runtime.ts`, `app/orchestration-driver.mjs`, or the active S1 Unit 3 tests. It proves the shared validator, store readiness, and UI projection contract through direct component composition, but cannot claim the product source-to-UI chain is complete.

After S1 Unit 3 reaches stable reviewed bytes and releases its ownership, root may extend `/root/sol_s3_integrity_boundary` or issue a separate integration handoff limited to `app/orchestration-driver.mjs`, `app/orchestration-driver.d.mts`, `app/core.mjs`, `app/core.d.mts`, `daemon/src/reports/ir.ts`, and their direct driver/Core/report tests. `app/orchestration-driver.mjs`, its declaration, and its direct test stay reserved until that release. The integration pass only carries the already reviewed integrity reader through driver snapshot, Core completion, UI, and report; it does not alter the S1 runtime behavior or redesign the validator. If S1's final driver interface can carry the verdict without all listed files, omit the unnecessary files. Do not start this handoff against moving S1 bytes.

Neither maker owns migration 031, migration 032/provider lifecycle, generated-output schema, acceptance semantics, renderer styling, native execution, Electron proof scripts, provider/model code, or broad project documents. Existing concurrent changes are preserved. Each independent checker owns only its review evidence and performs no product edits. S3 remains blocked until both Phase A and the later integration handoff pass; a Phase-A-only result cannot mark UI or Unit 1 complete.

## Required scenarios

The kept implementation must demonstrate all of the following.

### Positive current chain

A fresh current ledger uses public APIs to create a valid plan/attempt, launch intent, owned durable identity, exact clean receipt, and at least one host-authorized artifact. The artifact resolver returns the exact bytes. `finish` commits atomically, the SQL hash for each protected payload equals the stored hash, readiness advances, driver snapshot and UI say `verified`, and exact replay returns the same result. After close/reopen with an equivalent trusted resolver, the shared validator still verifies the bytes and lineage; if the resolver cannot reconstruct authority after restart, the result must be unavailable and that limitation must be reported rather than guessed.

### Original hostile probe

Against a fresh post-migration ledger, repeat the review's structurally valid `forged-structured` handoff with the literal `444...` payload hash and matching relational artifact. The handoff insert must fail at the SQL hash boundary, the artifact and terminal update must not commit, the attempt remains running with `cleanup_verified=0`, readiness does not advance, and UI never says verified.

### Hash-correct fake artifact

Use an ordinary `openLedger` connection and insert a canonical handoff using the actual payload hash but an unauthorized or unresolvable `fake-source` artifact. A raw hash match may satisfy the byte-integrity trigger; it must not become authority. The direct terminal update must fail because no host-validation capability was armed. Public terminal validation, driver readiness, Core/UI, and derived report reads must also fail closed through the host resolver/receipt lineage check. No acceptance or dependent stage may advance. A separate trusted test may arm the capability only through the store after a valid resolver result; tests must not expose a general-purpose “arm” API to fixtures. This scenario documents the product boundary rather than claiming that SQL alone knows artifact provenance.

### Missing hash primitive

Open the migrated file with a plain raw connection that has neither `cue_sha256` nor the terminal capability predicate. Current launch-intent, identity, and handoff inserts and a terminal transition must fail closed with zero dependent-row delta. Reads may remain available for audit, but that connection cannot create current terminal authority.

### Pre-033 corrupt upgrade

Create a copied pre-033 database through the historical product migration path, insert the original correction-2 forged handoff and terminal state, close it, then upgrade only by current `openLedger`. Migration must retain every original row and stored state, add exactly one immutable fence for the old attempt, and project handoff/cleanup/effective completion as unavailable. Reopen it twice, confirm the fence is stable and no synthetic replacement row appears, and confirm current attempts created after the marker remain writable through public APIs.

### Database and migration checks

Both a fresh database and the copied pre-033 database must pass `PRAGMA integrity_check` with `ok` and `PRAGMA foreign_key_check` with an empty result before close, after upgrade, and after reopen. Migration replay is idempotent. Source/dist migration bytes are identical after the normal build/copy step. Migration 031 retains its pinned hash. Migration 032 retains the stable S1 correction-2 hash unless that separate owner publishes a later reviewed hash before this unit freezes its baseline.

## Done commands and stop rule

For Phase A, run from `C:\Users\User\cue\daemon` unless noted:

```text
npx --no-install vitest run test/integration-handoff-activity.test.ts test/integration-orchestration.test.ts test/integration-generated-json-host.test.ts test/integration-selection-explanation-ui.test.ts <new-integrity-test-if-created> --reporter=verbose --fileParallelism=false --maxWorkers=1
npx --no-install tsc -p tsconfig.json --noEmit --pretty false --incremental false
npm run build
npx --no-install vitest run test/integration-orchestration.test.ts -t "independent connections atomically claim exactly once" --reporter=verbose --fileParallelism=false --maxWorkers=1
```

Then run the fresh/pre-033/file-backed hostile probes described above, record exact row deltas and component UI/readiness DTOs, compare source/dist migration bytes, hash 031/032/new migration and all owned source files, and run scoped `git diff --check` from the repository root.

After the separate integration handoff starts on stable S1 bytes, rerun its direct driver/Core/report tests, the Phase A focused suite, TypeScript, build, the positive chain, and both hostile projections. Review must trace the exact host → validator → store readiness → driver → Core/UI/report call chain in the resulting source. No source-to-UI claim follows from mocks that bypass this chain.

This is a newly dispositioned hypothesis, not correction 3 of the blocked migration-031 approach. It gets an initial maker pass followed by independent review, with at most **two correction passes total** if the reviewer produces a concrete counterexample. Every correction must improve that exact counterexample and rerun all gates above. A regression is reverted. If the second correction still permits a fake hash to reach terminal state, permits a hash-only fake artifact to appear verified in any current source/driver/readiness/UI path, loses historical rows during upgrade, or requires unsupported host provenance after reopen, record the raw result as **FINAL BLOCKED** and stop. Do not invoke a model, provider, native helper, Electron, or network path for this unit.
