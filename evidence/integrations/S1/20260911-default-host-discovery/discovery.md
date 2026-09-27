# Default orchestration host: read-only composition discovery

Date: 2026-09-11. Reviewer: contracts_review. No product edits, tests, or live calls. This is an API gap audit, not qualification evidence.

## Immediate decision

Injecting an OrchestrationHost alone cannot currently deliver an accepted M-only goal. Fix the smallest explicit plan/artifact contract first; do not impersonate a writer or fabricate an independent principal.

- plan.ts requires an implementation and downstream verifier for every requirement (requirement-coverage).
- engine.ts maps every implementation task to implementation runtime admission; planner/verifier map to model. Qualified M-only Qwen therefore cannot be the required producer.
- stage-envelope.ts similarly uses implementation as both responsibility and permission classification.
- acceptance.ts selects all implementation principals as makers. Any new M-only producer must be included, including failed retry attempts, or independence becomes unsound.
- AcceptanceArtifact has filesystem/retrieved-source/remote-state only. Document/code checks require a filesystem target. An internal generated answer is not a retrieved source. Explicit generated-output contract support is needed, or separately approved host publication with real write ownership. Neither implies the model can write.

## Smallest next implementation unit

Add explicit M-only production responsibility to the versioned approved plan contract (or separately encode execution authority), while keeping all legacy implementation tasks P-only. Include this producer in requirement coverage, verifier dependency, every historical maker principal, readiness/history/retry integrity, selection role and readonly stage-envelope checks. Hash and display the distinction before approval. Add an immutable generated-output target appropriate to a narrow document transformation contract; bind actual persisted bytes to attempt, input, plan and requirement digests. Preserve old plan/history encodings.

Completion gate: real SQLite plan->claim/reservation->M runtime->owned generated artifact->independent checker->acceptance tests, with fake adapters only for offline testing. Negative cases: M candidate cannot execute legacy implementation, missing maker/reviewer identity remains unknown, same actor under different attempt labels fails independence, changed output invalidates acceptance, unclean attempts block advancement. These are component tests; real eligibility and live flow remain separate.

## Minimal supported first goal

Use an explicitly selected narrow template: transform user-supplied structured data into an approved output schema with exact field/value preservation. Freeze concrete requirement parameters before approval. One qualified Qwen producer generates text; a separately registered deterministic checker actually parses and compares the persisted output against approved input. Its principal identifies a real pinned checker implementation/execution authority, not a second label for Qwen or a model-generated pass string. This supports only the stated mechanical contract, not arbitrary semantic correctness or general coding.

The verifier stage needs a real host-checker runner/candidate and its actual qualification/trust contract; returning a fabricated completed stage is not integration. Do not call the same model twice solely to invent independence. If no genuine verifier execution identity is available, retain unverified status.

## Concrete host wiring after the contract unit

1. Bootstrap: app/main.mjs currently calls createCueCore(config) with no orchestration host. Create one AppDaemon, construct a default host with that same daemon.db, then pass it to createCueCore(config, daemon, { orchestration: host }). Alternatively introduce a host factory after core opens its database; avoid two ledger owners.
2. Preparation: OrchestrationHost.prepare persists/selects a real saveSelectionPolicy revision matching requested mode, returns the approved candidate/scope IDs, proposed plan, concrete requirements, budget and finite limits. Disable retries initially. A single supported candidate is acceptable; it is not evidence of comparative performance superiority. Estimates need measured provenance, not fixture scores.
3. Parent approval: core.prepareGoalRecord currently hardcodes command/file_change actions, empty egress and no-network copy. For this template, approve no worker write authority and explicitly declare the fixed host broker provider destination. Scope grants and child envelopes must narrow that parent; no hidden egress exception. Requirements, output target, limits and mode must remain frozen.
4. Admission/runtime: install real host catalog, opaque evidence references, trusted bytes resolver, current subject recomputation, freshness limits and exact model role authorization. Resolve the adapter from persisted StageEnvelopeBinding, with the shared db and actual owned launcher session. Never publish fixture M evidence or grant P from M.
5. Authority/receipts: authorizePlan/Claim/Stage/Execution cross-check approval, policy, candidate and exact lineage. engine.reservation and verifyBudgetMapping use explicit currency units. engine.receipts and authority.verifyReceipt consume durable actual outcomes plus independent exact-attempt cleanup observations. Cancel acknowledgement is not cleanup. Budget finality is distinct from client termination; unknown provider usage/billing stays unknown unless a documented local monetary policy proves the narrower amount.
6. Acceptance: captureManifest reads persisted actual output bytes; isManifestCurrent rehashes/rechecks them. resolveChecker returns pinned collect/evaluate implementations. principalForAttempt resolves actual producer/checker authority and execution lineage. Only collect/finalize's accepted receipt changes completion. Durable reopen must retain the same evidence.

## Qualification dependency

M evidence is still pending. The fixed localhost provider remains a separately trusted server, not an AppContainer-confined server. Owned broker cleanup work is in progress under another maker. This audit does not inspect or approve their unfinished changes. Default host activation must wait for independent current-source evidence and a bounded real approved flow.

## Source references

- app/main.mjs:101; app/core.mjs:269,310,345
- app/orchestration-driver.d.mts:31 (host composition interface)
- daemon/src/orchestration/plan.ts:145 (coverage loop)
- daemon/src/orchestration/engine.ts:21,144
- daemon/src/orchestration/stage-envelope.ts:119
- daemon/src/verification/acceptance.ts:13,30,252,303
- daemon/src/selection/policy-store.ts:108; daemon/src/orchestration/store.ts:53

## Inspected source hashes
- app/main.mjs : C77670A5CB92EAC704E1345482045E14F7DA546B8006543507D35C0162FB7503
- app/core.mjs : 418B5086879485A97877ED0B66E286B449F07C21486D8FDB1DA0921A74763CAA
- app/orchestration-driver.d.mts : 4C98CF53C9F06D5116F5001FFE3D0B2B0A4A74C5D82974B00D9B5C0846D49697
- daemon/src/orchestration/plan.ts : 2E20CD2221480E943B168430C3BF6BB3DF1BAD6C047C2DC563408E6FC4FFF968
- daemon/src/orchestration/engine.ts : 9B09E5CCCFA70F8071764A9B2479A075262A5D945F3701F4D32AE292BA90CE1C
- daemon/src/orchestration/stage-envelope.ts : 575E3BC95F39BBDBA37898657A9981B86A1B5540355B435D004EA826E4CDB3DE
- daemon/src/verification/acceptance.ts : 256D64317BFCB24719556B2A1EBE57E93E2E274B3AEE382ED2564FE26F6401E0
