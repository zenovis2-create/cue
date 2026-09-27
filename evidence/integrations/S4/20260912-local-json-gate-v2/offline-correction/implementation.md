# Offline audit correction

The executed E34418BA runner incorrectly modeled `generated_output_target` as denormalized columns. The real schema stores semantic fields in a canonical, hashed `payload`. The corrected auditor parses that payload, binds its run/target scalar keys, verifies its SHA-256 and input bytes/length, then checks its input, producer, checker revision, parameters and evidence source lineage.

The actual ledger contains six native identities: four qualification identities and two workflow identities. The corrected auditor selects identities by the two workflow attempt IDs, requires exactly one per workflow attempt, and then applies candidate plus all six session-field checks to cleanup and native identity facts. Strict historical readers run against the retained closed backup.

Read-only replay of backup SHA-256 `188a8784...862a` passed with accepted evidence, exact generated output SHA-256 `7b8d013d...0c50b`, two workflow identities/cleanups selected from the six-row inventory, one observed workflow producer attempt, two local invocation reservations, and no claimed provider HTTP count. The original `result.json` remains `passed:false` at SHA-256 `639582CB...68C1C4`; this separate replay corrects only the auditor verdict.

Offline fixture gate: 8/8 PASS. Scoped diff check: PASS. No Electron, native, cleanup, checker, model, or OS process was started.

Frozen correction hashes:

```text
C3F9C8C8FC2310A49B5E97E4EF90725CE455F6D6A62E00068C6D6584AF152E42  scripts/reuse/local-json-electron-gate-v2.mjs
12AADC0077022A04C088A9443D199EB8B05D5036D3A2E8220C494DF033EB43A5  daemon/test/integration-local-json-electron-gate-v2.test.ts
E34418BA6397F2403540D1C291EB1A1A043EBA358F77EB6CB5E3F1F2A6B2241C  executed runner archive
```
