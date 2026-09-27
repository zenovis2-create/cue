# S5 explicit saved comparison creation plan

## Completion contract

Done means an exact bounded `comparison-create` request accepts only a snapshot ID, saved baseline/candidate projection ID arrays, and candidate mode. Core revalidates workspace ownership and immutable projection bindings, derives policy digests, and calls the existing comparison store with disclosed descriptive defaults. The renderer requires an explicit submit, renders the sanitized saved view, fences stale/new-run and error replies, and never starts a run or grants measurement, approval, promotion, or policy authority.

Focused Core→IPC SQLite tests cover one-row creation, reopen/replay, ID conflict, foreign/tampered inputs, hostile descriptors, and unchanged run/policy/approval state. DOM tests cover explicit creation, repeat replay, rendered result, failure, and stale response. JavaScript syntax, focused safe suites, daemon build, diff check, and final hashes are recorded.

## Attempt cap

Two substantive implementation/test passes. A second pass is used only to correct a concrete first-pass failure.

## Every pass

Run `node --check` for changed JavaScript, the two focused Vitest suites with one worker, inspect the scoped diff, and record the exact result. Run the daemon build once after source is stable.

## Failure rule

After a second failed substantive pass, stop, preserve the exact failing command/output, and report the blocker without claiming completion.
