# Done contract: read-only verifier stdio gate

Status: preparation only; native execution requires root review.

Done means a new, single-use gate is frozen for `D:\Temp\User\Cue.ReadonlyVerifier.StdioGate1`. It permits at most one native boundary launch and records `intent.json` and an exclusive prelaunch `expected.json` before invoking the launcher. A successful future result must prove project read and owned-runtime write, EACCES/EPERM for project create/overwrite/remove/rename/chmod, sibling reads/writes, and controlled loopback; exact root identity and SDDL restoration; worker death; absent profile; unchanged original bytes; one nonce-bound exit frame and cleanup frame; and bounded raw host diagnostics. Missing worker output remains failure with post-observation retained.

The gate pins the runner, test, probe client, repaired launcher, executable, helper adapter, three compiled runtime imports, and change-snapshot manifest/helper (11 closure pins). It makes no claim that the repaired stdio contract resolves prior `0xC0000142` failures.

Attempt cap: two implementation corrections. No model, provider, external-network, credential, or native launch is allowed during preparation.

Every pass runs:

1. `node --test scripts/reuse/readonly-verifier-stdio-gate.test.mjs` (at least 15 passing tests).
2. `node --check scripts/reuse/readonly-verifier-stdio-gate.mjs` and its test.
3. No-run manifest output, all 11 closure-pin comparisons, and absence of the owned root, intent, expected, and result paths.
4. Scoped diff inspection and independent review.

On failure, retry only with a new evidence-based hypothesis within the cap; otherwise stop and hand back to root.
