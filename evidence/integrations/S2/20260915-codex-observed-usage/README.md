# Codex observed token usage producer

Date: 2026-09-15

This change consumes the Codex app-server v2 `thread/tokenUsage/updated` notification. The producer accepts a snapshot only when its `threadId` and `turnId` match the active ephemeral run, both `total` and `last` contain all six safe non-negative integer counters, and `modelContextWindow` is null or a positive safe integer. It emits the cumulative `total` snapshot once and then only on a strict increase of `totalTokens`; duplicate and lower reordered snapshots are ignored. Events after the correlated terminal are ignored.

The executor converts each accepted cumulative advance to an exact per-attempt delta before writing the existing attempt activity stream as `{unit:"token", quantity, status:"observed"}`. For cumulative snapshots `5` then `8`, durable quantities are `5` then `3`, whose sum is `8`. The typed controller event retains `source:"thread/tokenUsage/updated"` and `scope:"ephemeral-thread-cumulative"`. Equal, backwards, and post-cancel snapshots add no quantity, and delta state starts fresh for each retry attempt. If no complete valid snapshot arrives, the pre-existing `{quantity:0,status:"unknown"}` fact remains. No price or monetary receipt is derived.

The default Codex candidate advertises `usage:"supported"`. In the runtime contract this flag is copied to the execution handle as an adapter capability; it does not establish qualification, price, billing finality, or cleanup evidence.

## Frozen scope

- `daemon/src/host-codex-controller.ts`
- `daemon/src/adapters/integration-executors.ts`
- `daemon/test/codex-usage-producer.test.ts`
- this evidence directory

Pre-edit content identifiers produced by `git hash-object` (Git SHA-1 object-name algorithm), captured before mutation:

- controller: `470b2efd596fa030cfd111c249f520190057580e`
- executor: `eff5c3ce0ec38eb9f29e9385065eb86895646152`
- focused test: absent

These identifiers were computed without `-w`, so the blobs were not inserted into the repository object database. A later `git cat-file` retrieval confirmed they are unavailable; prior source bytes are therefore not reproduced or assigned fabricated SHA-256 values here.

Capability follow-up pre-edit Git object IDs:

- executor: `1f81611b1c91ac7cd42392f7446149e60fc82ffe`
- integration executor test: `1e76dd9c56c6f26eb075ecedc6ac879f93e53951`
- adapter preservation test: `24faa71e107698af3f2fbb4ec1cc3c3a5408457b`

Cumulative-delta review revision pre-edit SHA-256 source receipts:

- controller: `da85cb7d8d6421d2252fa4c483f0c9a3d8d44211df52bc7b689828599e6d471f`
- executor: `edcfa9225f81506947f67a02be08ba902549b12e272815861c3803f4b53920d9`
- focused test: `7c21eb395524463f3872796d31090aa647f8f644557d4baa094170ea81529588`

No binary, provider call, local port 8085 service, build, price conversion, billing receipt, cleanup claim, or budget release was used.
