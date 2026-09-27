# Protocol correction results

The rejected revision and independent `NOT CLEAR` review remain preserved. Exact source/test preimages and their hashes are in this directory.

Correction attempt 1 exposed that a duplicate response poisoned the channel correctly but the next client send surfaced the generic closed error. Attempt 2 retains and surfaces the original fatal protocol error.

## Final behavior

- Incremental byte framing rejects an unterminated frame above 64 KiB before newline buffering.
- Optional `jsonrpc:"2.0"` responses and safe bounded notifications are accepted.
- `account/updated`, malformed frames, server requests, unknown/duplicate response IDs, oversized stdout, and stderr above 1 MiB fail closed.
- Stderr is continuously consumed and never retained in evidence or diagnostics.
- Null ChatGPT email yields account presence with no identity. Non-null identity uses normalized email and excludes mutable plan type.
- Authentication, capability, entitlement, billing, and model availability remain unknown.

## Gates

- Focused attempt 2: **8/8 passed**, exit 0.
- TypeScript no-emit: **passed**, exit 0.
- No provider, model, service, or network call occurred.

## Pins

- Source: `c7187cf235d54cfce6f54d8a57bf4317a1eaaad61927c56104c7bb945474a7bc`
- Test: `54f1e8c76542276f8c39f6dfcfdafe4270a9532221635c3f147ba4aad7d8e180`
- Focused log: `4e1a6f5871d843b0903b3906bac81f5b0926c3fc391fd19c896baa1eb3ecf101`
- TypeScript log: `5913c4acfaced3b4ce71164e1ec2e8a6ba3e6a5a545d8676aa07e7d17b9c8cb8`

Source is frozen pending independent re-review. The separately authorized service-authentication extension is not part of this correction.
