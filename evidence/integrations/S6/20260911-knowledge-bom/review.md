# Independent BOM interoperability correction review

Code and focused regression verdict: PASS. Shared final build pending the separate local-policy guard correction; recorded below when complete.

The original failure was reproduced against actual compiled resource store -> knowledge index: a BOM-prefixed source persisted byteLength 12 with decoded text reencoding to 9 bytes, and indexing refused it. The correction reconstructs exactly one U+FEFF only if the three-byte gap and SHA256 both match the original resource metadata. The unchanged exact length/hash check then runs. Already BOM-preserving text takes the ordinary exact-byte path. Tokens, excerpt and byte offsets all derive from reconstructed original text, so offsets remain original UTF-8 offsets rather than offsets into the stripped view.

Independent command: `npx --no-install vitest run test/integration-knowledge.test.ts test/integration-resource-store.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`. Exit 0, 13 passed, 1.19 seconds, 2026-09-11 21:14:52 KST (tool f5300b). The connected case imports through the real store, closes/reopens the DB, removes original source files, then indexes and compares Korean/emoji excerpts to exact original byte slices. It also covers already-present BOM, wrong hash, wrong length and changed text. Existing immutable store and query bound cases pass.

No hash/size allowance was widened. No source edit or model call by this reviewer. Fixture lexical retrieval measurements remain fixture evidence, not general relevance or remote provenance certification.

Hashes:
- daemon/src/knowledge/lexical.ts SHA256 B1C26BAFC0A5671564A54DDEB0CE587D5B7F1422AD711FC56EAAC32B871B6E21
- daemon/test/integration-knowledge.test.ts SHA256 A231FC55A086C0DA6DB70437207CEB669AEBF2F4887D5CBD02924F6BBBA2CA31

## Final shared build gate

Final `npm --prefix daemon run build`: PASS, exit 0 (tool 92e82d), after owning makers confirmed their concurrent type corrections. The first attempted root-level `npm run build` had no script and did not execute a compiler. The first daemon build then failed on unrelated engine.ts:145 acceptance literal typing and integration-local-host-settings.test.ts:45 narrowed accounting typing; no asset copy ran on that failure. Those actual failures are retained here rather than reported as a first-pass green build. No source changes or broad regression rerun by reviewer.
