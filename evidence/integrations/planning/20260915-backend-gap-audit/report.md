# Independent remaining-backend and readiness review

Date: 2026-09-15  
Reviewer: Codex `/root/remaining_backend_discovery`  
Scope: offline source, deterministic fixtures, and generated readiness artifact only. No model, provider, native helper, Electron, or live call was made.

## Verdict

PASS for the bounded S4-02, S4-04, A02, and A07 conditions reviewed here.

This does not qualify S4-01 live workflows, provider-side failure classification, S5 measured improvement or promotion, S3 final-byte publication, or the all-product release.

## Independent gate

- `npm run build` in `daemon`: exit 0.
- `npx vitest run test/integration-recovery-policy.test.ts test/integration-driver.test.ts test/integration-evidence-policy.test.ts test/integration-verification.test.ts test/integration-release-readiness.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`: 5 files, 95/95 tests, exit 0.

## S4-02 and A02

`FailureCause` has seven exact values: `transient`, `authentication`, `quota`, `capability-mismatch`, `quality-failure`, `policy-violation`, and `unknown`. The policy produces the four bounded actions `retry`, `switch`, `replan`, and `stop`, with cleanup, external-effect, budget, deadline, total-attempt, candidate authorization/authentication/capability, and sealed-policy guards evaluated before recovery activation.

The added test-only capability cases close the previously missing explicit assertions: no approved alternate produces `replan`, while an approved authenticated capable alternate produces `switch`; unsafe cleanup still produces `stop`.

The public-driver quota fixture records the failed first attempt and `quota` observation, selects only `agent-b`, creates one recovery activation, then completes the replacement maker and checker. It reconciles three exact 10-unit reservations to 30 committed units and replay creates no launch or activation. This is sufficient for the original synthetic branch and fallback-tracking conditions. It is trusted injected host evidence, not real provider quota classification.

## S4-04

The installed requirement/evidence contract distinguishes `code`, `research`, `document`, and `external`. The focused suites prove exact code file/test/hostile evidence; research claim mapping; document section and render evidence; and an authoritative external transition observer. Partial evidence, wrong policy binding, model claims, caller scalars, and unscoped acceptance cannot create completion. The original task-kind evidence-definition condition is therefore met independently of S4-01 live qualification.

## A07 artifact

Reviewed generation:

`evidence/integrations/release/20260915-milestone-readiness/generations/89d23e3044a0cb4e81715f7f8b9ae27ce54f828d8cb90751cbe2749bb1d812cf`

Checks passed:

- `current-generation.json` manifest SHA-256 matches `generation.json`.
- The manifest generator SHA-256 matches current `scripts/reuse/cue-release-readiness.mjs`.
- All three source hashes and byte lengths match the current checklist, specification, and execution map.
- Both rendered files match their manifest hashes and byte lengths.
- HTML contains no script or HTTP(S) reference and uses a restrictive CSP.
- The report keeps S0-S4, S5, and S6-S7 separate; reports qualification `not-assessed`, S5 `not-proven`, and all-product `not-ready`.
- Checked boxes and present evidence files yield at most `documented`; empty sections and missing/bad references remain unverified.
- Generation identity covers the full report plus generator digest, so evidence or generator changes cannot silently reuse this ID.

The existing `evidence/integrations/release/20260915-milestone-readiness/maker.md` describes the earlier pre-correction projection and failed generation attempts. Its claims that S6-S7 were qualified and that no artifact exists are superseded by the corrected generator, tests, current generation, and this review. It must not be cited as the final artifact state without an explicit superseded note.

## Remaining genuine backend gaps

- S3-03 still has no actual final-byte publication seam. The orchestration suite proves atomic claims, lease retention/release, immutable handoff references, and reopen launch/resend zero, but cannot demonstrate that a losing writer is unable to overwrite materialized final workspace bytes.
- S5-07 remains unimplemented by design. Evaluation comparisons are descriptive and hard-code `promotionEligible: false`; no qualified comparison producer or durable promotion/predecessor-revert path exists. Do not add an unconnected activation store or convert fixture comparison into promotion authority.

