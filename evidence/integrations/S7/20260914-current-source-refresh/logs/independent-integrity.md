# Independent post-generation integrity audit

No generator, build, report renderer, model, provider, native helper, Electron, or network command was run by this reviewer.

- Current generation: `26081b828ecffd738ba59cc709bf9dc806c9f2f278809a809b1fbb8024324a42`
- Pointer snapshot digest: exact generation digest
- Manifest SHA-256: declared and observed `19123b1505bc802e904fc2d8a6757bfbc20773e2974f66cf93d386d2155578e2`
- Result: 170 files, 385 edges; result, source, basis, manifest, and pointer use the same snapshot digest.
- Source verification: 170/170 current source files exist and match their declared SHA-256; 0 mismatches.
- Basis verification: before/after both use HEAD `8e2afa6366e3af62f7115b2c67be799130f8dfdf`, status SHA-256 `7f0ea2978e2ee88b0ee43b5156179b54dd7b8f3b020137370202ec200f0e9f05`, and 132 scoped entries.

Manifest artifacts:

| Artifact | Bytes | SHA-256 | Result |
|---|---:|---|---|
| `cue-current-source.html` | 128998 | `6a6c5aa2d0e2206078c7786ae1f5c8257a29717b130d7566195601d5a0ed880b` | match |
| `cue-current-comparison.html` | 164447 | `121560d4e362411e33773e2a5a4cecccb9a29388a5a8d790ee3ac282606bee4f` | match |
| `source.json` | 125344 | `8f2632de09ff42125cd8089c08ec721acb0cfd4ab2318382a15b644ded2e01e7` | match |
| `source-basis.json` | 708 | `a64733b5a0a97bbfbb455a1b751352c5d91654b3cfcf7e7160044a11e7e829ab` | match |
| `result.json` | 334240 | `ac35fbbbdd108836954e9f4966811b51ce70b69b798f64e61367a168d61a3c80` | match |

Historical retention:

- All 63 before-manifest records were checked. Exactly one current-path hash changed: `current-generation.json`, the authorized pointer update.
- The other 62 records, including all eight earlier generation directories and the retained staging generation, preserve their recorded byte lengths and SHA-256 hashes.
- Nine top-level preimage copies were independently matched byte-for-byte and hash-for-hash to the corresponding before-manifest records, including the prior pointer (`909652ce62a6dc440098d4ad98e26ac3259ee4b3a8edc3fcc899221daa15b146`).
- Nine generation directories now exist: the eight retained historical generations plus the new current generation.

Verdict: PASS for the bounded static source snapshot, artifact integrity, pointer/basis binding, and historical retention claim. This proves no runtime, provider qualification, native behavior, or whole-product completion.
