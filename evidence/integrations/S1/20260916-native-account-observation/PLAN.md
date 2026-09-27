# Native account observation

Done means a production module launches the exact ledger-owned, pinned Codex installation with fixed app-server arguments, observes only bounded account JSON-RPC methods, binds the result to the exact installation/profile and current measurement subject, terminates the setup process, verifies cleanup, and issues a private receipt that shaped caller data cannot reproduce.

- Attempt cap: 2 focused test runs.
- Every pass: run the new focused integration test and inspect its raw log; run TypeScript only after the focused behavior passes.
- A failed pass requires a new evidence-backed hypothesis. Stop after two failed passes.
- No provider, model, or network call is made by the tests. Tests use synthetic fixture files and a synthetic owned child only.

## Reduced scope

`account/read` with `refreshToken:false` establishes bounded local account presence and an opaque identity digest. It does not prove a currently accepted service authentication. The receipt therefore reports authentication, capability, and entitlement as `unknown`; no consumer may promote `authAvailable`, quota, resource eligibility, model entitlement, or money from it.

Optional `account/rateLimits/read` is invoked only when caller policy explicitly requests it. Its presence is recorded as a distinct service observation and is never converted into money, entitlement, or model availability.

The real service-authentication producer remains unresolved and requires a separately authorized, freshly accepted provider operation. This unit is useful preflight identity/presence code, but it does not complete the missing authenticated fact and must not be described as merely an external measurement with no remaining code integration work.

## Ownership and preimages

- New: `daemon/src/native-account-observation.ts`
- New: `daemon/test/integration-native-account-observation.test.ts`
- No pre-existing source or test file is edited, so there are no byte preimages.
- No ledger schema, migration, credential, auth profile, runtime/controller, or host/Core file is modified.
