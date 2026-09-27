# S7 current-source follow-up QA contract

Status: prepared only. Do not run the Electron/default mode until `/root` announces source freeze and the generator owner reports the fixed artifacts ready.

## Done

One bounded run of `node scripts/reuse/current-source-electron-proof.mjs` must exit 0 and preserve:

- exact-byte SHA-256 and byte-length checks for `cue-current-source.html` and `cue-current-comparison.html` against their saved receipts;
- an independent current `app` + `daemon/src` recapture and AST extraction equal to every saved file, import observation, edge, count, inventory entry, and snapshot digest;
- independent historical-pin verification and file/node/edge comparison set arithmetic equal to the saved comparison specification;
- source-basis before/after equality and current source/delivery implementation hashes;
- real hidden production `openReportWindow` observations for both exact saved HTML byte strings, including CSP, zero scripts/links/assets, zero non-bootstrap requests, disabled privileged renderer surfaces, and default/narrow/expanded screenshots;
- a structured PASS result. Any failure preserves `failure.json`, process logs, and prior evidence.

The parent reviewer inspects screenshots personally. Automated DOM assertions prove structure and state, not visual quality.

## Budget

Maximum four harness corrections, each with a different diagnosed cause. Every pass runs `node --check scripts/reuse/current-source-electron-proof.mjs` first. A failed final run is retried only after a new hypothesis; unchanged failures are handed back with evidence.

No paid/model/native-helper calls and no external network are used. The child process is hidden and bounded to 60 seconds. Cleanup applies only to an absolute `%TEMP%\\cue-current-source-proof-*` profile whose resolved parent and prefix are verified before recursive removal.
