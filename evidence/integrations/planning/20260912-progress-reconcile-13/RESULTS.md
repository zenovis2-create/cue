# Integration documentation reconciliation 13

Date: 2026-09-12

Done contract before document edits: update only the four integration documents after independent backend and UI reviews exist. Check only reviewed recovery-handoff and allowlisted reason-code components; preserve historical failures and unrelated edits.

Correction cap: 2. Every pass checks exact review wording and counts, local Markdown links, SHA-256, and the scoped whitespace diff. A failed pass requires a concrete new hypothesis.

Boundaries retained: unavailable external completeness stays held; raw reasons and identifiers stay private; no restore/CAS, provider/native-executor/Electron qualification, broad S4 or S0-S7 completion, or current S7 snapshot claim. The parent GOAL remains `usageLimited` and unfinished.

No product source, tests, build, or runtime execution belongs to this documentation unit.

## Applied reviewed evidence

- Backend: [`../../S4/20260912-recovery-handoff/review.md`](../../S4/20260912-recovery-handoff/review.md) — bounded PASS for the actual persisted resolver/terminal reader, 2 files 12/12; protected-host recovery remains source-inspected held-only wiring backed by the maker 3-file 17/17 matrix.
- UI/IPC: [`../../S4/20260912-recovery-handoff/ui-review.md`](../../S4/20260912-recovery-handoff/ui-review.md) — bounded PASS, 3 files 19/19; the post-wording 13/13 overlaps and was not added.
- Preserved unresolved: `integration-generated-json-host.test.ts` `runs shared-ledger` fails with `invalid_requirements:array`; no before-change baseline establishes its origin.

## Documentation gate

- Scoped whitespace gate: `git diff --check` over the four owned documents — PASS.
- Local Markdown link audit: 325 links checked, 0 missing.
- SHA-256:
  - `docs/INTEGRATION_SPEC.md`: `6422C50F7F36CD51246946977F73D8E105D80304794F93EF8D1892D38189E905`
  - `docs/INTEGRATION_CHECKLIST.md`: `F22F5A294AF66E7A6F67A21A3B4E8AB5BA55058B27441467D1063E36D4BD841E`
  - `docs/INTEGRATION_PROGRESS.md`: `1CB2E22F13C02528A5C03257F1493807850CDFF5C69E6079CC89CCACD3446B17`
  - `docs/integration/LOOP.md`: `B02B3F6186F17616B016778C8FF5AFF789BDA4D081035E317222A64AA9FDAC21`

The documents retain historical S7 status, open restore/CAS/provider/native-executor/Electron and broad S0-S7 scope, and the unfinished `usageLimited` GOAL.
