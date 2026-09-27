# S1 Unit 2 provider lifecycle implementation evidence

Date: 2026-09-12 KST

## Result

Implemented migration `032_provider_execution_lifecycle.sql` and a typed append-only provider lifecycle store. This unit records cancel request, client acknowledgement, provider terminal, local controller observation, local tree observation, cleanup, billing finality, and lifecycle seal as separate facts. Projection preserves absent facts as `unknown`; `providerDeath` remains `unknown` because this offline unit has no remote-death observation authority.

Provider thread, turn, and subtask input references are bounded at 1,024 UTF-8 bytes and persisted only as SHA-256 digests. Each digest is globally unique and relationally bound to one exact run/task/attempt/candidate/event. Reuse by another attempt is rejected regardless of changed reference type or label.

The public store exposes authority `{processKill:0,budgetRelease:0,acceptance:0}`. Billing becomes `final` only after a prior provider-terminal row with the same typed `provider_receipt_digest`. Lifecycle state never updates orchestration attempt, cleanup, budget, or acceptance state.

## Integrity boundary

Lifecycle status, evidence digest, provider receipt digest, lineage, ordinal, terminal uniqueness, and seal constraints use typed relational columns and database constraints/triggers. Canonical payload SHA-256 is recomputed by every public projection/read and matched back to those relational columns. The hostile direct-SQL test inserts a structurally valid provider-terminal payload with a caller-supplied fake hash; insertion does not change orchestration state and public projection rejects it with `provider_lifecycle_payload_integrity`.

Legacy attempts present before migration 032 are captured as `legacy-provider-lifecycle-unavailable` and cannot receive invented current lifecycle history. Migration replay is idempotent and preserves explicit legacy availability.

## Correction attempts

1. Initial implementation: build passed; provider/P5/handoff/orchestration run produced 40/44 passing. Three lifecycle failures were test expectations for a specific trigger message when SQLite evaluated the stronger exact-event trigger first. The fourth failure was the existing `integration-orchestration` concurrent claim `database is locked` issue already documented by S3 review.
2. Final correction: changed only the three lifecycle assertions to accept either applicable fail-closed trigger. Provider lifecycle + P5 + handoff regression passed 33/33. No product behavior was weakened.

## Final gates

```text
npx --no-install vitest run test/integration-provider-lifecycle.test.ts test/p5.test.ts test/integration-handoff-activity.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
3 files / 33 tests PASS / exit 0

npx --no-install tsc -p tsconfig.json --noEmit --pretty false --incremental false
PASS / exit 0

npm run build
PASS / exit 0

integration-provider-lifecycle coverage
- hostile DTO/proxy/accessor/custom prototype/extra key/oversize/hash drift: PASS
- exact replay/ordinal gap/conflict/terminal conflict/seal/late write: PASS
- cross-attempt reference theft under changed type and label: PASS
- billing without matching provider receipt: rejected, zero added rows
- two file-backed connections and rollback: PASS
- fresh close/reopen integrity/FK: PASS (`integrity_check=ok`, empty `foreign_key_check`)
- pre-032 migrate/replay/close/reopen integrity/FK: PASS (`integrity_check=ok`, empty `foreign_key_check`)
- raw SQL fake-hash terminal projection: fail closed

source/dist migration byte parity
SHA-256 1b18a5e078452bc173d4e87e07f1b6dc4d463305dcea8a1c48b60a48272f63b0
13,322 bytes each / byte_equal=True

owned tracked diff check: exit 0
new-file trailing whitespace scan: none
```

The broader `integration-orchestration.test.ts` file remains 10 passed / 1 failed because `independent connections atomically claim exactly once` hit `database is locked`. The exact failing test passed when isolated (1 passed / 10 skipped). This unit did not change that shared S3 behavior and does not claim a clean broad regression.

## Current hashes

| File | SHA-256 |
|---|---|
| `daemon/migrations/032_provider_execution_lifecycle.sql` | `1b18a5e078452bc173d4e87e07f1b6dc4d463305dcea8a1c48b60a48272f63b0` |
| `daemon/dist/migrations/032_provider_execution_lifecycle.sql` | `1b18a5e078452bc173d4e87e07f1b6dc4d463305dcea8a1c48b60a48272f63b0` |
| `daemon/src/orchestration/provider-lifecycle.ts` | `326dc83adab8caf781d0df7eb2c4cefdad98b9dcb6ed5c5e26229453932fbf02` |
| `daemon/test/integration-provider-lifecycle.test.ts` | `f3599baea607e77aa797185862b56094b945e73c0f3529df9da7d77d4113c11e` |
| `daemon/src/ledger.ts` | `a263670999b9b62df48a2fce13fd9d695ded13e18534193fc67f2fb8aff84e19` |
| `daemon/scripts/copy-assets.mjs` | `0f6906a7411c1d8b6ca1c6638b789b82e33d7bb72513f93daa85292f84768870` |
| `daemon/test/p5.test.ts` | `b67f5a9759df4f95e278e7ef5369671d4650ddac1ef6a02c6f7e6e606e99f3df` |

No provider, model, CLI, native launcher, Electron, or network execution occurred. Actual remote provider death and billing cessation remain open, and no broad checklist checkbox should close before independent review.
