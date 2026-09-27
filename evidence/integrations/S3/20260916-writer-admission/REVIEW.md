# Independent writer-admission review

## Verdict

**PASS for the bounded `file_change` writer-admission seam.** The production driver now refuses a writable orchestration attempt before adapter launch unless its attempt-owned staging and publication contract remain valid through the last asynchronous registration boundary.

This is implementation progress within S3-03. It does **not** close the original parent because arbitrary command-capable writes are not classified by this guard.

## Correctness review

The admitted writable path is bound to the stage envelope's `file_change` action. Immediately before candidate launch it requires:

- the prepared entry's approved staging authority;
- the same attempt publication contract currently stored under the launch attempt ID;
- the captured final-publication host;
- the candidate's exact `attempt-owned-existing-files-v1` capability.

The driver performs this check before asynchronous `openStagedAttempt`, validates the returned contract and host/entry/deadline/contract identity after that callback, and repeats the full writable check at the final pre-launch point. The second check matters because the host callback can mutate the candidate object. Independent review found that gap in the first candidate; the correction adds the final check and a regression that removes the capability during registration. The corrected test observes one registration attempt, zero adapter launches/reads/writes, unchanged publication bytes, and the existing unsupported-publication block.

Read-only behavior remains separate: the guard is entered only when the bound stage envelope contains `file_change`. Existing driver coverage launches an approved non-file-change stage without publication staging. The change does not grant writer authority to read-only work.

The native contention test uses the real final-publication store and compare/write helper. One writer commits A; the stale independently journaled writer records contention and cannot replace A. Reopen/resend produces no additional publication or adapter launch. This supports the named duplicate/overwrite result for the tested existing-file publication path: duplicate publication rows remain one and stale overwrite count is zero.

## Verification

- Focused public driver publication suite: **14/14 passed**.
- Named durable orchestration suite: **12/12 passed**.
- Daemon TypeScript no-emit compilation: exit **0**.
- Final reviewed SHA-256:
  - `app/orchestration-driver.mjs`: `391A3CC59FDBFA73978A6E6991EBA765092AE9C7248497DBC34EE4A3A07057BD`
  - `daemon/test/integration-orchestration.test.ts`: `04AB9851CB1E1168797D51AFFA03D3A612A5BDF98F1A04A22FE148EAC9ADE389`
  - `daemon/test/integration-driver-publication.test.ts`: `B9943CB76EC51615C120F9E1CA9E40F843F1F27DE3FFF34E6B890F94B8948E20`

The root-owned full suite was still running when this bounded review was written. Its only observed failure at that point was the previously deferred pinned-Codex-binary hash mismatch; this review does not convert a pending or failed full suite into a pass.

## Evidence limits

The maker initially failed the requested full pre-edit copy procedure. Git-object reconstruction and the exact production seam recover the intended pre-edit content, but the driver reconstruction has different line endings from the recorded pre-edit byte hash. This is not byte-exact preimage proof for every owned file and remains an evidence limitation.

The implementation classifies writer admission from `allowed_actions.includes('file_change')`. A command/shell capability that can mutate files without that action is outside this guard. Standalone adapter execution outside orchestration is also unchanged. Therefore the exact race is fixed and the tested duplicate/overwrite behavior is qualified, while broad direct-write exclusion and original S3-03 closure remain open.

No production source was edited by this reviewer and no provider/model call was made.
