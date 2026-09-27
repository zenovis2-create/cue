# Native authority foundations independent review

Date: 2026-09-16 (Asia/Seoul)  
Reviewer: `provider_installation72`, independent of maker `cost_observation74`

## Initial verdict

**NOT CLEAR — the assigned complete authority constructor is absent, and the retained foundations have trust-boundary gaps**

The maker correctly refused to invent authentication or entitlement. The repository has no trusted pre-launch producer for a current provider-account authentication/entitlement observation. Consequently, `createNativeExistingFileAuthorities` and the requested real Core/deployment-staging positive path were not implemented. This prevents a Unit 1 completion claim but is safer than accepting an account reference, installation presence, capability evidence, or caller-shaped boolean as service authentication.

The first frozen foundation pass also had three material defects:

1. `native-runtime-receipts` validated only selected top-level fields when decoding an immutable row. It did not exact/deep-validate `outcomeInputs`, controller/workers, or owned-resource evidence. A canonical row inserted directly into SQLite could therefore contain shaped inner evidence and later be returned as trusted.
2. Receipt outcome classification accepted `read_only_result_received` for any issued result without binding the authentic runtime mode/role. Implementation and verifier success semantics must remain distinct.
3. The deterministic checker used ordinary array `length` and `map` reads rather than dense own-data descriptors, permitting accessor execution at its public input boundary.

The native runtime identity dependency separately required a correction because process-tree membership and native creation identity were observed in sequence without bracketing. The dependency maker changed this to stable root and target FILETIME observations around tree enumeration and added changed-identity refusal; its final coordinated evidence remains pending.

Required correction evidence includes hostile direct-row tampering, cross-mode outcome refusal, getter/proxy-free checker admission, exact retry after a failed receipt insert/transaction, native identity reuse/refusal, and the maker's corrected focused fixture passing after a coordinated build. This review will remain bounded to the independently useful receipt, cleanup, and checker foundations unless a real trusted authentication producer and the complete constructor are added.

---

## Corrected bounded-foundation review

Foundation verdict: **CLEAR for migration 050, authentic native runtime receipts, native cleanup observation, and the opt-in deterministic existing-file checker**

Overall Unit 1 verdict: **NOT DONE — the fixed native authority constructor and Core/deployment-staging positive path remain absent**

The initial findings remain preserved above. The corrected receipt store exact-validates the complete issued-evidence schema, including role, verification mode, outcome inputs, process identities, resources, bounds, and uniqueness. Implementation success now requires an implementation mode with `goalVerification.passed`; verifier success requires the model role, `read-only-result`, and the exact `read_only_result_received` reason. Copied result objects, mismatched bindings, cross-mode evidence, denormalized rows, malformed canonical inner evidence, and conflicting replay refuse.

The runtime issues evidence through an exact-object private map after ordered teardown. The adapter binds it to the persisted attempt, candidate, expected subject, and session before inserting migration 050's immutable row. Evidence reads are idempotent, so a failed insert or rolled-back transaction does not burn the authentic proof; an exact retry can commit, while the unique attempt/receipt/session constraints make later replay immutable. Adapter completion fails if required receipt persistence fails.

The native identity dependency now observes root and target Windows FILETIME identities before and after owned-tree enumeration and requires stable exact identities plus tree membership. It does not mint ownership from the controller PID printed on stdio. Copied/foreign results and simulated target identity reuse refuse. Account/profile resources are marked `retained-authorized`; cleanup neither deletes them nor requires their absence. Only `ephemeral-owned` resources are absence-checked. Live matching processes yield residual, changed creation identity means the owned process has exited and the PID was reused, and query failure remains unknown.

Migration 050 is installed with exact schema-definition comparison and immutable guards. The packaged SQL is byte-identical to source; fresh, upgrade/current, reopen, partial-install, weakened-trigger, and current 048/049 coexistence checks pass. The deterministic checker captures dense own-data arrays without invoking accessors, binds every target's path, bound, expected final SHA-256 and exact byte length into its parameters digest, and rejects missing, extra, duplicate, unchanged, oversized, or mismatched artifacts. It is an explicit mechanical artifact contract and does not interpret provider prose or claim an arbitrary natural-language goal passed.

Reviewed foundation SHA-256 identities:

- `daemon/migrations/050_native_runtime_receipt.sql`: `A01C219129A940A07749107B1A4760B62C3D0702A13D668B7CB445D459F2CAD7`
- `daemon/src/orchestration/native-runtime-receipts.ts`: `1DDA9817D130AE17E1F8513AE5A7D196CB3CE8EC464CEE04ED6821AAE8BB1D9F`
- `daemon/src/native-process-cleanup.ts`: `1BA52E80BC23DB88D358D49F0B33572D97A41D9AE18B77314E89D54477C5B504`
- `daemon/src/verification/native-existing-file-checker.ts`: `2D25DD1BA93875DF50F29C22B753AF20AA604058BE9EF0FF357EDBD45F1736D8`
- `daemon/src/ledger.ts`: `1CCBA282683B77AC545F96FE61B9753E7861E28DC71646237BBD433596E7C2AC`
- `daemon/scripts/copy-assets.mjs`: `AB5BB35D383E9A413D09BC55E4938DEBCAB3FFB9B25662E8FD4CFD8D52C3270D`
- `daemon/test/integration-native-runtime-receipts.test.ts`: `F5EA589F700C6434031F4E9DE99C3A7106A920C0C18E1AF557AE5C4FC9B361C8`
- `daemon/test/integration-native-process-cleanup.test.ts`: `8D34BCD97E25CBD1ED403912F38A4F90F53D7838BC31C557AD1DA8DBDA165510`
- `daemon/test/integration-native-existing-file-checker.test.ts`: `7E46F990808B60961F58174ABFCA7A663A1F5CBE68BB820F4846C50EA12E25D7`
- `daemon/test/integration-native-runtime-migration.test.ts`: `66519EF79FB7DF914CA1BEB46E176B1F8F28C273D520AD127A89140918437D29`
- Maker `RESULTS.md`: `22B1618EA3D6D8112826821D4D418BC750E551CE5DFFBED3FE43D9DBEC1AE55D`

Durable gates show the coordinated consumer build passing; the foundation suite passing **22/22 tests across 9 suites** with zero skips/failures; migration 050 passing **2/2** packaged/fresh/reopen/partial/weakened checks; and the corrected native identity plus actual runtime receipt dependency passing **20/20 tests across 4 files**. Evidence identities include `foundation-gate.json` SHA-256 `030223EF415856B2B5B555F3E1F61E86050C64B71099C8BD6E6AB71AC9A8CF26` and `focused-final.raw.log` SHA-256 `38529425B4C52269B0C2303F962195D2BBFDAC90D3B99857F7CA68727C5FC3E7`.

The repository still lacks a trusted pre-launch producer for current provider-service authentication and entitlement. Installation identity, auth-profile presence, capability evidence, account references, and downstream run lineage do not establish that fact. Therefore no constructor, complete native workflow, final billing, publication acceptance, provider qualification, or S1 closure is approved by this review. Missing billing remains outside this implemented foundation; any future authority must emit unknown/non-final and retain the conservative reservation unless exact trusted billing evidence exists.
