# External reproduction guide — Cue

This one-page guide helps outsiders clone Cue and independently verify published claims against a known commit. Campaign KPI **external repros** count when someone outside the maintainers reports results (GitHub issue, PR, or comment with evidence).

## What this guide verifies

Claims that match the project README (do not treat this as a security certification):

- Windows 11 Electron desktop app; Codex-powered; workspace actions run through **capability-zero AppContainer workers**
- Host process handles model communication — **not** fully offline; **not** “the entire app is sandboxed”
- Execution envelope **does not expand after approval**; workers operate in the **approved worktree only**
- **P3-16** network policy is **detect-and-stop**, not syscall enforcement; capability-zero workers still get **OS socket denial** separately
- Demo is a **34s edited** recording; **current UI is Korean** (demo UI was translated for capture)
- **No** paid CTAs, Calendly, Sponsors, or revenue pitch in this guide
- Retained P12 evidence is **bound to a sealed source snapshot**; re-running checks on a newer tree does not auto-certify that tree

## Requirements

- **Windows 11**
- **Node.js** and **npm**; native deps may need a compatible Windows build toolchain (Visual Studio / Build Tools as usual for Electron/native modules)
- For **live Codex** paths only (Tier C): Codex CLI **0.153.0** and authenticated profile at `%USERPROFILE%\.codex\auth.json`
- Git, and enough disk for `node_modules` + Electron

Tier A (preferred first) does **not** require a live model or paid API usage.

## Clone & install

```powershell
git clone https://github.com/zenovis2-create/cue.git
cd cue
git rev-parse HEAD   # record this SHA in your report
npm ci
npm --prefix daemon ci
```

Optional: `npm start` launches the app (workspace picker on first run). Live UI is not required for a valid Tier A external repro.

## Tier A — low-cost / no live model (preferred first)

Run these on Windows 11. They are the default path for an external repro.

```powershell
npm ci
npm --prefix daemon ci
npm test
npm run evidence:p12:stop
npm run evidence:p12:mutation
npm run evidence:p12:source
```

| Command | What you should expect |
| --- | --- |
| `npm test` | Daemon Vitest suite. Win32 containment tests **skip on non-Windows**; on Win11 they should exercise containment paths. |
| `npm run evidence:p12:stop` | Stop / reclamation with **real capability-zero AppContainer workers** and a **deterministic** host-controller fixture (no live vendor model A/B). |
| `npm run evidence:p12:mutation` | Regression sensitivity: fail-fast, writer-lifecycle, and parent-death safeguards in disposable copies outside the checkout. |
| `npm run evidence:p12:source` | Source manifest binding for the staged tree (excludes evidence). |

**Expected artifacts** (under `evidence/P12/` after a successful local run, or compare to published ones):

- `p12_stop_result.json` — controller / worker termination and reclamation
- `p12_mutation_result.json` — mutation / regression sensitivity
- `p12_source_manifest.json` — staged source tree binding

Published release artifacts in-repo are tied to the sealed v0.1 snapshot; your run proves **your** checkout behaves as claimed, not that you re-sealed the historical verdict.

## Tier B — optional Electron UI proofs

Not required for a valid external repro, but useful if you want window-level checks:

```powershell
npm run evidence:p12:electron
npm run evidence:p12:cancel
```

| Command | What it checks |
| --- | --- |
| `evidence:p12:electron` | Real Electron window / runtime security values (see `p12_electron_window_result.json` + companion PNG) |
| `evidence:p12:cancel` | Fail-closed behavior when the first workspace selection is canceled (`p12_electron_cancel_result.json`) |

## Tier C — optional live Codex (costs money)

**Not required** for a valid external repro. Live model runs can incur costs.

```powershell
npm run evidence:p12:manifest
npm run evidence:p12
```

| Command | What it checks |
| --- | --- |
| `evidence:p12:manifest` | Full tool manifest and hashes from the pinned Codex outbound request (`p12_manifest.json`) |
| `evidence:p12` | Two distinct live goals **A/B** with a real Codex model (`p12_live_result.json`: goals, envelopes, output hashes, PIDs, provenance) |

