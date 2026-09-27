# Independent A03 corrective-attempt review

Verdict: **UNVERIFIED / NOT CLOSABLE.**

The corrective actual command has a terminal receipt: `actual1.exit.txt` contains exit code 1, and the complete Vitest log reports one failed actual test. The log preserves the exact before identities for both trees and later cleanup frames with `remaining: []` for both. It does not contain `targeted-stop-target-completed` or `targeted-stop-final` frames.

The failure occurs at line 121 on `expect(driver.stop(firstRunId)).toBe(true)`. The returned value was false. The completion fence therefore was not exercised by this explicit Stop request, and the run never proved that the sibling retained its original PID/creation identities and advancing heartbeat while only the selected run stopped. Cleanup subsequently removed both exact identity sets, but cleanup is not a substitute for targeted isolation.

The current fixture explains the false Stop result. Its local selection policy has `timeoutMs: 1000`, while the prepared configuration uses `launchTimeoutMs: 100` and `taskTimeoutMs: 100`. Driver activation arms the local entry deadline from the policy timeout, and the serial drive loop separately enforces the task timeout. The real Windows fixture performs multiple `observeProcessTree` PowerShell queries before it calls Stop; the preserved run took over 33 seconds. The entry therefore expired and initiated cancellation long before the explicit Stop assertion. `stop(runId)` correctly returns false for an already-cancelled entry. This is a fixture-lifetime mismatch, not evidence of a driver Stop defect.

The raw before frame is useful evidence that two real owned trees launched. The two cleanup frames and successful hook completion show that the failure path removed the original captured identities. They do not establish request-versus-completion fencing, selected-only death, or sibling isolation.

A separately authorized changed-hypothesis gate should set a realistic bounded policy timeout and compatible launch/task limits for actual Windows observation, with configuration limits no greater than the policy timeout. The limits must cover the known multi-query setup and both verified terminations while remaining below the existing driver caps; for example, a 120-second policy/task window and a bounded launch window appropriate to the observed PowerShell startup cost. Before explicit Stop, the test should assert both driver snapshots are still active and neither attempt ID is already present in `cancellationCompleted`. The existing completion fence and durable frames should remain unchanged.

No OS test was rerun and no source or product file was edited during this review. No provider/model or billing behavior was exercised.

## Pins

- actual log: `6f243bd41ff15028b04bd80dda14d0ce9fe9fa80f7d743d04148319262de9b5a`
- exit receipt: `f1b2f662800122bed0ff255693df89c4487fbdcf453d3524a42d4ec20c3d9c04`
- executed test: `ee2e7682d28d616d438127c7130d7c22f268d55b1d5c75de91aa628a79eeda6a`
