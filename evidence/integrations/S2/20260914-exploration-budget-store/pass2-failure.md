# Maker pass 2 failure

The second focused gate ran 28 tests: 27 passed and the new concurrent-writer test failed only because it expected the SQL trigger spelling `exploration budget limit exceeded`; the public API rejected the second writer first with `exploration_budget_limit_exceeded`. One writer returned `reserved`, so the measured serialization behavior was correct.

The full raw output is retained in `pass2-tests.txt`. The single-line expected-string correction is the frozen checker candidate. The maker did not run a third pass because the declared two-pass cap was consumed; independent review must execute the corrected gate.
