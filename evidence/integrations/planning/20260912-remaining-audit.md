# Cue integration remaining-work truth audit — 2026-09-12

Scope: read-only review of `docs/INTEGRATION_SPEC.md`, `docs/INTEGRATION_CHECKLIST.md`, `docs/INTEGRATION_PROGRESS.md`, `docs/integration/LOOP.md`, and the relevant source/test/evidence inventory. No tests, builds, Electron/native/model/provider calls, or product edits were performed. This report is the only file written.

## Verdict

The checklist is materially conservative, but it is now behind the source in a few narrow places. Sixteen unchecked lines have enough source-bound evidence to be reconciled as documentation-only work (A). Most remaining lines are still real implementation work (B), actual/exhausted external gates (C), or stage/product-wide acceptance gates (D). No evidence supports whole S0–S7 completion.

There is also one completed narrow S5 component for which the checklist has no dedicated row: the enrollment/observation/coverage IPC and renderer unit independently passed its source gate (`evidence/integrations/S5/20260912-evaluation-ui/review.md:5,23-25,38-49,62`). It should be documented as a checked component, paired with a separate unchecked actual-Electron row. The actual proof has not run: the preflight remains blocked at the exact database-count gate and records Electron executions as zero (`evidence/integrations/S5/20260912-evaluation-ui/actual-proof-preflight.md:3-5,36-54`; `actual-qa-plan.md:15-17`). `docs/integration/LOOP.md:9` still names this already implemented UI unit as “Next,” while the source exposes `cue:evaluation` and the renderer flow (`app/ipc.mjs:2,208-229`; `app/renderer/renderer.js:159-213`).

## A — implementation/evidence exists; checklist reconciliation only

These are safe candidates for a documentation pass, provided the checklist wording is kept narrow and retains the cited limitations.

| Unchecked checklist line(s) | Why the existing evidence is sufficient |
|---|---|
| 45 | The catalog already distinguishes four capability kinds and the checked row immediately below records the independent eight-check gate (`INTEGRATION_CHECKLIST.md:45-47`). This closes kind separation only, not discovery/admission. |
| 49 | Cue-owned identity, execution ID, cancellation vs cleanup, and adapter ownership are independently covered by the common contract and concrete adapters (`INTEGRATION_CHECKLIST.md:49-50,59,61,72-77`). |
| 60 | Start/event/cancel/cleanup/usage lifecycle is split across the concrete adapter, lifecycle, transport, and cleanup gates (`INTEGRATION_CHECKLIST.md:58-61,77`). “Unsupported feature” remains an explicit runtime-contract field rather than actual support. |
| 62 | Admission already rejects missing, stale, fixture, changed-fingerprint, and unauthenticated/unqualified evidence (`INTEGRATION_CHECKLIST.md:62,67-68`; `docs/INTEGRATION_SPEC.md:123-125`). |
| 70 | Store, native commit, reopened-ledger read-only observation, protected Core host, and UI projection now collectively satisfy the narrow persistence/re-observation statement (`INTEGRATION_CHECKLIST.md:70-75`). This is not full restart recovery or execution resumption. |
| 89 | The following checked item records four modes, persisted default/CAS, run pinning, and actual Electron QA (`INTEGRATION_CHECKLIST.md:89-90`). Keep the “disabled without a real host” limitation. |
| 93 | Mode/model separation, fixed candidate choice, and mode UI are already covered by the pure selection and preference gates (`INTEGRATION_CHECKLIST.md:90,93,96`; `INTEGRATION_PROGRESS.md:274-275`). |
| 95 | The checked pure selector explicitly covers quality/cost/deadline/resource filters and deterministic tie-breaking (`INTEGRATION_CHECKLIST.md:95-96`). Host observations and execution remain separate. |
| 107 | The named selection suite's reproducibility, hard filtering, and deterministic selection evidence is already recorded by the checked selector row (`INTEGRATION_CHECKLIST.md:96-107`; `INTEGRATION_PROGRESS.md:182`). Do not imply live data or all S2 gates. |
| 160 | The retry integration already requires host-confirmed clean state before a replacement attempt and preserves unsettled ownership (`INTEGRATION_CHECKLIST.md:158-160`; `INTEGRATION_PROGRESS.md:280-283`). |
| 164 | The generated-output store, capture bridge, isolated deterministic checker, preparation/approval, and acceptance host cover the exact immutable source/attempt/checker binding (`INTEGRATION_CHECKLIST.md:164-176`). The live Qwen workflow remains failed. |
| 172 | Independent producer/verifier identity and rejection of self-attestation are implemented in requirement acceptance and finalization (`INTEGRATION_CHECKLIST.md:170-176`; `docs/INTEGRATION_SPEC.md:154-158`). |
| 177 | The acceptance unit and app connection require all required outcomes to pass and preserve fail/unknown in history (`INTEGRATION_CHECKLIST.md:175-177`; `INTEGRATION_PROGRESS.md:263`). This does not prove an actual live workflow. |
| 234 | The report foundation already generates IR from ledger/declared source and distinguishes planned from observed facts (`INTEGRATION_CHECKLIST.md:230,234,239-240`). |

