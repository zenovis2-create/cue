# WFP collector lifecycle seam — implementation receipt

The diagnostic collector now accepts an optional injected `IReadonlyWorkerLifecycle`. A successful native subscription must exist before `StartAfterSubscription` runs. Collection-disabled and native setup/subscription failures therefore invoke no worker start. The subscription and callback remain rooted while the injected observer waits for death.

A direct typed `Dead` observation permits normal unsubscribe and collector finalization. `Alive`, `Cancelled`, and `Timeout` request stop plus another death observation so native resources can be released, but remain diagnostic `unknown` even when subsequent death is observed. Unknown or throwing start/death observations, failed stop/death verification, unsubscribe failures, and close failures retain native state and poison later collection. A proven start rejection follows the normal unsubscribe/free/close path and remains `unknown`.

Verification command:

`node --check scripts/reuse/readonly-wfp-collector.test.mjs; node --test --test-reporter=spec scripts/reuse/readonly-wfp-collector.test.mjs`

Result: 17/17 passed, comprising the original 12 collector cases and five executable lifecycle groups. `git diff --check` passed.

Final SHA-256:

- `F4FDCE9EA7BBD4E3066BDF86E04217EDE55301B66CE6FDE763FEFAB95C22EAD7` — `scripts/reuse/native/readonly-wfp-collector.cs`
- `C4AB681A8F454EEC0B6EB2BC7307D2665AA5AE073BB5C96192C65D0D13D8401C` — `scripts/reuse/readonly-wfp-collector.test.mjs`
- `B7356C304FF6D7830687918C1F39E20328A7D2D62F343CDE255B45EA2C410B26` — `DONE-CONTRACT.md`

This is an offline injected seam. It does not connect the production launcher, establish OS worker/job death, enforce an adapter's wall-clock timeout, prove network denial, or grant qualification authority. No live WFP, worker, network, model, provider, elevation, or policy operation ran.
