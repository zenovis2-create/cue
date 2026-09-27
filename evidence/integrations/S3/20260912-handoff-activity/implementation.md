# S3 immutable handoff and typed activity implementation evidence

Date: 2026-09-12

## Verifier contract recorded before product edits

- Done means `npm run build`, the nine focused Vitest files listed in the Unit 1 design, and `npx --no-install tsc -p tsconfig.json --noEmit` pass from `daemon/`; the deployed migration list matches source; a real file-backed SQLite fixture closes and reopens without changing immutable handoff facts; hostile replay/mutation/accessor/proxy/bounds/identity/artifact/crash/atomicity/late-callback probes pass; and `git diff --check` passes for owned files.
- Correction cap: two full correction passes after the initial implementation.
- Every pass runs the complete gate above, including migration parity, reopen probes, hostile probes, and the owned-file diff.
- On failure, retry only with a new evidence-backed hypothesis. Roll back any correction that makes the measured gate worse; after two correction passes, hand the remaining failure to the human with exact evidence.

## Initial baseline

The pre-implementation build and TypeScript check passed. Vitest passed the seven pre-existing requested files (91 tests); `integration-handoff-activity.test.ts` and `host-codex-controller.test.ts` did not yet exist and Vitest silently omitted them. There were no pre-existing test failures.

The first implementation probe exposed 28 failures: selection was persisted before the stage envelope it validates against, and the driver could not launch. Moving selection back after stage binding and adding a separate in-transaction launch-intent boundary restored launch. The next probe exposed retry-history duplication in the readiness join and terminal blocking without an empty-artifact handoff; the readiness query was changed to correlated existence checks and clean verified attempts now create a canonical empty-artifact handoff when the host reports no artifact claims. These failures were retained here rather than treated as baseline success.

## Final gate

- Correction pass 1: build, TypeScript, migration parity, SQLite reopen, and eight present focused files passed (96 tests). The ninth controller test was then added.
- Correction pass 2: build passed; all nine requested focused files passed (97 tests); `tsc --noEmit` passed; source and deployed migration lists matched through `031_orchestration_handoff_activity.sql`; the file-backed hostile fixture passed close/reopen; and owned tracked-file `git diff --check` passed. A final accessor-array descriptor probe was added within this pass and the full gate was rerun with the same 97/97 result.
- No model, provider, network, worktree, native process lifecycle, or Electron execution was performed. This evidence does not claim actual OS Stop/cleanup lifecycle or close the S3 checklist; independent review remains required.

## Product and focused-test SHA-256

```text
701857afeab8f84ba8b05ae942cbc80ed64d135e6e88d733995ef38ef9152796  daemon/migrations/031_orchestration_handoff_activity.sql
26ff13e983b51514f49a87ead7bbff2dbd59a76114442f9a7bee49f7c313b179  daemon/src/orchestration/handoff-activity.ts
28a34a4a1cfe27f982d12aa75f4b5ba1ea36c5562e0eeb92c1fe2e0734f5405a  daemon/src/orchestration/store.ts
22c64c297cdea25e100ee64bbe3f49d08b43f0cba9e3063caf2990d29cc435bd  daemon/src/orchestration/engine.ts
ba5f0f3f01bd3e124c2327acb4e106865eb4242603a743a71dba6b9fdd4fec29  daemon/src/integration-runtime.ts
7a1a2817b7498f34143e3ab1c471f11bcd355ebdc4c4173889abf326e8096ffd  daemon/src/adapters/integration-executors.ts
68e4cd2f6da5fb0f119587650ae277d6cb6e744257f81f05c0b504f69b2963d8  daemon/src/host-codex-controller.ts
a708278bdcd6b05ef2696c0a62f767e2310c95e4ddee68f181be01a01b5a7378  daemon/src/host-codex-runtime.ts
7ea2c3159361a320cf95ebf83c8e278d7149074388ac0d497c82d1bf77c27b00  app/orchestration-driver.mjs
6206fe820b7c9feb7bbcf41135fa97401b03e96939ecc2656d636a5deb1fa465  daemon/src/ui/orchestration.ts
59c6806f62b7759c16f39e42c63bb09d472503781cbf4694a8283f071cccdd62  daemon/test/integration-handoff-activity.test.ts
0c0f2445eaf9044ace83723050550bee8361f8fe2ed629191fab013732622a3a  daemon/test/host-codex-controller.test.ts
```
