# Subscription live runner plan

## Completion gate

Done means `node --test scripts/reuse/subscription-live-runner.test.mjs` exits 0 and the focused tests prove: a durable fixed-run ledger admits at most four slots across reopen, duplicate slots are refused, every reservation is made before spawn and remains consumed after failure/unknown outcome, exact executable/hash/argv/cwd/env/stdin are enforced, output is sanitized and capped at 256 KiB, and timeout cleanup is bounded through the existing creation-bound process termination helper. The launcher must expose actual process identity plus latency, usage, result model, and session fields without emitting credentials.

No provider executable or model is invoked by these tests.

## Pass contract

- Attempt cap: two implementation passes per failing hypothesis.
- Every pass runs the focused Node test command above.
- A failed pass is followed by a new evidence-based hypothesis; no unchanged retry.
- Keep a change only when the focused gate improves. If it regresses, restore the owned files to their prior contents.
- If two passes for one hypothesis fail, record the attempts and hand the blocker to the root owner.

## Scope

Owned files are `scripts/reuse/subscription-live-runner.mjs`, `scripts/reuse/subscription-live-runner.test.mjs`, and this plan. The root owner alone supplies an approved fixed launch descriptor and executes any real subscription task. The runner never creates or copies credentials, never retries, and never resets the fixed `20260916-subscription-live` ledger.
