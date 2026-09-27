# Independent measured capture snapshot review

Result: **PASS**. No blocking findings remain in the pinned scope.

## Contract verification

- `canonical` takes a descriptor-safe owned snapshot before dependency, terminal-integrity, or evidence callbacks. The snapshot rejects proxies before reflection; rejects accessors, symbols, sparse/extra array properties, custom prototypes, custom array iterators, `toJSON`, cycles, unsupported values, and non-finite numbers without invoking host getters, proxy traps, iterators, or serializers.
- Snapshot limits are inclusive: depth 64, 262,144 nodes, 65,536 array entries, 4,096 object keys, and 1,048,576 encoded raw JSON bytes are accepted by the bound checks; only values above each limit reject. Incremental byte accounting matches JSON UTF-8 encoding for container delimiters, commas, colons, escaped keys/strings, and primitive representations, and rejects oversized escaped input before terminal/evidence callbacks or writes.
- Plain-object and array key order is retained through descriptor enumeration and property definition. Valid values remain JSON-compatible, while the final canonical payload still uses the existing one-MiB stored-byte gate and schema/digest construction.
- The timing regression mutates the original host value from `elapsedMs: 3` to `999` during the clock-evidence callback. The captured, read, replayed, and reopened value remains `3`; later host mutations do not affect the fact or digest; returned nested fact data is deeply frozen; the original host object remains mutable.
- The hostile nested-array regression records zero getter, proxy, iterator, and `toJSON` traps and zero database writes. Existing measurement capture, historical replay, monetary accounting, evidence projection, unavailable measurements, and Core containment remain compatible.
- No producer/default-host, trial, promotion, schema, native, server, network, model, or live-Electron behavior was added.

## Independent gate

Reviewer pass cap: 2. Pass 1 ran every required check; pass 2 was unnecessary.

Command (from `daemon`):

`npx vitest run test/integration-evaluation-measured-facts.test.ts test/integration-evaluation-measured-facts-core-containment.test.ts test/integration-evaluation-measured-fact-evidence-core.test.ts --config vitest.config.ts --reporter=verbose`

Result: exit 0; 3/3 files and 19/19 tests passed. Root's successful final build was not duplicated.

Final pins: 2/2 matched.

- `daemon/src/evaluation/measured-facts.ts`: `6E3D27E123EC24835612F44DD7A1DB8A6E3B534AEF7B5ED3273B6936846A20CE`
- `daemon/test/integration-evaluation-measured-fact-evidence-core.test.ts`: `4A52C9085E96D6694AE1EF1A222D352EB7EDCFC50A2962734796469B38733D53`

Preimages: 2/2 matched.

- source preimage: `03CA353494677F8336CC762F7AB0DA50BF9A04693FECBE81B92D34CB19C2CD91`
- evidence-Core test preimage: `3CC5FCC6F6B4903D26F78736771AC708AFA5111D89A94C1D858E4A02CA021CE2`

## Evidence history and limitations

The maker's two failed TypeScript builds and untested handoff are preserved in `maker.md`, `maker-handoff-pins.json`, and `before-root-gate.json`. Root's first failed correction build and successful second build/focused gate are preserved in `root-gate.md`. The stable final pins supersede the maker handoff pins.

The populated Core fixture is synthetic SQLite evidence. It injects terminal-integrity authority and temporarily disables lineage triggers and foreign-key enforcement to seed exact lineage rows. This verifies the measured-fact snapshot boundary and replay behavior, but does not qualify a real provider/runtime, native execution, default host, trials, promotion, or broader S5 behavior.
