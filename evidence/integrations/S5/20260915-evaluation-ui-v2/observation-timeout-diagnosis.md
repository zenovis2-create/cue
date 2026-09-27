# Observation-timeout diagnosis

## Finding

The preserved renderer checkpoint proves enrollment completed and the observation form was enabled. The timeout itself is only the outer symptom. The renderer's observation handler converts any unavailable IPC response into a generic status and the scenario waited only for “revision 1”; the harness did not persist the returned IPC value or current status when that wait failed. Consequently the exact thrown Core error is not present in the pass-3 receipt and cannot be reconstructed honestly from the timeout alone.

Static tracing shows the failed request path:

1. renderer submits `operation: 'observe'` with the current enrollment and expected prior revision;
2. `app/ipc.mjs` rereads the enrollment and calls `core.observeEvaluation`;
3. Core rereads the enrollment and `evaluationObservations.observe` calls `readRunOutcome`;
4. any validation or read failure is intentionally collapsed by IPC to `{ available:false, reason:'evaluation-unavailable' }`.

The fixture input itself is not contradicted by current source: it creates a pending Core run, binds a saved local selection policy, validates and installs a matching plan, then enrolls through Core. The same copied fixture completed observation in offline pass 1 before later harness changes. Pass 3 also recorded `installation_identity_unavailable_or_drifted` at cleanup while other agents were changing/building shared sources. Because the offline proof imports current `app/core.mjs` but compiled daemon evaluation modules, source/build drift during the run is a concrete confounder. It is evidence that the run was not a stable-generation proof, not proof of which validation inside `readRunOutcome` failed.

## Required changed fixture/harness adjustment

A future authorized pass should:

- run only after root freezes source and completes the coordinated build, then pin and compare the exact app source and compiled daemon module generation before any fixture creation;
- allocate a fresh immutable receipt directory for the pass, so `VACUUM INTO` always targets an absent file and earlier receipts are never overwritten;
- make the IPC facade persist a bounded, redacted receipt for each evaluation operation before returning it to the renderer: operation, available boolean, and public reason only;
- on an observation wait failure, persist the current renderer status plus database counts and the latest enrollment/observation revisions before cleanup;
- optionally wrap the Core observation call at the harness boundary only to record the error class/code and rethrow it into the unchanged IPC handler. It must not alter the return, retry, or bypass Core/IPC.
- retain the reviewed policy-binding fixture unchanged unless the stable-generation diagnostic identifies a specific authority mismatch.

This discriminator will separate a stable current-source outcome validation failure from the observed concurrent-generation drift. No Electron or Core execution was performed for this diagnosis.