No other unchecked line has enough current evidence for a truthful documentation-only closure. In particular, the S5 foundation deliberately hard-codes `promotionEligible: false` and describes its trial producer as trusted/in-memory (`daemon/src/evaluation/comparison.ts:107-110`; `evidence/integrations/S5/20260911-evaluation-foundation/review.md:24-32,36-51`), so it cannot close the broad S5 outcome or promotion rows.

## B — next bounded implementation work

| Unchecked checklist line(s) | Bounded work still possible without a live provider gate |
|---|---|
| 91-92, 97 | Finish R-04–R-06 disposition/admission boundaries and enforce that transforms cannot mutate candidate authority, reservation, or final selection. Persist automatic transition reasons within the approved envelope. |
| 102-103, 106 | Complete durable price provenance/staleness types, end-to-end retry/handoff/verification accounting, and a cold-start/exploration-budget policy. Provider truth remains a later C gate. |
| 119, 121-123 | Connect read parallelism/write leases, artifact/source handoff hashes, heartbeat/tool/artifact activity, and durable wait/checkpoint ordering to the real driver. Existing plan/store/envelope units are foundations, not these integrations (`INTEGRATION_CHECKLIST.md:117-131`). |
| 132-133 | Consolidate the already separate UI facts and add the missing final-overwrite regression to the named orchestration suite. Actual Stop cleanup remains a C/D scenario. |
| 158, 161-163, 178-179 | Implement cause-complete transition/replan branches, cumulative limits across plan revisions, change-record/restore guards, type-specific evidence policies, and crash-held recovery. The current checked retry path covers transient retry only (`INTEGRATION_CHECKLIST.md:158-179`). |
| 193-195, 197-198 | Build the durable observed-trial and comparison path: identities/revisions, failures/cancel/unknown, retry/handoff costs, evaluation+holdout membership, manual baseline authority, environment/price provenance, and a rollback-safe promotion state that stays disabled until evidence qualifies. Current observations explicitly expose trial conversion as unavailable (`evidence/integrations/S5/20260912-outcome-collection/review.md:19-27`). |
| 216-219, 221-222 | Add a frozen bilingual quality corpus/metrics, exclusion scanning for auth/environment/raw conversation, package restart/next-run behavior, explicit no-hook/no-MCP-injection checks, and declarative extension quarantine. Existing lexical/package foundations explicitly leave quality, restart, and app connection separate (`INTEGRATION_CHECKLIST.md:212-222`). |
| 241 | Regenerate from the current Cue revision and produce a readable structure/comparison visualization with source-bound claims. The existing 104-file snapshot predates later source changes and its 13,287px flat list failed the architecture-visual standard (`INTEGRATION_CHECKLIST.md:241-242`; `INTEGRATION_PROGRESS.md:93`). |

