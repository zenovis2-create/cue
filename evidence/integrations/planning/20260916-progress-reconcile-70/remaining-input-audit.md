# Remaining live-input audit (batch70)

Status: read-only blocker audit; no product/source/global-document change, provider call, port probe, credential/config read, CLI execution, download, or local-model access.

## Done contract

One authoring pass only. Done means this report (1) maps the 14 still-open S0/S1/S2/S5/A01/A08 parents from the original 22, (2) distinguishes missing external facts from startable code, (3) names the exact receipt authority needed by S2-02/S2-03/S5-03, (4) identifies current production seams and the repository's second-agent evidence without elevating fixtures to qualification, and (5) gives a bounded next unit with executable gates. Verification for this pass is heading/ID presence plus `git diff --check` on this file. A failed gate requires a new hypothesis or human handoff; no repeat write.

## Finding

The 14 scoped parents are **not all externally blocked**. Final monetary truth and live qualification need external facts, but current source already contains a production Codex token-usage producer and strict storage/projection contracts. The next useful code unit is to connect stored, attempt-bound activity and final budget receipts to an omission-detecting terminal accounting manifest. It must preserve monetary values as unknown until an authorized receipt verifier supplies final provider evidence.

The complete original-22 partition is: scoped here `S0-01`, `S1-01..05`, `S2-02..03`, `S5-03..05`, `S5-08`, `A01`, `A08` (14); outside this audit `R03..R06`, `S3-01`, `S3-03`, `S4-01`, `S4-05` (8). Batch69's 22/44 arithmetic is therefore consistent.

## Exact external receipt required

For a monetary request, Cue needs a provider/account-authoritative billing or invoice record whose authenticity is checked by a deployment-owned verifier and which can be bound to the stored `runId`, `requestId`, `attemptId`, provider/account identity, currency/unit, observed/effective timestamps, monotonically increasing receipt revision, and final/non-final status. A final record must state actual units and provider finality; cancellation acknowledgement, local process exit, token telemetry, list price, quota display, or a model-authored statement cannot supply finality. To make handoff allocation `known`, that same authoritative evidence (or a provider-authoritative itemization derived from it) must partition the exact final total into base, retry, verification, and handoff units, with evidence bytes/digest. If the provider exposes only an aggregate invoice, Cue must keep phase allocation partial/unknown; it cannot invent the split.

This is the contract already enforced by `createBudgetManager(...).observe` in `daemon/src/budget.ts` (`verifyFinalReceipt`) and `createHandoffAccountingStore` in `daemon/src/evaluation/handoff-accounting.ts` (`stored-final-invoice-partition`). What is absent is a deployment composition that obtains and verifies such a provider receipt and supplies `MeasuredFactHost.captureHandoffAttribution`. No existing repository event can honestly manufacture monetary finality.

## Existing production facts and actionable code

| Seam | Current evidence | Consequence / original task |
|---|---|---|
| `createCodexExecutor` (`daemon/src/adapters/integration-executors.ts`) | Converts cumulative `thread/tokenUsage/updated` into per-attempt delta `usage` activities, rejects post-cancel growth, and emits explicit zero/unknown when no usage was observed. `daemon/test/codex-usage-producer.test.ts` covers retry reset and cancellation. | A real production producer already exists for **observed token quantity**, useful to S2-03/S5-03 completeness. It is not a price or bill. |
| `createHandoffActivityStore.activity` (`daemon/src/orchestration/handoff-activity.ts`) | Stores ordered, replay-checked, exact-attempt usage/tool/output/terminal activity. | Can support a deterministic terminal manifest over success/failure/cancel/unknown and missing-activity reasons without external calls (S2-03/S5-03). |
| `createAuthoritativeAccountingStore` (`daemon/src/evaluation/authoritative-accounting.ts`) | Projects every reservation and latest receipt at a fixed cutoff; identifies base/retry/verification/unclassified lineage and refuses incomplete actual final totals. | Existing accounting lineage can detect omitted retry/verification attempts. It cannot infer provider price or handoff allocation (S2-02/S2-03). |
| `createHandoffAccountingStore` (`daemon/src/evaluation/handoff-accounting.ts`) | Validates exact final receipt + execution handoff + evidence and checks component sum. Missing entries remain explicit `handoff-cost-disposition-unavailable`. | Storage/validation is implemented; only the trusted production attribution producer is absent (S2-03/S5-03). |
| `createEvaluationMeasuredFactStore` (`daemon/src/evaluation/measured-facts.ts`) | Calls optional `captureHandoffAttribution`; validates activity coverage and preserves uncertainty. | Product composition can add a producer; leaving the callback absent is safe and yields unknown rather than fabricated completion (S5-03). |
| `snapshotCostCapacityObservation` (`daemon/src/selection/cost-capacity-observation.ts`) | Strict immutable observation-only snapshot with actual/estimated/unknown and fresh/stale/future states. | Validation exists, but there is no trusted deployment ingestion/store binding for actual price/quota/billing (S2-02 external fact plus startable composition work). |

