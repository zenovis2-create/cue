# Integration documentation reconciliation 21

Date: 2026-09-13

Done contract before document edits: update only the four integration documents after the post-ACL coordinator lifecycle review is terminal. Record stdio-gate preflight, newest failed actual run, read-only diagnostic proposal, and reviewed lifecycle correction as distinct bounded claims.

Correction cap: 2. Every pass checks exact review wording and counts, all local Markdown references with zero missing, SHA-256, and the scoped whitespace diff. A failed pass requires a concrete new hypothesis.

Boundaries retained: PID/ACL/profile/runtime/fixture post-state is not permission success. The changed exit from `0xC0000142` to `1` is neither a causal diagnosis nor success; `observed:null` remains. No actual rerun after the pending lifecycle change, new model call, qualification, or registration is inferred. Full-suite and S7 evidence remain historical. Broad S0-S7 and the `usageLimited` GOAL remain unfinished.

This documentation unit performs no tests, build, model/native/Electron calls, OS actions, or product-source changes.

## Applied reviewed evidence

- Preflight: [`../../S1/20260913-readonly-stdio-gate/review.md`](../../S1/20260913-readonly-stdio-gate/review.md) — 15/15 offline PASS for the single-use gate contract.
- Latest actual: [`../../S1/20260913-readonly-stdio-gate/actual-review.md`](../../S1/20260913-readonly-stdio-gate/actual-review.md) — FAIL/CLOSED after PID67984 and exit1 with `observed:null`; bounded post-state only, no permission proof.
- Diagnostic plan: [`../../S1/20260913-readonly-stdio-gate/diagnostic-review.md`](../../S1/20260913-readonly-stdio-gate/diagnostic-review.md) — PASS with constraints for future single-shot nonce-bound stage evidence; instrumentation remains unimplemented.
- Lifecycle: [`../../S1/20260913-readonly-launch-lifecycle/review.md`](../../S1/20260913-readonly-launch-lifecycle/review.md) — 3 files, 23 unique tests plus build PASS for timeout+15 seconds, abort/error/overflow/no-close settlement, verified worker-death gating, and retained runtime on uncertainty. Overlapping maker 11 tests were not added.

## Documentation gate

- Scoped whitespace gate: `git diff --check` over the four owned documents — PASS.
- Local Markdown reference audit: 354 references checked, 0 missing.
- SHA-256:
  - `docs/INTEGRATION_SPEC.md`: `B61AE3F0F863959B25DE574C37CCD56CB37C6A8D35C64A7E2EB431B9498C0DF3`
  - `docs/INTEGRATION_CHECKLIST.md`: `D1409273B0DE2337D7FFAE697F9683B4B54A72684AEC5C7B8465FCC669BFB076`
  - `docs/INTEGRATION_PROGRESS.md`: `BC875A8CEACA6F6DD2A5800C72D86A7386C59B0BBD6EBB834DD27359824872C3`
  - `docs/integration/LOOP.md`: `1930AA4EABF79BB8420A3396E0CE2CEEE473E6A59963F951130689DEF48AC708`

No native rerun after lifecycle changes, permission/qualification/registration proof, current full-suite/static snapshot, or broad S0-S7 completion is claimed. The GOAL remains `usageLimited` and unfinished.
