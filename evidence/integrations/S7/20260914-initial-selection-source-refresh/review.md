# Independent review — static source refresh after S4 recovery correction

## Criteria declared before generation

- Root runs the fixed offline current-source generator once only after the S4 recovery-observation functional review passes.
- The published pointer, manifest, result, source input, and before/after basis share one exact snapshot digest.
- The manifest contains exactly five artifacts whose observed byte lengths and SHA-256 hashes match.
- All 170 declared source paths exist and match their current SHA-256 hashes.
- Of 69 before-manifest records, only `current-generation.json` may change; the other 68 must retain exact lengths and hashes, and the new generation must add exactly six files.
- All nine top-level preimages must match the before manifest exactly.
- `daemon/src/orchestration/recovery-policy.ts` must remain pinned to `bd35e5d614da53a031320ac81196b296b8f81cfcc4c9a756f03fd744b19f502f`.

Review is read-only. No generator, build, functional test, product edit, model/provider/native helper, Electron, or network call is authorized here.

## Verdict

PASS. Root's single fixed-generator run exited 0 and published `fa8c3a322a043f33c8208434ca55a7a805fe4266b171860a9a4236fd91481732`. Independent read-only validation found exact pointer/manifest/digest agreement, five of five artifact lengths and hashes, 170 of 170 source hashes, identical before/after basis, the required recovery-policy pin, and no historical loss. Of 69 before records, only the authorized pointer changed; the other 68 remain exact. The new generation adds exactly six files and all nine prior top-level files remain available as exact preimages.

Evidence: `logs/independent-pre-generation.md` and `logs/independent-post-generation.md`.

Scope: bounded static source bytes and declared imports only. This does not establish runtime, visual, native, provider, performance, clean-tree, or whole-product qualification. The directory name remains preparation history for rolled-back initial selection; this generation represents the later S4 recovery-observation source state.
