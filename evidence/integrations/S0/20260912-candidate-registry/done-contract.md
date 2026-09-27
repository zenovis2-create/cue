# S0 candidate registry — done contract

Date: 2026-09-12 (Asia/Seoul)

## Completion definition

1. Only the independently consolidated `resolved-unqualified` candidates are tracked as inactive and non-executable.
2. `nlm mcp cli` and `hermesagent` remain unresolved and are neither registered nor activated.
3. The established local Orca identity is kept distinct from any public repository provenance.
4. No candidate is described as qualified, enabled, installed, admitted, or otherwise executable.
5. `docs/INTEGRATION_CHECKLIST.md` lines 28 and 30–32 remain open overall.
6. Focused tests, documentation links, TypeScript/build, and `git diff --check` pass.

## Verifier loop

- Attempt cap: 2.
- Every pass: focused catalog tests, TypeScript/build, documentation-link checks, and `git diff --check`.
- Failure response: make at most one correction using a new hypothesis and rerun the complete pass. If the gate does not improve, stop and record the evidence for a human reviewer.
- Keep criterion: retain a change only when the measured gate passes or improves; this record does not issue a PASS verdict.

## Scope decision before editing

`daemon/src/integration-catalog.ts` accepts host-measured installation, protocol, authentication, and subject observations. It has no field for a public-source-only `resolved-unqualified` identity or for provenance kind. Adding public repository observations there would blur identity research with host availability. This pass therefore updates the product's inactive candidate documentation and backlog decision rows only; it does not extend the runtime registry API.
