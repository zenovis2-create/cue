# S3-03 bounded writer-admission result

The production driver now checks writer admission before staging registration and repeats the full check immediately after the asynchronous registration, at the last point before adapter launch. A stage envelope granting `file_change` requires a prepared attempt-owned execution root, the same attempt publication contract, the final publication host, and the candidate's `attempt-owned-existing-files-v1` capability. Failure is recorded through the existing `existing_file_publication_unsupported` blocked path before candidate launch. The regression mutates the candidate capability during registration and observes zero launches.

This closes the discovered existing-file publication ordering race. It does not classify arbitrary command execution as a write, and it does not change standalone adapter use outside orchestration. Read-only stages remain outside this guard.

The focused driver fixture now runs publication cases from isolated attempt roots. Its disabled-staging regression observes zero adapter launches, opens, reads, and writes. The named orchestration suite uses `createFinalPublicationStore` and the native compare/write helper: winner A commits, stale B records contention and cannot overwrite A, and reopening/resending B leaves the single result row unchanged.

## Verification

- `npm exec -- vitest run test/integration-driver-publication.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`: 14 passed.
- `npx vitest run test/integration-orchestration.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`: 12 passed.
- `npx tsc -p tsconfig.json --noEmit`: exit 0.

## Final SHA-256

- `app/orchestration-driver.mjs`: `391A3CC59FDBFA73978A6E6991EBA765092AE9C7248497DBC34EE4A3A07057BD`
- `daemon/test/integration-orchestration.test.ts`: `04AB9851CB1E1168797D51AFFA03D3A612A5BDF98F1A04A22FE148EAC9ADE389`
- `daemon/test/integration-driver-publication.test.ts`: `B9943CB76EC51615C120F9E1CA9E40F843F1F27DE3FFF34E6B890F94B8948E20`

Raw command output is stored beside this file as `focused-vitest.raw.log`, `named-vitest.raw.log`, and `tsc.raw.log`.

These are bounded implementation and suite results. Independent review and the root-owned shared build/full suite remain the final acceptance gates.
