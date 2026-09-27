# Independent review: measured-facts Core wiring

## Review contract

Done means only an explicitly supplied trusted `runtime.measuredFactHost` constructs the repaired measured-fact store; exact identifier input, enrollment/observation/run/workspace ownership, and any pre-existing fact ownership/tuple are checked before host callbacks; capture/read use the Core daemon ledger; unconfigured, malformed, foreign, and conflicting calls perform zero callbacks and writes; exact historical replay remains immutable and `trialReady:false`; no trial, promotion, or UI path is added. Review cap: 2 corrections. Each pass runs the focused measured-fact Core and observation Core suites, syntax, frozen hashes, and scoped diff; a failure requires a new concrete hypothesis or handoff. This reviewer owns evidence only.

## Verdict: PASS — narrow trusted-host Core path

`createCueCore` constructs both measurement contracts and the repaired measured-fact store from the same daemon `db` only when `runtime.measuredFactHost` is explicitly present. The runtime object is a host-construction boundary and is not accepted from renderer or method input. Without it, registration, capture, and read remain unavailable.

Capture accepts exactly `factId`, `enrollmentId`, and `observationId` through descriptor-safe input validation. Before store delegation it validates all identifiers, reads the enrollment, requires its run in the configured workspace, verifies that the observation belongs to the enrollment and run, and preflights any existing fact ID. The preflight rejects a foreign fact before the store's prior-row read can invoke evidence or terminal callbacks; it also rejects a local immutable tuple mismatch as a replay conflict. The store separately rejects an occupied enrollment/observation tuple before host capture.

Read validates the identifier and joins the fact through its run/envelope to the configured workspace before invoking store validation. Both capture and read delegate to the store built on the Core ledger, so no alternate database authority is introduced.

The positive Core regression captures a real direct-store fact, preserves `trialReady:false`, appends a newer observation, then proves read and exact capture replay return the immutable original while host capture remains at one call. Foreign enrollment, foreign read, a foreign existing fact ID paired with a local tuple, malformed/extra/accessor input, and the unconfigured path all fail without relevant callbacks or added measured-fact rows.

## Verification

- Independent command: `npx vitest run test/integration-evaluation-measured-facts-core-containment.test.ts test/integration-evaluation-observations-core.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` — 2 files, 3/3 PASS.
- `node --check app/core.mjs` — PASS.
- Scoped `git diff --check` — PASS; only Git's existing LF-to-CRLF notice was printed.
- Maker reports daemon TypeScript build/typecheck through the focused prehook PASS.

## Frozen hashes

- `app/core.mjs`: `896461800E8EB790286F529EF0728AF26D97691867E6F6E24BCF157F6696D209`
- `daemon/test/integration-evaluation-measured-facts-core-containment.test.ts`: `F4BF3741CC982BD6159040AFD22EF226504AE831E6C7B268DB546549823F253D`
- `daemon/test/integration-evaluation-observations-core.test.ts`: `E76DB8E2FFB837B54E720707D24651F44E8C790F93B13A5C8ADC1A0E261873AD`
- `DONE-CONTRACT.md`: `527C4C46466AA9A2B7556624315016DFD48A2ACA44D4C2A0A6E5FE359D125A77`
- `RESULTS.md`: `214EA1B18F4588132EF435BFE92E1E6FF0F21688009D14783598C24619486B5A`

This PASS lifts unconditional Core containment only for the repaired store behind the explicit trusted runtime host. It does not approve the pre-repair blocked factory, make facts trial-ready, add promotion or UI behavior, establish a real measurement/trial, or authorize provider, model, native, Electron, network, credential, or paid activity.
