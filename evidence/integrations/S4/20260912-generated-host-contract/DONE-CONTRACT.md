# Done contract: generated host checker evidence policy

Done means the original `runs shared-ledger` integration test passes without weakening requirement validation, evidence independence, `pass_disabled`, or quarantine behavior. The checker receives a trusted, run-scoped evidence-policy descriptor through the production call chain, with focused rejection coverage for missing, malformed, and cross-run policy facts.

## Attempt cap

At most two correction hypotheses. A failed pass requires a new diagnosis; the same approach is not repeated.

## Every pass

1. `npx --no-install vitest run test/integration-generated-json-host.test.ts -t "runs shared-ledger" --reporter=dot --fileParallelism=false --maxWorkers=1`
2. Focused generated acceptance/evidence-policy tests selected after source tracing.
3. `npm --prefix daemon run build`
4. Scoped `git diff --check` over owned files and this evidence directory.

## Failure rule

Keep a change only if the original reproduction or a focused contract gate improves. After two failed hypotheses, preserve the evidence and hand the blocker back without weakening validation or manufacturing policy authority.
