# Integration documentation reconciliation 20

Date: 2026-09-13

Done contract before document edits: update only the four integration documents after the windowless-gate actual review and startup diagnostic review are terminal. Preserve every historical run and record the newest actual failure, prelaunch expected-evidence semantics, and read-only diagnostics as separate bounded claims.

Correction cap: 2. Every pass checks exact review wording and counts, all local Markdown references with zero missing, SHA-256, and the scoped whitespace diff. A failed pass requires a concrete new hypothesis.

Boundaries retained: the windowless change did not resolve the observed `0xC0000142` startup failure; no permission scenario or success is inferred. `expected.json` is prelaunch `wx` evidence only for this gate; older PATHEXT expected values remained in memory before launch. `fs.chmod` denial is not generalized to arbitrary DACL behavior. The prior full suite and S7 snapshot remain historical. Broad S0-S7 and the `usageLimited` GOAL remain unfinished.

This documentation unit performs no tests, build, model/native/Electron calls, OS actions, or product-source changes.

## Applied reviewed evidence

- Latest actual: [`../../S1/20260913-readonly-windowless-gate/actual-review.md`](../../S1/20260913-readonly-windowless-gate/actual-review.md) — FAILED and closed after prelaunch durable expected evidence and PID48620 creation; `0xC0000142`, `observed:null`, and no permission scenario. Windowless did not resolve startup.
- Diagnosis: [`../../S1/20260913-readonly-startup-diagnosis/review.md`](../../S1/20260913-readonly-startup-diagnosis/review.md) — non-inheritable NUL stdio is a concrete contract defect; PID-matched `0xc0000008` is corroborating, not full causal proof.
- Offline repair: [`../../S1/20260913-readonly-stdio-repair/review.md`](../../S1/20260913-readonly-stdio-repair/review.md) — inheritable NUL handles, exact two-handle allowlist, initialized cleanup guard, and embedded-C# execution, 11/11 PASS. No post-repair native rerun.
- Earlier PATHEXT expected values remained in memory before launch; only the latest gate wrote `expected.json` prelaunch with `wx`. `fs.chmod` denial is not generalized to arbitrary DACL behavior.

## Documentation gate

- Scoped whitespace gate: `git diff --check` over the four owned documents — PASS.
- Local Markdown reference audit: 354 references checked, 0 missing.
- SHA-256:
  - `docs/INTEGRATION_SPEC.md`: `02259C3AA752A4A62DD34D661ACBD5DF64C0E7E0191CD733F7829E782A9228DB`
  - `docs/INTEGRATION_CHECKLIST.md`: `DA394C3DE4ED23F686DC256722C6F1C7837804F8292D9D80B84955E2EB58833F`
  - `docs/INTEGRATION_PROGRESS.md`: `1BC92BBD7F29BFA70423824DD4D2DD2635A30DD231F2E868A417B784086B47A9`
  - `docs/integration/LOOP.md`: `37163450C3E6A40088D6D08755D0D9CAAACF0F522AFF1717B35BF3C65552510A`

The LOOP authoritative heading is corrected to 2026-09-13. Prior full-suite and S7 evidence remain historical. No current runtime success, permission/DLL-cause proof, qualification, registration, or broad S0-S7 completion is claimed. The GOAL remains `usageLimited` and unfinished.
