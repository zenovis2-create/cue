# Diagnosed corrections

1. The first fixture did not satisfy the orchestration plan's verifier-role and requirement-coverage invariants. The fixture gained a dependent verifier task; no product behavior was weakened.
2. The session-handle fixture initially bound the durable handle to the wrong owner lineage. It now uses the exact candidate binding passed by the runtime.
3. Staging registration originally used the same timeout as the surrounding runtime launch. The outer timeout could classify the refusal as a generic execution failure before the staging failure marker was recorded. Registration now receives half of the configured launch budget, and focused timeout plus synchronous-rejection cases verify the explicit pre-adapter `change_publication_staging_unavailable` outcome.

The correction cap is exhausted. The retained implementation passes the measured gate in `pass-final.log`.
