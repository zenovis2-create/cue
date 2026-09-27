# Independent review — P12 preload contract correction

Reviewer: /root. Maker: /root/reuse_transport. Date: 2026-09-11.

Reviewed the one-line git diff against the actual six-method frozen object in app/preload.cjs and the unchanged cleanup-failure test. The exact allowlist now includes the two selection preference methods already implemented and independently reviewed in S2. Unknown methods are still rejected by exact equality; isolation, CSP, navigation, and cleanup assertions were not relaxed.

The focused test ran the actual Electron proof with forced cleanup failure. Its recorded exit0 means the negative test passed: the proof itself failed, emitted no success result, and preserved the forced-cleanup-failure reason. This is not a claim that cleanup succeeded or that the broad regression now passes.

Source SHA256: 9598d07850f82f51582b3ed8177e9e383bfcf650af740c290b59a5a127c73140.
Unchanged test SHA256: 44388a535ea1912bc09f8b5eaeaa0872eac6a1e157b690bde3b20ce4f1febd2e.
Command and log: p12-proof-contract.json / p12-proof-contract.log in this directory.

Verdict: PASS for this bounded contract correction. Original broad failure remains recorded.
