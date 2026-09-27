# Independent review — initial-default host source refresh

## Verdict

**PASS for the bounded static source recapture.** This verifies the current source/import report and preserved history only. It adds no runtime, provider, model, native, Electron, performance, browser, or visual qualification.

## Audit

- The single retained generator receipt exited `0` and reports `ready:true`, generation and snapshot digest `fb070af2b5e236e07ad8423181320f68f147e2ac9b41c1d5efd423293c81ff93`, 172 files, and 392 declared edges. `generate.log` SHA-256 is `df0f21efa8322d61cbbe1213d05cce50770f64184e698dc06d6ccc5829c62645`; `generate.exit.txt` SHA-256 is `13bf7b3039c63bf5a50491fa3cfd8eb4e699d1ba1436315aef9cbe5711530354`.
- `current-generation.json` points to that exact generation and snapshot. Its declared manifest SHA-256 `a2de41f8fff3579d5b4e5c48a7a2e7e108aa02dca8db51ac633dd3b83b06b9e6` matches the actual `generation.json`.
- All five manifest artifacts exist and match their declared byte lengths and SHA-256 values: the source HTML, comparison HTML, `source.json`, `source-basis.json`, and `result.json`.
- The current `app` and `daemon/src` JavaScript/TypeScript inventory contains exactly the 172 declared files with no skipped or extra entry. Every one of the 172 current file hashes matches `source.json`. `result.json` contains 793 parsed import records and 392 declared graph edges.
- `source-basis.json` has identical before/after snapshot digest, base commit, source-status hash, and 134-entry count. Its scope explicitly excludes evidence, scripts, tests, and output writes.
- `before.json` contains 81 prior records. Excluding the deliberately replaced pointer, all 80 retained records still match exact bytes and hashes. The prior pointer's full preimage matches its recorded old hash `abb89ff4a149451aeee6425b84c99d03cf92653378b61af13e380e8fcc32eb43`; the other eight top-level full preimages match their retained current counterparts.

The current pointer SHA-256 is `4b2512f6f0290e9cc02f5d3485f21b8f090509e4bb4105685eeb0bda9f0edd29`. The generator was not rerun during this review.
