# Independent completion-fence preflight review

Verdict: **CLEAR for the single root-coordinated corrective OS attempt.**

The prior race is closed by separating cancellation request from cancellation completion. The adapter registers the child `close` waiter before termination, increments only `cancelRequests` at entry, awaits the termination operation, awaits the registered child-close promise, and then boundedly polls the captured PID/OS-creation identities until none remain. Only after all three facts does it add the exact orchestration attempt ID to `cancellationCompleted`. The integration test waits for that per-attempt completion marker before asserting target absence or proceeding to sibling isolation.

The platform-independent delayed test demonstrates the fence directly: completion remains zero after request, remains zero after delayed termination resolves while close is pending, and becomes one only after close and the absence verifier. This specifically detects the ordering error from actual attempt 2.

The actual oracle retains the exact before records for both controller/grandchild trees and synchronously emits them with workflow and persisted attempt IDs. After selected-run completion it emits target remaining identities, request/completion facts, sibling heartbeat before/after, and both expected and current sibling tree records before assertions. The sibling must advance its heartbeat and retain exact PID plus creation-time identities. After the sibling's own completed Stop, the final frame records both trees' empty exact-identity sets.

Failure cleanup continues to revalidate the exact controller identity before verified termination, awaits close when applicable, records every captured identity and any remaining originals, and refuses root cleanup if an original remains. Canonical direct-temp-parent, exact-prefix, non-symlink, and verified-removal guards are unchanged. Raw frames occur before assertions and cleanup, so a failing attempt remains inspectable.

The correction changes only the test/evidence harness. It does not change driver semantics, assert provider cancellation or billing cessation, or turn taskkill/name scans into completion evidence. The two historical failures remain preserved.

Reviewed current test SHA-256: `ee2e7682d28d616d438127c7130d7c22f268d55b1d5c75de91aa628a79eeda6a`.

No actual OS run, build, product edit, provider, model, Electron, or network call was performed during this review.
