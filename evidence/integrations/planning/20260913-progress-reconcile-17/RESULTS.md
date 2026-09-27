# Integration documentation reconciliation 17

Date: 2026-09-13

Done contract before document edits: update only the four integration documents after the S1 harness review and the current full-suite result are terminal. Record the reviewed S3 startup fix, S1 diagnostics/harness result, and full regression as separate bounded claims; preserve earlier native failures and the exhausted actual-native cap.

Correction cap: 2. Every pass checks exact review wording and counts, local Markdown links, SHA-256, and the scoped whitespace diff. A failed pass requires a concrete new hypothesis.

Boundaries retained: migration 016 behavior is unchanged; no actual native permission/cleanup proof, provider/model qualification, restore/CAS, broad S0-S7 completion, or current S7 snapshot claim. Snapshot `0c5f4ecd...` is historical after the ledger source edit. The parent GOAL remains `usageLimited` and unfinished.

This documentation unit performs no tests, build, model/native/Electron calls, OS actions, or product-source changes.

## Applied reviewed evidence

- S3: [`../../S3/20260913-ledger-startup/review.md`](../../S3/20260913-ledger-startup/review.md) — 5 files, 42/42 and build0 for serialized schema startup, rollback/handle release, and exact claim contention; migration016 remains on its prior separate boundary.
- S1 diagnostics: [`../../S1/20260913-readonly-acl-diagnostic/review.md`](../../S1/20260913-readonly-acl-diagnostic/review.md) — inherited-environment autoload failure and exact production two-key success are bounded observations, not proof of the raw-missing historical failure.
- S1 harness: [`../../S1/20260913-readonly-harness-repair/review.md`](../../S1/20260913-readonly-harness-repair/review.md) — offline 9/9 for exact environment sanitation, raw diagnostics/terminal receipts, and old-manifest rejection before filesystem/native work. No native rerun or cap reopening.
- S7: [`../../S7/20260912-current-source/recapture-review-20260913.md`](../../S7/20260912-current-source/recapture-review-20260913.md) — current static snapshot `9d228642...`, 164 files, 371 declared import edges, five artifact hashes. Earlier snapshots remain historical.
- Regression: [`../../20260913-regression/review.md`](../../20260913-regression/review.md) — independently audited executed scope PASS after build0: 191/191 files, 1266/1271 tests passing, 0 failures, 5 explicit skips, 1019.04 seconds. Sole exclusion `p10c-manifest` remains an unknown pin and is not passed.

## Documentation gate

- Scoped whitespace gate: `git diff --check` over the four owned documents — PASS.
- Local Markdown link audit: 356 links checked, 0 missing.
- SHA-256:
  - `docs/INTEGRATION_SPEC.md`: `E9A9C0393D734D4CBA71BCAC805D2755147EC8F8C12AD1D41E51743948918D02`
  - `docs/INTEGRATION_CHECKLIST.md`: `CB419494B582EE970603CBF3415659D7D7C8F3606F5A5CC4A620D5F6902DF42F`
  - `docs/INTEGRATION_PROGRESS.md`: `71D074804BFFFF312FFE542C6DFE9795F0BE805B95232B0EF1A90FB10A6FE84E`
  - `docs/integration/LOOP.md`: `80390B4D5AC1DEE8E7D904F37344589A90CFA29BB6984CAB9B2B5D250ABAEF08`

Broad S0-S7, actual read-only verifier permission/cleanup, provider/model qualification, restore/CAS, and the unknown excluded pin remain open. The GOAL is still `usageLimited` and unfinished.
