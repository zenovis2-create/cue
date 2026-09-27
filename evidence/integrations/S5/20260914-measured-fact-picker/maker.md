# S5 measured-fact picker maker handoff

Outcome: LIMITED after the second and final maker pass.

Pass 1 ran the required daemon build and exact three-suite Vitest command. Build exited 0; Vitest exited 1 with 31/32 passing because a new DOM fixture asserted before list controls were re-enabled and closed JSDOM before a stale promise drained.

Pass 2 changed only those waits, then ran the same required commands. Build exited 0 and Vitest exited 0 with 3 files and 32 tests passing.

Implemented scope:

- Core bounded SQLite rowid/fact-id scan, at most 64 candidates and 20 protected summaries, empty incomplete continuation, stale cursor denial, and closure-protected evidence revalidation.
- Strict safe list DTO and before-prepare IPC dispatch.
- Manual measured-fact refresh/next picker; selection invokes the existing revalidated detail read; run/error/approval fencing clears list and detail and approval locks controls.
- Actual SQLite/Core→IPC coverage for reopen/no-write/no-recapture, foreign/corrupt skipping, 65 corrupt rows before an older valid record, bounds, disabled host, closed Core, outer transaction, and protected receiver.

Closeout gap: IPC command-shape validation accepts `measured-fact-list`, but its local numeric bounds branch still lists only `comparison-list` and `projection-list`. Core rejects invalid bounds before callbacks, yet the assigned IPC-local rejection-without-Core-call boundary is not proved. The cap was exhausted, so no post-pass source/test correction was made.

No model/server/network/native/live Electron action, commit, or push occurred. The fixture-only dropped lineage triggers/FKs and injected terminal authority remain synthetic and grant no runtime, measurement, trial, promotion, policy, capture, registration, or launch authority.
