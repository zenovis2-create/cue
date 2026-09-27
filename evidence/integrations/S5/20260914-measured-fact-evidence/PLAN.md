# Measured-fact evidence view maker plan

Done means one read-only, host-gated projection revalidates an existing measured fact and exposes only bounded provenance and measurement availability through workspace-contained Core. It remains non-convertible (`trialReady:false`, `promotionEligible:false`) and does not change capture, trials, UI, or default host activation.

Attempt cap: two completed focused gate passes.

Every pass runs the new Core evidence test with the existing measured-fact and Core-containment suites. Before completion, run the daemon build and `node --check app/core.mjs`.

Required cases: populated SQLite attempt/tool/model lineage, deterministic replay and reopen, stored tamper and changed evidence rejection, explicit unavailable measurements, and callback-zero/write-zero rejection for unconfigured, malformed, and foreign Core requests. A failure gets one new concrete hypothesis; after the second failed gate, preserve evidence and hand off.
