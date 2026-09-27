# Independent review — upstream source catalog

Verdict: **PASS for the bounded provenance catalog.** The catalog preserves exact repository responses and selected source bytes at immutable commits. It does not authorize adoption or establish legal permission, license compatibility, a complete BOM, or runtime suitability.

## Independent validation

The current catalog SHA-256 is `2407ab681c4677887acf96c8eae438f7cc72ca32cf04a302d362dd2d0b3a1579`. Its retrieved-byte manifest SHA-256 is `18c0ad52cd1b469aeb3b9297860969247e8b1ebd67f7728c857e17d2636555b3`, matching the catalog's evidence pin.

A local read-only audit independently checked all 23 manifest entries. Every preserved file exists under the evidence directory and matches both its declared byte length and SHA-256. Mismatches: 0.

For each of the three repositories, the preserved repository response matches the requested full name, canonical GitHub HTML URL, default branch, and captured GitHub SPDX field. The preserved commit response matches the cataloged 40-hex commit and names the cataloged tree SHA. The preserved tree response names the same tree SHA, reports `truncated:false`, and contains the cataloged entry count:

- `vastsa/PI-Desktop`: commit `4e2e005551bcb278eee475c79cdee41de0348f29`, tree `66fe88f74711c844888f467a65b2cb91d79cd7b0`, 1,860 entries.
- `Tencent/teamai-cli`: commit `556293ee42730bf56aecb4d0e8efda2dd5a5348a`, tree `a6480f6992cf8eacc9cf3786137ed88a081eea44`, 600 entries.
- `tt-a1i/archify`: commit `d673e8300df60a5c8166abe78787fdc78f6b8000`, tree `fbc0ebdc79d2b07f72da136e61e57dfc6b2a357d`, 575 entries.

The commit API, recursive tree API, and raw-content templates embed those immutable IDs. Every cataloged retrieved source path, license path, and notice path is present in its exact saved tree. The complete saved tree path inventories support the narrow absence statements: neither PI-Desktop nor teamai-cli has a NOTICE-named or third-party-notice file path at the pinned tree; archify contains the two listed `THIRD_PARTY_NOTICES.md` files. This is only filename/path evidence. It cannot prove that no notice obligation exists.

## Truth boundaries

All three repositories remain `bomStatus:"incomplete"` and `adoptionAuthorized:false`; the catalog-level adoption flag is also false. Each repository retains explicit unknowns for transitive dependencies, notice completeness, assets, or unreviewed files. The catalog states `legalConclusion:"none; source and repository labels are evidence inputs only"`.

The GitHub SPDX values (`LGPL-3.0`, `NOASSERTION`, and `MIT`) are fields in the saved GitHub repository metadata. They are not an independent legal interpretation, permission grant, compatibility finding, or proof that every dependency and shipped asset has the same license. The retrieved license and notice texts remain evidence inputs requiring a separate legal/BOM review before any adoption decision.

No fetched code was installed or executed during this independent review, and no network refresh was needed. “Canonical repository” here means the identity and HTML URL in the preserved GitHub repository response at retrieval time; it does not prove perpetual project ownership or equivalence to any local installed artifact.
