# Explicit paid-exploration consent plan

Done means an orchestration preparation with a trusted, frozen exploration summary shows one separate unchecked Korean consent control containing only candidate, task count, and the exploration subcap (with an explicit statement that the subcap is included in the total budget). The control is absent for ordinary runs, resets on every new preparation, preparation error, and stop, and stale preparation responses cannot restore prior consent. Approval forwards `allowExploration: true` only from a deliberate checked state captured for the same prepared run.

Core done means `approve(runId, options?)` accepts only no options or an exact own-data plain object `{ allowExploration: true }`: proxies, accessors, inherited objects, extra keys, false, mismatched runs, consent without configured exploration, and configured exploration without consent all fail before writes. For configured exploration, `orchestration.approveExploration(runId)` runs inside the same existing SQLite transaction, before the normal `approval_event` insert. Ordinary approval remains compatible. The prepared approval result, including `threeLines`, orchestration summary, and exploration summary, remains frozen; UI text never includes authorization/consent digests, credential references, or source IDs.

Maximum implementation revisions: 3. Each pass runs the focused DOM/Core/IPC tests: `npm --prefix daemon exec -- vitest run test/integration-driver-core.test.ts test/p10c-renderer.test.ts test/p11-electron-surface.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`. The daemon build gate `npm --prefix daemon run build` is requested from the root's shared serial build slot before qualification. Every pass checks actual Core plus injected host/driver configuration, atomic rollback, missing/invalid consent, ordinary compatibility, exact preload/IPC forwarding with malformed getter/proxy inputs making zero Core calls, checkbox display/copy/reset/stale-response behavior, and absence of internal identifiers in rendered text. A failed pass requires a new hypothesis. If the measured gate regresses, restore the recorded full-byte preimages. After three failed revisions, stop and hand the evidence to the human.

No provider, model, native helper, Electron, browser launch, or live network call is permitted; local model stays off. Maker and independent reviewer remain separate.

Full-byte preimages were copied under `preimages/` before owned source edits. SHA-256 values:

- `app/core.mjs`: `cd00ba74e58efe44adb8687b6b8e0e48eda9be7a8566de4aae3cedcadbcce70c`
- `app/core.d.mts`: `1ca633427a555708f3e007bf0f26831fcb036a0a24a80ee52a8b09f9ac6d48a5`
- `app/ipc.mjs`: `441c532c713a055b2856864c2d2c8c519c4d2cebbff7b71aecfadd946551b1c4`
- `app/ipc.d.mts`: `c3b0c9fafacab2b341eb561679363e622a8b332be7993756b44ad311e2b7f75f`
- `app/preload.cjs`: `baec01dbc7dfd3fa7665887a02b2b9a0b91d4316d90b0f517d7c9902b843fedc`
- `app/renderer/index.html`: `2561be90fdb53005aa7df10e124f7d4b3ae71a977b15166fcea688fab0216206`
- `app/renderer/renderer.js`: `9d233d722bbd3708d9be93b0595ca328985ae9649d13ce257f66b8bc4bbc2836`
- `app/renderer/styles.css`: `606890ba693d219e6d4a4e014b87de470550b6b6444b34fd5702b2b76e141344`
- `daemon/test/integration-driver-core.test.ts`: `a290b5bf5201646bf3ea4f99f9bf22e885ac072e3c3040cb2a79b1cba7acd165`
- `daemon/test/p10c-renderer.test.ts`: `477c887e1d607e7cb3f229960ef512b846e3dced37b109b88c78c64e44704048`
- `daemon/test/p11-electron-surface.test.ts`: `b19f178ced52cb1ca164da828ca98abe1f6cf66e7cc552e58ab052f160c73f1e`
