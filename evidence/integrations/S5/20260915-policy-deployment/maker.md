# Policy deployment maker record

## Implemented boundary

Migration 044 adds an immutable canonical qualification table, an append-only deployment transition chain, and a CAS deployment head. Promotion requires a host-resolved `cue-qualified-policy-comparison-v1` record with exact predecessor/candidate policy identities, disjoint dataset/holdout membership commitments, measured-fact commitments, metric/environment/account-limit and price-time evidence, and at least one favorable measured dimension. Existing descriptive comparisons, malformed descriptors, future records, overlapping splits, wrong mode/currency candidates and no-improvement records produce no promotion writes.

The promotion store snapshots authority output before consulting trusted injected time, revalidates the head after the authority callback, persists the full canonical body, supports resolver-free exact replay, validates the bounded transition chain on reopen, and permits revert only from the latest promotion to its exact stored predecessor. Caller-owned transactions are rejected before callbacks or writes.

The generated JSON host accepts an explicit monetary deployment channel. Unbound future runs resolve the current head; a same-instance replay uses its prepared configuration; a restarted host uses an immutable persisted run binding only when that policy belongs to the verified channel history. Existing exact references remain pinned, and local policy behavior remains unchanged.

## Measured gates

- Initial module fixture: 2/6 passed. The four failures shared one ordering-predicate parser defect (`case-commitments`).
- Second module fixture: 5/6 passed. The remaining assertion expected the CAS label while the stronger transition-link head guard rejected the tamper.
- Third module fixture: 6/6 passed.
- First connected gate: module 6/6; host suite did not load because compiled `policy-promotion.js` did not yet exist.
- First coordinated build: exit 2, exposing a wrong `SelectionMode` type import and a test-only callback-union type error.
- Corrected build: exit 0.
- Final coordinated build after bound-run ancestry tightening: exit 0; raw output in `build-final.log`.
- Final focused gate: 3 files, 26/26 tests, exit 0; raw output in `focused-final-pass2.log`. This includes the existing generated JSON host compatibility suite.
- Source and compiled migration 044 hashes match in `source-pins.sha256`.

## Claim limits

All qualification authority used by positive fixtures is explicitly synthetic. No provider, model, native helper, network, billing, or live evaluation ran. This implements refusal, persistence, connected future-run selection, CAS promotion, and predecessor revert mechanics. It does not supply the real empirical qualifier required by S5-05 and therefore does not close broad S5-07.

Shared registration changes in `ledger.ts` and `copy-assets.mjs` were made by root from the supplied 4-table/9-trigger/marker contract and are included only in final pins and gates.
