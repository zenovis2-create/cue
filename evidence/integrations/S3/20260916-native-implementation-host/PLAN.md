# Native implementation host plan

Done is `npx vitest run daemon/test/integration-native-implementation-host.test.ts` exit 0, `npx tsc -p daemon/tsconfig.json --noEmit` exit 0, and unchanged exact-byte hashes for every pre-existing owned file. Attempt cap: 2 implementation passes.

Every pass runs the focused test and no-emit typecheck. A failure gets one new hypothesis and one final pass; otherwise hand back the preserved logs and blocker.

Owned files are new: `app/native-implementation-host.mjs`, `app/native-implementation-host.d.mts`, and `daemon/test/integration-native-implementation-host.test.ts`. No pre-existing owned filesystem bytes exist to back up. `pre-edit-sha256.json` records that fact. Root owns startup wiring and documentation.

The executable contract is a strict factory that returns an unavailable readiness object until the host supplies an open ledger, trusted clock/evidence, exact monetary policies and observations, qualified Codex implementation and independent verifier candidates, immutable existing-file targets and requirements, requirement/final-acceptance authority, production staged-file publication, deployment staging, receipt authority, and stage/plan authorization. A successful result is an ordinary `OrchestrationHost` consumed by the existing Core driver.

No provider call, suspect Codex binary execution, local-model access, or generated-JSON permission expansion is allowed in this work.
