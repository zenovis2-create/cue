# R-05 independent review

Date: 2026-09-11
Reviewer: native independent agent `transport_review` (did not implement the reviewed code).
Verdict: **PASS for the isolated R-05 experiment**, with limitations below. No remaining blocking finding in the reviewed scope. This is not production-adapter approval.

## Evidence

Reviewed `scripts/reuse/usage-normalization.mjs` and its test, plus the separate `model-transport.mjs` fixture and its test. Executed:

```text
node --test scripts/reuse/model-transport.test.mjs scripts/reuse/usage-normalization.test.mjs
26 tests: 26 pass, 0 fail, exit 0
```

An independently executed assertion additionally rejected both impossible partial records below and accepted the boundary case `total_tokens:100, completion_tokens:99, cached_tokens:1`.

The first review found that partial records with missing input could report cached input greater than total. The implementation now checks `cachedInput <= total - (output ?? 0)`, and regression rows cover:

- `total_tokens:1, cached_tokens:100` with input/output absent.
- `total_tokens:100, completion_tokens:99, cached_tokens:2` with input absent.

Other inspected behavior: missing counters remain null/unknown; explicit zero stays observed; cached input is not added twice; invalid and overflowing counts are rejected; reported totals must match known complete components; arbitrary provider metadata is not copied; output records are frozen.

## Reviewed SHA-256 hashes

| File | SHA-256 |
| --- | --- |
| `scripts/reuse/usage-normalization.mjs` | `2D5EB58C2D1D85A9BDEAF5B00840A780FAAAAEFD1585D9C5BCE4668517F375FC` |
| `scripts/reuse/usage-normalization.test.mjs` | `0BAAF73F2B173EF517CB64BC6064813B2266B955A61971505EE4F8EBF4A872A2` |
| `scripts/reuse/model-transport.mjs` | `77D5835FEE99A96BAF87017D5EFAE99458D3B702E060453E9ECB62BB2CD42A28` |
| `scripts/reuse/model-transport.test.mjs` | `B5014C3B2E3581CEF3019486BE3837EB567B88E5B9139EF445D1EC795B06C9BF` |

## Transport review and scope limits

The isolated transport tests also pass. Inspection and fixtures cover successful chat SSE/Ollama NDJSON terminals, malformed input, wrong identity, tool requests, premature EOF, response bounds, HTTP failures without retry, redirect refusal, pre-abort, timeout connection closure, and cancellation without disrupting a parallel stream.

- These fixtures do not demonstrate real SDK or provider compatibility, authenticated operation, production integration, pricing, billing, model quality, or optimization performance. No paid/model calls were performed.
- Transport request construction does not request an optional provider usage stream; fixture-supplied usage observations do not prove actual provider usage retrieval.
- Transport usage processing and R-05 normalization are separate experiments. R-05 validation must not be claimed to run in the transport path.
- Loopback address validation limits the destination but does not authenticate a local server. Use is limited to known fixture endpoints.
- Closing the client connection does not establish that server-side inference stopped. `providerStopped: 'unknown'` correctly preserves that uncertainty.
- This normalization contract covers OpenAI chat and Ollama counters only; it neither assigns monetary cost nor claims support for other providers or final invoices.

No application source was modified by the reviewer. Review artifact completion check: verify this file exists and retains the measured four source hashes and scope statements.
