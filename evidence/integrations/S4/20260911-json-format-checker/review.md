# Independent review: cue-json-format-v1 core

Reviewer `/root/broker_review`, 2026-09-11. Read-only product review. **PASS for the exact bounded JSON formatting predicate**, not freeform semantic verification or acceptance-host integration.

## Reviewed identities

| File | SHA-256 |
| --- | --- |
| `daemon/src/verification/json-format-checker.cjs` | `34AB9E98F097710643694446E8DEE97D5FB2F2BE437D0206F734148A443CFBDC` |
| `daemon/src/verification/json-format-checker.d.cts` | `DBE8EB237DE4EF72C6EA6842B387FAF69EF6498A8240A292AA77D37590D6CAD4` |
| `daemon/test/integration-json-format-checker.test.ts` | `A796B226078556E07363E1446FF8BA79CD006A8AA4CDCCA6D2B8EC7759C4C86A` |

## Independent verification

- `npx --no-install vitest run test/integration-json-format-checker.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` in `daemon`: exit 0, **7 passed**, 260 ms, start 18:05:53 local time.
- `npx --no-install tsc -p tsconfig.json --noEmit`: exit 0.
- Additional reviewer stdin Node probe: deterministic LCG seed 34187, 1000 nested JSON structures (maximum generated recursion depth 6), canonical numbers, Unicode, escaped control characters and lone-surrogate strings. All 1000 exact pretty outputs passed; adding a final newline failed in all 1000 cases.
- Five additional large zero arrays, lengths 209712–209716, were compared against actual `Buffer.byteLength(JSON.stringify(value,null,2))` on either side of the 1 MiB expected-output boundary. Within-bound expected values passed and over-bound expected values returned unknown. Four explicit exponent/surrogate/control-escape inputs were classified against exact canonical reserialization. Additional detached-buffer and Proxy-wrapped typed-array inputs returned unknown without invoking a Proxy trap. Probe result: `{"status":"pass","cases":1009,"mutatedOutputs":1000,"detachedRejected":true,"proxyTraps":0}`.
- Initial additional probe had a reviewer-only scalar-generator off-by-one index and failed with `Buffer.from(undefined)` before meaningful checker assertions. It was corrected once using the scalar array's actual length; the result above is the corrected run. Product code was not changed or blamed for this fixture error.

## Contract assessment

- Input is snapshotted using intrinsic typed-array buffer/offset/length getters, not caller-defined getters or iteration. Non-Uint8Array, Proxy and shared backing buffers are rejected. Hashes bind copied bytes, and the verdict is frozen.
- UTF-8 decoding is fatal, BOM is explicitly unsupported, and an escape-aware scan enforces at most 64 container levels before JSON parsing or recursive serialization. Tests cover depth 64/65 and bracket/escape content inside strings.
- Canonical means exactly `JSON.stringify(JSON.parse(inputText)) === inputText`; this deliberately rejects duplicate keys, incidental whitespace, alternate number spellings, alternate escapes and native key-order changes. It is **not** a general RFC canonicalization standard or a requirement that all object keys be lexicographically sorted.
- Supported expected output is exactly native `JSON.stringify(value, null, 2)` encoded as UTF-8, with no trailing newline. A byte-for-byte comparison is the sole pass authority. Supplied output is capped independently at 1 MiB; invalid or oversized output fails only after a supported input/expected result is established.
- The iterative preflight counts container braces, comma/newline separators, indentation, quoted keys/colon spaces and primitive serialized bytes, and stops at the cap before constructing an oversized pretty string. An explicit post-construction length guard remains. Expected-output overflow is unsupported/unknown, never falsely reported as an implementation mismatch.
- No user source is evaluated; object keys such as `__proto__`, `toJSON` and code-like string content remain parsed data. The checker imports only Node crypto/util and does not access files, network or subprocesses.

## Limits

This unit assumes trusted Node intrinsics in its checker process; it does not claim immunity to arbitrary code that has already replaced global JSON/Buffer/Object functions or polluted prototypes in the same process. Typed-array inputs themselves cannot perform that mutation through this API. A production independent checker host must keep candidate code out of the checker process.

The audit covers the predicate and declarations only. It does not prove that a supplied input is the approved requirement artifact, that a result came from an independent principal, that compiled distribution assets are installed, or that final acceptance/ledger/UI uses this checker. Those require separate host integration evidence. Seven tests plus the additional sample probe are coverage evidence, not a universal proof of all possible JSON inputs.
