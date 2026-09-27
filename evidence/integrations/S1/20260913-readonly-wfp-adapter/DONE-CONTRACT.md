# DONE contract — WFP observation lease adapter

Done means an owned inert lease exists before any fallible WFP setup; `Ready()` uses the existing injectable native interface to open, query enabled collection, derive the exact executable app ID, and subscribe; denied/disabled/failed readiness returns false and the launcher resumes zero times; successful readiness keeps callback, subscription, app-ID allocation, engine, and native adapter rooted until the existing launcher zero-time process-handle wait reports exact death; only then does cleanup run in unsubscribe → free → close order. Unknown death, ambiguous subscribe, unsubscribe/free/close failure, or premature disposal stays quarantined, fails closed, and poisons adapter reuse.

Completion gates: new executable injected-native adapter tests, existing collector 17 tests, existing launcher observation/terminal tests, `npm run build`, launcher source/dist parity, and scoped `git diff --check`. Correction cap: two total; every pass runs the focused adapter and related regressions. A failure requires a new measured hypothesis or handoff.

The adapter is an internal production building block. Default PowerShell/CLI launch continues to pass a null provider. This unit does not activate WFP, add caller flags, prove network denial, or run a live query, subscription, worker, model, provider, policy, elevation, or historical gate.
