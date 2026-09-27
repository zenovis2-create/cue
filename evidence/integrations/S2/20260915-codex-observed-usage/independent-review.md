# Independent review: Codex observed usage producer

Verdict: **BLOCKED** by cumulative snapshot persistence semantics.

## Blocking finding

`HostCodexRpcSession` correctly accepts only complete, safe-integer, nonnegative,
thread/turn-correlated snapshots whose `totalTokens` strictly increases. It drops
foreign, duplicate, decreasing, malformed, and post-terminal notifications. The
adapter then persists **every** accepted cumulative total as an ordinary usage
quantity (`integration-executors.ts:169`). For a valid sequence `5 -> 8`, durable
activity contains quantities `5` and `8`; the durable schema omits the producer's
`scope: "ephemeral-thread-cumulative"`. `handoff-activity.ts` appends both rows and
does not replace or max them. A later generic sum therefore produces 13 tokens.

No current projection or monetary budget path sums these rows: measured facts use
usage only as an activity-presence/evidence fact, while `budget.ts` derives money
only from separately authorized provider receipts and uses a per-request maximum.
That prevents a current token-to-money or billing-finality leak, but it does not
make the durable token facts safe for the stated cumulative-accounting contract.
The adapter should preserve cumulative scope in the durable contract or persist a
non-double-counting representation, and a two-snapshot durable test should prove
the selected rule across attempts/retries.

## Other review results

- Thread and turn binding, duplicate/reordered suppression, post-terminal
  quarantine, and malformed numeric rejection are covered and passed.
- Equal `totalTokens` snapshots are dropped even when the component breakdown
  changes, because monotonic admission keys only on `totalTokens`. This is a safe
  drop policy for cumulative accounting, but there is no explicit regression test.
- Exact `total` and `last` objects require the six expected own enumerable JSON
  fields. A malformed/partial `last` causes the whole notification to be ignored.
  Accepted usage remains `status: "observed"`; it is never marked provider-final.
- Accessor/proxy descriptor hostility is tested at the adapter boundary. Provider
  notifications arrive through `JSON.parse`, so prototype/accessor objects cannot
  cross the actual transport boundary. The controller still rejects non-plain
  token objects when exercised directly.
- Cancellation remains non-success and does not invent terminal/provider cleanup.
  Existing retry storage binds activity to distinct attempt IDs. The new producer
  test does not exercise usage across retry/cancel lineage; this should accompany
  the cumulative persistence fix.
- No token quantity is converted to currency, no price is inferred, and observed
  usage does not establish provider billing finality, goal verification, cleanup,
  or terminal success.

## Verification

- Focused Vitest: **17/17 passed** across three files.
- TypeScript: `npx tsc -p tsconfig.json --noEmit` **passed**.
- No build, live provider, localhost:8085, OS, or native tests were run.
- Immutable upstream source evidence is pinned to peeled commit
  `41e22fee981a63b3698df7ed36bad393cda24715`.

Exact commands and reviewed file hashes are in `independent-review.log`.
