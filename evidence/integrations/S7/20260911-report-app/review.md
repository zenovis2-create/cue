# Independent app report integration review

Reviewer `/root/transport_review`, read-only implementation review. Status: PASS for this app integration after the display-byte correction below. Actual Electron behavior/visual QA remains a separate evidence gate.

## Corrected display-byte identity race

The initially reviewed `app/report-window.mjs` read and hashed `artifact.path`, then called asynchronous `win.loadURL(fileURL)`. Chromium could subsequently read a replaced file. A concurrent same-run export could therefore display bytes different from the first IPC receipt without an untrusted root writer.

The maker now constructs a base64 HTML data URL directly from the already verified byte Buffer, with a 32 MiB bound. No second file read occurs when loading the window. The regression replaces the original file from the mocked loadURL implementation and asserts the URL still decodes to the original verified bytes. This closes the identified pathname race rather than adding another pre-load check.

Parent, maker and browser QA were notified. Independent final gates ran only after correction readiness. Data-URL loading and the actual browser shell still need the separately assigned Electron QA; browser URL/size support is not established by a mocked window test. Load errors destroy the hidden window and propagate rather than reporting successful opening.

## Other reviewed behavior

No additional blocker found in the current scope: same-core known run lookup; fixed host state output root and hashed basename; no renderer-provided HTML/path; ancestor/link checks before output directory creation; all registered actual IPC handlers require the main window and main frame; separate ephemeral report session; no Node/preload/JavaScript, denied permissions/downloads/popups/navigation and restricted requests. Host-exclusive output-directory ownership remains the delivery helper's precondition.

The local invoke helper bypasses Electron sender checks for host-side tests only and is not exported through preload. The report IPC returns status/hash, not filesystem paths. Actual Electron behavior remains the separate QA agent's responsibility.

## Independent checks

Daemon working directory, 2026-09-11 20:29:09 local:

```text
npm run build
npx vitest run test/integration-report-app.test.ts test/p11-electron-surface.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
```

Build exit 0; 7 tests PASS across two files, duration 1.51 seconds (tool chunk 3ff246). Tests cover actual core SQLite export and fixed state path, reports-directory junction rejection, registered IPC sender/frame denial across every channel, no returned path, mocked isolated-window controls and byte-race regression, renderer run-ID/legacy visibility and the P11 preload/channel/status boundary. They do not claim actual browser traffic/permission interception or a new provider canary.

## Reviewed SHA-256

| Artifact | SHA-256 |
|---|---|
| app/report-window.mjs | B79F071DF4D0802A4B01BABF38F5CCFA88A531B2BAB772911A29574DB1FA1789 |
| app/report-window.d.mts | BC471EFBB63DBC1A56DF617C221B6E7B7167957684BE57B5D98B40F1621D9FC9 |
| app/core.mjs | 7CC4892D94FF4D7C96EFE968DF4AF80658D419AEE38EA14101B5C9DBD1105DBA |
| app/core.d.mts | 65F81CE891F7CD78961B2064CF1EDF2284F6A19D94F987F4A687A02828C2ABB2 |
| app/ipc.mjs | 6EB6A9C700D7657E138150554FA3F96DBA00123BA2F5897D6934D55AD508EFD7 |
| app/ipc.d.mts | 197D21C767C3A323153FBCF15A7E1ACA91FF9D96A93F54A44F6C5E89968D94A5 |
| app/preload.cjs | FAD17DE6C26F401DDB13274CB95905DB4B13A1EDDE521E95C59E4C2F1345079F |
| app/main.mjs (report wiring scope) | 5AD89F87BE8518F945EB5E0CBC0575B4644DCA5F109811DD07A5F3F38AB54AA8 |
| app/renderer/renderer.js | F3301679978782F172ADB118B3993E9A8BC94285B4B0988C653A50C2B48F29DA |
| app/renderer/index.html | 4005594434C7012E617A8EDF576CDC7375F496C2667B9648AA1EA10F1C48C7A4 |
| daemon/test/integration-report-app.test.ts | B94464D339A61CB36584248FDAEDD3EA71B9F6B6F569FA6125738653626DE886 |
| daemon/test/p11-electron-surface.test.ts | 8B0D7985C3B1AEA5D81C41AC2E50AB372167DCF0C81AB932B9D204A01057F500 |
