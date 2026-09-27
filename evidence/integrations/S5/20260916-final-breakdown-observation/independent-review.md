# Independent review: final accounting breakdown observation

Verdict: **CLEAR for this bounded correction**.

The production path now accepts a legitimate final classified `readRunOutcome` and preserves its exact `{baseUnits:'7', retryUnits:'0', handoffUnits:null, verificationUnits:'0'}` through observation storage, reread, and the historical cutoff/cohort result.

The initial patch had material forged-finality gaps: recomputed hashes could bless changed totals, redistributed phase totals, or an older supplied receipt after omitting a newer persisted revision. The final correction rebinds every supplied receipt scalar to the ledger, requires exact eligible-reservation coverage, and compares each supplied latest receipt with the actual latest persisted receipt at or before the observation cutoff. Later-than-cutoff revisions preserve historical reads.

The validator derives base/retry/verification classes from immutable reservation-attempt lineage: retry link first, otherwise the validated original plan role. Revised lineage remains unclassified and requires all three components null. This prevents phase redistribution while preserving the existing quarantine rule. `handoffUnits` remains null because this DTO has no authoritative handoff attribution input.

Independent gates passed:

- final corrected combined observation/outcome suite: 29/29
- TypeScript `--noEmit`: exit 0 after the product correction
- exact Base64 preimages decode to the byte lengths and SHA-256 values in `preimages.json`

Final reviewed pins:

- `daemon/src/evaluation/observations.ts`: `e0e2ce7abeed14641267cc767023e611dc7b5814fa5aff201724d6a63833b0aa`
- `daemon/test/integration-evaluation-observations.test.ts`: `70d3d7e17a7e1a7e149a7f6de17515b23eac1e20b0633818ce3df5bde280bae8`

This review does not establish external provider receipt production, authoritative handoff cost attribution, a real measured trial, promotion, or broad S2-03/S5-03 completion.
