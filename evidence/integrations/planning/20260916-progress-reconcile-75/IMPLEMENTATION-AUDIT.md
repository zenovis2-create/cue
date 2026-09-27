# Batch 75 remaining implementation audit

## Verdict

Three remaining original parents are offline backend conditions and must not inherit neighboring live requirements: S3-03 is closure-ready if an independent original-condition review pins the current named suite and writer evidence; S2-03 and S5-03 are conditionally closable when their shared accounting maker and independent gates prove the exact original invariants. The other remaining parents still require provider facts, actual lifecycle/boundary observations, a measured cohort, or all applicable release gates.

The cost runtime/UI consumer is already assigned to root, and the writer boundary and cost-attribution producer are excluded from implementation ownership in this audit. Their closure criteria are nevertheless audited below. No provider, model, network, authentication, or local endpoint call was made.

## Corrected offline closure audit

### S3-03 — closure-ready on the original wording

Original text: verify duplicate execution 0 and final-result overwrite 0 in `integration-orchestration.test.ts`.

The original row does not require provider qualification, a live model, universal standalone-adapter mediation, or classification of every shell outside the orchestration contract. Current `integration-orchestration.test.ts` contains the native winner/stale-loser/reopen case: winner A remains, the loser records one contention result, and reopening/resending performs no new authorization/publication. The suite also retains claim/reopen duplicate-execution controls. The writer admission path now refuses effect-capable `command`, `write_stdin`, `shell`, mixed, and unknown action sets before launch in its focused contract.

Therefore the previously recorded “arbitrary command-capable writes” and “standalone adapter” limitations are useful product boundaries but are not blockers stated by S3-03. They belong to S3-01/default workflow scope if applicable. S3-03 may close after an independent reviewer confirms the current hashes and passing named gate; no live measurement is required by its original wording.

Exact gate: current `daemon/test/integration-orchestration.test.ts` exit 0, with explicit claim/reopen duplicate launch 0 and native winner/stale-loser/reopen overwrite 0 assertions; retain the supporting `integration-driver-publication.test.ts` admission cases and TypeScript/build pins.

### S2-03 — conditionally closable offline

Original text: include invocation, retry, verification, and handoff cost, and verify parallel budget reservation/settlement.

Nothing in this row requires real provider billing. Synthetic fixed-unit receipts are sufficient to verify accounting completeness and concurrency invariants, provided they remain labelled fixtures and grant no price truth. Closure gate:

- every attempt phase is classified as base invocation, retry, verification, or handoff;
- reservation to terminal settlement is bound to the exact attempt/request lineage;
- concurrent reservations cannot exceed the budget;
- unknown/non-final cleanup releases zero;
- exact replay does not reserve or settle twice;
- totals equal the sum of all four classes, and omission/tampering refuses.

S2-02 remains separately open for trusted API/subscription/local observation truth and actual/estimated/unknown/stale display. S2-02 is not a prerequisite for proving S2-03's backend arithmetic with explicit fixture units.

### S5-03 — conditionally closable offline

Original text: include failure, cancellation, and unknown outcomes without omitting handoff/retry cost.

This is likewise an offline projection/completeness invariant. Closure gate:

- terminal projections cover success, failure, cancellation, and unknown;
- retry and handoff units survive into the outcome/measured-fact projection;
- missing phase attribution makes the record non-comparable or rejected rather than zero;
- stored/reopened totals reconcile exactly and stale/foreign receipts fail closed.

S5-05's actual four-mode improvement evidence must not be imported into S5-03. S5-03 can close on synthetic adversarial accounting fixtures plus independent review while measured optimization remains open.

## 1. Default native host deployment — next unassigned unit

Current state:

- `app/provider-installation.mjs` identifies and rechecks installed Codex/Claude bytes without granting qualification.
- `app/provider-installation-binding.mjs` binds an issued Codex descriptor to the native implementation candidate.
- `app/native-implementation-host.mjs` composes a complete staged implementation/checker workflow, but production code never calls `createNativeImplementationHost`; only tests do.
- `app/main.mjs` obtains its factory from `app/protected-installation.mjs`, whose only enabled host is the local generated-JSON/Qwen path. With Qwen OFF, there is no default native provider host.
- The native host accepts an opaque verifier candidate, but production has no corresponding verifier adapter. `createDefaultCodexCandidate` supports implementation only, and `createCodexExecutor` rejects roles other than `implementation`.

