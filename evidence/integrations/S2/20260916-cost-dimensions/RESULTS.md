# Persisted cost dimensions results

## Outcome

- Monetary and local engines now accept an optional terminal cost observation and persist it in the same transaction as the execution receipt. A bad source digest rolls the terminal mutation back.
- The immutable row binds run, attempt, candidate, current launch subject, provider/tool, and either the approved account identity for API/subscription or exact runtime attempt identity for local resources.
- Source bytes and their digest are stored and verified. Canonical payload and denormalized row fields are cross-checked in SQL and on every read.
- The snapshot and renderer distinguish API amount, subscription usage, and local resource usage; actual, estimated, and unknown; fresh, stale, and future. Subscription/local units are never displayed as money or free service.
- Observations remain `observation-only`; they do not create budget receipts, finalize billing, grant candidate/selection authority, convert units, or release reservations.

## Gates

- Coordinated batch76 build after corrected migration048: PASS, exit 0 (root-owned log).
- Focused gate: PASS, 4 files and 32 tests. It covers monetary engine API unknown, subscription estimated/stale, local engine actual/stale, renderer dimension labels, source mismatch rollback, existing receipt fallback, and migration startup.
- TypeScript no-emit: PASS, exit 0.
- Renderer syntax: PASS, exit 0.
- Owned-file diff check: PASS.
- Independent migration gate after correcting its schema-invalid `pending` fixture to `queued`: PASS, 4/4 tests. Preimage `b616d452da5ea55bb712ae1f8e74c6a63e556783eef62f40500a1eef17c78378`; corrected test `e49d35f7f7bd4a708e331e327290cab3f6489efff5d01b279677936a01168102`.
- The initial 31/31 failures were an upstream migration048 SQL parse error before any cost test ran; root preserved and corrected that infrastructure baseline before the successful pass.
- A later preliminary root combined gate used the first reader revision and exposed deterministic property-order sensitivity: canonical stored lineage was parsed in alphabetical key order, while current lineage used construction order and `JSON.stringify` falsely reported an integrity mismatch. The reader now compares both sides through the same canonical serializer; the post-correction 32/32 gate and store pin below include that fix.

## Final hashes

- `049_cost_observation.sql`: `2dcb4a5b3f7f0e0e4a5ec73ce7f7adc15df8463e801718e09bdae220e8fa54ad`
- `persisted-cost-observations.ts`: `ec3f4dec66f069a78041cdcf656375f33360e5049e05ef0dede12e662e1dcfca`
- `engine.ts`: `9ee35ae52fe05fe5de1f5ff579ea35ba4e950591d0e3dd417e7816d99ed53d92`
- `ui/orchestration.ts`: `cdc7a42ccebdd392dc31b63e118bb6841c67b357778ca6a8ef2d25882d937c4c`
- `renderer.js`: `25132c9f546ef71a3b6ae811c5ed51a99a3d3037df755a4711e3a8d977888fa3`
- `copy-assets.mjs`: `8bd81af4adf139d5bd07580623c20b479cf47d407d451a6e73dd4d2954e36a9a`
- `integration-persisted-cost-observation.test.ts`: `6a08c72be01ba5d83792be803fb9925b8a21d274637131c74b21bc2c2ac865b7`
- `integration-engine.test.ts`: `85e47c3fb8d76fdf7ee43c8a9d3eb4c9f6ad0360829ae5a2e82285b3e61db927`
- `integration-local-engine.test.ts`: `25a94597556792d49a176141c0740a299fb3db5af23c2d1524a4055541748abf`
- `integration-cost-observation-ui.test.ts`: `c1556f77d9f85ec03b609c4bb54d55f0efec9652989f3cc62d97e2c8d8304ffb`

## Limits

- This is one immutable terminal observation per attempt with exact replay. It does not implement a later estimated-to-actual revision stream.
- Missing host observation remains unknown; existing trustworthy monetary budget receipts retain their legacy API-only fallback.
- Offline fixtures prove the production path and distinctions, not external invoice correctness or live provider qualification. No live/provider/model/network call was made.
