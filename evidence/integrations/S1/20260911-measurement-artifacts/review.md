# Independent review: labeled measurement artifact sets

Reviewer `/root/broker_review`, 2026-09-11. Product code read-only.

Initial verdict: **bounded-read correction requested**. The source otherwise implements the requested labeled content-set digest without widening it into dependency discovery, admission or permission authority.

Initial hashes:

- `daemon/src/measurement-artifacts.ts`: `D10BE0CB4296FB5FAAF497864AE4CDA98C3F2799B0AF9814C638A67DE1199DD7`
- `daemon/test/integration-measurement-artifacts.test.ts`: `F14F6C434F4D11E68896B19672C1D1166614EABC483EC0C25389CA37120CD2B4`

Independent initial command in `daemon`:

`npx --no-install vitest run test/integration-measurement-artifacts.test.ts test/p13-measurement-subject.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`

Exit 0, **10 tests passed**, 427 ms, start 18:30:08 local time. Tests cover ordering independence, content/label drift, existing subject invalidation, relocation independence, multi-buffer reads and malformed/missing/duplicate/accessor inputs.

## Initial resource finding

The implementation snapshots initial file size but originally reads until EOF with no limit tied to that snapshot. A concurrent appender can continually extend a file and delay the final stat/drift comparison indefinitely while occupying the synchronous host thread.

Independent bounded reproduction created a private actual one-byte temporary file, wrapped only Node's `readSync` to append one byte after every successful actual read, synchronized Node's named builtin exports, and called the actual source function. A reviewer guard stopped the ninth read to prevent a loop. Output: `{"initialSize":1,"reads":9,"observed":"review-terminated-unbounded-read","instrumentation":"append one byte after each successful actual read"}`. The wrapper and builtin exports were restored in finally, and the file/directory were removed. This is deterministic concurrent-growth instrumentation, not a claim of an unbounded live writer benchmark.

Requested correction: bound reads by initial size plus one overflow-detection byte, then reject growth as `artifact_set_changed`. Keep the existing content hash and stat-drift contract. Final evidence follows after correction.

## Scope assessment

- Input is a host-owned plain array of 1–128 labeled plain file descriptors. Proxy arrays/items, accessor entries, sparse/extra properties and duplicate IDs are rejected before reading files.
- The function snapshots descriptors, sorts IDs deterministically and hashes exact file bytes through a descriptor with a 1 MiB working buffer. ID and digest pairs, rather than install paths, form the versioned aggregate digest. Results, arrays and entries are frozen.
- Files are resolved and opened, non-files rejected, and descriptors closed in finally. Size/mtime/ctime/device/inode checks detect supported drift of the open file; they are not a guarantee that a path cannot be replaced after measurement or that later execution uses those bytes.
- Host callers must enumerate every required component. This helper does not discover dependency closure, validate a probe PASS, create a candidate qualification, enforce file permissions, or solve measurement-to-launch TOCTOU.

## Final correction and independent result

**PASS for the corrected artifact-set measurement helper.** One diagnosed maker correction bounds each read to the remaining initial file size plus one overflow byte, rejects any accumulated byte count beyond that initial size immediately, and rejects an invalid/non-safe stat size. The prior content/digest and stat-drift checks remain intact. A permanent regression uses the same deterministic append-after-read scenario with a bounded guard.

Final hashes:

- `daemon/src/measurement-artifacts.ts`: `24C9BBE71E671D75C19C072D74106874E887568531616A07B7052CD8D57DF88E`
- `daemon/test/integration-measurement-artifacts.test.ts`: `21FDDF48EC016AE453398A640778F42FC4D16EFE1C19E584FB572BE132A6F245`

Independent final verification:

- Same focused Vitest command above: exit 0, **11 passed**, 450 ms, start 18:32:33 local time. The added bounded-growth regression passes while existing multi-buffer content and subject tests remain green.
- Repeated the independent actual-file/read-wrapper probe against the corrected source, now asserting the expected rejection and read bound: `{"status":"pass","initialSize":1,"reads":2,"observed":"artifact_set_changed"}`. Instrumentation and temporary resources were restored/removed in finally.
- `npx --no-install tsc -p tsconfig.json --noEmit`: exit 0.

The byte bound prevents concurrent growth from extending work indefinitely; it is not a wall-clock deadline for a slow filesystem and does not impose a smaller maximum supported file size. No real model request, qualification or production host wiring was performed by this review. All scope limits above still apply.