Small executable sequence:

1. Add a distinct verifier executor/candidate in `daemon/src/adapters/integration-executors.ts` and its declaration surface. It may reuse the reviewed host-Codex transport mechanics, but must require the verifier role, its own candidate/account/model identity, typed activity, Stop, durable reference, subject, and evidence callbacks. Do not weaken or generalize the implementation-role check.
2. Add `app/native-implementation-deployment.mjs` that accepts already trusted non-secret workflow/policy/accounting configuration plus separately injected implementation/verifier authority factories. It should call `createNativeImplementationHost` only when every existing authority is present; missing auth, evidence, policy, checker, billing verifier, or qualification returns explicit unavailable.
3. Extend `createStartupOrchestrationFactory` in `app/protected-installation.mjs` to select this factory only from an explicit, sealed host-kind setting. The default/missing setting remains unavailable while Qwen is OFF. Configuration must not convert installation identity into authentication, entitlement, qualification, or billing truth.
4. Keep `app/main.mjs` limited to wiring the chosen factory. It must not embed current-user paths, hashes, auth references, or fabricated verifier authority.

Focused gate:

`integration-runtime-contract.test.ts`, `integration-executors.test.ts` (or a new verifier-focused peer), `integration-native-implementation-host.test.ts`, `integration-provider-installation-binding.test.ts`, `integration-protected-installation.test.ts`, `integration-default-startup.test.ts`, then TypeScript/build. Required counterexamples: implementation descriptor used as verifier, same candidate/account identity for maker and checker, missing qualification/evidence/billing callback, installation drift, disabled setting, Qwen OFF, and configuration attempting to declare qualification.

Parent effect: meaningful offline progress on S0-01, S1-01, S1-02, and S1-05. It cannot close them without actual protocol/lifecycle/preservation and required P13/M receipts.

## 2. S4-05 production external-effect authority registration

Current state: `daemon/src/held-recovery.ts` has the strict observer/verifier contract and `app/native-recovery-host.mjs` consumes injected `externalEffectObservers` and `externalEffectVerifier`. `app/main.mjs` supplies only the generated-output handoff authority, so production startup always leaves decisive external-effect authority absent.

Small independent change:

- Add an exact, operation-keyed recovery-authority registry at startup and pass it through `nativeRecoveryFactory` into `createNativeRecoveryHost`.
- Registration must accept only already constructed observer/verifier callbacks with fixed IDs/revisions; config can select a registered operation but cannot manufacture authentication or a final receipt.
- Preserve the current behavior for an empty registry: held state, zero writer launch/resume, and `external-effect-authority-unavailable`.

Files: `app/main.mjs`, `app/native-recovery-host.mjs` and declaration, a small registry module, `daemon/test/integration-recovery-handoff.test.ts`, `integration-native-recovery-host.test.ts`, and `integration-held-recovery.test.ts`.

Gate: empty/unknown/duplicate/drifted registration remains held; one injected authenticated final observer/verifier reconciles the exact intent; reopen performs no resend or writer resume. This advances S4-05 offline deployment wiring. Authentic provider receipts remain an external blocker to parent closure.

## 3. R03 selection-scoped lifecycle matrix

Current source has narrow fixture receipts, update invalidation, Codex lifecycle machinery, and real OS process tests, but no single current selection matrix matching the original six behaviors: normal, failure, cancellation, restart, duplicate, boundary, with explicit pure-function N/A reasons.

Small independent change:

- Add a bounded lifecycle-matrix validator under `daemon/src/reuse/` (or the existing reuse-manifest module) that accepts only the currently selected R-IDs from the frozen selection catalog.
- Require exactly the six original columns per selected row. A cell is either a pinned executed receipt or a structured N/A containing a reason and proof that the selected seam is pure/no-lifecycle.
- Bind receipt path/hash and selected revision; missing, duplicate, extra, stale, or transport-N/A rows fail.
- Add `integration-reuse-lifecycle-matrix.test.ts` with the current pure fixture/tool selections and negative cases. Do not mark transport cancellation/restart rows N/A.

