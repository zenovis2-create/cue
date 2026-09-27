# Original reuse/S0 contract audit — independent review

Review date: 2026-09-15 (Asia/Seoul)

## Scope and verdict

This was a bounded, read-only audit of the original R01, R02, R04, R06, S0-02, and S0-03 rows in `docs/integration/REMAINING_EXECUTION_MAP.md` against current documentation and source. No test, provider, model, local endpoint, candidate CLI, installation, authentication, or account call was run.

**S0-02 may close on the exact original condition.** The condition is: “agy, grok build, nlm mcp cli, hermesagent, openclaw, paseo, orca, herdr 및 pi의 정확한 제품·역할·미지원 조건을 등록한다.” This is an identity/role/unsupported-condition registration task. It does not require runtime catalog enrollment, installation discovery, authentication, qualification, enablement, admission, dispatch, or any account grant.

R01, R02, R04, R06, and S0-03 remain **OPEN** for the actionable gaps recorded below.

## S0-02 nine-row evidence

Each requested term occurs exactly once in `docs/reuse-decisions/CANDIDATE_INVENTORY.md`. Every row is inactive and unqualified; none grants supported runtime status, credentials, an account entitlement, execution permission, or dispatch authority.

| Requested term | Canonical registered identity/revision | Role and public boundary | Explicit unsupported/unmeasured condition | Status |
|---|---|---|---|---|
| `agy` | Google Antigravity CLI, `google-antigravity/antigravity-cli` @ `e4afe6b6f3aa115b1ba31e26db6508a23b5e42e5` | coding-agent CLI/orchestrator; managed JSON/NDJSON subprocess candidate | installed binary/version, auth, protocol and cleanup unmeasured; no public-repo license grant established | inactive / resolved-unqualified |
| `grok build` | SpaceXAI Grok Build, `xai-org/grok-build` @ `37949780c144e37df692e3d669051a21fec24f20` | coding-agent CLI/runtime; ACP stdio candidate | installed artifact, auth and lifecycle unmeasured | inactive / resolved-unqualified |
| `nlm mcp cli` | user-selected alias `jacob-bd/notebooklm-mcp-cli`; canonical `jacob-bd/gemini-notebook-mcp-cli` @ `03f7812c243f4d6ff732e2a485e6b9d35540f660` | Notebook service CLI/MCP server, not a general model; `nlm`/`notebooklm-mcp` | package/source correspondence, auth, MCP start/cancel, service side effects and complete license conditions unverified; `tmc/nlm` not selected | inactive / resolved-unqualified / user-selected |
| `hermesagent` | user-selected `NousResearch/hermes-agent` @ `2f21d29f4446134b51b7e6b1d2f515502bc0ae5e` | agent/gateway; public ACP boundary is only a candidate, while Hermes owns model/tools/session | installed artifact/source correspondence, auth, protocol and tool/child/session cleanup unverified; HermesForge not selected | inactive / resolved-unqualified / user-selected |
| `openclaw` | `openclaw/openclaw` @ `a0148f9a81c6db230002d08838f6732b6358fcba` | agent platform/Gateway; WebSocket client boundary | Gateway identity/auth and Gateway-owned session/worker cleanup ownership unmeasured | inactive / resolved-unqualified |
| `paseo` | `getpaseo/paseo` @ `fa93c4290eaa87ae58452ab6e2012f85ae6e0c6b` | agent/workspace daemon; SDK/daemon WebSocket boundary | installed identity and Paseo-owned child/worktree lifecycle unmeasured | inactive / resolved-unqualified |
| `orca` | already-established local Orca product identity; public comparison `stablyai/orca` @ `556a7772ed7bdf67d5f811449d07f06dcd4285f4` | local Orca-managed worktree/terminal/task runtime; local version-matched guide is the authority | local artifact/package public provenance and version-matched schema unverified; neither Stably nor `xiws/orca` is attributed to the local product | inactive / local resolved-unqualified; public provenance unresolved |
| `herdr` | `herdrdev/herdr` @ `9ad65d9031e8cb16a7b553c0e6f74809e9811e92` | persistent terminal workspace/runtime; CLI JSON or local socket/pipe candidate | installed identity, Windows pipe ACL, protocol/state semantics and cleanup unmeasured | inactive / resolved-unqualified |
| `pi` | `vastsa/PI-Desktop` @ `2b1ebb9336a871688a8aee0a17a5214ed7a41a25`; embedded Pi Harness stable `v0.85.1` @ `d981de1229ef899957bbe968bc8dcda02a21f477` is not a second registration | local-first desktop app; opt-in loopback MCP boundary | installed identity and MCP opt-in/auth/authority/lifecycle unmeasured | inactive / resolved-unqualified |

