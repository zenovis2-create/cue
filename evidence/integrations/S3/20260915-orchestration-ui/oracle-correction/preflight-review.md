# Independent S3-02 Electron preflight review

Verdict: **BLOCKED before the single actual Electron attempt by two evidence-oracle gaps.**

The offline receipt is internally consistent with the intended narrow claim. It uses the compiled Core/driver/store, shipped preload and strict IPC handler, and current renderer. The flow prepares and approves through the UI, reaches one injected in-process producer, invokes the real UI Stop operation once, and preserves blocked/cancelled state, unresolved execution ownership, unknown cleanup, unverified acceptance, and no checker launch. `Core.close()` correctly rejects `orchestration_cleanup_unverified`; the fixture closes only its owned SQLite handle after the in-process completion settled. This is not presented as product cleanup success. Fetch count is zero.

The Electron harness uses an actual isolated BrowserWindow with shipped preload, trusted main-frame IPC, file-only request filtering, installation-generation checks before and after, source/compiled hashes, SQLite backup integrity, native-identity count zero, child exit verification, and guarded canonical temp-root removal only after a successful receipt. Failure retains evidence. No provider, model, native helper, or port 8085 path is present.

## Blocking corrections

1. **The local invocation-count field is observed but not asserted.** The required budget UI currently reads `실행 지시 1/2회 · 잔여 1회 ... 금전 비용 미측정`, but `scenarios.mjs` asserts only the monetary-unknown phrase. A renderer regression that drops or changes the count could pass. Assert the exact bounded count/remaining semantics (`1/2` and remaining `1`) in both the running and stopped observations, alongside the existing monetary-unknown assertion.

2. **The screenshot oracle proves only partial selector intersection, not visibility of the five required fields.** `capture()` scrolls the broad `#orchestration` or `#result` container to center and accepts any intersection with the viewport. `running.png` is not required to contain the selection reason, producer-running/verifier-pending text, invocation count, monetary-unknown phrase, and enabled Stop control simultaneously. `stopped.png` similarly captures only `#result`, while the unknown-cleanup stage and budget text live elsewhere. DOM JSON proves values, but the planned actual-window visual claim needs field-level visibility evidence.

   Before the actual run, either capture compact, named regions for each required group or add a viewport-containment assertion for every concrete field/control represented in each screenshot. Record which screenshot proves each field. A broad container merely intersecting the viewport is insufficient. It is acceptable to state that a long panel screenshot shows only the visible portion, provided separate captures prove the omitted required fields.

The expected blocked result must remain visible as `cancelled`, with cleanup unknown, ownership unresolved, acceptance unverified, and Stop enabled. Do not change fixture authority or synthesize a clean receipt to satisfy the harness.

No Electron window, product edit, build, provider, model, native helper, or network call was performed during this review.
