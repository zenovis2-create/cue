# S5 durable evaluation comparisons — independent review

## Final verdict: PASS — correction pass 1/2

Correction pass 1 resolves both initial blockers without relaxing the comparison boundary. The durable comparison component is approved at the reviewed hashes below.

### Correction verification

- **Core bound fixed:** `app/core.mjs:338-345` now rejects each projection-ID array unless its length is `1..4096`. The length check occurs before `Reflect.ownKeys`, `Array.from`, the combined-array spread, and all projection/workspace database reads. The focused Core regression supplies 4,097 IDs and observes `projectionReads = 0`; its accessor-array probe observes `touched = 0` and `projectionReads = 0`.
- **Backend ordering retained:** `daemon/src/evaluation/comparisons.ts:22-32` applies the same proxy, prototype, `1..4096`, dense own-data, descriptor, identity, and duplicate checks before `build` can read a projection. The backend 4,097-ID and accessor regressions also observe zero projection reads and zero getter touches.
- **Canonical request integrity fixed:** decode at `daemon/src/evaluation/comparisons.ts:105-113` reconstructs the expected snapshot from immutable stored projection/enrollment dependencies, canonicalizes the stored membership IDs and constraints, recomputes the same request bytes used by create, and compares the result with `saved.request_digest`. A trigger-bypass regression mutating only `request_digest` now fails with `evaluation_comparison_integrity`.

The full focused gate passes **6 files / 28 tests**. Typecheck, build, Core syntax, migration parity, and scoped diff checks also pass. No new blocker was found.

## Initial review history — BLOCKED

The focused implementation is close and its advertised 6-file gate passes, but two required fail-closed boundaries are incomplete. This receipt does not approve the component until both findings are corrected and independently rerun.

### Initial blocker 1 — Core performed unbounded work before the store's projection limit

`app/core.mjs:338-345` validates dense own-data arrays but has no non-empty or maximum-length check. `createEvaluationComparison` then copies both complete arrays and performs one projection read plus one workspace query per element at `app/core.mjs:1013-1017`. The backend's `MAX_PROJECTIONS = 4096` check at `daemon/src/evaluation/comparisons.ts:23` runs only afterward at line 1018.

Therefore the workspace-facing API does not enforce the required bounded input before allocation and database work. A large dense array, or a large array containing the same valid projection ID repeatedly, can cause caller-controlled memory allocation and arbitrarily many indexed reads before the store rejects it. Add the same `1..4096` bound to each Core array before `Array.from` and before any projection lookup, then test 0, 4097, and a large duplicate-ID array with a projection-read/SQL spy proving zero reads.

### Initial blocker 2 — `request_digest` corruption was accepted by `read`

`daemon/src/evaluation/comparisons.ts:63-65` reads `request_digest`, and create/replay uses it at lines 119-124. However decode at lines 105-112 never recomputes or compares it. The integrity condition checks payload, payload digest, dataset, membership, constraints, and result digests only.

After bypassing the update trigger in the same hostile-database model already used by the tests, `UPDATE evaluation_comparison_snapshot SET request_digest='<64-byte different value>'` leaves `read('snapshot')` successful. The returned snapshot appears valid, while an exact future replay fails with `evaluation_comparison_replay_conflict`. This silently changes durable idempotency behavior. Recompute the canonical request digest from snapshot ID, baseline/candidate membership IDs, and constraints during decode and require equality with `saved.request_digest`. Add a focused trigger-bypass test for this mutation; the current comparison tamper test covers only an oversized payload.

## Verified behavior

