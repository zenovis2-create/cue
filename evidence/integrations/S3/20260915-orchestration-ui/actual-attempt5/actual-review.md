# Independent actual-attempt5 review

Verdict: **PASS for the bounded original S3-02 UI evidence scope.** The attempt closes the five requested UI observations for the declared in-process fixture. It does not qualify provider/model execution, monetary billing, native process cleanup, or resolved execution ownership.

## Evidence reviewed

- `result.json` records `passed:true`, actual renderer/preload/trusted IPC/Core/driver scope, producer launch once, cancellation once, and settled in-process work. It separately records `closeRejected:true` and `dbClosed:true`; the latter is fixture teardown after the handle settled, not product cleanup success.
- `calls.json` contains the real `cue:prepare`, `cue:approve`, `cue:execute`, status, and `cue:stop` IPC sequence. `running.json` and `stopped.json` preserve the same run and show producer running, verifier pending, then blocked/cancelled with acceptance unverified, cleanup unknown, and ownership unresolved.
- Local accounting is exactly one of two invocation instructions with one remaining. Provider request count and monetary cost remain explicitly unmeasured. The external request list and fetch count are empty, and the backup reports zero native identities.
- `final.json` records Electron PID 48980 exiting 0, child closure, backup verification, owned-root removal, and no cleanup errors. `before.json` and `after.json` are byte-identical (SHA-256 `189eee9ddc725e5d2b99d4ef4d23284975ed202fe2c116bb4d725154df6fb2ce`).
- Source pins include `app/renderer/styles.css` SHA-256 `83a24037c06916cf0b540d5dbe40341e66157de394810fbc4c310fcb38a18634` and `electron-proof.mjs` SHA-256 `517f24b5bddf7b6df18df7b01ffad39e1309528d84437ae063d8a0886b817886`.

## Visual audit

I directly inspected all nine PNGs: `running-choice`, `running-producer`, `running-verifier`, `running-budget`, `running-stop`, `stopped-result`, `stopped-uncertainty`, `stopped-stop`, and `stopped-budget`. They visibly show the stored fixed-pair reason, producer running/verifier waiting, one-of-two invocation accounting with monetary cost unmeasured, an enabled Stop control, and the final blocked/cancelled and uncertainty state.

Every matching visibility receipt reports `overflow:false`, positive field dimensions, the 1187 by 989 viewport, and containment within the viewport and each clipping ancestor. The corrected choice field is physically readable at 231.859375 by 80.59375 pixels; this is actual Electron layout evidence for the CSS correction. Each visibility receipt's image digest matches its PNG:

- running-choice `f5baa178873574627ee073742db4c6d936ab7596c520d8ea2ccf689eb8ca13b5`
- running-producer `b2220b372939e5d6426d1166155efcbbca7191a671f6db0a0ae9711528cf5569`
- running-verifier `da8efaf624ccc3a18187e6c74d5d0f60c718ebcc9b752e0b55764e6193eb1173`
- running-budget `aa31547881e7a4252450ccdccefdc8459256806ce12a14e9bc0a98a13df6c8ff`
- running-stop `0d9a719ac900e7bc39aefa665f4f04d1d002bcdafc23ac86f4a0bbba90b1f6f6`
- stopped-result `88961363df1ecabc34b42502ee66b5bb87530956a0edb45f10df0ad57491e2f0`
- stopped-uncertainty `3ff923ac92f397057124f2eee6cc034aaf56295fff28bc070f3747da2c016872`
- stopped-stop `38b882bffe96367882a22bd58fce554a820cf399d973999b5a044b582c44bf9b`
- stopped-budget `7ea1c5368cf9ffd475c0f97230f31fa1cf8c60957c853feadf486d963fb3a0b4`

## Closure boundary

The five original S3-02 fields are evidenced through the shipped Electron UI and IPC path, including a real UI Stop request reaching the driver. The injected producer and synthetic admission/cleanup callback make this a local integration proof. The retained ledger truth is deliberately conservative: blocked/cancelled, cleanup unknown, ownership unresolved, and acceptance unverified. No checker launched. The evidence therefore supports the UI contract and actual CSS layout fix while leaving real provider/model behavior, billing, native cleanup, and complete product qualification outside this result.

Actual attempts 1 through 4 remain preserved as failed historical evidence; attempt 5 does not rewrite their outcomes.

Key receipt SHA-256: `result.json` `c4ec61216657769ad0143ad5ab2735d56a890b830f287e080a76c2ca41b607cc`; `final.json` `99ec5ace0d4c907387d641acc3c3d643b6b6bc64b5906e0430153315c780d70d`; `calls.json` `670a0cfef0f693f2f574e313cbb1e73f785f2a5581ebe99cc54c32a3d7ae245b`; `running.json` `c39438e9e76beedf9d476a0412de2c2d289d97760351d777455FDB68B415BC70`; `stopped.json` `1a8ef6b865b635b79a3239e1ce241375edf9e07392a07756b99b440097197313`.
