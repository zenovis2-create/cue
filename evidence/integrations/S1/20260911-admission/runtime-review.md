# Independent integration runtime seam review

Reviewer: /root/contracts_review. Date: 2026-09-11.

Verdict: PASS for the new synthetic, transient host-controlled integration seam. No blocking finding in this bounded scope. This does not qualify any real adapter, model, P13/M probe, OS cleanup implementation or application dispatch integration.

Done gate: focused tests exit 0, ownership/admission/state review, scoped whitespace check and reviewed hashes. Artifact cap 1, followed by read/hash verification. Reviewer made no implementation edits or live model calls.

Command (cwd daemon): `npx --no-install vitest run test/integration-runtime-contract.test.ts --reporter=verbose`

Observed exit 0, 9/9 tests passed, duration 248 ms. `git diff --check -- daemon/src/integration-runtime.ts daemon/test/integration-runtime-contract.test.ts` exit 0. Author reported TypeScript build exit 0; reviewer did not rerun that build.

## Reviewed behavior

- Candidate implementations come from the host registry. Host authorization, availability, kind/role support and supported/unsupported feature values are checked before launch. Current subject is rebuilt and freshly evaluated against host evidence for each attempt.
- Write and model admission use separate probe vectors. No unknown candidate, stale/missing/drifting evidence or denied authorization launches in the tested scenarios.
- Run ID is reserved before awaiting adapter launch. Duplicate attempts are denied, including after a partial launch failure; that failure explicitly leaves cleanup unknown.
- Adapter completion records execution outcome but does not settle the run. Cancel is idempotent per handle; acknowledgement does not prove cleanup. Unsupported cancellation remains explicit.
- Only independent host cleanup with matching run ID, subject digest and a nonempty evidence reference can settle. Unknown/residual cleanup stays open. Late adapter completion cannot overwrite a settled run. Parallel run state is independent.

## Trusted dependencies and incomplete integration

Host callbacks, the adapter control object and cleanup observation service are trusted implementations, not untrusted RPC payload parsers. This module does not itself verify process ownership/death or evidence authenticity beyond the host-supplied contracts. The host authorization callback must preserve existing envelope/writer lease rules, and current artifact identity must remain stable between measurement and launch.

The module is an integration seam without application dispatch wiring, normalized delta/usage event forwarding, persistent ledger/recovery or real worker cleanup implementation. Launch timeout and cancellation while launch is still pending are absent; a launch that never resolves cannot yet expose a public handle for cleanup. Partial-launch errors retain the ID but require an external recovery mechanism to inspect/clean leftovers. These are explicit scope limits and must be implemented before real production adapter activation.

The earlier admission review recorded that admission had no external call site at that earlier snapshot. This new seam now consumes admission; the application still does not invoke this seam. Neither review marks the full S1 checklist complete.

## Additional bounded review notes

Manual qwen-live-smoke.mjs was read and syntax-checked with `node --check`; no live request was made by reviewer. It preserves timestamped evidence with exclusive file creation and judges nonempty text plus successful terminal only, consistent with its connectivity-only scope. Model metadata and usage/provider-stop unknown limitations remain as documented in review.md.

The attempted P2 portability/capture-filter work was rolled back by its owner after failed hypotheses. It is not approved by this review; the baseline grep failure and obsolete monetary-policy assertion remain separate work. No claim of whole-suite success is made.

## Reviewed snapshot SHA-256

| Path | SHA-256 |
|---|---|
| daemon/src/integration-runtime.ts | 4F19140FA48101F722A732528C95E454E2D59037851EDA8A98D9E82B445F6CA8 |
| daemon/test/integration-runtime-contract.test.ts | 77AB8AC808525D2B3982C15429545CD1C81DD02474C7D92914C4F485ED16B5D5 |
| daemon/src/capability-admission.ts | DA9073981F0EBC5FF1F0D1CCA2F81022D2163DA0524B521AA0C47D17D8BE8530 |

