# Outputless failed execution handoff results

Implementation outcome: a generated JSON producer attempt that returns `failed` with null text can reuse its exact immutable verified-clean cleanup observation as the required terminal handoff artifact. The stored receipt and attempt remain failed. The dependent checker does not launch and acceptance remains unverified.

The offline resolver checks cleanup byte/hash integrity, producer attempt lineage, candidate, role, subject, canonical launch intent and attempt identity, durable session fields, zero output activity, one failed terminal activity, and any existing receipt/handoff. Existing terminal rows must describe exactly one failed/clean receipt and exactly one cleanup artifact with matching bytes, hash, and length. Completed/succeeded and checker attempts are excluded.

Verification:

- `npm run build`: passed after fixing one TypeScript test import found by the first build.
- `npm exec vitest run -- test/integration-generated-json-host.test.ts test/integration-recovery-handoff.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`: passed, 2 files and 22 tests, twice (the second run covered the final reviewer-directed exactness patch).

Final SHA-256 pins:

- `app/generated-json-host.mjs`: `223B8A990D9915775DCDE85CCDC88AC1F0344BF82D15796CB53C76D01FD6E6E2`
- `app/generated-json-handoff-authority.mjs`: `277173919D0FD459825BD7144265B63B43ADC07C8A27A6C0AA51EC43E415DBCE`
- `app/generated-json-handoff-authority.d.mts`: `935F9CABA9EA903BE5F7B75152B8DDDE4CD74F22D10E8EC2743614401525E6AF` (unchanged)
- `daemon/test/integration-generated-json-host.test.ts`: `0745E9E0E10EA50D829A3764D31E1082562C7E1680E99B793010D7F61165FBB9`
- `daemon/test/integration-recovery-handoff.test.ts`: `EE946B490C36470B10345C0A1DD12E5C45B24B7D6902BE6C44EF2B5A4D2820EF` (unchanged)

Evidence limitation: exact pre-edit hashes were recorded in `PLAN.md`, but full byte-for-byte preimage copies of the already-untracked owned files were not captured before editing. No reconstructed preimages are claimed.
