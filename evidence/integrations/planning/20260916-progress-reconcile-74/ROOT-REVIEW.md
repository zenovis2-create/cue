# Batch 74 final reconciliation review

## Verdict

**CLEAR with the recorded limits.** The frozen batch is internally consistent and does not claim release readiness or completion of the 21 open original parents. No actionable reconciliation defect was found.

## Independent pin and accounting checks

- Recomputed all 118 `RESULTS.json` pins: 6 documents, 16 source/test files, 6 compiled files, 79 evidence files, and 11 generated artifacts. All exist and all SHA-256 values match.
- Recomputed all 63 entries in `prior-artifact-inventory.json`. All exist and all hashes match.
- Confirmed the parent accounting: 44 original parents = 23 previously closed + 0 newly closed + 21 open.
- Confirmed `doc-check.json`: 694 local links, zero missing, 63 prior artifacts unchanged, and current-source generation `17fbc8cf...d4171` with 191 files and 433 edges.
- Confirmed the current release generation `c0934fc...a17df` reports `not-ready`. The batch does not convert bounded implementation evidence into release approval.

## Regression reconciliation

The retained initial full-suite result remains exit 1 with 1,661 passed, 47 failed, and 9 skipped. It has not been rewritten as a green full-suite run.

The failure classification and focused results reconcile arithmetically and by artifact:

- 42 driver/real-restart fixture failures are covered by the final 77/77 driver and restart gate;
- 2 selection fixture failures and 1 migration-boundary fixture failure are covered by the combined 15/15 focused gate;
- 1 startup-identity fixture failure is covered by the 2/2 positive and reused-PID gate; and
- the remaining 1 failure is the historical unknown Codex SHA mismatch, explicitly user-deferred.

Thus 46 of the 47 initial failures have later focused passing evidence. This is targeted reconciliation, not a subsequent clean full-suite result. The startup run has a bounded session-observation record in `startup-fixture/RESULTS.md`; `checks.json` correctly states that no standalone raw startup log was retained.

## Claim boundaries

The final documents preserve the material limits:

- optional native-host installation binding is not default-startup, authentication, entitlement, protocol, or provider qualification;
- the cost observation bridge is a durable read surface without a runtime/selection consumer or trusted real billing producer;
- writer admission covers declared `file_change`; command/shell-capable writes and standalone/default paths remain outside the bounded gate; and
- reconstructed writer preimages are verified by Git object content, while the original driver's mixed line endings were not preserved byte-exactly.

The early `REMAINING-AUDIT.md` S3 paragraph predates the final named-suite overwrite assertion and therefore describes that assertion as missing. The final status documents supersede that temporal clause: they record the winner/stale-loser/reopen assertion and keep S3-03 open for command/shell and standalone/default breadth. This chronology issue is non-blocking because the authoritative current status is accurate and still leaves the parent open.

No provider, model, network, or new test call was made for this final review. The approved subscription budget remains exhausted at 4/4, Qwen remains off, and the review does not equate this bounded batch with completion of the remaining 21 parents.
