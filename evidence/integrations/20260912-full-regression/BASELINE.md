# Full regression baseline

Command: `npm test` from repository root. Exit 1; 1173.21 seconds.

Result: 188 files (174 passed, 14 failed); 1261 tests (1217 passed, 39 failed, 5 skipped).

The user-excluded unknown historical Codex pin still fails and is not qualified. Additional failures include the direct native-snapshot process boundary, stale Electron API inventory, fixtures missing evidence policies/native assets, an invalid session deletion against immutable native identity, legacy-schema/current-API mismatch, missing verified handoff, and concurrent SQLite claiming.

The Electron proof allowlist was corrected after its baseline case had already failed; no production installation source was edited during the baseline. Follow-up gates must identify changes and must not describe this original baseline as passing. Full output was streamed through the tool and some large chunks were truncated; the counts above are the final runner summary, not a reconstructed total.

Next pass: repair diagnosed failures without weakening constraints, run affected suites with independent review, then a final full gate with durable output capture. Retry cap per diagnosed component is 2; unknown historical pin remains separately excluded rather than silently fixed.
