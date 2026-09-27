# Generated WFP launcher bootstrap seam

## Done contract

- Command from `daemon`: `npm exec vitest run -- test/integration-readonly-wfp-bootstrap.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`.
- Attempt cap: 2; every pass runs the exact command.
- Done means production launcher generation, control measurement/snapshot/verification, worker bootstrap, SQLite, and authority stores prove byte-exact base64 transport; prelaunch and during-ACL tampering cause zero native-worker spawns; emulated readiness failure yields failed/null references and zero authority rows.
- Failures receive one new hypothesis; a second failure is reported.

Only OS process/root/death edges are mocked. No generated C# is executed and no WFP, worker, ACL, provider, or policy API is called. An emulated failure is fixture behavior, not denial or qualification evidence.
