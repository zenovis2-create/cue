# Independent audit before root correction

## Frozen candidate and gate

- Store `072f5c4522a7966c420640656e807b598836b47cbe539fd573cd872c29c05669`
- Migration 041 `03c89a28f05a4e20394440fef8935f44b1594a9f69e8c5509afb6bcf9fcd62cd`
- First independent-gate test candidate `f4af9fc073939f7e64eece5b48fef75b48765445026149589c837ff6f3d8c115`
- Independent build exited 0 and focused suites passed 28/28. Raw logs and exit files are preserved as `independent-build.*` and `independent-tests.*`.

This green gate does not qualify the candidate because source/contract audit found two blockers:

1. The raw authorization hash test used 13 SQL values for a 12-column table while supplying 12 arguments. It threw before reaching the migration payload/hash trigger. The post-gate test-only correction `a5492515ed5ac2f8d689e40ae785ee1428601731a56dd6b9d7ed9fd3881d25b7` has not been independently executed and therefore is not yet qualified.
2. Authorization joins the exact selection policy and checks ordinary budget currency, unit, and maximum limit, but neither SQL nor `readAuthorization` binds the ordinary budget's `policy_revision`. A fixture with ordinary policy revision `ordinary-v1` is accepted against selection policy `policy:1`. This violates the requested exact immutable policy/budget binding and could let a subcap prepared under one ordinary budget provenance be treated as authorized under another.

The maker's two-pass history remains failed at 27/28. Root owns one separately documented correction with full current preimages. No second independent gate has run.

Status: NOT QUALIFIED pending exact budget-policy binding, a valid payload/wrong-hash trigger oracle, frozen final pins, and one authorized independent re-gate.
