# Owned writer quiescence result

Verdict: the focused model-free Windows gate passes. A real Node writer ran in the isolated Git staging worktree with the PID and OS creation time captured in `receipt.json`. The runtime cleanup authority returned `unknown`, observed the exact identity `matching-alive`, returned `unknown` again during the exit transition, and then observed `matching-exited`.

While cleanup was unknown or the writer was alive, the test observed the publication file still contained `base\n`, with zero publication results, zero staging-cleanup rows, zero orchestration receipts, and one retained workspace write lease. Only after the exact writer exit did final publication commit. The native staging coordinator then recorded `active_cleanup_verified`, removed the execution root and released the lease. The publication contained `replacement\n`; one implementation receipt was durable.

The downstream verifier deliberately uses the fixture's original non-writer launch path. Its later blocked state is outside this bounded gate; the implementation attempt has verified terminal integrity and no unresolved attempt. No product or provider code was changed.

Final evidence gate: `npx vitest run test/integration-owned-writer-quiescence.test.ts --fileParallelism=false --maxWorkers=1 -t "withholds publication"` — 1/1 passed in 21.63 seconds on 2026-09-16.

Earlier transcript-only failures were not saved as raw files: the initial package command entered its pretest build and found TS2722 at the optional publication `execute` call; the first direct run timed out without diagnostics; the diagnostic correction proved a real child launch but exposed the fixture's contradictory unconditional clean receipt; after binding receipts to the runtime snapshot, the flow completed and exposed an incorrect expected receipt count of two rather than one. These observations are summaries of tool output, not claimed raw logs.
