# Reconciliation no-op correction

Done: no-op and mixed changed/unchanged approved targets reconcile through real
Git/native paths; unknown dirty paths and digest divergence remain refused;
only dirty approved members are restored and final execution root is clean.

- Attempt cap: 2.
- Every pass: focused Git factory tests and no-emit TypeScript when shared source permits.
- Failure: retry only with a new hypothesis, otherwise hand off with raw logs.
