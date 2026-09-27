# Progress reconciliation 1 — correction 1

Date: 2026-09-12 (Asia/Seoul)
Correction pass: 1/2

## Superseded claim

The independent review correctly blocked the original reconciliation because the inserted narrow cost row shifted physical checklist line numbers. The historical `implementation.md` statement that broad rows `102/103/105/106` remained open is superseded by this correction record; that file is retained unchanged as historical evidence.

The authoritative open scopes are identified by meaning:

- API/subscription/local cost provenance and actual/estimated/unknown/stale classification;
- call/retry/verification/handoff costs and parallel reservation/settlement;
- price/quota/GPU/billing uncertainty;
- cold-start defaults and separately authorized exploration budget.

## Correction

Removed the volatile `broad 102/103/105/106` wording from `docs/INTEGRATION_CHECKLIST.md` and `docs/INTEGRATION_PROGRESS.md`. Both documents now name the four open scopes above. No checkbox state changed.

The narrow pure cost/capacity observation component remains the only checked row with that prefix. The four broader semantic rows remain open. Reuse common gates 11, 12, 17, and 18 remain checked; gates 13–16 and 19–22 remain open.

## Verification

- Semantic checkbox assertions, local relative links, and target-document trailing-whitespace scan: PASS.
- Scoped `git diff --check` for the two documents and reconciliation evidence directory: exit 0.
- `node --test scripts/reuse/claude-launch-spec.test.mjs scripts/reuse/role-contract.test.mjs scripts/reuse/usage-normalization.test.mjs`: 23/23 PASS, exit 0.
- `npx --no-install vitest run test/integration-cost-capacity-observation.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`: 9/9 PASS, exit 0.
- `npx --no-install tsc --noEmit -p tsconfig.json`: exit 0.
- `npm run build`: exit 0 (`tsc -p tsconfig.json && node scripts/copy-assets.mjs`).

## Corrected document hashes

- `docs/INTEGRATION_CHECKLIST.md`: `a7ade3f2be6e0dbb87663b6d471f48b5f96bdd383d39f25b2d21f745d91e6aa0`
- `docs/INTEGRATION_PROGRESS.md`: `e1401321c4e0e66c709d7a6034590c693e7f41f62ba28a65586319c37d4a5ab3`

This correction removes the review blocker only. It does not complete any broad S2 scope or the integration project.
