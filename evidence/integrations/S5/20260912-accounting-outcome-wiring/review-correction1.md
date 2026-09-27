# Independent correction-1 review: accounting outcome wiring

Date: 2026-09-12 KST  
Verdict: **PASS for the accounting-to-outcome wiring unit**

## Review done contract

Done means preserving the initial blocked review, verifying that the corrected outcome fixture creates a valid acceptance receipt through the public evidence-policy API, rerunning the full outcome/report/accounting/acceptance/history and observation/Core/UI consumer set, checking the frozen hashes and owned diff, and running the coordinated daemon build after concurrent native source stabilizes. Only this review file is owned. No provider, model, native helper, Electron, or network call is made.

## Correction assessment

The accounting implementation is unchanged at SHA-256 `BC7CE539B31AC8751ED34A660E5BFEB3ECD647060F2D1333F4CC3FABECD2FA64`. The correction is confined to the outcome test fixture, now SHA-256 `4F1ED660D95D80E711F1FD7756DD0EDEE8E93B5E0636B6430BCFA6460D11C51B`.

The fixture now supplies a typed public `EvidenceObservation` from its registered checker. It binds the checker and producer principals, parameters digest, policy source revision, observed time, exit status, target-manifest digest, verdict, target identities/bytes/digests, and the kind-specific hostile checks, claim-source map, required sections, render proof, or external observation fields. The acceptance implementation validates those fields through the normal public collection/finalization path. No database receipt injection or policy weakening was introduced.

This restores the two cases blocked in the initial review:

- The positive case now obtains an actual accepted receipt, so `readRunOutcome` validly reports historical acceptance while billing remains unresolved.
- The corruption case first obtains that accepted receipt, then proves contradictory task state and mutated acceptance bytes fail closed. The policy-corruption branch remains intact.

The full accounting behavior remains as reviewed: authoritative all-reservation inventory drives monetary class totals; missing/estimated receipts withhold finality and breakdown; debt is disclosed with decimal committed/remaining/debt values; revised lineage withholds all classes; retries include failed and replacement attempts; handoff remains null; local accounting remains committed-dispatch count only. The existing outcome-report path carries the same DTO, and observation/Core/UI consumers accept the current monetary/local shapes.

## Verification

- Outcome, outcome-report, authoritative-accounting, current acceptance/history, evaluation observations, observation Core, and evaluation UI: **65/65 passed across 8 files**, exit 0.
- This contains the maker's corrected **54/54** focused set plus **11/11** consumer cases.
- Coordinated daemon build (`tsc -p tsconfig.json` and asset copy): **passed**, exit 0, after the concurrent native worker reported stable source.
- Owned/evidence `git diff --check`: **passed**.
- Frozen source and corrected-test hashes match `RESULTS.md`.

No blocking correctness issue remains in this unit. This PASS is limited to wiring the already reviewed authoritative accounting snapshot into the existing run-outcome DTO, report, and evaluation consumers. It does not establish a real trial, promote measured facts, complete S5 measurement, authorize external execution, or broaden Core beyond the reviewed path.
