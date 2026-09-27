# Independent P10-C cleanup-race review

Verdict: PASS for the bounded test correction. No production file changed.

The saved test preimage SHA-256 is `E340BCFF1910BCBDFC0CE19082230469A60075331D559B8BA9A642373591E3B5`. It already awaited `core.close()`; the original full-suite `--bail=1` failure was an `EPERM` from strict `afterEach` `rmSync` after a real copied controller executable had been started and immediately stopped. The new test waits for an owned `tool_worker` session in the run's ledger and for `started.txt` before stop. It captures the owned PIDs, still checks the single execution event and write flag, awaits close, and asserts those PIDs are no longer alive before unchanged strict recursive removal. Thus it does not skip process launch, cleanup, or the filesystem gate. Only the named test block and its timeout differ from the exact preimage. Final test SHA-256 is `5579DEE297F861FC5DD42BB40C0C9F0DBFE7AE4BE162F6A908E59F2DC5516ACF`.

I independently ran the named case with `-t`: exit 0, 1 passed, 16 filtered skips. I then ran the full `test/p10c-core.test.ts` file: exit 0, all 17 tests passed in 83.79 seconds. Root's post-change coordinated build exited 0. These focused results resolve the observed race at this revision; they are not a claim that the ongoing full repository suite passed. No provider, Qwen, or live service call was made.
