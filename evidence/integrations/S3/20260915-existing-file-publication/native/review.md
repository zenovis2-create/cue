# Independent native compare/write review

Date: 2026-09-15

Final verdict: **CLEAR** after correction of active packaging pins.

The independent read-only checker verified the following against the final source and artifact:

- `snapshotRelative` remains on `cue-change-snapshot-v1`; `compareWriteExisting` is separately dispatched on `cue-change-snapshot-v2`.
- The v2 implementation holds exclusive, no-reparse handles for the root, each relative ancestor, and the existing target. It uses `FILE_OPEN`, never creates a file, and performs no pathname replacement.
- It reads and compares the target identity, byte length, and SHA-256 on the held target handle, repeats the same-handle check immediately before writing, flushes, then rereads and verifies identity, length, digest, and bytes before returning `committed`.
- Pre-write mismatches and conflicts return `contention`; any write, flush, or post-write verification failure returns `unknown`.
- The host copies the replacement buffer and validates plain data descriptors, proxies, strict relative paths, bounds, nonce, exact response keys, and before/after hash bindings.
- The executable, manifest, host constant, asset copier, packaging test, and copied distribution artifact use SHA-256 `82ff0f80ecb63293de0eed39296bf66ad51b4cfdeee2d8d7aaea062fae80d07e`. Every source hash declared by the manifest matches its file.

The checker initially blocked two stale active digest consumers in `daemon/scripts/copy-assets.mjs` and `daemon/test/integration-journal-packaging.test.ts`. Root corrected both and the checker verified the final agreement. Core native behavior had no additional correctness or security finding.

Evidence: `pass-final-go.txt`, `pass-final-vitest.txt`, `final-pins.md`, and `../packaging/build-pass2.log`. The target-symlink case was skipped because the current token lacks symlink privilege; actual junction-ancestor and existing snapshot junction cases passed. This review makes no power-loss atomicity claim and does not claim rollback after an ambiguous write.
