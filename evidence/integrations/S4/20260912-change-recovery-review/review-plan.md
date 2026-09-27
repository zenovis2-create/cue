# S4 Unit 2 independent review plan

- Done: issue an evidence-backed PASS only if the focused tests, typecheck/build, migration integrity/reopen checks, and independent hostile regressions all pass; otherwise report exact blocker counterexamples with source lines.
- Attempt cap: three diagnosed review passes.
- Every pass: re-read the assigned design and changed bytes, run the focused Unit 2 tests plus the independent regression file, and check the temporary SQLite ledger with `integrity_check` and `foreign_key_check`.
- Failure handling: retry only with a new hypothesis; preserve the failing counterexample and hand it to the maker after the third diagnosed pass. Product files are read-only for this review.

