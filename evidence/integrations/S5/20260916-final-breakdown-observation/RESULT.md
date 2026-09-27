# Maker result: final accounting breakdown observation

Status: **REVIEW READY**. This is not an independent verdict and does not close S2-03 or S5-03.

## Change

`readRunOutcome` already emits final classified monetary breakdowns, but the existing observation validator rejected every non-null component. The validator now accepts only canonical bounded non-negative decimal strings, requires base + retry + verification to equal `actualUnits`, rejects every classified component while `final:false`, and keeps `handoffUnits:null` because this DTO has no authoritative handoff-allocation input. For `final:true`, every reservation existing at the observation timestamp must have an exact immutable ledger receipt represented; the latest represented revision for each request must be actual/provider-final and its units must sum to `actualUnits`. Receipt scalars are rebound to the ledger, so recomputed document hashes cannot forge units or finality. Later receipts do not invalidate a historical observation. It neither calculates costs nor grants provider finality.

The focused test now persists a real `readRunOutcome` result containing `{baseUnits:'7',retryUnits:'0',verificationUnits:'0',handoffUnits:null}` and verifies the same outcome through the dataset/arm/policy cutoff `coverage` path. Recomputed hostile stored outcomes reject wrong arithmetic, leading-zero decimals, 33-digit overflow, fabricated handoff units, non-final classified totals, an altered final total with all classes hidden, and altered receipt units with matching arithmetic.

## Evidence

- Exact filesystem preimages are stored as Base64 and verified against `preimages.json` byte lengths and SHA-256 values.
- Initial fixture hypotheses failed before the target boundary (`task_not_ready`, then `invalid_plan:requirement-coverage`) and remain in `pass1-red.log` / `pass1b-red.log` with exit 1.
- Corrected red reproduction reached `evaluation_observation_outcome_integrity`: `pass1c-red.log`, 18 pass / 1 fail, exit 1.
- Initial minimal fix gate: `pass2-focused.log`, 24/24 pass, exit 0; independent review then identified missing ledger rebinding.
- Corrected gate: `pass3-focused.log`, 26/26 pass across the observation and outcome suites, exit 0.
- TypeScript: `pass3-tsc.log`, exit 0.
- Reviewer-requested cohort assertion recheck: `pass3b-focused.log`, 26/26 pass; `pass3b-tsc.log`, exit 0.
- `pins.json` records final source/test and all preimage/gate artifact hashes. No build was run.

Original mapping: direct S5-03 observation/cohort propagation and supporting S2-03 reconciled accounting propagation. Trusted provider receipt production and authoritative handoff allocation remain external inputs.

## Phase-allocation correction

A later audit found that sum equality alone allowed recomputed hashes to redistribute units among base/retry/verification. The final validator now derives each eligible reservation's class from immutable attempt lineage: retry link first, otherwise the validated original plan role (`verifier`, `implementation`, or `model-producer`); revised attempts remain unclassified and require all three components null. It also compares the provided latest receipt against the actual latest persisted receipt whose observed time is at or before the observation cutoff. A later-than-cutoff receipt preserves historical reads.

The final focused gate is `phase-final-focused.log`: 29/29 pass, including legitimate base+verifier store/read/cohort, the existing real retry inventory outcome, forged phase redistribution, omitted newer-at-cutoff receipt, and later-than-cutoff preservation. `phase-final-tsc.log` exits 0. The earlier `phase-focused.log` and `phase-focused2.log` fixture-setup failures are retained and are not product verdicts.
