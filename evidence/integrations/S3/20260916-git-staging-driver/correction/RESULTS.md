# Root driver integration correction result

Final bounded gate: `npx --no-install vitest run test/integration-git-staging-driver.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`, 2/2, exit0 in gate-pass3.log. Exact source and cleanup observations are independently recorded in [the review](../independent-review.md).

The positive proves native publication and verified removal of a distinct real Git worktree, followed by lease release. The test explicitly restores the execution file before clean-only cleanup. The dirty negative proves committed publication can coexist with retained dirty execution bytes, unknown cleanup, held lease, no finished receipt and blocked driver. Guarded fixture teardown removes only its own disposable parent; it is not product cleanup.

Both cases use synthetic admission, execution and receipts. The positive does not complete the entire run: its downstream verifier is not advertised by the fixture candidate, and the trace ends blocked with orchestration_execution_failed. This is implementation-stage integration evidence only. No S3-01/S3-03 parent closure or production dirty cleanup claim is made.

Earlier errors remain preserved: unsupported fixture protocol markers, an extra admission field, and missing resolve import in diagnostic output. clean-pass2.json and dirty-pass2.json retain the helper's original names but contain the successful pass3 traces. The independent cleanup observation confirms those exact disposable roots are absent.
