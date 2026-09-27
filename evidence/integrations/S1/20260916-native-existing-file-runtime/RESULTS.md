# Results

## Outcome

The native implementation runtime now consumes the workflow's approved existing-file targets through an explicit `approved-existing-file-change` transport. Admission requires exactly `file_change`, empty egress, the durable `attempt_staging_authority` execution path/root identity, and a descriptor-safe dense target list. All admission and staging checks occur before controller filesystem, process, or session mutation.

Structured `write_text` calls are dispatched in process through the reviewed native `snapshotRelativeNative` / `compareWriteExistingNative` identity-CAS boundary. Generic commands, unapproved targets, contention, and absent/new-file targets fail without an AppContainer worker. There is no command grant or create fallback. Default workspace mode and the read-only verifier retain their prior paths.

## Gates

- Coordinated build: exit 0 (`build-native-final`).
- No emit: `npx --no-install tsc --noEmit -p tsconfig.json --pretty false --incremental false --preserveWatchOutput`: exit 0.
- Native focused: `npx --no-install vitest run test/integration-native-existing-file-runtime.test.ts test/integration-native-verifier.test.ts test/integration-native-implementation-host.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1 --testTimeout=30000`: 3 files, 12 tests passed, exit 0.
- Existing controller/runtime regression: `npx --no-install vitest run test/p10c-runtime.test.ts test/p10c-host-controller.test.ts test/host-codex-controller.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1 --testTimeout=30000`: 3 files, 28 tests passed, exit 0.
- No provider, model, or network call was made.

The first focused pass before the lifecycle correction had 8 passes and one fixture-path failure. The first independent review then found post-spawn authority validation and non-write worker fallback. Both were corrected; historical failures are not represented as passing evidence.

## Final SHA-256

- `daemon/src/host-codex-controller.ts`: `e14beb1e0c0dd70e853c40fcb8abdeb62bbf7781c5640dbdec70e018278da29d`
- `daemon/src/host-codex-runtime.ts`: `1e06c7fcd370610f70af6748d002e94010164a54aaae944f53c7970fb005077a`
- `daemon/src/adapters/integration-executors.ts`: `0f5b3b77ff28f957c68b43d4efe76a34810482d3ea0d7580fe3038eb06e33ab6`
- `app/native-implementation-host.mjs`: `5d10aefec0db3f73812a821ca945d7c3ac9fae5a859bd01c3a6305c2c24fd45a`
- `app/native-implementation-host.d.mts`: `93f8d4f23fbc268cd50ed5f2e21190254d0acc0c53a18f2706ff6a50cb8f7c37`
- `daemon/test/integration-native-existing-file-runtime.test.ts`: `51ba37cc45617cba0b6272a0cfc75b93773fb11685bf36f2c691ecd94b38b540`

## Scope limit

The native write path supports replacement of approved existing files only. Creation remains unavailable until a separately reviewed native create primitive and identity contract exist.
