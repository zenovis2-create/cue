# Current static source recapture review — stdio/lifecycle generation

Verdict: **PASS** for the bounded static source snapshot and declared-import artifact integrity. This review follows `RECAPTURE-STDIO-LIFECYCLE.md`; it makes no runtime, UI, model, native, performance, or qualification claim.

## Verified generation

- Active generation: `generations/097ef304a7ea63788d36e0c6951f2ca323340c6f198a926e7ca07f7d6cf7fcd5`
- Snapshot digest: `097ef304a7ea63788d36e0c6951f2ca323340c6f198a926e7ca07f7d6cf7fcd5`
- Source files: 164
- Declared import edges: 371
- Pointer manifest SHA-256: `7ab0065282ca58f62c66b5188890eedc0f9cfccfd45224ea4e33183003e530a1`

The active pointer, generation name, manifest digest, result digest, and before/after source-basis digests are consistent.

## Independent artifact checks

All five manifest-listed artifacts matched their recorded SHA-256 and byte count:

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `cue-current-source.html` | 124,890 | `08c421a9cf31c992e20acbec42faf283b074bba0e70be7351d7d64e27cfde650` |
| `cue-current-comparison.html` | 158,315 | `1820d4a0c67031986e13e03f727f210f329a7ac656b303a40e4fb18744764886` |
| `source.json` | 120,518 | `fbaf36627d61257feccb805536d66ce727ac7040b82ceae6bee0935897c6d79f` |
| `source-basis.json` | 708 | `4c4a57ed31b20ccea7f2b56b30fab657af77a80923d2b497f23c973538d0bf75` |
| `result.json` | 319,498 | `f22e86cae2dcf8fabe9e1cb6d78774ddc5a5fd3d75be448b2cbd1ab5c8fa8d2b` |

All 164 files listed in `source.json` were independently read from the current scoped `app/` and `daemon/src/` worktree and rehashed. Missing files: 0. Hash mismatches: 0.

The source basis is stable: before and after snapshot digest, base commit, and scoped source-status digest agree.

## Execution boundary

This review used existing generated artifacts only. It did not rerun the generator, build, screenshots, Electron, UI, model, or native-worker commands. Concurrent diagnostic fixture work remained outside the scoped source capture.