### Correction after existing-consumer audit

Do **not** add the terminal-manifest projection proposed below. Existing code already covers the intended inventory:

- `readRunOutcome` enumerates every attempt, retains failed retry history, produces top-level success/fail/cancelled/unknown, and derives all-reservation base/retry/verification totals from `createAuthoritativeAccountingStore`.
- `validateStoredExecution` in `measured-facts.ts` requires exact execution-subject coverage for every stored attempt and exact activity-cutoff membership, with explicit missing usage/tool/output/terminal uncertainty.
- `inspectHandoffCostCoverage` and `createHandoffAccountingStore` already expose missing handoff lineage/allocation and validate authoritative final partitions.

The proposed projection would duplicate these consumers without creating receipt authority.

One concrete, existing-consumer defect remains: `readRunOutcome` legitimately returns non-null `breakdown.baseUnits`, `retryUnits`, and `verificationUnits` for fully final, classified receipts (`run-outcome.ts`, exercised in `integration-evaluation-outcome.test.ts`). But `validateOutcome` in `observations.ts` rejects the observation whenever **any** breakdown member is non-null (`if(Object.values(b).some(x=>x!==null)) fail(...)`). Thus a final reconciled outcome cannot be persisted by `createEvaluationObservationStore`, precisely where S5 cohorts consume it.

Minimal failing regression belongs in `daemon/test/integration-evaluation-observations.test.ts`: extend its existing fixture with final actual receipts for every reservation (or share the final-accounting fixture pattern from `integration-evaluation-outcome.test.ts`), assert `readRunOutcome(...).accounting.breakdown.baseUnits` is non-null, then call `store.observe(...)`. Current behavior throws `evaluation_observation_outcome_integrity`; desired behavior persists and re-reads the exact breakdown. The minimal fix belongs only in `validateOutcome`: accept `null` or canonical non-negative decimal strings for each of the four fields, require all four null when `accounting.final === false`, and retain `handoffUnits:null` unless authoritative handoff attribution is present. Do not recalculate or grant finality in the validator.

Focused gate: `npx --no-install vitest run test/integration-evaluation-observations.test.ts test/integration-evaluation-outcome.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`, then `npx --no-install tsc --noEmit`. Original mapping: direct **S5-03** observation/cohort ingestion; supporting **S2-03** reconciled cost propagation. It still does not close either parent without provider receipts.

### Superseded implementation proposal (do not execute)

The earlier proposal was to add an activity/accounting terminal-manifest producer. The audit above shows that this would duplicate current projections and should not be implemented.

Suggested ownership: new `daemon/src/evaluation/terminal-accounting-manifest.ts` and `daemon/test/integration-terminal-accounting-manifest.test.ts`; wire it into measured-fact capture only after an independent review of the standalone projection.

Named gates:

1. `npx --no-install vitest run test/integration-terminal-accounting-manifest.test.ts test/codex-usage-producer.test.ts test/integration-evaluation-authoritative-accounting.test.ts test/integration-handoff-accounting.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`
2. `npx --no-install tsc --noEmit`
3. Adversarial cases: success/failure/cancel/unknown all represented; retry and verifier attempt omitted => reject; missing/zero-unknown usage remains unknown; non-final/cancel ACK never final; duplicate/reordered events reject; handoff missing remains explicit; replay/reopen byte-equal; callback/write count zero on malformed input.

