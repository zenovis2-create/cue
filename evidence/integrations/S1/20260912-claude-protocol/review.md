# Independent pure Claude protocol review — PASS within fixture scope

2026-09-12. Reviewer inspected the complete new source/test and maker contract without editing product code. No blocking correctness defect found within the explicitly synthetic `cue-claude-fixture-v1` contract.

Verification: `npx --no-install vitest run test/integration-claude-protocol.test.ts --reporter=verbose` — **9 PASS**, exit 0; `npx --no-install tsc --noEmit` — exit 0. No shared build, CLI subprocess, native executor, provider call or model call was performed. Tooling processes were limited to these pure test/typecheck commands.

Reviewed behavior:

- Fatal incremental UTF-8 decoding and a native byte snapshot handle split multibyte characters without invoking caller buffer/getter overrides. Proxy/shared/detached buffers reject. Total stream, per-frame and frame-count limits bound processing.
- The supported dialect requires init, exactly one assistant message or one ordered streamed text block, a matching success result and final newline/EOF. Unsupported tools, usage/identity fields, alternative stop reasons, wrong indexes/order and duplicate terminals reject.
- Canonical JSON roundtrip rejects duplicate keys/noncanonical frames; BOM, malformed UTF-8, partial EOF and oversize input leave the decoder closed after failure. Provisional text events do not constitute success; finalization is required and cannot be repeated.
- Usage and billing remain unknown, cleanup and acceptance remain unverified, eligibility remains unverified and executable remains false. The caller's `identityVerified` boolean is a fixture-shape precondition only; it is not a model identity measurement or authority token. Source import search found no app/runtime consumer granting execution from this module.
- Launch-spec argv/environment are a bounded fixture declaration with `auth: unconfigured`; they do not prove actual CLI flag support, isolated folders, authentication or an approved executable. Version 2.1.267 is the historical fixture constraint rather than a fresh installation observation.

Source SHA-256 `792C1C8CC0CBF05ED948D7B7B73FC60541D6DB332C575D617BDEBCDC94EDB241` ([source](../../../../daemon/src/adapters/claude-protocol.ts)); test SHA-256 `FABDD2DBA34C844E2886D2B3B23DDBE260FDF9C18B881D32B0CF4A11B572E97C` ([test](../../../../daemon/test/integration-claude-protocol.test.ts)).

The historical experiment `scripts/reuse/claude-launch-spec.mjs` still hashes to `57A07D016BE906F01CF2AE1D188A936CB36A036D385DF9D0EC67E86F66B4FD17`, matching [the baseline reuse review](../../S0/20260911-baseline/reuse-review.md) and the [R-02 decision](../../../../docs/reuse-decisions/R-02.md). The new implementation uses Node built-ins and local fixture patterns; no upstream implementation or current protocol compatibility was asserted or researched in this unit.

This PASS does not complete real Claude CLI integration, authentication, live schema compatibility, OS cleanup, capability admission or task acceptance. Those remain separate evidence gates.

## Product-fit assessment: limited fixture foundation

The practical reusable work is incremental UTF-8 handling, bounded byte/frame processing, sticky failures, data snapshots and explicit separation of provisional output from terminal completion. The event state machine deliberately rejects normal richer init/model/session/usage metadata and an assistant-plus-stream combination. No source-backed live dialect mapping or production adapter seam is present. It therefore duplicates/strengthens a synthetic experiment rather than establishing a usable Claude protocol adapter. Keep this as an experimental fixture foundation (or relocate it accordingly); do not check S1 actual-protocol support from these nine tests. Broader schema support requires a separately reviewed upstream contract and real captured compatibility evidence.