The user selections for NLM and Hermes are independently preserved in `evidence/integrations/S0/20260912-confirmed-identities/report.md`: the original NLM URL remains an alias to the pinned canonical repository, and Nous Hermes is selected over the different HermesForge product. Those choices remove identity ambiguity only.

`daemon/src/integration-catalog.ts` remains a host-observation catalog for installation, protocol, authentication and subject freshness. It contains no rows for these nine inactive research identities. That absence is correct for S0-02: documentation registration does not imply runtime support or account access.

## Remaining original-contract gaps

- **R01 — OPEN:** individual source pins and fixture implementations exist, but R-01 remains `defer`. There is no single adoption manifest binding each adopted/limited component's canonical source, immutable revision, exported API and actual Cue product import seam. Close by finalizing the disposition and rejecting any unpinned or seam-mismatched load.
- **R02 — OPEN:** current decisions record top-level licenses and several Windows/runtime/install caveats, but dependency/asset notices, complete install/run side effects and an update owner are not complete for every non-rejected candidate. Close with source-pinned BOM/impact rows and fail-closed validation of every required field; record explicit not-applicable reasons for rejected/deferred components.
- **R04 — OPEN:** `docs/reuse-decisions/R-04.md` calls the strict native RoleSpec formatter a bounded adoption, while `docs/INTEGRATION_BACKLOG.md` says product incorporation is incomplete. `parseRole`/`serializeRole` is consumed only by reuse fixture tooling, not app/daemon product source. Close by wiring a thin product adapter with source revision, patch list and Cue contract tests, or by correcting the disposition to fixture-only rather than adopted.
- **R06 — OPEN overall:** current model-runtime source already fingerprints its source/app/policy/test/package/native closure, rejects subject/evidence drift before launch, and returns a closed refusal when a pinned candidate is unavailable. That is a complete subcondition for the current model boundary only. The generic reuse gate remains open because R01/R02/R04 reuse seams are not bound into an adoption subject; catalog `sourceVersion` is not compared and catalog `subjectDigest` may be null. Close by binding the adoption-manifest digest to evidence, requiring it for adopted components, and proving revision/hash drift produces zero dispatch followed only by an independently admitted pinned fallback or closed refusal.
- **S0-03 — OPEN:** prior identity review supplies public source commits and top-level license facts, but explicitly lacks installed artifact hashes, adopted dependency locks and a complete third-party asset/license/notice inventory. Close with an external BOM keyed by candidate, source revision, artifact digest, license, notices and assets, plus refusal to adopt an incomplete row. No live/provider call is required for that documentation/source-package task.

## SHA-256 source pins

| Source | SHA-256 |
|---|---|
| `docs/reuse-decisions/CANDIDATE_INVENTORY.md` | `0d132fd1f15894d67c8ce4dd6208a3e03d642787c55ae247e2f8e36d2f225ee5` |
| `evidence/integrations/S0/20260912-confirmed-identities/report.md` | `84e3e1ebd340e4b8a17d078263d421bb61dfd0aa7a1d1b445c0c20582dbca861` |
| `daemon/src/integration-catalog.ts` | `04ebca37b010aa0c89df0f848533abaaf8685f6eb9dee18e75b38810f0963a14` |
| `evidence/integrations/S0/20260912-candidate-identity/review.md` | `bee13d1a561a2df19a8ece77f7f07acdf533cc34a351f0375aca4f6f5a3e7e68` |
| `docs/integration/REMAINING_EXECUTION_MAP.md` | `a4ceaadb9d3d464a537a9602dd1922d58cac67cf52a22d8f7d465fcaef8ddef5` |

These hashes pin the exact bytes audited. They do not convert any external repository pin into an installed binary identity or grant account/provider authority.
