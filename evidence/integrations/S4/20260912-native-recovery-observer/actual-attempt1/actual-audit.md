# Independent audit of actual attempt 1

Reviewer `/root/broker_review`, 2026-09-12 KST. PASS for this captured synthetic-identity, actual-OS observation proof. No repeat helper/native/model invocation. Audit opened the archived SQLite backup read-only and inspected existing JSON evidence.

- Runner records exit 0, 6.6775253 seconds, attempt 1, no additional attempt. Exactly two observer queries and 80 guard checks were recorded; finalization errors are empty. The five-second limit applies per observation, not to the entire two-query harness.
- At 2026-09-11T15:35:46.808Z, native observer output reports three matching-alive identities. Independent live metadata, persisted identity, and observer FileTime strings match exactly: harness PID 54184 / `134336145433883704`; child PID 28352 / `134336145435028228`; child PID 29056 / `134336145435563794`.
- At 15:35:49.656Z, the harness still matches alive; both children are absent, after both recorded graceful close events with exit 0. Task/profile paths report absent with matched current-folder provenance in both observations. These paths were random synthetic, never-created boundaries, not actual AppContainer profiles. This proves absence observation, not profile removal behavior.
- DB before/after file SHA-256 is identical (`15b520ea52fd66d676f48eddbf4cee0431370c9a6620f50cdf699218035dbb5a`); WAL is absent and total_changes remains 5. Independent backup inspection finds exactly one identity row, validates its payload SHA/reference and exact equality with the captured synthetic identity, and returns SQLite integrity `ok`.
- Harness records its disposable root removed after backup and DB close, with no historical path deletion. Reviewer independently confirms that exact disposable root currently returns ENOENT. No additional PID or profile query was made.
- Captured before/after manifests are equal. Proof hash is `6504ff4914fe0ba9810cec35914209ecdf968f1b2244dfaf2d502898c2515d8c`; compiled observer is `2efde82dc1ab4c6f12a3091c29c94e19216874c5bb34c4de5545af0d4a1930cc`; helper source and compiled copy both `dbf6abb0d3b0343e03bf848a8564f54f34f7a96714d079bab570e14fa3c567a4`. This historical proof is bound to those captured bytes, not later product edits. Selected-file hashing is not a complete installation-generation proof.

Both outputs remain `sourceKind: native`, `authority: observation-only`. Persisted role names launcher/client/guardian are synthetic labels here: the real subjects are a harness and two benign Node children. No AppContainer, production guardian, model/checker executor, provider, qualification, cleanup receipt, restart or recovery action was exercised. This proof does not resolve earlier failed live workflow ownership or authorize termination/deletion.

## Audited artifact hashes

| Artifact | SHA-256 |
| --- | --- |
| result.json | 77421a4ea13f5f2faa2af422dcf70280d95281229b7f0e20348bdccfcfb2ec1d |
| before.json / after-manifest.json | 55ff2f86a68da54e9a873dd08d36531d4103e3e17bf4ec52c0acc3a85cc15571 |
| alive.json | c6da651d14ce3615d7deca524ae6bb1fd7878ae21f60f891640267acf9ec97b0 |
| after-close.json | 726a6adf1aff6f049ce25b1efc4f1323837961365cf4f6deeabf017b4b6cc9b3 |
| ledger-backup.sqlite | 0ed7cb67ce7a0320bd8b0fa0b1f0929fc98e5302219b48109ef66409ec1cce58 |
