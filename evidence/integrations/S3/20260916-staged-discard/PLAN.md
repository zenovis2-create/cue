# Durable failed-clean staged discard

Done means migration 048 installs a separate immutable discard record with only `discard_verified` and `discard_unknown`; a strict failed/clean execution receipt for the exact running attempt and exact coordinator-owned execution root is required; publication or change-set evidence refuses discard; cleanup is inspected; only verified discard permits write-lease release; unknown/tampered/reopened states remain blocked. The driver must route the real failed-clean receipt through this coordinator before ordinary terminal persistence.

Attempt cap: two implementation/test passes for this schema hypothesis.

Every pass runs direct Vitest for the staging migration definition and driver publication suites after the coordinated build. Failure gets a new hypothesis or is handed back after the cap.

Exact byte preimages were copied before edits under `preimage/`.

- `daemon/src/ledger.ts`: SHA-256 `582ED1BDFF398BF12B21DAADC0ABE9A07020DD7532635BA50CD0CC0B197D0A33`
- `daemon/src/orchestration/staging-authority.ts`: SHA-256 `26D1F0D968785E0613BDC1D2E828C2F85DACDEFA1D481CFA474140D1F336AA57`
- `app/orchestration-driver.mjs`: SHA-256 `1EBC106A7EF14C3B2E1C79A1BA839752BD0FFC9B35C4647F78EC9AE28E80AB73`
- `daemon/test/integration-staging-authority-migration-definition.test.ts`: SHA-256 `DFFCB5F7883D67ACBA166FBAEEF658687943562D3B60A4AB410AC0DA9684FA71`
- `daemon/test/integration-driver-publication.test.ts`: SHA-256 `F8F0C32E10AAAEA5D6F070FED68653725A6D867504BF93D0385B6ED60A094496`
- `daemon/src/orchestration/store.ts`: SHA-256 `267B755F0C6CE4EC4267B522686878D77305FA19AD12354A72B0045FDEAA5E02`
