# Driver fixture correction

Done means the common positive writer fixture uses attempt-owned execution staging and real staged existing-file publication while target-free tasks remain read-only. Existing behavioral assertions remain intact.

Attempt cap: two passes per hypothesis.

Every pass runs the exact `integration-driver.test.ts` suite, then the writer-publication and named orchestration suites, followed by TypeScript compilation. The root owns the shared full suite. No test command runs while the root's current full suite is active.

Pre-edit SHA-256: `D5DBE8445B045416FD8004F4C0E68DDB2F7F8A0CC0C91B1FA9A98C9A882A8623`

Pre-edit Git object: `36a1e7906f2ac9b73bdd7da400e6972483beb223`

The whole-file preimage is stored under `preimage/`.

The real-restart child is also handle-only: it persists a session identity and wait-delivery state but never writes workspace content. Its whole preimage is stored alongside the main fixture; its pre-edit SHA-256 is `2B57E43FBB76327F8165D8708B58F09ACB56B519FA9E2B71289EF4C4E0A263B9` and Git object is `5a1c38dd5ed933bb605df166588be658e5678045`.
