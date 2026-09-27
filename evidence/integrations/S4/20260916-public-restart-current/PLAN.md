# Public-driver restart current-contract fixture correction

Done means the opt-in Windows integration test reaches the real native publication callback through the current Git execution-staging contract, records one durable intent and no result before forced process termination, then proves restart blocks automatic replay. The product driver and recovery code remain unchanged.

- Attempt cap: 2 focused runs after the parent supplies a current compiled build.
- Every pass: run only `integration-public-driver-startup-restart.test.ts` with the required absolute observation and cleanup record paths, then inspect the JSON result and retained cleanup receipt.
- Keep a change only if the gate advances from pre-publication EOF to the expected effect/restart frames without weakening identity, authority, native-write, or no-replay assertions.
- On failure: use a new evidence-backed hypothesis; after two failures, stop and report to the parent.

Hypothesis 1: the executable fixture predates mandatory execution staging. It advertises staged publication while launching in the publication worktree and supplying replacement bytes from an in-memory map. The current driver correctly refuses writable launch unless configuration opts into a trusted execution-staging host. The existing Git staging factory additionally requires a clean committed publication root.

Planned bounded correction:

1. Configure the crash child with the compiled Git staging host and `executionStaging: true`.
2. Write the replacement in the isolated execution worktree during runtime launch and read those bytes during final publication.
3. Initialize the integration publication worktree with a real clean commit; update only the resulting Git-status expectation (`M` instead of the former staged-plus-modified `AM`).

## Pre-edit hashes (byte copies not retained)

- `daemon/test/fixtures/integration-public-driver-startup-crash-child.mjs`: `b7f96fd6297e660aa45e5aca24b1dfebeff3c07b60e043384bc15b2a85a113cb`
- `daemon/test/integration-public-driver-startup-restart.test.ts`: `9f190884922983200eb9fc58f240c77b72004b67b4a0806420a34639ca62754c`

The assigned exact byte copies were not retained before editing. These hashes identify the observed pre-edit files but do not substitute for byte-for-byte preimage artifacts.
