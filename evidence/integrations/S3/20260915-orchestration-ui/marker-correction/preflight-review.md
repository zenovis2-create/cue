# Independent readiness-marker correction preflight

Verdict: **CLEAR for the separately coordinated actual attempt 3.**

`writeDurableJson` opens each marker with exclusive writable mode (`wx`), writes the JSON through that same descriptor, calls `fsyncSync` on the writable descriptor, and closes it in `finally`. This removes the exact Windows `EPERM` cause from attempt 2. Exclusive creation also prevents an existing marker from being silently overwritten.

The Windows-local marker test exercises the actual helper against an owned temp file, verifies Unicode JSON readback, verifies replay fails with `EEXIST` without changing the first value, and applies canonical direct-temp-parent, non-symlink, realpath, recursive-owned-root, and post-removal absence guards. Together with the three bootstrap tests, the recorded offline gate covers writable flush/readback, exclusive replay, synchronous bootstrap return, controlled readiness order, single error propagation, and absence of top-level await.

The Electron harness now writes exclusively to new `actual-attempt3`; attempts 1 and 2 remain preserved. Only the marker helper/import/call and output directory changed. The nine visual field oracles, exact accounting assertions, blocked/cancelled and unresolved/unknown outcome, expected Core-close rejection, fixture database teardown, source/generation checks, request denial, backup integrity, child-close verification, and owned-root guard remain present.

Reviewed pins:

- `electron-proof.mjs`: `917823e3cee9bfa3cdc81cf1ef6d7cc42753a3523788766659a99fb952da4479`
- `startup-correction/bootstrap.mjs`: `78c586b7df69b3abf754613694dc9a1e909c5f90dee0f03dff2084894ef4471a`
- `startup-correction/bootstrap.test.mjs`: `de68d3ed668dd041bd98d5c41614f64148c239e5079434782f0399f41d31db4f`
- `marker-correction/marker.test.mjs`: `95fb4f53684f79a1a4faedb3d7f6df12c39935f470ff93202bdbb4dccde16118`

This verifies a flushed marker file, not atomic directory-entry durability across every crash mode. No Electron window, OS integration gate, build, product edit, provider, model, native helper, or network call was performed during this review.
