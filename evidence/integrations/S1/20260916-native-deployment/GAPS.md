# Native protected-startup authority gaps

## Intended production path

Protected startup already owns the application generation guard, opens the real daemon ledger, and supplies the orchestration factory consumed by `createCueCore`. A native deployment branch at that boundary must construct `createNativeImplementationHost` from trusted runtime authorities and then pass the result through the existing deployment-staging wrapper. Selecting native mode must bypass the local generated-JSON settings and health probe so that it cannot contact or start the disabled local model.

No production edit was made in this batch because the current source cannot reconstruct the required native authority from persisted state. Adding a resolver that always returns unavailable, or succeeds only when tests inject callbacks, would leave the actual application path unreachable.

There is also an execution-contract blocker after authority construction. The native host grants the implementation stage `file_change` only. The default `launchHostCodexRun` implementation path captures its before/after workspace snapshots by calling `launchAppContainerWorker`, whose preflight requires the stage envelope to contain `command`. The same worker boundary handles controller workspace tool calls. Therefore a correctly authorized native implementation candidate currently fails at the before snapshot prior to RPC/model execution. The batch75 read-only verifier special case avoids snapshots only for an exact empty-authority verifier envelope; it does not change implementation behavior.

Granting `command` is not an acceptable configuration workaround. The writer admission boundary deliberately rejects command-capable writes because their staging/publication semantics are not classified. A follow-up implementation contract must provide host-owned snapshot observation outside candidate command authority and route structured existing-file changes through the staged `file_change` contract without granting arbitrary shell execution. Until that contract is implemented and tested through the real launcher, even a future valid native startup authority record cannot complete an implementation run.

## Existing facts required by the native host

The current `createNativeImplementationHost` contract requires all of the following before it returns an available host:

- two distinct qualified candidate records and their exact account references;
- current measurement subjects and capability-evidence references for both candidates;
- a Codex executor for each role, including exact binary/model/tool identity and per-attempt binding resolution;
- optional issued provider-installation descriptors bound to the exact executor binary and current subject;
- qualified observations and four exact monetary selection-policy references;
- trusted accounting bounds, reservations, receipts, and final-billing verification;
- a fixed requirement/checker contract, acceptance authority, and requirement-checker resolver;
- runtime run authorization and independent cleanup observation;
- publication authorization for the staged existing-file contract;
- orchestration plan, claim, stage, and receipt authority.

Ordinary configuration is intentionally insufficient. Candidate IDs, paths, policy IDs, or an enabled flag cannot create authentication, qualification, billing truth, cleanup proof, acceptance, or publication permission.

## Why current persisted state is insufficient

`ProviderInstallationDescriptor` issuance is process-local. `identifyProviderInstallation` records issued descriptors in a private `WeakMap`; after restart, protected startup cannot reissue one without trusted expected executable hash, signer, version, and auth-profile path inputs. Existing settings do not contain a trusted provider-measurement recipe.

Capability-evidence rows can support admission after startup has rebuilt the exact current subject. They do not define how to collect that subject or identify the provider installation. Per-run account-identity rows are execution bindings, not startup credential or authentication authority.

Selection policies and deployment channels describe candidate choice. They do not supply candidate executors, provider installation identity, observations, pricing authority, cleanup verification, billing verification, acceptance, or publication authorization.

The generated-JSON bootstrap supplies local-model-specific implementations of several callbacks. Those callbacks are tied to its isolated local model/checker, local accounting, generated-output acceptance, and control bundles. Reusing them for Codex implementation/verifier roles would change their authority meaning and would fabricate qualification.

No fixed built-in registry currently maps a protected native deployment identity to all of the runtime callbacks and measurement recipes above. No existing protected setup operation persists the complete demanded facts in a form that protected startup can validate and reissue after restart.

## Minimum follow-up boundary

A future implementation needs a protected setup authority and a fixed built-in resolver. The setup result must identify the exact implementation/verifier candidates, provider measurement inputs, subject collector revision, evidence/checker references, policy references, accounting authority, and the revisions of the fixed cleanup, billing, acceptance, publication, and orchestration authority implementations. At startup, the built-in resolver must validate those demanded facts, remeasure current installations and subjects, read current evidence/policies, and construct callbacks from fixed code rather than persisted JavaScript or module paths.

How that protected setup is persisted and protected must follow the existing protected-installation threat model and a separately approved design. DPAPI, signatures, a new ledger schema, or another sealing mechanism are possible future choices, not requirements or approved design in this record.

Until both the authority resolver and the implementation execution contract exist, native protected startup must remain unavailable. The reviewed native host composition validates a caller that already possesses all required authorities, and its read-only verifier can use the corrected transport path, but the default application cannot truthfully manufacture the authorities or complete the implementation leg.
