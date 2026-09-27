# Independent actual evidence review

Verdict: **PASS for the bounded direct-publication component. A04 and S4-05 remain open as broader contracts.** No OS test or build was rerun for this review.

## Actual result and source binding

The preserved command exited 0 with five test files and 34 tests passing. The actual source pins before and after contain the same two hashes, despite harmless JSON key-order differences:

- fixture SHA-256 `0e9418451398ddf2445ca95fe034f45752f0d8aafb4f227bc2daa600e99a2ff5`
- test SHA-256 `fbfcf5c60768ad8daa03922acb9b44410ba9b459f61cc512355987fcbe433920`

The raw log SHA-256 is `b4b0d50af38bff1743057664e2caf96de06f5cc28b07f4ac38a51b5816e1c14`; the exit receipt SHA-256 is `9a271f2a916b0b6ee6cecb2426f0b3206ef074578be55d9bc94f6f3fe3ab86aa` and contains exit code 0.

## Crash-window evidence

The first raw frame binds PID 83012 to creation time `2026-09-15T20:51:26.3989700+09:00`. It records one durable publication intent, zero publication results, and a committed native existing-file outcome. The original six-byte preimage digest is `6db7d803e74f1ffa7d8f5adc0bf95b3e15bf4c8373fffadf546227cc6c6742cb`; the 28-byte postimage, read independently from disk, is `published-after-crash-window` with SHA-256 `539958af7ce9abb3bfa052361f8dcc5385349b73acf111a3667605c6a8104a4c`. The passing test also requires that exact PID/creation identity to be absent after forced termination.

This establishes the intended bounded window: production publication intent persisted, real native existing-file effect completed, and publication result was still absent when the exact child was killed.

## Fresh-process recovery evidence

The reopen frame comes from distinct PID 67968 at creation time `2026-09-15T20:51:38.7109800+09:00`. It records production hold-before-reconcile behavior and binds the held case to `publication-attempt` and `publication-real-restart-set`, state `held`, revision 0, reason `interrupted-native-journal`, and null final seal. The stored payload SHA-256 is `5b901afcf8501b6f39eae62155f9b549dd15e4f497540ba0c9fd585e3909dc0a`; the passing assertion recomputes it over the emitted payload and binds its schema, case, attempt, change set, state, revision, and reason. There is exactly one initial held transition and zero recovery decisions or activations.

Production Git-status capture records the expected actual state `AM final.txt`. Reconciliation count is one; root and attempt are blocked; cleanup remains unverified; the original lease remains held. Exact replay returns pending with authority calls 0 and execute calls 0. Receipt, acceptance, publication-result, and replacement-attempt counts are all zero; the original attempt count remains one; blocked-no-auto-resume recovery count is one. The actual replacement bytes and digest remain unchanged across reopen.

## Cleanup evidence

The actual test passed through Vitest `afterEach`, whose source requires exact-identity cleanup for every registered child and canonical, non-symlink, uniquely prefixed direct-temp-root deletion, aggregating failures and retaining roots when cleanup is unverified. There is no separate raw cleanup JSON receipt. Therefore the passing lifecycle is evidence that the assertions and cleanup hook returned successfully, but it is weaker than a durable before/after identity and root-absence receipt. No broader machine-wide process absence is claimed.

## Contract disposition

This actual closes the bounded component exercised here: direct production final-publication store, native compare/write helper, held-recovery creation, interrupted-write reconciliation, Git-status capture, SQLite reopen, pending replay, zero resend, and retained lease over synthetically seeded lineage.

It does not invoke the public orchestration driver or prove that the driver creates the same lineage. The fresh child explicitly calls the two production recovery functions; it does not traverse `ownDaemonWorktree` or prove full production daemon ownership/startup ordering. For those reasons this evidence alone does not close the broader original A04 contract or S4-05. It also does not qualify provider/model execution, sessions, Electron, billing, power-loss durability, or new-file/rename publication.
