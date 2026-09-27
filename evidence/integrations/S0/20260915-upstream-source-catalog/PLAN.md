# Upstream source catalog plan

## Done contract

- Resolve the current canonical GitHub repository and immutable HEAD commit for `vastsa/PI-Desktop`, `Tencent/teamai-cli`, and `tt-a1i/archify`.
- Retrieve only bounded primary repository metadata and selected source bytes needed to inventory root/package manifests, license/NOTICE files, and asset/BOM indicators.
- Record immutable pinned URLs, retrieval timestamps, exact byte lengths and SHA-256 values for every retrieved file.
- Keep missing, absent, ambiguous, and unreviewed inventory entries explicit. A repository license label or file does not grant Cue adoption authority or establish a complete redistributable BOM.
- Do not install or execute fetched code, call providers, use credentials, or make paid API requests.
- Validate the final JSON with a local descriptor/shape/hash/link consistency check and parse it successfully.

## Attempt cap

Two catalog revisions. Each pass runs JSON parse, schema/field checks, duplicate URL/path checks, SHA-256 format checks, bounded-count checks, and immutable commit URL checks. A failure requires a changed hypothesis or handoff.

## Ownership

This unit writes only `docs/reuse-decisions/upstream-source-catalog.json` and this evidence directory. Root owns integration into other manifests and documentation.
