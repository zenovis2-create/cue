# Independent reuse-manifest review

## Verdict

**PASS for local byte-bound documentation, with the filesystem race limitation below.** No result authorizes adoption. The four actual manifests all remain `incomplete`, expose all four compliance categories as `unknown`, set `adoptionAuthorized:false`, and state `verificationScope:local-byte-bindings-only`.

## Independent evidence

- Focused Vitest: 1 file, 7/7 tests, exit 0 (`correction/review-focused.log`).
- Node syntax check: exit 0 (`correction/review-syntax.log`).
- Direct CLI validation of R-01, R-02, R-04, and R-06: four exit-0 incomplete projections, each with authorization false (`correction/review-cli.log`).
- No build, network, provider, native execution, or installation was performed.

## Source findings

The validator snapshots caller input once through property descriptors before filesystem access. It rejects proxies, accessors, symbols, cycles, non-plain prototypes, sparse arrays, excessive depth/node/string bytes, and excessive array/object members. Canonicalization then operates on the frozen owned snapshot with sorted object keys.

Package-complete records require a Cue-native origin and cross-bind `origin.revision`, `package.version`, the artifact digest, and an identical Cue file reference. Compliance is represented by exact records with status, reason, and evidence; non-unknown claims require evidence. Unknown categories keep a bounded-adoption record incomplete. The returned authorization flag is unconditionally false.

File references reject absolute paths, traversal components, Windows separators/drive syntax, duplicate case-folded paths, symbolic links and existing junctions, non-directory intermediate components, non-regular final entries, missing files, digest drift, conflicting hashes, more than 256 unique files, files over 4 MiB, and aggregate content over 16 MiB. Reads compare descriptor identity, size, and modification time before and after reading.

The hostile tests exercise missing compliance evidence, artifact/revision mismatch, unknown downgrade, getter-free descriptor rejection, nested getters, proxies, symbols, cycles, excessive arrays, hash drift, duplicates, lexical escapes, missing/nonregular/oversized files, a pre-existing junction, and bounded CLI input.

## Residual limitation

The filesystem verification is not atomic against a concurrent privileged rename or junction swap. `reader()` checks component links and `realpathSync(path)` before opening the path; it validates the opened descriptor afterward, but does not prove that the opened descriptor remained under the previously resolved root. `readReuseManifest()` likewise performs `lstatSync(path)` and then reopens by pathname, so a same-size replacement can race those calls. This does not invalidate the stated offline local-byte documentation result, because the output grants no adoption authority. It must not be cited as native atomic race resistance or as verification under a concurrently hostile filesystem. A future authority-bearing use would need handle-relative/no-follow traversal or an equivalent OS-specific primitive, plus a race fixture.

## Exact reviewed SHA-256

- `165dbb84732ed0ab27d839a5dd0b38a53fabc616d306dc19fd6fac272da8061c` scripts/reuse/reuse-manifest.mjs
- `549bde1366cfa77bb29c291f66b884ec7a08e01cc672fc98e517cd4497de8798` daemon/test/integration-reuse-manifest.test.ts
- `bc4afc964a6dfab43d0282e98bf5cbc06212b42d15e7f0f4f842d1cba3b09d1b` docs/reuse-decisions/manifests/R-01.json
- `f38390ad1dba4a8f258e88bb7ddc3b17b4f6a7b7b66a28f544fb40d071261886` docs/reuse-decisions/manifests/R-02.json
- `769f2c0d4741114885ecace8249854787df83db0635218760dd141c9cc30263d` docs/reuse-decisions/manifests/R-04.json
- `5baba3ce3989256743fd7512ef9598443f22e65646d5d84b155bbdd4dfabd822` docs/reuse-decisions/manifests/R-06.json