Cue pins and verifies the default Codex executable SHA-256. Alternate `CUE_VENDOR_CODEX` requires matching `CUE_VENDOR_CODEX_SHA256`. Credentials must not appear in UI, worker env, or ledger.

## How to report

Open a GitHub issue (or PR / comment) on [zenovis2-create/cue](https://github.com/zenovis2-create/cue) with evidence. Suggested fields:

| Field | Example |
| --- | --- |
| **OS build** | Windows 11 build number (`winver` / `[System.Environment]::OSVersion`) |
| **Node version** | `node -v` / `npm -v` |
| **Commit SHA** | `git rev-parse HEAD` (link the commit) |
| **Tiers ran** | A / B / C — list exact commands |
| **Pass / fail** | Per command; note skipped tests if any |
| **Evidence** | Paths under `evidence/P12/`, or truncated JSON hashes / key log excerpts |
| **Surprises** | Anything that differs from README **Current limits** (P3-16 detect-and-stop, P4-2 cwd, P6-3 Buzz, nested subprocesses, goal verification scope) |

Do not paste secrets (`auth.json`, tokens). Hashes and redacted logs are enough.

## Counting rule for maintainers

An **external repro** counts when **all** of the following hold:

1. **Independent person** — not a Cue maintainer / campaign operator
2. **Public report** — issue, PR, or comment on the repo (or clearly linked public post)
3. **Links a commit SHA** (or release tag that resolves to a commit)
4. **At least Tier A**: `evidence:p12:stop` **or** `npm test` **pass on Windows 11**

Tier B/C strengthen the report but are optional. A demo video alone is not an external repro.

## Links

- [README — Verification](https://github.com/zenovis2-create/cue/blob/main/README.md#verification)
- [docs/DEMO.md](https://github.com/zenovis2-create/cue/blob/main/docs/DEMO.md) — storyboard / capture notes (34s edited demo; UI Korean in app)
- [evidence/P12/](https://github.com/zenovis2-create/cue/tree/main/evidence/P12) — published stop, mutation, source, electron, cancel, manifest, live, verdict artifacts
- Sealed v0.1 snapshot example: commit [`51d1e36`](https://github.com/zenovis2-create/cue/tree/51d1e36cacc30bc8ae6040284ea74c7814fb20fc) (historical binding; new trees need their own bind)

Discovery only (not required for reproduction):

- [Product Hunt launch](https://www.producthunt.com/products/cue-24?launch=cue-bea6eb17-4a05-470a-b95e-329e9a81ef8d) · [Dev.to AppContainer write-up](https://dev.to/_76dca2218d5cc98e685ca/why-cue-still-uses-appcontainer-after-codex-rejected-it-for-windows-agents-5h1b) — discovery only; this guide does not sell anything

---

## 한국어 TLDR (유지보수자용)

- 이 문서는 **외부인이 Cue를 clone해서 주장을 독립 검증**하는 1페이지 가이드입니다.
- KPI **external repro** = 유지보수자 외 인물 + 공개 리포트(이슈/PR/댓글) + 커밋 SHA + **Windows 11에서 Tier A**(`evidence:p12:stop` 또는 `npm test` 통과).
- Tier A는 **라이브 모델 불필요**(저비용). Tier B는 Electron UI, Tier C는 Codex 유료 가능 경로(선택).
- 과대주장 금지: 전체 앱 샌드박스·완전 오프라인·P3-16 시스템콜 강제·보안 인증서 아님.
- 데모 34초 편집본, 현재 UI는 한국어. 유료 CTA/Calendly/Sponsors 없음.
- 증거는 **소스 스냅샷에 바인딩**; 새 트리에서 돌렸다고 과거 verdict를 재인증하는 것이 아님.
- 리포트에 OS 빌드, Node, SHA, 실행 티어, pass/fail, `evidence/P12/` 해시·로그 요약을 받게 하세요.
