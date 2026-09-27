# Independent actual fresh Electron result review

Reviewer: broker_review, 2026-09-11. Verdict: **FAIL / workflow incomplete; cleanup unresolved**. This audit is read-only against the original state and closed backup. No new model call, retry/resume, product edit, rebuild, receipt rewrite or manual acceptance occurred.

Owned evidence: D:/Temp/User/Cue.ElectronGate.IyTVWW/evidence. Durable copies are in [live-evidence](live-evidence/result.json). Selected independent checks are preserved in [live-audit.json](live-audit.json) and [live-os-observation.json](live-os-observation.json). Completion criterion was exact result/source/ledger/cleanup accounting, not converting a partial run to success.

## Actual outcome

Qualification Electron PID 37956 exited 0, closed normally and reported eligible/confirmed cleanup. Both phases record Electron 44.2.0, Node 24.20.0, ABI 149, with userData at the owned data directory and sessionData at its electron-session child. Six live M1/M2/M3 capability rows have valid payload/observation hashes, matching before/after subjects, clean outcomes and raw journals whose stored bytes/digests still match. Subjects: checker ef86e8e38e1314fc98e75fe633f4bc808c563ad2b8f588cd647992f26c04a1ee; model fd9f159406d211212792d207380ef79c22004f9969769c13d581b5c225522b18. This is evidence audit, not an independent re-review of this reviewer's earlier collector foundation.

Workflow Electron PID 66956 eventually timed out and was terminated: code 1, closed=true, timedOut=true, taskkill status 0. The actual DOM had already reported blocked/orchestration_timeout with cleanup unverified. Screenshot capture succeeded. The runner's final workflow_attempt_count error is an audit symptom of the incomplete workflow, not proof that request counting itself caused the runtime stall.

The reopened backup contains one producer attempt, state running, cleanup_verified=0, no orchestration receipt, no checker attempt and no acceptance_final. Workflow run: 73ac27b4-b143-49b2-8a73-e2a5e867847f. Producer attempt: attempt-76fd81197c24eb0340dead193cdc459044e95f09f28b47d9. No cleanup_observation exists for this attempt. A response alone cannot settle the attempt or establish acceptance.

## Response and count evidence

Qualification persisted actual production-model outcome succeeded, text OK and usage 22 input / 37 output / 59 total tokens. Workflow persisted exactly 42 bytes of the expected formatted JSON, observed at 2026-09-11T14:17:41.299Z. Response SHA-256: 7b8d013d7fbae03576cf41a22662292c69cd7d2be94f6839b284fe2b9090c50b. Its stored metadata hash matches, binding the producer attempt, run, formatted-json target, json-format requirement, plan/policy/requirements and stage envelope digests.

Thus both intended inference phases have response evidence; the separate two-request gate allowance is finished. There is no independent provider-side HTTP request counter. One local_invocation_reservation with limit_count=2 is a committed producer dispatch intent, not proof of one total Qwen request or permission to retry. Checker and acceptance remain zero. The historical Node canary allowance is separate and unchanged.

## Independent filesystem/OS and integrity observations

At 14:23:20.440Z UTC, all 31 recorded owned PIDs returned ESRCH, including both Electron children, producer launcher 54512, qualification session launchers and the client/guardian identities available in qualification cleanup receipts. All 24 recorded qualification task/profile/parent-package paths returned ENOENT.

The workflow's random native client PID, guardian PID and profile paths were not durably captured in cleanup evidence. They cannot be reconstructed from the launcher PID after exit. Therefore the independent PID observations do not establish complete workflow native cleanup; no machine-wide absence claim or deletion was made. Owned gate state/profile/evidence remains intentionally retained.

Read-only reopened SQLite backup integrity_check is ok. Its hash matches the runner: 76cd0a9668bcc1e711af48838ad4d4187f608eb064207b937943f7392dcc2f2e. All 356 recorded installation file hashes matched during independent audit; script SHA matches the approved AD2E76151122492AC8FF1765823B384E5D559306F1B4D06C44673530A9655848. The recorded initial and final parent generation digest agree: 2c50fb39f5c064c5919dfc3b0e713173dbd1f25692ac04977290903ae42ac2d4. These checks do not infer missing runtime settlement or cleanup.

Primary result hash: 3472382f0dddb3deb8006a50436749bc3d5e78623fc3bda93f4d84434c16cff9. Observer hash: 4e3bb82f4eab7837c5ea9ffda53be3db6fa051958c2339d3c0e8559aea0d95c4. Screenshot hash: 18f1628a66be271a39103d52e32eefc35f7bb31b90bf67fabf406f4df170c1d0.

Next diagnosis must address the producer response-to-settlement/cleanup path using offline reproductions. The actual workflow gate remains unchecked. Current evidence must stay failed, with no additional model request under this gate.

## Follow-up: native identity recovery remains unavailable

Read-only follow-up found session_runtime, execution_event and orphan_session_observation empty. The only orchestration_activity is the engine-request record (timeoutMs 60000); it contains no native boundary identity. Stage envelope binds the known producer stage task/run to the owned workspace but contains no random native profile/client/guardian. Artifact kinds are only goal, goal_scope and the 16 qualification raw journals. Producer capture metadata binds semantic output provenance, not native identity.

Source confirms native profile is created with a fresh GUID; launcher emits its path and guardian/client identities through stdout frames, and the adapter retains them in its in-memory observations object. There is no separate durable ready-frame artifact in this failed workflow. The guardian receives launcher/profile data in its private launch payload, not a persisted recovery mapping. Therefore current Cue.Model-prefixed paths cannot be attributed to this attempt by name or timestamp alone. No speculative association or global enumeration/deletion was performed. Workflow cleanup stays unverified/quarantined despite the known launcher being absent.
