# Independent diagnostic follow-up review

Status: **PASS with two implementation constraints.** This is a sound next diagnostic direction, not evidence that the user command or any permission probe ran.

The reviewed follow-up is `15A7C0E86BCE09B39B3C7AA6EAF44C98A9C5C68E05077AAA703CB5C403ED9B40`. I compared its control-flow claims with the pinned client `530651732FD977FC32D44463A8128D40F7DEB4FA8BAD797778F4F7D08B950587` and the retained failed result.

The source supports the stated ambiguity. Client evaluation, `runProbe` entry, cwd/runtime derivation, filesystem operations, port validation, socket creation, and asynchronous completion all precede the only `runtime/result.json` write. The initial project read has its own catch and mutation attempts use the local `attempt` catcher, but no single outer boundary covers evaluation, setup, socket/callback failures, or the final result write. Several distinct failures can therefore produce the retained `observed:null` shape. NUL stdout/stderr removes ordinary child exception text. Exit 1 establishes no more than a normal process exit status; it does not select one of these paths.

The proposed nonce-bound, fixed-schema diagnostic can distinguish stages if implementation preserves these constraints:

1. A diagnostic stage means only that the pinned wrapper reached the point where it set that stage and then reported an error. It must never count as proof that the evaluated probe body, user command, filesystem attempts, socket attempt, or result write ran. Only a valid exclusive `result.json` may supply those permission observations, and any missing/malformed result must keep the gate failed.
2. The recorder must be single-shot and non-recursive. Stage must be a closed enum; `name` and `code` must be type-checked and length-bounded before persistence; the nonce must match the prelaunch expected receipt; `diagnostic.json` and `result.json` must both use exclusive creation. Diagnostic-write failure must have its separate fixed exit classification without retrying or replacing an existing file. Offline injections must cover synchronous evaluation/setup, port and socket errors, callback errors, malformed/oversized error fields, duplicate recorder entry, and diagnostic-write failure.

With those limits, the diagnostic can narrow a later separately authorized experiment while remaining fail-closed. It adds no readiness, filesystem/network boundary, cleanup, acceptance, or user-command authority. No source, native state, profile, process, model, provider, or network action was changed or invoked in this review.