## C — actual external, OS-surface, or exhausted gate; cannot close now

| Unchecked checklist line(s) | Blocking truth |
|---|---|
| 28, 30-32 | Exact tool/model identity, auth, protocols, aliases, upstream commits/licenses, and unsupported conditions require current external/product inspection. PATH and `--help` evidence is explicitly insufficient (`INTEGRATION_CHECKLIST.md:28-37`; `INTEGRATION_PROGRESS.md:94,301,303`). |
| 48, 51-52, 69, 78 | Real connector normal/failure/cancel/restart behavior, Codex preservation, a second agent, current local-model qualification, remote cancellation/billing termination, and P13/M qualification need real runtimes. Current Qwen evidence is revision-historical and does not qualify the present source (`INTEGRATION_PROGRESS.md:284-295`). |
| 101 | Selection-explanation actual Electron QA ended FAIL after both attempts; the checklist expressly says the two-attempt cap is exhausted (`INTEGRATION_CHECKLIST.md:101`). |
| 105 | Quota exhaustion, GPU insufficiency, and provider billing termination need trustworthy current provider/OS observations; fixture checks alone cannot close it (`docs/INTEGRATION_SPEC.md:61-65`). |
| 146 | The package entry's nonvisual portion passed, but visible-window capture left the aggregate result false (`INTEGRATION_CHECKLIST.md:146-147`; `INTEGRATION_PROGRESS.md:59,63`). |
| 153 | Both the historical and fresh Qwen allowances are exhausted; the latest workflow had bytes but no checker/final acceptance/verified cleanup (`INTEGRATION_CHECKLIST.md:153`; `docs/integration/LOOP.md:17-19,39`). |
| 196, 199 | Four-mode real improvement and the approved-budget measurement portion require actual comparable trials; no existing evidence supplies measured quality/time/prices or promotion authority (`INTEGRATION_CHECKLIST.md:183-199`; `evidence/integrations/S5/20260912-outcome-report/docs-audit.md:7-11`). |
| S5 evaluation UI actual QA (missing checklist row) | Source gate passed, but no Electron attempt exists and the last independent preflight is still blocked (`evaluation-ui/actual-proof-preflight.md:32-54`). The later plan text claims the exact-count assertion was prepared (`actual-qa-plan.md:17`) but is not an independent re-review or execution result. |

## D — final stage/product acceptance gates

| Unchecked checklist line(s) | Why it is aggregate rather than a next code unit |
|---|---|
| 11-22 | These are the reusable gates repeated per adopted feature. Partial R-01–R-08 records cannot close the global template (`INTEGRATION_CHECKLIST.md:7-22`). |
| 248-255 | These are end-to-end release scenarios and milestone/release gates: four-mode same-goal runs, failover, parallel Stop, crash/restart, false-success rejection, scope/budget denial, stage separation, and full tests/reviews (`INTEGRATION_CHECKLIST.md:244-255`). Component tests must not be substituted. |

The release scenarios include external/runtime dependencies, but D takes precedence because the checklist defines them as the final integrated acceptance surface.

## Recommended next three implementation units after the S5 UI source gate

The order below closes the largest internal S5 seam while remaining fail-closed about real performance. It does not reopen the blocked S5 Electron proof or exhausted Qwen/selection gates.

### 1. Durable observed-trial projection (fail closed)

**Dependency:** completed enrollment, stored observation, and historical outcome reader (`evaluation-enrollment/review.md`, `evaluation-observations/review.md`, `outcome-collection/review.md`).

**Done:** given one immutable enrollment plus a stored observation, produce at most one immutable trial slot whose run/case/arm/policy/environment/account-limit identities come only from stored records; map fail/cancel/unknown without dropping them; require explicit tool/model revision, quality, elapsed, currency/unit, price timestamp/source, and four cost components before declaring the slot comparable. Missing facts return stable non-convertible reasons. Exact replay is idempotent; conflicting replacement is rejected. No promotion or execution transition exists.