- Store input is exact plain own-data. Proxies, accessors, sparse/extra-key arrays, duplicates, empty arrays, and arrays over 4096 are rejected. An independent hostile probe supplied an accessor array, accessor constraints, and injected `dataset`, `caseId`, `runId`, `trial`, `result`, and `nowMs`; all were rejected with `touched = 0`.
- The store re-reads immutable trial projections and enrollments. It requires one dataset digest, manual-baseline and candidate arm bindings, matching policy digests, unique projection membership, and unique case/arm slots. Projection timestamps after host `recordedAtMs` fail closed.
- Only non-null stored projection trials reach the existing `createEvaluationStudy().record` path. Current `trial: null` projections produce stable `insufficient` comparisons. Availability retains evaluation/holdout and per-arm projection, trial, missing-projection, missing-trial, and outcome denominators, including fail/cancelled/unknown/unavailable and reason counts.
- The snapshot payload binds dataset, membership, cutoff observation references, constraints, descriptive result, availability, and their advertised digests. Exact replay ignores a later host clock; changed request membership conflicts. Returned values are recursively frozen. Correction pass 1 also verifies the canonical request digest during every decode.
- Migration 030 provides update, delete, and replacement triggers. Reads force the primary-key index, cap payload reads at 1,048,576 bytes, reject outer transactions, survive reopen, and reject oversized payload corruption. Ledger registration and asset-copy registration are present.
- Core supplies `Date.now()`, scopes every create/read membership to its configured workspace, exposes only explicit create/read methods, and has no automatic invocation site. Top-level caller injection of `nowMs` is rejected. Correction pass 1 enforces the per-arm bound before copying or database reads.
- `promotionEligible` is false in both the durable snapshot and reused comparison result. The focused create test observed no changes to approval, execution, orchestration-attempt, or selection-policy counts. Source search found no comparison-side writes to those tables.

## Independent gates

Run from `daemon/`:

`npx --no-install vitest run test/integration-evaluation-comparisons.test.ts test/integration-evaluation-comparisons-core.test.ts test/integration-evaluation-trials.test.ts test/integration-evaluation-baseline.test.ts test/integration-evaluation-baseline-core.test.ts test/integration-evaluation.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`

Initial result: exit 0, **6 files / 27 tests passed**.

Correction pass 1 result with the same command: exit 0, **6 files / 28 tests passed**.

- `npx --no-install tsc -p tsconfig.json --noEmit`: exit 0.
- `npm run build`: exit 0.
- `node --check app/core.mjs`: exit 0.
- Scoped `git diff --check`: exit 0 (line-ending warnings only).
- Migration source/dist SHA-256 parity: equal, `16ccea2244c796e8e4a4b540c2642751138d155c882d5f6cf790131de1eac342`.

## Correction pass 1 reviewed artifact hashes and limits

| Artifact | SHA-256 | Bytes |
|---|---|---:|
| `daemon/src/evaluation/comparisons.ts` | `fe6865f60c84f7c40538d202b151624cc244621e6ee7c93ae0cc55b7a888b3e0` | 13,422 |
| `daemon/migrations/030_evaluation_comparison.sql` | `16ccea2244c796e8e4a4b540c2642751138d155c882d5f6cf790131de1eac342` | 1,290 |
| `daemon/src/ledger.ts` | `4b8a78d1fb72dbc21f3af01f6f105e4c01749de38ccec0934db6bba108ea313e` | 3,970 |
| `daemon/scripts/copy-assets.mjs` | `5652b6372e1bd774850061563fe8b8cf43c00454da185ba22503483ce3616446` | 6,514 |
| `app/core.mjs` | `b2ff8b67d40077eb8bc3d3ed8433339780918c2ff59d7f656dbe97fd13935751` | 57,588 |
| `app/core.d.mts` | `355222ece202595633c416b2e0f8da68b4bad6fdc2b3fe3fd764accfdbbcd65b` | 9,073 |
| `daemon/test/integration-evaluation-comparisons.test.ts` | `63ff5b3eecd7b23cd1569fe9dbc3bc310488a9ce9261697ca118ab8dd234753b` | 11,809 |
| `daemon/test/integration-evaluation-comparisons-core.test.ts` | `382d49164ec88c59a0129cd1ab4ecb95f11d1a3012bbdab0db2e7f84e041927d` | 5,544 |
| `evidence/integrations/S5/20260912-evaluation-comparisons/implementation.md` | `541c394c7828b0d871d2dfd1c9d63d6aa150b2389343ecbe2705b24331c40bf5` | 2,682 |

Limits reviewed: 4,096 projection IDs per arm; 1,048,576-byte stored payload; 128-character projection/snapshot identities; indexed single-row snapshot lookup; no outer transaction entry.

This review establishes neither a performance improvement nor promotion eligibility, and it does not claim S5 or the full integration program is complete.
