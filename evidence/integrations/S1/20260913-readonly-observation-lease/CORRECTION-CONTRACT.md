# Correction contract — finalization overrides pending success

The prior 12/12 gate did not exercise a `return 0` already pending when the launcher's `finally` block found observer death or disposal unverified. Its PASS was withdrawn after that fail-open path was identified.

Done means the production-shared finalizer throws over a pending successful candidate return for observer false, observer throw, and disposal throw; successful finalization returns the candidate unchanged; quarantined process/job/lease handles remain retained; the complete observation-lease and terminal-wait focused gates pass; build and source/dist parity pass; and scoped diff check passes.

Correction cap: two total. Each pass runs both focused tests and the build/parity/diff gates. No live process, WFP, network, model, provider, policy, or elevation operation is authorized.
