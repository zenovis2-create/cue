# Independent review: measured-facts authoritative repair

## Review contract

Done means the repaired direct measured-fact store closes the three historical blockers with the reviewed authoritative-accounting component, passes all seven counterexamples in `design-review.md`, preserves exact stored-cutoff replay and tuple conflicts, and leaves Core containment plus `trialReady:false` unchanged. Review correction cap: 2. Every pass checks frozen hashes, the focused measured-fact and authoritative-accounting suites, containment, TypeScript/build receipts, and scoped diff. A failure requires a new evidence-backed hypothesis or handoff. This reviewer owns evidence only and made no product or test edits.

## Verdict: PASS — repaired direct-store component remains contained

The implementation closes the historical accounting gaps. First capture rejects an authoritative-snapshot-shaped object supplied by the host and calls `captureCurrent(runId)` internally inside the immediate insert transaction. It requires the caller's monetary items to cover the authoritative snapshot one-for-one at each latest receipt, rejects incomplete/unclassified inventory, binds the registered price currency/unit, and persists the authoritative snapshot itself. Caller class values never enter the stored result; the positive fixture proves `base` and `verification` come from database lineage even when every caller class is false.

Stored reads recognize authoritative accounting only in the authenticated measured-fact payload. They call `projectAt(runId, storedCutoff).historical` and require byte-for-byte equality, excluding `currentDisclosure` from fact identity. The positive monetary regression appends receipt revision 2 after capture and proves both read and exact capture replay return the unchanged revision-1 fact. The separate authoritative-accounting suite proves the newer revision is disclosed while cutoff history remains immutable.

Existing exact fact/enrollment/observation replay returns the validated stored row before host capture and without reapplying the latest-observation rule. A later observation therefore does not invalidate the earlier fact. Reusing a fact ID with another tuple or reusing the occupied enrollment/observation tuple with another fact ID fails before a second row appears. Stored payload/scalar tampering still fails closed.

## Counterexample coverage

1. Two final monetary reservations with one host item omitted: rejected; no understated fact is stored.
2. Caller supplies false cost classes: stored classes are authoritative `base` and `verification`.
3. Receipt revision appended after capture: stored accounting, cutoff, and fact replay remain identical.
4. Observation revision appended after capture: exact earlier tuple returns unchanged with host capture count still one.
5. Changed fact tuple and occupied enrollment/observation tuple: both replay conflicts; row count remains one.
6. Public Core capture/read: both remain synchronously unavailable before host callbacks or writes.
7. Caller submits a valid authoritative snapshot shape on first capture: rejected; snapshot shape does not confer stored-row authority.

## Verification

- Independent focused run before the coordinated build: measured-facts plus authoritative-accounting passed 15/15. Containment failed only because `daemon/dist/migrations/039_readonly_verifier_identity.sql` had not yet been copied; this historical ENOENT is not counted as a pass.
- Root coordinated build receipt `c7b367`: PASS and copied migration 039.
- Independent post-build containment-only run: 1 file, 1/1 PASS.
- Maker focused measured-fact suite: 9/9 PASS; configured pretest TypeScript/build PASS; scoped diff-check PASS.
- Independent scoped `git diff --check` for source, maker test, and repair evidence: PASS.

## Frozen hashes

- `daemon/src/evaluation/measured-facts.ts`: `072072079F1F6B571DD77727BD8BA9AA3EC9FB98D5C097DDB1FAD1CF0107FA57`
- `daemon/test/integration-evaluation-measured-facts.test.ts`: `6D5971A0568592B561B190B13F9A727FFCF27DEC49318955D42967717ABBF691`
- `app/core.mjs`: `BBC7E32B0424E654B8C3CD139A80A83CE8103477CA70F77C86570064C49A7C27`
- `RESULTS.md`: `A43E8A869D885A055ED317ED39F28D59E8383E995A9271CBCE8477934EA436F1`
- Updated `design-review.md`: `B63A4951998049279D0D53A01A259CEB536A250B1EE1C50DB385F67C2B77C981`

This PASS repairs the direct factory only. It does not lift Core containment, make any fact trial-ready, approve measurement or promotion, qualify a real trial, or authorize provider, model, native, Electron, network, credential, or paid activity.
