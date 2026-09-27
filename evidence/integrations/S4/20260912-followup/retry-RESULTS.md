# S4 retry follow-up results

Date: 2026-09-12

Verdict: executor gate passed; independent root review remains required.

## Corrections and evidence

1. A schema-aware legacy path in `states()` avoids querying `orchestration_handoff` when that post-016 table is absent. The first focused run then exposed that the historical test itself called the current stage binder against schema 015. The concurrent worker also failed during concurrent ledger opening, before retry contention was measured.
2. The legacy fixture now constructs exact pre-016 FK-linked stage, activity, receipt, and terminal rows directly. Worker hosts now provide the same exact artifact bytes and authorization as the parent fixture. Worker ledger connections open serially, then both claims begin together; this isolates retry-claim contention and does not claim migration-open concurrency support. This pass left only the current activity API being used for a historical row.
3. The historical activity row is now inserted in its original schema form. Added assertions prove legacy readiness is readable without 033 trust, missing current 033 artifact resolution fails closed with zero retry writes, and concurrent retry produces one new attempt and one link while the consumed loser writes no attempt.
4. Each worker result promise now receives an immediate rejection observer while the original promise remains in the asserted result set. This prevents an unhandled rejection if later worker setup fails and cleanup terminates an earlier worker, without swallowing a real gate failure.

SQLite busy/locked was never accepted or translated as duplicate consumption.

## Gates

- `npm run build`: exit 0.
- `npx --no-install vitest run test/integration-retry-backend.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`: exit 0, 10/10 tests passed.
- `npx --no-install tsc -p tsconfig.json --noEmit`: exit 0.
- Scoped `git diff --check`: exit 0, no output.

## SHA-256

```text
e891175af53ae244075c0d24697561a89495181f7d668617c91b11c704034a10  daemon/src/orchestration/store.ts
347e8ce6779ac0abd1b5c165ef91483ede6e26e40dbc776107ccf1fa55714227  daemon/test/integration-retry-backend.test.ts
```

No model, provider, native helper, network, Electron, or S5 behavior was invoked. `ledger.ts` was not changed.

## Generated-output fixture compatibility follow-up

The generated-output fixture's boolean-only receipt verification caused current schema 033 to preserve the attempt as blocked, making its three retry assertions stale. The fixture now records an exact attempt selection, launch intent, durable identity, authorized artifact, and terminal handoff before calling `finish`. Existing retry expectations and negative assertions were preserved.

The required combined command passed 25/25 tests across `integration-generated-output.test.ts`, `integration-generated-acceptance-host.test.ts`, and `integration-retry-backend.test.ts`.

Root's first final build (saved as chunk `8fac37`) caught TS2345 at the generated-output fixture's string SHA seeds because its helper signature declared only `Uint8Array`. The helper now accurately accepts `string | Uint8Array`, matching `crypto.Hash.update`. The follow-up build, no-emit TypeScript check, and the same 25-test combined gate all exited 0.

Root's later expanded baseline (chunk `7f5952`) passed 135/143 tests. Seven acceptance-history tests failed at `invalid_requirements_fields`, identifying a stale checker/evidence-policy fixture; the separate driver-independence regression is owned outside this fixture follow-up.

```text
3de99561dbe6789f14cd381ae5d737f9393924b799a9fcae10961ecb8b3a57a1  daemon/test/integration-generated-output.test.ts
```

## Acceptance-history fixture compatibility follow-up

The seven history tests first failed before setup at `invalid_requirements_fields`. Adding the exact mandatory evidence policies and source revision moved the focused suite to 2/7 passing; the remaining five results were correctly `unknown` because the checker still emitted legacy raw bytes without a structured evidence observation. The fixture now uses legitimate schema-033 terminal evidence and emits policy-bound observations for code hostile checks, research claims, document sections/rendering, external identity, and explicit pass/fail verdicts.

Historical encoding, retry-chain mutation, acceptance separation, and corruption expectations were preserved. Verification passed:

- Build: exit 0 (chunk `227de8`).
- Focused history test: 7/7 (chunk `638094`).
- Combined history, acceptance, and retry gate: 41/41 (chunk `ea9222`).
- No-emit TypeScript: exit 0 (chunk `9d2ef9`).
- Scoped diff check: exit 0.

```text
a01df300d2d0ca19594a7654427ebc9ec5eda2da67950c4572bb2a530d7b9a8c  daemon/test/integration-acceptance-history.test.ts
```
