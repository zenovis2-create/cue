# S5 authoritative accounting correction 1

Date: 2026-09-12 KST  
Status: ready for independent re-review; Core remains quarantined

Preserved the original blocked review and corrected its six findings in the original owned source and test.

- Receipt IDs and runtime receipt kind/provider-final/unit combinations are validated before aggregation.
- The cutoff inventory now binds the full monetary/local policy rows, original plan, bounded attempts, retry contract/link/authority receipt, attempt-revision rows, plan revisions, and revision steps. Buffer payloads use explicit base64 canonicalization in the checksum input.
- Retry classification validates the contract payload/digest, link payload request, referenced orchestration receipt, prior attempt, run/task identity, and clean failed outcome.
- Monetary snapshots expose `remainingUnits` and `debtUnits`; debt makes the bounded monetary result incomplete and prevents a final total. Calculations match `createBudgetManager.snapshot` rules.
- Local snapshots expose a distinct `localCount` object, keep all monetary unit fields null, enforce the local policy limit, and can be complete.
- Count and maximum-payload-size gates run before bounded `LIMIT 4097` materialization.
- Current disclosure enumerates current monetary and local reservations, including request IDs created after the historical cutoff, while historical bytes remain unchanged.
- Revised attempt roles remain `lineage-unavailable:s4-revision-unverified` and `unclassified`; no original-plan fallback was added.

## Verification

- Focused integration suite: 5/5 PASS.
- Full daemon build (`tsc -p tsconfig.json` plus asset copy): PASS.
- Owned/evidence `git diff --check`: PASS.
- Source SHA-256: `EEC92B001FECB0CAB292B0261DE2E195BDA62099A141C5EAF449521519F90B31`.
- Test SHA-256: `BC4AE98DD3225BBDA2356EBCFEDE8A752BE219690F486A67F683D033564326AC`.

No Core, migration, measured-fact, budget manager, local-budget manager, selection, promotion, driver, provider, model, native, Electron, network, credential, or paid-call source was changed.
