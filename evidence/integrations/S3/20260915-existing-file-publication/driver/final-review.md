# Independent driver final-publication review

## Evidence-path collision

My original independent review at `driver/review.md` was overwritten by another checker's mirror. Its known SHA-256 was `EFF4000D61FA7FA5D83BC6365BB65BE133651BE414B912A77D31037D3F7AD94F`. Root preserved the colliding mirror separately and recorded the old/new hashes in `review-path-collision.md`.

This file reissues my conclusion from the preserved test result and source checks. It does not claim byte-for-byte restoration of the overwritten review.

## Verdict

PASS for the bounded staged existing-file publication seam. The production driver routes explicitly opted-in, capability-advertising writers through the durable final-publication store before recording successful completion or releasing the write lease.

Broad S3-03 remains open. Legacy adapters that write the original worktree directly are not universally protected, and this unit does not establish an all-writer final-overwrite invariant.

## Reviewed behavior

- Host preparation must explicitly set `stagedPublication:true` with registered existing-file targets. The resolved candidate must independently advertise `attempt-owned-existing-files-v1`; missing capability blocks before adapter launch and retains the lease.
- The driver captures the exact attempt-owned change set and supplies an immutable staging-only contract before launch. Registration timeout or rejection produces launch/read/write/receipt zero, preserves the preimage, and retains the lease.
- A successful adapter outcome is deferred rather than passed to `store.finish`. The driver reads bounded staged bytes, rechecks the prepared entry, cancellation, deadline, host function identities, running attempt/root task, change set, and exact staging contract, then invokes the durable publication store outside an outer database transaction.
- The final authorization callback is called once. After it returns, the driver evaluates deadline/clock first and freshly repeats function/state/SQL/contract checks. A callback that synchronously stops the run creates no publication intent/result, native write, or orchestration receipt and retains the lease.
- Only an exact `committed` publication allows the deferred finish. Pending, unknown, contention, callback drift, cancellation, and timeout remain blocked with the lease held and no completion receipt.
- The real native comparison test proves one winner commits and a separately journaled stale writer cannot overwrite it. Same-instance replay adds no launch or native write; reopening the unresolved loser is refused at sealed preparation before launch/write.

The post-authorization guard corrects a defect found during this independent review. Before correction, `finalPublication.authorize` could synchronously call `driver.stop` and return true after the earlier driver checks, allowing native execution to proceed. The added regression demonstrates the corrected zero-write behavior.

## Independent gate

From `daemon/`:

`npx --no-install vitest run test/integration-driver-publication.test.ts test/integration-orchestration.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`

Observed result: exit 0, 2 files and 20 tests passed. The publication file supplied nine cases and the neighboring orchestration suite supplied eleven.

The same command invocation was preceded by a malformed PowerShell `Get-FileHash` positional call. That hash subcommand failed, while Vitest completed successfully. A separate correct read-only hash command then verified all frozen pins below. Root's final build pass 2 is separately recorded with exit 0.

Another checker later ran a broader 85-test gate. That is separate evidence and is not added to my 20-test count.

## Frozen pins

- `app/orchestration-driver.mjs`: `2ED110D994E22910CD9B95DEAF5D7A0167C033165C6A41CD7512221277A050F0`
- `app/orchestration-driver.d.mts`: `EABD94E34CC642B429E84F8AF1502B04F780CC0C3ECBB990DC5E3E3EA65F5006`
- `daemon/test/integration-driver-publication.test.ts`: `1E2C82D5DA0D58C1DC82FB6BE7CB1DBE70158124C940DF01E6126A22306752E1`

## Limits

- Multiple targets publish sequentially. If a later target is unresolved, an earlier committed target remains committed while the run stays blocked and retains its lease. There is no multi-target atomicity or rollback claim.
- Reopen protection for an unresolved run is a fail-closed sealed-preparation refusal, not a positive resume path.
- The host staging implementation and candidate marker are trusted injected capabilities. No production provider or legacy direct-write adapter was qualified.
- The native primitive covers existing files only. New-file creation, atomic pathname replacement, power-loss rollback, and arbitrary external-writer guarantees remain outside scope.

No provider, model, credential, local endpoint, Electron, network, or unrelated native/OS test was invoked by this review.
