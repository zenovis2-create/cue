# Independent review — persisted cost dimensions

## Verdict

CLEAR for the frozen persisted cost-dimension implementation and original S2-02 backend/UI distinction. The first independent migration run found an invalid historical test fixture (`task.state='pending'`); the maker corrected it to the schema-valid `queued` state with its own preimage. The failure remains in `checker-migration.log`, and the independent corrected run is 5/5 in `checker-migration-corrected.log`.

## Production lineage and integrity

- `createPersistedCostObservationStore.record` accepts observations only inside the engine's terminal SQLite transaction. It snapshots hostile input through the strict dimension validator before reading fields, then derives run, attempt, candidate, launch subject, tool, and identity from the ledger.
- API and subscription observations require the exact current `orchestration_account_identity`: candidate, opaque account reference, subject digest, tool ID, and stored identity digest must match the launch. Local-resource observations instead require the exact attempt identity and cannot use account identity. Cross-class dimensions reject.
- Provider/tool and account/local identity values cannot be substituted by the host observation. The source resolver must return bytes whose SHA-256 equals the declared source digest; the bytes are retained in the immutable row.
- Migration 049 checks canonical payload bytes, all denormalized lineage/dimension/state/time/source columns, current attempt/launch/identity relations, and source/payload hashes at insert. Update, delete, and replacement are prohibited. Reads recompute the payload digest, canonical form, current lineage, every denormalized field, and retained source digest before projecting a value.
- A preliminary combined root gate exposed a deterministic reader defect: parsed canonical JSON orders lineage keys alphabetically, while the freshly constructed lineage used declaration order, so direct `JSON.stringify` comparison falsely rejected valid rows. The frozen correction compares `canonical(stored.lineage)` with `canonical(lineage)`. The original failure is retained in batch76 `backend-gate.json`; the maker's corrected 32/32 gate and final store pin include the fix. This was property-order sensitivity, not timing or runtime nondeterminism.
- Exact replay returns the existing observation only when payload and source bytes match. A conflicting attempt/observation collision rejects. A bad source causes the encompassing terminal transaction to roll back the observation, attempt completion, and any associated settlement.

## Dimension and authority behavior

- The production monetary engine persists subscription observations and API observations. The production local engine persists local-resource observations through the same store. UI reads the persisted per-attempt record first and uses the earlier monetary receipt bridge only when no persisted record exists.
- The shared validator preserves `api | subscription | local-resource`, `actual | estimated | unknown`, and `fresh | stale | future`. It rejects currency/unit/price/quota/GPU/billing combinations that cross dimensions. No conversion exists between monetary, subscription, and local-resource units.
- Unknown observations require null units. Renderer output labels API money, subscription usage, and local-resource usage separately; it never calls subscription/local units money or free service and clears unavailable data.
- The projection exposes only bounded descriptive fields and `authority:'observation-only'`; account references, provider/source references, and digests are redacted. Persisting an observation does not create or finalize a budget receipt, release a reservation, authorize a candidate, affect selection, or establish invoice truth.
- The one-observation-per-attempt limit is explicit and honest. It is an immutable terminal observation, not an event history or aggregate across a workflow.

## Migration and packaged startup

- `ledger.ts` installs 049 only when both tables are absent, rejects partial schemas, counts the four guards, checks the migration marker, and compares the live table/trigger SQL with a fresh reference definition on every open.
- The asset copier includes `049_cost_observation.sql`. Tests cover fresh, reopen, 048 upgrade with application-row preservation, partial schema, weakened trigger, altered table, packaged/source byte equality, and compiled fresh/reopen startup.
- Independent focused migration/schema gate after the fixture correction: 2 files, 5/5 PASS. Maker reports the post-canonical-fix production/renderer focused gate at 4 files, 32/32 PASS, TypeScript exit 0, renderer syntax exit 0, and diff check exit 0. Root's final backend gate passed 159 tests with 0 failures and one intentional opt-in actual-public-driver-restart skip across 14 files, including the cost migration, store, UI, local-engine, and monetary-engine paths. No cost or ledger source edits remained pending at that gate.

## Original parent decision

**S2-02 — approve closure.** The original text requires API/subscription/local cost and actual/estimated/unknown/stale distinctions. Current production engine→store→snapshot→renderer paths now implement those distinctions without fabricated amounts or settlement authority. The original parent does not require a live provider call; external source truth and provider qualification remain separate concerns.

## Limits

This approval proves the persisted distinction, integrity, and UI consumption contracts. It does not authenticate a real provider invoice, infer an entitlement, convert subscription/local units into money, or claim a full multi-event cost history.
