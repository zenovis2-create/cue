# Recovery observation integrity maker receipt

Status: maker PASS, source frozen after revision 2.

The recovery store now snapshots the complete own-data failure observation before invoking clock or proof callbacks. It persists the four decision-authority fields under nested `cue-recovery-classification-v1` while retaining the migration-required outer `cue-failure-observation-v1`. Decision creation canonically validates the stored payload, requires a fresh complete reread to equal it, copies proof bytes, and derives retry/replan facts from the saved authority only. Legacy observations without the nested authority cannot create or replay a non-stop decision. Alternate candidate status is snapshotted once and reused after later callbacks.

Tests cover false-to-true and true-to-false authority drift, mutation after callback return, proxy rejection without traps or proof reads, missing/malformed/extra legacy authority, single candidate callback use, unchanged valid replan, final budget and attempt-slot races, claim limits, replan budget, and driver regressions.

## Gates

- Revision 1: daemon build exit 0; 4 files, 78 tests passed, exit 0.
- Revision 2: daemon build exit 0; 4 files, 80 tests passed, exit 0.

Raw terminal output and exit markers are retained in `logs/`. This unit uses injected host observations and runtimes; it does not qualify live provider, native, UI, or credential behavior, and it does not close broad S4.