The existing projections plus the validator correction can support, but cannot close, S2-03/S5-03 until a real provider receipt source exists.

## Second-agent evidence (Claude Code)

Repository evidence identifies a plausible installed second agent without reading its configuration: `evidence/integrations/S0/20260915-installed-cli-identity/observations.json` records `C:/Users/User/.local/bin/claude.exe`, version `2.1.270`, SHA-256 `fd7f35ec...b1a9ec7e`, valid Authenticode, signer `Anthropic, PBC`. The record explicitly says authentication was not inspected, protocol qualification is false, and model calls were zero. It is trustworthy evidence of the observed installed file/signature, not account entitlement or adapter eligibility.

There is **no production Claude adapter/configuration in the current source**. `daemon/src/adapters/registry.ts` registers only `codex`. `daemon/test/fixtures/claude-jsonl-fixture.ts` and `scripts/reuse/claude-launch-spec.mjs` are synthetic, non-executable contracts; `evidence/integrations/S1/20260912-claude-protocol/fit-review.md` confirms the decoder was deliberately removed from production. Historical help/version evidence describes `--print`/JSON/stream-json and tool/settings controls, but no current actual stream capture binds those declarations to version 2.1.270. Therefore S1-03 remains blocked on approved authentication/installation use plus one bounded real protocol observation. A startable pre-live code unit is a disabled `createClaudeModelOnlyExecutor` with host-supplied spawn/stop and no registry/admission entry, but it should wait for a source-backed/current wire schema decision to avoid encoding another invented dialect.

No evidence found supports probing Qwen/8085; it remains OFF and excluded.

## Scoped parent disposition

| Original task | Missing external fact | Actionable now |
|---|---|---|
| S0-01 | Codex underlying executable provenance remains deferred; Claude auth/current wire compatibility; local OFF. | Preserve signed Claude identity observation; no honest protocol qualification from fixtures. |
| S1-01 | Actual selected transport lifecycle and provider terminal behavior. | Changed-hypothesis offline lifecycle matrix/terminal manifest can be built, but cannot select/adopt transport alone. |
| S1-02 | Trusted current Codex executable SHA and live equivalence receipt. | Existing Codex adapter preservation/usage tests remain useful; no closure without the pin. |
| S1-03 | Approved Claude auth/use and current real stream; local ON decision separately. | Disabled adapter skeleton only after wire contract decision; no current production adapter exists. |
| S1-04 | Provider cancel/terminal/billing receipt. | Existing lifecycle ledger can keep request, ACK, terminal, cleanup, and billing-unknown distinct. |
| S1-05 | Fresh required P13/M receipts for every supported target. | Current source suites can run after target dispositions; it is an aggregate gate, not first work. |
| S2-02 | Trusted price/quota/billing observations per provider/account. | Add deployment ingestion interface/store binding that defaults unknown and uses existing snapshot validation; no paid call needed. |
| S2-03 | Final monetary receipt and, for known phase allocation, authoritative itemization. | Terminal-manifest producer is concrete now; existing reservations/receipts/retry/handoff rows support omission checks. |
| S5-03 | Same receipt/itemization for known totals. | Same terminal manifest plus measured-fact composition; terminal state coverage is locally derivable. |
| S5-04 | Actual frozen dataset/holdout and complete paired manual baseline runs. | Contract/setup checks can be implemented or rerun, but final cohort is live data. |
| S5-05 | Four-mode paired holdout measurements meeting floors/objectives. | No meaningful closure before S5-04 and trusted measures. |
| S5-08 | Approved-budget actual trials and current required receipts/review. | Named suite can be a later gate; not a producer. |
| A01 | One pinned goal/revision actually executed in four supported modes. | UI/projection composition can be checked after S2/S5 inputs; cannot fabricate cohort. |
| A08 | All applicable current stage/live receipts and independent review. | Release tests are aggregate verification after upstream rows, not a standalone implementation target. |

The most valuable immediate path is therefore: terminal manifest (S2-03/S5-03) -> trusted observation ingestion interface defaulting to unknown (S2-02) -> deployment-selected receipt verifier/source -> actual cohorts (S5-04/S5-05/A01) -> aggregate S5-08/A08 gates.
