# Independent S3-02 actual-attempt-3 audit

Verdict: **FAIL / OPEN. The real Core/UI reached running state, but visual proof and UI Stop were not completed.**

The startup corrections worked. Electron 44.2.0 moved from `ready:false` to `ready:true` in 50 ms, then the actual Core, injected fixture host, trusted IPC, shipped preload, and renderer initialized. `running.json` records one producer launch and the required running values: fixed-pair selection reason, producer running, verifier pending, invocation count 1/2 with one remaining, monetary cost unmeasured, and Stop enabled.

The first screenshot failed before capture. The harness attempted `running-choice.png` for `#orchestration-stages .selection-summary`, then asserted that the field was outside the viewport. No PNG or visibility receipt was written. The current scroll helper adjusts only the window. The selected field is inside `.orchestration ol`, which has `max-height:260px` and `overflow-y:auto`; window scrolling does not guarantee the field is inside that nested scrollport. This is a harness capture defect, not evidence that the renderer omitted the field. Because bounds are saved only after the containment assertion, the failing rectangle was not durably recorded, which limits diagnosis.

The scenario aborted before clicking UI Stop. `truth.cancels:1` was produced by teardown through `Core.close()` after the screenshot failure, not by the renderer Stop control. There is no stopped DOM receipt, stopped screenshot, IPC Stop call receipt, blocked/cancelled visual result, or post-Stop unknown-cleanup visual evidence. No S3-02 completion claim is supported.

Teardown behaved safely. The child exited 1 and closed; the SQLite backup passed integrity with native identity count zero; expected cleanup uncertainty caused `closeRejected:true`; source hashes matched before and after; fetches and denied request observations were both empty; the parent verified the backup and removed the exact owned root. `final.json` remains `passed:false` with `verified:true`, `removed:true`, and no parent errors.

A future separately authorized correction should scroll each selected element into all relevant scroll containers, using `element.scrollIntoView({block:'center', inline:'nearest'})` or an explicitly verified ancestor-scroll routine, wait two animation frames, then test both viewport containment and clipping by every overflow ancestor. It should save the raw pre-assert rectangles, ancestor scroll positions/clipping rectangles, and field text before any assertion so a failure remains diagnosable. Existing field-value, blocked/unknown, Stop, backup, and cleanup oracles should remain unchanged.

No provider/model/native process was launched, and no billing, provider cleanup, or product visual defect is established. S3-02 remains open.

## Evidence pins

- before/after source snapshot: `d206cec8f6bae812342324f21dd5c5f1c9b5f4e93bd3f6726a127779f03bafc7`
- running DOM receipt: `1bfe2bacc8b8671c0250e8f919f721ff198dbd0cc5f9fa74541c7122f602699c`
- failure receipt: `f0051d64e9e61d1cd8bf1c4fec702cf66aa4849f46eb5bf8b7bf72e70c3b2792`
- result receipt: `3a689a51cc81254498e8817c505dd5c3c7adbb21373a9e9cbf6c71fd80329bd2`
- final parent receipt: `cc32edc93ea785f45972d1cbeee2c675b7fa0d7437ea641bcffb7aa5761f1604`
- ledger backup: `84f9b42c67bc491e51993a93e64377e7f068050b4e5d990abd486464c199aa2b`
