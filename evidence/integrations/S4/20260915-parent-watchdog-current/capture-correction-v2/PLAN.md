# Parent watchdog console capture correction v2

Done means: the read-only AppContainer profile query is validated before the actual-attempt marker; the entire preflight and five-file Vitest invocation are enclosed by durable failure receipt handling; the single actual OS invocation passes with exactly one valid `P12_PARENT_DEATH_IDENTITY` line, unchanged source/dist hashes, unchanged profile count, and verified removal of the exact owned temp root.

Offline correction cap: 2. Actual OS invocation cap: 1, created only after the profile preflight succeeds. Every offline pass runs `node --check evidence/integrations/S4/20260915-parent-watchdog-current/capture-correction-v2/run-gate.mjs` and `node evidence/integrations/S4/20260915-parent-watchdog-current/capture-correction-v2/run-gate.test.mjs`. The actual command is `node evidence/integrations/S4/20260915-parent-watchdog-current/capture-correction-v2/run-gate.mjs --run`.

On failure, retain the durable receipt and owned diagnostics, do not rerun the actual command, and report the exact stage. This changed hypothesis corrects the invalid PowerShell array expression and moves all post-entry work under terminal receipt handling. It does not change product source.
