# Default native recovery observer — actual bounded QA PASS

2026-09-12 KST. [Runner](runner.json) exited 0 in 6.68 seconds. [Proof](../native-proof.mjs) SHA-256 `6504FF4914FE0BA9810CEC35914209ECDF968F1B2244DFAF2D502898C2515D8C` was root-reviewed before this single attempt. No product source or build changes were made by the QA executor.

[Result](result.json) records exactly two calls to the default compiled observer, with no `fixture.query` or `fixture.stat` replacements. The shipped PowerShell helper performed targeted native queries; default filesystem inspection observed exact synthetic GUID paths. The selected source/helper/compiled/proof/Node hash guard ran 80 times without drift; this count is not a quality score or a full installation-generation guarantee.

[Independent process metadata](independent-live-metadata.json) came from a separate targeted PowerShell/.NET `Process.StartTime.ToFileTimeUtc` query. The harness PID 54184 and two harmless owned Node children 28352/29056 were placed in a structurally valid synthetic identity in isolated SQLite. Their native start times matched on the [first observation](alive.json), with all three `matching-alive`. After graceful child stdin closure, both children exited 0 and the [second observation](after-close.json) reported them `absent`, while the harness remained `matching-alive`.

The exact random task/profile/AC paths were absent under the current OS temp/local-app-data bases; path provenance matched. No AppContainer profile was registered or deleted. The identity's role names, SID, envelope and control digests are synthetic fixture data; this test does not prove a real launcher, guardian, model or sandbox lineage. It validates the actual default native observation path against independently measured processes.

[Database before](db-before.json) and [after](db-after.json) matched exactly: database file hash, WAL hash and `total_changes()` were unchanged, and the stored identity was unchanged. A consistent [SQLite archive](ledger-backup.sqlite) passed integrity checking and retained one synthetic identity row. [Backup receipt](backup.json) SHA-256 `0ed7cb67ce7a0320bd8b0fa0b1f0929fc98e5302219b48109ef66409ec1cce58` identifies the archive.

[Owned-state receipt](owned-state.json) records closed children, closed database and ENOENT-confirmed removal of the validated owned temporary root. No historical ledger/profile cleanup occurred and finalization errors were empty. [Selected before](before.json) and [after](after-manifest.json) hashes matched.

The observer remains observation-only: no recovery action, termination decision, cleanup receipt, acceptance, capability qualification, model/checker executor, provider/network call or paid call is claimed. The ordinary child shutdown belongs solely to the QA harness. Attempt 2 was not run.
