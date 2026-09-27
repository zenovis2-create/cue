# Generated JSON recovery authority maker record

This bounded implementation followed [ROOT-CONTRACT.md](./ROOT-CONTRACT.md). The original delegated files and their hashes are preserved by [preimages.json](./preimages.json) under `preimages/`:

- `app/generated-json-host.mjs`: `223B8A990D9915775DCDE85CCDC88AC1F0344BF82D15796CB53C76D01FD6E6E2`
- `daemon/test/integration-generated-json-host.test.ts`: `0745E9E0E10EA50D829A3764D31E1082562C7E1680E99B793010D7F61165FBB9`

## Bounded plan

Done meant a stop-only generated JSON recovery authority derived from exact durable failed-terminal lineage, with no retry, quota, authentication, candidate, or external-effect claims beyond persisted evidence. The attempt cap was two focused test passes. Each pass used the focused generated host integration test; final validation was delegated to the independent checker after the maker cap was consumed. Failures were preserved and addressed with a distinct hypothesis.

## Focused test attempts

Both attempts ran from `daemon/`:

`npm exec vitest run -- test/integration-generated-json-host.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`

1. Exit code `1`: 18 tests passed and the new test failed during preparation with `retry_host_missing`. Hypothesis: the explicit test-only automatic-recovery wrapper added a retry contract but did not supply the orchestration store's required retry clock/contract authority. Fix: add a trusted test-only `authority.retry` wrapper with a clock, contract authorization, and `classifyFailure: () => null`. Production settings and classification were unchanged.
2. Exit code `1`: 18 tests passed and the new test reached the durable recovery behavior, then failed in its assertion query with SQLite `no such column: source_ref`. Hypothesis: `orchestration_failure_observation` stores `sourceRef` inside its canonical payload rather than as a table column. Fix: query the durable payload and decode `sourceRef` from it.

No third maker test pass or build was run because the declared two-attempt cap was consumed. The independent checker owns final build and focused validation; this record does not claim maker PASS.

## Additional review correction

Source review identified that terminal payload validation needed exact shape and event lineage enforcement. The final implementation reuses the existing terminal integrity verifier, requires canonical exact root and terminal-data keys, binds the SQLite `event_id` to `payload.eventId`, rejects future observation timestamps, and rederives the content-bound source reference on every read. Coverage was added for foreign receipt/handoff context, foreign attempts, extra secret fields, event-ID mismatch, future timestamps, tampering after SQLite reopen, strict candidate denial, durable stop, and zero recovery launch. These additions were not rerun by the maker after the cap was consumed.

## Smoke check

The following import-only command exited `0` with no output:

`node --input-type=module -e "const m=await import('./app/generated-json-recovery-authority.mjs'); if(typeof m.createGeneratedJsonRecoveryAuthority!=='function') process.exit(1)"`

## Final file hashes

- `app/generated-json-recovery-authority.mjs`: `60F2BCD52272607EACF8EB0D2CD6DEC5F9D44B5064792D6FCD1B3C3A2A1F36B4`
- `app/generated-json-recovery-authority.d.mts`: `B15E088BC0059BFA404E8D9387B924C735344012FB0E62DF0F3BF9D597D1072D`
- `app/generated-json-host.mjs`: `3C92B646D397A4B9285D1CCC6BD2CB143423A601FCA55B420FCF65FE814E0D2A`
- `daemon/test/integration-generated-json-host.test.ts`: `B87DAAE3C37592D0189A63910049C3034021724C233CCB3E4C3567DD52100F39`

Final validation is delegated to the independent checker using the same focused Vitest command and the required daemon build. The isolated local model native suite is outside this bounded validation.
