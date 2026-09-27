# S3-03 writer admission plan

## Done gate

- A writable orchestration attempt using the existing-file publication flow cannot call a candidate launch unless attempt-owned execution staging, a matching publication contract, the final publication host, and the candidate staging capability are all present.
- A read-only attempt remains launchable without publication staging.
- The named orchestration suite exercises real publication modules to show a stale losing writer cannot replace the winner and reopening/resending causes zero additional publications.
- Focused Vitest commands and daemon TypeScript compilation pass.

## Attempt cap

Two implementation/test passes per hypothesis.

## Every-pass checks

1. Run the focused writer-admission regression.
2. Run `integration-orchestration.test.ts`.
3. Run daemon TypeScript compilation.

On failure, use a new hypothesis. Keep a change only when these gates improve; otherwise restore the exact recorded preimage.

## Exact preimages

- `app/orchestration-driver.mjs`: `a30ca36648cc0ece3e0db7ff1f83b647389472cc`
- `daemon/test/integration-orchestration.test.ts`: `ab205fec203a5c68eb798508017f8fbaa8fd89e8`
- `daemon/test/integration-driver-publication.test.ts`: `073c9bb36215c41c0681c8a2f92e5e1e097fcec1`

SHA-256 byte pins:

- `app/orchestration-driver.mjs`: `92F214C340FD0FE330EE3C042C392DA8FE2854C6009EF0D35A179F5490C05527`
- `daemon/test/integration-orchestration.test.ts`: `413440BADC651F2D502644DECBA10C6E15598C1C6706D4FE89D9F0FB012D8A4E`
- `daemon/test/integration-driver-publication.test.ts`: `44D70DD15436855B8D0E8BD8C888C9D8EAC8CE2A89E82717F1B97BCA3B203EC5`

All three paths were already untracked in the shared worktree at discovery time. Whole-file preimages are stored under `preimages/`. Their Git object hashes exactly match the hashes captured before mutation. The driver copy has normalized line endings, so its filesystem SHA-256 differs from the mixed-line-ending source byte pin; the two test copies match both their captured Git hashes and SHA-256 byte pins. Unrelated concurrent edits must not be reverted.

## Production-path finding

`resolveCandidate` checks staged-publication capability only when `stagingContracts` already contains the attempt. `recordLaunchIntent` creates that contract later, so the admission check can run too early. The wrapped `launch` then opens/passes a contract without rechecking candidate capability, and an unstaged writable configuration can reach the candidate directly. The guard belongs immediately before the wrapped candidate launch, where both the bound stage and final attempt contract are known.
