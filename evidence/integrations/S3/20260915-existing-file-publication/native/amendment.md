# Native compare/write amendment

The bounded plan remains unchanged. Pass 1 exposed one concrete handle-lifetime defect in the new compare/write path: `defer closeHandles(handles)` captured the initial one-element slice before ancestor and target handles were appended. The failed test showed the second invocation returning `target-open-failed` and temporary-file cleanup reporting a live handle. The correction defers a closure that reads the final slice. The next and final passes closed every handle and passed the winner/stale-loser and cleanup cases.

No second design correction was required. The helper does not contain a fault-injection branch. Helper timeout, death, malformed or partial output remain `unknown` at the host boundary; the deterministic partial-response test covers that claim without weakening production behavior.