Gate: validator tests plus existing `integration-reuse-manifest.test.ts` and reuse update-invalidation tests. This can finish the offline portion of R03 and make the remaining provider rows exact. R03 itself remains open until selected transport lifecycle rows are actually observed.

## 4. R04/R05 and S1 adoption boundary

There is no adopted external product component in the current reuse manifests: fixture/tool selections are limited, R-08 copies no external bytes, and the manifests retain `adoptionAuthorized:false`. Therefore R04 cannot close by treating “adopted components” as an empty set. R05 likewise lacks an incorporated revision against which separate upstream, Cue-regression, and necessary real-boundary receipts can be bound.

The next executable action is not another generic manifest. After S1 selects a transport/adaptor disposition, extend the existing reuse manifest with:

- immutable component/package revision and source notice;
- exact Cue adapter import/entry point;
- patch ledger with explicit `none` permitted;
- shipped-byte/lockfile hash;
- separate upstream-test, Cue-contract, and actual-boundary receipt references.

Files should remain the existing `docs/reuse-decisions/manifests/<R-ID>.json`, reuse-manifest validator/tests, the selected adapter, and its focused runtime contract. Gate: an unpinned load, missing notice/patch field, adapter outside the recorded seam, or substituted revision must fail before dispatch. This is ready only after the selection decision; inventing an adoption now would weaken R04.

## Original-parent closure table

| Parent group | Offline work now | Can original parent close offline? | True blocker |
|---|---|---:|---|
| R03 | lifecycle matrix validator and pure/N/A rows | No | selected transport lifecycle receipts |
| R04 | incorporation contract after a real selection | No | adopted component/disposition and source facts |
| R05 | separate receipt binding after R04 | No | upstream/Cue/necessary actual boundary for same revision |
| S0-01 | default installation-to-host deployment | No | auth-reference semantics and actual protocol qualification; local remains OFF |
| S1-01/S1-02/S1-05 | verifier adapter and native startup factory | No | normal/failure/cancel/restart preservation and required actual P13/M |
| S1-03 | none while local is OFF; second-agent factory can be scaffolded only after protocol selection | No | second-agent actual route and user decision for local model |
| S1-04 | lifecycle ledger already separates facts | No | authenticated provider terminal/billing-stop observations |
| S2-02 | root-owned cost consumer | No | trusted production price/usage/capacity sources |
| S2-03 | shared accounting producer and concurrent settlement tests | **Yes, conditionally** | no live blocker; exact four-phase lineage/arithmetic gate |
| S3-01 | writer/default workflow work | No | actual default writable workflow qualification |
| S4-01 | default native deployment preparation | No | supported matrix workflow with independent checker/acceptance |
| S4-05 | external-effect registry wiring | No | authentic external receipt authority |
| S3-03 | current named duplicate/overwrite gate | **Yes; closure-ready after independent pin/review** | no live blocker in original text |
| S5-03 | assigned shared accounting producer | **Yes, conditionally** | no live blocker; all outcomes plus retry/handoff completeness gate |
| S5-04/S5-05/S5-08/A01 | dataset contracts already exist | No | approved actual baseline/holdout four-mode trials and settlement |
| A08 | local regression gates can pass | No | all required current actual receipts/reviews and deferred Codex-pin disposition |

## Recommended order after the root-owned cost consumer

1. Re-audit S3-03 against only its original named-suite condition and close it if the current pinned gate passes; do not require standalone adapter universality.
2. Finish and independently review the shared S2-03/S5-03 accounting producer against the exact offline closure gates above.
3. Implement the distinct verifier adapter and trusted native deployment factory. This is the shortest path from the already reviewed installation/native-host modules to an actual default app seam, and it exposes exactly which auth/qualification inputs remain external.
4. Wire the external-effect authority registry into production recovery startup. It is independent of provider execution and preserves held/no-resume behavior when no authentic authority is installed.
5. Build the R03 selection-scoped matrix only after the active adapter selections are stable, so its rows describe real selected seams rather than another speculative inventory.

No additional offline documentation-only pass should close R03-R05, S0/S1, S4-05, or A08. Their remaining conditions are observable behaviors or actual selected incorporation, not missing prose. This limitation does not apply to S2-03, S3-03, or S5-03, whose original backend conditions can be proven offline.
