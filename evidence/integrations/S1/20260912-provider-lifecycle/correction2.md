# Provider lifecycle correction 2 result

Date: 2026-09-12 KST  
Correction: final pass 2 of 2

## Reviewer blocker resolved

Public lifecycle writes no longer use predecessor row existence as authority. `append()` and `bindReference()` now start an immediate transaction and revalidate the complete ordered predecessor chain before checking or inserting the requested fact. Revalidation covers:

- canonical payload bytes and recomputed SHA-256;
- equality between payload and typed relational columns;
- exact run, task, attempt, and candidate lineage;
- contiguous ordinals and post-seal exclusion;
- cancel request before client acknowledgement;
- a single provider terminal;
- billing finality bound to the exact preceding provider receipt digest.

Any corrupt predecessor aborts before the dependent insert. The reported fake provider-terminal row can no longer authorize public billing finality.

The ledger now registers deterministic SQLite function `cue_sha256`. Migration 032 invokes it in event and provider-reference INSERT triggers, so a structurally valid payload paired with a caller-supplied fake hash is rejected at the database boundary. Public full-chain validation remains in place because rows can survive from older bytes or be altered by an actor that deliberately removes immutable triggers.

## Exact hostile results

- canonical-looking raw provider-terminal + fake hash: DB INSERT rejected.
- same forged terminal inserted after deliberately dropping the exact-event trigger, then public billing append: `provider_lifecycle_payload_integrity`; event count remains 1.
- forged cancel predecessor, then public client acknowledgement: `provider_lifecycle_payload_integrity`; no acknowledgement row.
- forged parent event, then public subtask binding and lifecycle seal: both `provider_lifecycle_payload_integrity`; zero bindings and zero dependent events.
- valid predecessor changed after close using a raw connection with the immutable update trigger deliberately removed, then reopened: public acknowledgement rejects with `provider_lifecycle_payload_integrity`; no dependent row.
- valid provider-terminal to matching billing chain: PASS.
- two file-backed connections, replay/conflict, rollback, close/reopen: PASS.
- orchestration attempt state and `cleanup_verified`, local invocation budget rows, and acceptance-final rows remain unchanged in all forgery probes.

## Final gates

```text
npx --no-install vitest run test/integration-provider-lifecycle.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
1 file / 12 tests PASS

npx --no-install vitest run test/integration-provider-lifecycle.test.ts test/p5.test.ts test/integration-handoff-activity.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
3 files / 36 tests PASS

npx --no-install tsc -p tsconfig.json --noEmit --pretty false --incremental false
PASS

npm run build --silent
PASS

npx --no-install vitest run test/integration-orchestration.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
1 file / 11 tests PASS

npx --no-install vitest run test/integration-orchestration.test.ts -t "independent connections atomically claim exactly once" --reporter=verbose --fileParallelism=false --maxWorkers=1
1 passed / 10 skipped
```

The lifecycle suite includes fresh and pre-032 file-backed migration, close/reopen, `integrity_check=ok`, and empty `foreign_key_check` assertions.

Source/dist migration parity:

```text
SHA-256 d33b6ecb9498e4264de4fe35408634c871e224550786392d93bdf7667faefb67
13,418 bytes each
byte_equal=True
```

Owned tracked diff check exited 0. New source, migration, and test files contain no trailing whitespace.

## Current hashes

| File | SHA-256 |
|---|---|
| `daemon/migrations/032_provider_execution_lifecycle.sql` | `d33b6ecb9498e4264de4fe35408634c871e224550786392d93bdf7667faefb67` |
| `daemon/dist/migrations/032_provider_execution_lifecycle.sql` | `d33b6ecb9498e4264de4fe35408634c871e224550786392d93bdf7667faefb67` |
| `daemon/src/orchestration/provider-lifecycle.ts` | `56334581ae3d72fefb7c4ee4b642223a54c418012939ac5a16ba338818826a9b` |
| `daemon/test/integration-provider-lifecycle.test.ts` | `a335718c92498a24967c18ee0044d2f9bbf1f8cc76e4809afbe2a8a8a3fa0755` |
| `daemon/src/ledger.ts` | `89c837c71414f3311a355537c5151eae96f591b1e4981a6b6d6f18874ab31462` |
| `daemon/scripts/copy-assets.mjs` | `0f6906a7411c1d8b6ca1c6638b789b82e33d7bb72513f93daa85292f84768870` |
| `daemon/test/p5.test.ts` | `b67f5a9759df4f95e278e7ef5369671d4650ddac1ef6a02c6f7e6e606e99f3df` |

No provider, model, CLI, native launcher, Electron, or network execution occurred. Actual remote provider death and billing cessation remain open. Broad checklist completion remains pending the same independent reviewer recheck.
