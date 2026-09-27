# Launch binding design audit

2026-09-11. Read-only audit by `/root/cue_fit`; transcribed by parent. This is a design finding, not capability qualification or test execution.

The existing measurement helper hashes supplied files and detects open-file drift. It does not bind later staged or executed bytes to the measured subject. Both fixed executors previously supplied only the Node executable pin to the native launcher.

Required next implementation:

- Freeze the host-measured control bundle: Node, launcher, guardian, selected fixed client and checker core where applicable. Include adapter/enforcement/policy/probe/runtime components in the full MeasurementSubject.
- Pass expected hashes from that frozen bundle. Do not replace expected pins with newly observed hashes during launch.
- Have the trusted launcher verify staged bytes before resume and report expected/actual hashes with actual native process identity.
- Verify guardian bytes before starting it, while preserving its responsibility for cleanup before private roots are created.
- Treat trusted installed control paths outside an agent's writable scope as a prerequisite. Hashing a launcher does not make a writable launcher trustworthy.
- Do not require the parent to reread inaccessible private AppContainer files; trusted native expected/actual reporting provides the bridge.
- Keep provider identity/behavior and accepted task artifacts separate from client boundary qualification.

The deterministic checker can use existing candidate/attempt/subject, checker ID/revision/contract, input/output digest, verifier stage envelope and reviewer principal fields. It must not impersonate a Qwen/LLM principal. Existing runtime kind restrictions still require a concrete host composition decision; this audit does not introduce a new candidate kind or issue evidence.

Source hashes observed by reviewer before the following pin implementation:

| File | SHA-256 |
|---|---|
| daemon/src/measurement-subject.ts | 57566FBF0CE1554E196BAD6A77AAAAB698841029EFC8B6FB959257A5760FDD1 |
| daemon/src/measurement-artifacts.ts | 24C9BBE71E671D75C19C072D74106874E887568531616A07B7052CD8D57DF88E |
| daemon/src/adapters/isolated-local-model.ts | 6A1BC1D5ABADFC016536A82ADB24DA094080CF8B5E9469F50A28C0BDA305008B |
| daemon/src/adapters/isolated-json-checker.ts | 81F976C364CCCAF26A67C1B1F6E67A18FC610500E0500051F910FF2BF3AC1D66 |
| daemon/src/json-checker-client.cjs | F0A5FE10E9C3E689D9529ED6197FB2FCD1995DC9C2C35D2A259F216F38584484 |

Current qualification, provider confinement, full default host and product completion remain unclaimed.
