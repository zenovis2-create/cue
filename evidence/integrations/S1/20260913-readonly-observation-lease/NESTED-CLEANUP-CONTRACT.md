# Nested-cleanup correction contract

The earlier cap-two approaches are preserved as blocked history. This separately authorized one-attempt hypothesis replaces deferred exception aggregation with structural `try/finally`: observation finalization runs in the `try`, and independent native cleanup always runs in the nested `finally` before any pending return or finalization failure can escape.

Done means executable tests prove pending return 0 plus observer failure propagates failure after the cleanup sentinel runs exactly once, successful finalization preserves the candidate and runs cleanup exactly once, the combined observation-lease and terminal-wait tests pass, build/source-dist parity pass, and scoped diff check passes. On failure this unit stops. No live process, WFP, network, model, provider, policy, or elevation operation is authorized.
