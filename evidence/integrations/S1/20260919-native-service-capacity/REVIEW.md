# Native service capacity review (2026-09-19)

Scope: `daemon/src/native-account-observation.ts`, focused mock transport tests, and the pinned `GetAccountRateLimitsResponse` schema. Read-only source review; no live provider, service, Qwen, or network request was made.

The optional capacity request occurs after `account/usage/read` and before the second `account/read`. Authentication-only observation keeps its prior request sequence. `available` requires explicit `ordinaryUsageAllowed === true`, a present account ID, and no `spendControlReached === true`; false permission or spend-control denial yields `denied`, while missing/null permission or account ID yields `unknown`. Percentages and reset clocks do not grant capacity. This matches the pinned schema's ordinary usage permission and preserves the distinction from model entitlement and billing.

The branded capacity reader delegates to the issued service receipt reader, which validates installation, profile, account reference, current subject, time window, source digest, and issuer revision. The source and returned observation retain an account ID digest, not the raw account ID. Tests exercise cloned receipts, stale times, wrong profile, account drift, missing permission, spend-control denial, malformed permission, and unchanged authentication-only behavior.

Independent checks: `npx vitest run test/integration-native-account-observation.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1` passed 20/20; `test/native-provider-measurement-subject.test.ts` passed 6/6. No concrete defect found in this scoped review. The mock suite does not qualify live service behavior or model-specific capacity.
