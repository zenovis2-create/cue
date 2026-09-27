# S5 durable evaluation comparison snapshots

Implemented an append-only `evaluation_comparison_snapshot` ledger record and a backend store that accepts only a snapshot ID, bounded dense baseline/candidate projection ID lists, and comparison constraints without `nowMs`. The host supplies `recordedAtMs`; exact replay returns the original snapshot even when a later host time is supplied.

The store re-reads immutable projection and enrollment records, requires one frozen dataset, manual-baseline/candidate arm and policy bindings, unique membership and case-arm slots, and records only non-null stored trials into the existing evaluation study. The existing comparison remains authoritative for measurement coverage, outcome, variance, environment, account, price, and objective rules. Current null trial projections produce an insufficient descriptive result with explicit split/arm projection, missing projection, missing trial, and outcome denominators plus non-convertible and comparison reason counts. `promotionEligible` is always false.

The persisted payload atomically binds dataset, projection/enrollment/observation membership, cutoff time and observation digests, constraints, descriptive result, and their digests. Reads use bounded indexed lookup and reconstruct the result from immutable dependencies. Update, delete, and replacement triggers enforce immutability. Core exposes explicit workspace-scoped create/read methods and does not invoke comparison automatically.

Validation:

- `npx vitest run test/integration-evaluation-comparisons.test.ts test/integration-evaluation-comparisons-core.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` — 6/6 passed after correction.
- Final single-worker gate covering comparison, trial projection, manual baseline, pure evaluation comparison, and focused Core tests — 28/28 passed across 6 files.
- `npm run build`, `npx tsc -p tsconfig.json --noEmit`, `node --check app/core.mjs`, migration source/dist SHA-256 parity, and scoped `git diff --check` — passed.

This implementation does not claim that current null projections are comparable measurements, that performance improved, or that any policy, approval, execution, attempt, or promotion authority was created.

## Independent review history

The initial independent review was **BLOCKED** because Core did not cap projection arrays before copying them and snapshot reads did not recompute `request_digest`. Correction pass 1/2 added pre-read dense descriptor and 4096-entry checks in Core, zero-read/getter probes in Core and backend tests, canonical request digest verification during decode, and a request-digest-only tamper regression.
