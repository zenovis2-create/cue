# Independent post-generation validation

No generator, build, functional test, report renderer, model/provider, native helper, Electron, or network command was run by this reviewer.

- Root generator receipt: exit 0, `ready:true`, `reused:false`, 170 files, 385 edges.
- Generation and snapshot digest: `fa8c3a322a043f33c8208434ca55a7a805fe4266b171860a9a4236fd91481732`.
- Current pointer: 296 bytes, SHA-256 `c9789ea40ccb4e251c18d19998ec4bb4e62d4ed76e70cdaa5c3b6f1b7879c216`.
- Manifest: 984 bytes, declared and observed SHA-256 `507b490f709d9dbdadf94867b37e33d1a789eb1a90295e79c42318d9e760b6ae`.
- Pointer, manifest, `source.json`, `result.json`, and both basis observations use the exact generation digest.
- All 170 declared source paths exist and match their current SHA-256; zero mismatches.
- Recovery policy source matches required SHA-256 `bd35e5d614da53a031320ac81196b296b8f81cfcc4c9a756f03fd744b19f502f`.
- Basis before/after both record HEAD `8e2afa6366e3af62f7115b2c67be799130f8dfdf`, scoped status SHA-256 `7f0ea2978e2ee88b0ee43b5156179b54dd7b8f3b020137370202ec200f0e9f05`, and 132 entries.

| Artifact | Bytes | SHA-256 | Result |
|---|---:|---|---|
| `cue-current-source.html` | 128998 | `e1079c8499b365a7753b2f579e68665a652d1e597c72423b0d6471e4e79d8b06` | match |
| `cue-current-comparison.html` | 164447 | `9aa3b204fa65e1814d20c6389c2fd16d44019fc9ce099327b705585be8b04204` | match |
| `source.json` | 125344 | `91642210a43438e26b4d9366608bc899992aba8ab1e6cb1292b3e12b1a88ab54` | match |
| `source-basis.json` | 708 | `9e207f8eb2dba13774025f2985c9dac4cc05b9d04fa9caa2a271c7dbe6270045` | match |
| `result.json` | 334467 | `9a584905b5613872470238d649702fd9341aecc859b2fcfa0f0e72c53704c2c5` | match |

Historical validation:

- All 69 before-manifest records were checked. Exactly one mismatch is the authorized `current-generation.json` pointer update.
- The other 68 before records retain exact byte lengths and SHA-256 hashes.
- All nine top-level preimages independently match their prior records.
- The history grew from nine to ten generation directories; the new generation contains exactly six files (five artifacts plus `generation.json`). No prior generation file was lost or changed.

Verdict: PASS for this bounded static source refresh.
