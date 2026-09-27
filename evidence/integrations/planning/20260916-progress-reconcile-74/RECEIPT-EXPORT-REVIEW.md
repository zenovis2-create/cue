# Receipt export isolation review

## Verdict

**PASS.** The test-only change prevents ordinary test runs from overwriting retained integration evidence while preserving the two native fixture assertions and their production behavior.

## Reviewed change

The preserved preimage wrote both receipts unconditionally to the fixed prior-evidence directory with ordinary overwrite semantics. The current helper instead:

- reads the optional `CUE_GIT_STAGING_DRIVER_RECEIPTS` directory;
- performs no receipt write when the variable is absent;
- resolves a fixed test-owned filename beneath the caller-supplied directory;
- writes with `flag: 'wx'`, so an existing receipt causes the test to fail instead of being replaced.

The receipt names remain fixed (`reconciled-pass1.json` and `diverged-pass1.json`), so test input cannot add a path separator or traverse outside the selected directory. Directory creation is intentionally left to the evidence caller. An absent or invalid export directory fails the opted-in test run rather than silently dropping or redirecting evidence.

The database, publication, cleanup, lease, blocked-state, and filesystem assertions are byte-for-byte unchanged from the captured preimage. No production source file changed.

## Verification

- Focused gate: `1` test file passed, `2/2` tests passed, exit `0`.
- The default focused run completed without an export directory, exercising the no-retained-write path.
- All 63 entries in the batch-74 prior-artifact inventory exist and retain their recorded SHA-256 values after the gate.
- Preimage SHA-256: `5c0265fefd21d1273d0d2e23d7426728dc88e12ba1dbb08b7d6b271b0f0249cc`.
- Reviewed current test SHA-256: `2f58fc5a06c7e4a98cafce3b868beea78c24f8741c9e4f9939928f7099dfb6d9`.

## Scope

This qualifies receipt-export isolation for this test harness only. It does not add production behavior, close an original integration parent, or provide new provider evidence. No provider/model call was made by this review.
