# S3 handoff integrity boundary independent review

Date: 2026-09-12  
Phase: Phase A, pre-correction source review  
Verdict: **BLOCKED pending correction 1 and later driver/Core integration**

## Preserved baseline

The historical correction-2 `FINAL BLOCKED` review under `20260912-handoff-activity` was not edited. This is a new bounded mechanism and a separate review record.

Frozen pre-correction product hashes independently confirmed:

- `daemon/src/ledger.ts`: `e4588812566a1814db8cb8547ed530b67334b0fbd4c48073fa3b380c968b2ca8`
- `daemon/src/orchestration/handoff-activity.ts`: `ef33cab3365b98e3b3cb3e4dc2e1d22d0ddeccc3e4663700e73e4959b8028ed2`
- `daemon/src/orchestration/store.ts`: `48ecdbbc4b796b3893ce924a5375c81b9df6f31261ba8cd307108d24937df182`
- `daemon/src/ui/orchestration.ts`: `8e7f1ed7059f26f63258379d5c0de27fcc2f578bc55227a90831a3cc8153e593`
- source and deployed `033_orchestration_handoff_integrity.sql`: `d2ada29d74c3c50e310002db7938d86c6c68163817513ab19571d24fc3e4e9b2`

Migration 033 is additive and ordered after preserved migrations 031 and 032. Its first application fences every existing attempt before inserting its marker, and replay does not add later attempts to the fence. It adds `cue_sha256` insert checks and a terminal predicate. The shared host-backed reader rechecks canonical payload bytes, receipt/identity/intent lineage, durable session ownership, complete artifact membership, host authorization, resolved bytes, hashes, and lengths. Store readiness consumes the reader. UI accepts an injected reader and defaults to `integrity-unavailable` when none is supplied. Driver/Core integration remains intentionally pending, so no whole-chain verdict is possible in Phase A.

## Blocking finding: the terminal capability is publicly forgeable JS state

The design requires a connection-local one-shot capability held in a private closure and unavailable as a general-purpose arming API. The frozen implementation violates that boundary in two independent ways:

1. `ledger.ts:11-17` uses globally discoverable `Symbol.for('cue.handoff-terminal-authorization')` and stores a writable capability object directly on the public `better-sqlite3` database instance.
2. `ledger.ts:22-34` exports `withHandoffTerminalAuthorization(db, attemptId, payloadSha256, callback)`. It accepts an arbitrary tuple and performs no host integrity validation before arming it.

A direct runtime probe required only the database object:

```js
const symbol = Symbol.for('cue.handoff-terminal-authorization');
db[symbol] = {
  attemptId: 'forged-attempt',
  payloadSha256: '4'.repeat(64),
  consumed: false,
};
db.prepare('SELECT cue_handoff_terminal_authorized(?,?)')
  .get('forged-attempt', '4'.repeat(64));
```

Exact result:

```json
{
  "symbol":"Symbol(cue.handoff-terminal-authorization)",
  "descriptor":{"value":null,"writable":true,"enumerable":false,"configurable":false},
  "direct1":{"value":1},
  "direct2":{"value":0},
  "exported":{"value":1},
  "after":null
}
```

`direct1` proves arbitrary property arming; `direct2` proves only that consumption is one-shot. `exported` proves the general exported helper can arm another arbitrary tuple inside a transaction. Neither route invokes the shared host validator.

## End-to-end hostile consequence

I inserted a hash-correct canonical handoff and matching relational artifact for unauthorized `fake-source`. The payload SHA-256 was `c3f68c1ee108910f5c06b16f28dc419a875302aaf74326e8b35663b052e6d04e`; the artifact claimed SHA-256 `b625ed49d024261acc1f167b97cb36eade98bdcac7279f743bf55bf62d8c5108` and length 10.

The direct terminal update while unarmed failed with `terminal handoff integrity unavailable`, as intended. Setting the public symbol slot to that exact tuple and repeating the same SQL update succeeded without host authorization or artifact resolution.

```json
{
  "payloadSha":"c3f68c1ee108910f5c06b16f28dc419a875302aaf74326e8b35663b052e6d04e",
  "artifact":{
    "kind":"output",
    "sourceRef":"fake-source",
    "sha256":"b625ed49d024261acc1f167b97cb36eade98bdcac7279f743bf55bf62d8c5108",
    "byteLength":10
  },
  "unarmed":"terminal handoff integrity unavailable",
  "slotConsumed":{
    "attemptId":"attempt",
    "payloadSha256":"c3f68c1ee108910f5c06b16f28dc419a875302aaf74326e8b35663b052e6d04e",
    "consumed":true
  },
  "attempt":{"state":"completed","cleanup_verified":1},
  "integrity":{"status":"integrity-unavailable","attemptId":"attempt"},
  "ui":{
    "state":"blocked",
    "attemptState":"completed",
    "handoffStatus":"integrity-unavailable",
    "cleanup":"unknown"
  },
  "fk":[]
}
```

The shared reader and injected UI reader correctly expose the forged row as unavailable, but the database terminal state was still written. The capability therefore does not establish the claimed same-transaction host-validation authority.

## Required correction and retest

- Remove the globally registered symbol state and the general exported armer.
- Keep capability state private to the exact store/connection validation closure; no second store, fixture, DTO, or database holder may arm it.
- Preserve one-shot, exact tuple, unused, reuse, nested, throw/finally, closed connection, and wrong tuple behavior.
- Add a hostile two-store or separate-holder probe proving that a caller with the same database object cannot arm terminal authority without the validating store's exact successful read.
- Repeat the hash-correct unauthorized artifact terminal probe and confirm zero terminal-row delta.

The maker acknowledged this counterexample and root authorized correction 1. No final Phase A result is recorded until those new hashes and tests are handed off. Even a later Phase A PASS cannot close S3: the host → validator → store → driver → Core/UI/report chain must wait for the separately owned runtime/driver work to stabilize and then receive its own integration review.

## Evidence boundary

This was a read-only product review plus local SQLite/JavaScript probes. No product or documentation file was changed. No model, provider, native helper, Electron, network, OS lifecycle, or worktree action was executed. Standalone maker tests were still moving, so no full suite was run or claimed.
