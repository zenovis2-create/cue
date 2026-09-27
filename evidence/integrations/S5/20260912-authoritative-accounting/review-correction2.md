# Independent correction-2 review: S5 authoritative accounting

Date: 2026-09-12 KST  
Verdict: **PASS for the isolated authoritative-accounting component**

## Review done contract

Done means independently confirming the two correction-1 boundedness blockers are closed in the frozen source and focused regressions, while preserving fixed-cutoff historical replay, separate current disclosure, budget/local accounting semantics, and the revised-lineage quarantine. Maximum review-writing attempts: 3. Every pass checks the frozen hashes, focused test, nonincremental typecheck, diff check, and cited source behavior. Only this review file is owned.

## Findings

No remaining blocker was found in the correction-2 scope.

Current disclosure is count-gated at 4,096 before materialization, materialized with `LIMIT 4097`, and included in a 2 MiB projection-size check (`authoritative-accounting.ts:171-177`). The regression creates 4,097 post-cutoff reservations and proves `projectAt` rejects with `inventory_limit` rather than constructing the disclosure (`integration-evaluation-authoritative-accounting.test.ts:89-93`). The ordinary post-cutoff case continues to preserve the historical snapshot byte-for-byte while disclosing the new request separately.

Dependency capture now performs SQL length preflights before fetching the original plan, local policy, retry-link payloads, retry contract, retry authority receipts, revision plans, and revision steps (`authoritative-accounting.ts:43-52`). Attempt claim payloads retain their preflight. Revision-step payloads use the schema's 262,144-byte ceiling; local policy uses 4 KiB; other dependency payloads use 1 MiB. Only after those gates pass are rows fetched and BLOBs base64-normalized (`53-69`). The regression replaces a bounded retry-link payload with 1,048,577 bytes and proves capture rejects with `payload_limit` before normalization (`test:94-95`).

The correction does not alter the historical trust boundary: the historical snapshot and digest are built inside the read transaction, current disclosure is queried afterward and excluded from historical canonical bytes, and old bounded policy/receipt/lineage tampering remains checksum-bound. Monetary totals retain decimal-string budget parity and debt handling. Local monetary values intentionally remain unavailable while complete local count accounting remains separately represented.

Revised attempts remain `lineage-unavailable:s4-revision-unverified` and `unclassified`; no original-plan fallback was introduced. Core and migration 034 remain quarantined.

## Verification

- Frozen source SHA-256: `A6668C3D20D6B8FB963B4957C488197F7918A62088478246532F8831823A5935`.
- Frozen test SHA-256: `F3852E6309E125D02EEA2CC93A925999FE8925DDA05F2E564C6000A7F844807E`.
- Focused accounting suite: **6/6 passed**.
- Nonincremental TypeScript check: **passed**.
- Owned/evidence `git diff --check`: **passed**.
- The parent review reports the broader current-source gate at **75/75 passed across seven files**; this scoped pass did not repeat it.

This PASS approves only the isolated read-only authoritative-accounting component against its correction plan. It does not claim Core integration, remove containment, complete S5 measurement, approve migration 034, or authorize provider, model, native, network, Electron, credential, or paid activity.