**Owned file scope:** new `daemon/src/evaluation/trials.ts`, new `daemon/test/integration-evaluation-trials.test.ts`, one reserved migration (next available number) plus its deploy-copy registration, and only the minimal exports needed from `enrollment.ts`, `observations.ts`, and `run-outcome.ts`. Do not touch renderer/IPC in this unit.

**Completion command:** from `daemon/`, `npx --no-install vitest run test/integration-evaluation-trials.test.ts test/integration-evaluation-observations.test.ts test/integration-evaluation-outcome.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`, then `npx --no-install tsc --noEmit -p tsconfig.json` and `npm run build` (all exit 0), plus source/dist migration byte equality and independent source-hash review.

### 2. Explicit manual-baseline authority and enrollment

**Dependency:** unit 1's trial identity contract. The present store intentionally rejects first-time `manual-baseline` enrollment (`evidence/integrations/S5/20260912-evaluation-enrollment/review.md:5-9,19`), while comparisons require that arm (`daemon/src/evaluation/comparison.ts:13-19`).

**Done:** add a separate pre-approval baseline declaration bound to dataset/case, actual run, immutable policy/candidate identity, environment/account-limit revisions, and an explicit user-approved baseline authority. It cannot be inferred from a current automated mode, enrolled after approval/execution, or used to authorize execution. Replay is exact; changes require a new ID. Unit 1 may consume it only after matching stored outcome facts exist.

**Owned file scope:** new `daemon/src/evaluation/baseline.ts`, new `daemon/test/integration-evaluation-baseline.test.ts`, next reserved migration/deploy registration, minimal integration in `daemon/src/evaluation/enrollment.ts` and `app/core.mjs`/`app/core.d.mts`. Keep IPC/renderer out unless the backend review passes first.

**Completion command:** from `daemon/`, `npx --no-install vitest run test/integration-evaluation-baseline.test.ts test/integration-evaluation-enrollment.test.ts test/integration-evaluation-trials.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`, then typecheck/build exit 0, migration byte equality, and an independent review proving no execution/promotion authority was added.

### 3. Durable comparison snapshot with promotion disabled

**Dependency:** units 1 and 2, complete paired evaluation+holdout coverage, and the existing descriptive comparison core. Do not wait for actual model trials to implement the fail-closed store/API.

**Done:** collect only complete, immutable trial slots at a stored cutoff; call the existing comparison logic with a versioned constraints snapshot; persist the dataset/trial/constraint/result digests atomically; preserve sample counts, variance, unknown/failure denominators, environment/account-limit matching, and price freshness. Expose `insufficient`, `no-observed-improvement`, or descriptive `observed-improvement`; keep `promotionEligible=false` and provide no policy mutation. A later, separately authorized real-trial gate can supply evidence without changing this contract.

**Owned file scope:** new `daemon/src/evaluation/comparisons.ts`, new `daemon/test/integration-evaluation-comparisons.test.ts`, next reserved migration/deploy registration, minimal read-only Core methods in `app/core.mjs`/`app/core.d.mts`, and reuse `daemon/src/evaluation/comparison.ts` without relaxing its guards.

**Completion command:** from `daemon/`, `npx --no-install vitest run test/integration-evaluation-comparisons.test.ts test/integration-evaluation-trials.test.ts test/integration-evaluation.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`, then typecheck/build exit 0, migration equality, and independent replay/tamper/no-policy-write review.

After these three units, S5 lines 193-195 and 197 can be reconsidered narrowly. Lines 196 and 199 must remain open until real, approved, comparable evaluation and holdout trials exist. Line 198 should remain open until a separate promotion/rollback design is implemented and proven; the recommended comparison unit intentionally cannot promote.

