# S2 R-04–R-06 reuse disposition

Date: 2026-09-12
Scope: documentation/evidence reconciliation only; no product source, dependency, lockfile, migration, provider call, user-home write, or historical experiment rewrite.

## Dispositions

- **R-04 — direct native implementation, bounded adoption.** The accepted surface is the strict in-memory Cue RoleSpec parser/serializer. Its output is inert role content. It cannot select a model, add tools, grant permissions, write files, install, or launch. TeamAI's transformer is rejected as a product dependency for this scope because the required Cue contract is smaller and already enforced by the native wrapper. The earlier TeamAI source observation remains historical; no upstream execution or broad quality claim is inferred.
- **R-05 — direct native implementation, isolated component accepted; production connection deferred.** The accepted surface is `scripts/reuse/usage-normalization.mjs` for the tested OpenAI Chat/Ollama fixture fields. It preserves unknown/partial counters and excludes arbitrary provider metadata. It cannot set price, candidate eligibility, reservation size, settlement finality, provider stop, or billing truth. No SDK/provider/product integration is claimed.
- **R-06 — direct native guards for current bounded contracts.** Exact-key and plain-object guards are accepted only at the R-04/R-05 tested boundaries. Ajv/Zod remain deferred until schema scale or exchange requirements justify them. This is not universal DTO validation, and validator success supplies no policy, qualification, execution, or settlement authority.

## Authority boundary

External transform observation is inert only. Fixture/provider-derived usage can be an untrusted observation candidate only. The authorizing chain is:

1. `daemon/src/selection/policy.ts` validates exact policy/candidate shapes, intersects `allowedCandidateIds`, applies checks and bounds, and returns `executionAdmissionRequired: true` plus `budgetReservationRequired: true`.
2. `daemon/src/orchestration/engine.ts` re-reads the bound policy, intersects task and approved candidate IDs, requires current `host.authorizeExecution(context)`, validates the reservation lineage/freshness, and performs claim plus Cue budget reservation in one immediate SQLite transaction before runtime launch.
3. `daemon/src/selection/attempt-decision-store.ts` writes from that claim transaction and labels the stored output `historical-explanation-only`. Reading or replaying `attempt_selection` does not grant current admission or reconstruct private host observations.

The reuse modules are not imported by these three authority modules. Role payload injections such as `permissions`, `tools`, nested model permissions, prototype fields, or executable-looking strings are rejected or remain JSON data. The usage normalizer exposes only fixed counter fields and retains no arbitrary candidate, policy, price, budget, reservation, settlement, or launch fields. The selection policy rejects extra fields (including a tested `permissions` injection), and the engine derives candidate, policy, reservation, claim, and launch context from its separately bound Cue inputs. Thus a transform injection cannot flow into policy, candidate checks, budget reservation, or launch through these contracts.

This structural proof does not establish that provider observations, prices, quota, GPU capacity, billing finality, or stop completion are true. Those rows remain open.

## Immutable cited artifacts

| Artifact | SHA-256 |
|---|---|
| `scripts/reuse/role-contract.mjs` | `e87000f81d394bbe1c766af199778df2b85062e6a9b26a27b6bc6fc13653948b` |
| `scripts/reuse/role-contract.test.mjs` | `d31a41b36c4cbccf53e0269c4e4b92df66347ccd98df5f55239d01c1d16496c4` |
| `evidence/integrations/S2/20260911-role/reuse/R-04/result.json` | `fdc56489ca33ef1c1606fb7cb3803f9d3863e2fa46033fe6f3487beef5b3d591` |
| `scripts/reuse/usage-normalization.mjs` | `2d5eb58c2d1d85a9bdeaf5b00840a780faaaaefd1585d9c5bce4668517f375fc` |
| `scripts/reuse/usage-normalization.test.mjs` | `0baaf73f2b173ef517cb64bc6064813b2266b955a61971505ee4f8ebf4a872a2` |
| `evidence/integrations/S2/20260911-usage/reuse/R-05/result.json` | `499bdfb657332ff97b110a9796786f16aa6f28f88e0e36f73f17af98ffc696ad` |

The artifact hashes above were recomputed on 2026-09-12 and match the hashes stored in the historical R-04/R-05 result JSON where those files are enumerated. The historical files themselves were not changed.

## Verification

Pre-edit and final commands use the Unit 1 gate with an attempt cap of one:

```text
node --test scripts/reuse/role-contract.test.mjs scripts/reuse/usage-normalization.test.mjs
cd daemon
npx --no-install vitest run test/integration-selection.test.ts test/integration-engine.test.ts test/integration-budget.test.ts test/integration-attempt-selection.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
npx --no-install tsc --noEmit -p tsconfig.json
git diff --check -- docs/reuse-decisions/R-04.md docs/reuse-decisions/R-05.md docs/reuse-decisions/R-06.md docs/INTEGRATION_CHECKLIST.md docs/INTEGRATION_PROGRESS.md evidence/integrations/S2/20260912-reuse-disposition/implementation.md
```

Pre-edit results: reuse 14/14 PASS, exit 0; TypeScript exit 0; focused daemon 35/36 PASS, exit 1. The single failure is the pre-025 ledger upgrade fixture reaching current `orchestration/store.ts` without `orchestration_launch_intent`; it is outside this documentation-only file boundary and is not reported as a pass.

Final results: reuse 14/14 PASS, exit 0; TypeScript exit 0; scoped whitespace/hash/link and checklist-state checks exit 0. The focused daemon suite was 34/36 PASS, exit 1: the same pre-025 `orchestration_launch_intent` failure remained, and the independent SQLite writer budget case also returned `database is locked` while the repository was under concurrent work. The one-pass cap is exhausted, so neither result is retried or relabeled as passing. This unit changes documentation only and makes no regression-clean claim.

Independent review: **PASS / CLEAR**, recommendation **APPROVE**. The [read-only report](../../../../.omo/evidence/s2-reuse-disposition-code-review.md) corroborated the three dispositions, current source authority chain, injection non-flow boundary, six artifact hashes, local links, scoped whitespace, and reuse 14/14 PASS. It found no adoption/install or clean-regression overclaim. Review limitation: all six target documentation files are untracked in the shared worktree, so Git has no base diff proving their historical checkbox state; the reviewer directly confirmed that the current S2 section checks the two intended rows while the named provider/cost/usage rows remain unchecked.

## Checklist effect and remaining limits

Exactly two S2 checklist rows close: the R-04–R-06 disposition row and the external transform/calculation authority row. Other S2 rows, including automatic transition evidence and all provider/cost/usage/capacity/billing/cold-start work, remain unchanged and unchecked where they were unchecked before this unit. No dependency was adopted or installed, and no migration or production connection was added.
