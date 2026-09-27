# Cue promo copy (final paste)

Source: marketing bot · not related to Maestro Cue  
Repo: https://github.com/zenovis2-create/cue

## Positioning (one line)

Cue is a security-isolated desktop coding agent for Windows 11: natural-language goals, approved folders only, Codex CLI under capability-zero AppContainer isolation.

## Show HN

**Title**

Show HN: Cue – Windows desktop coding agent sandboxed with AppContainer (Codex CLI)

**Body**

I built Cue, a Windows 11 Electron app for running natural-language coding goals through Codex CLI — but only inside folders you explicitly approve.

Why I made it: most coding agents inherit a broad desktop session. Cue starts from capability-zero AppContainer isolation. You approve an execution envelope (work folders + scope); after approval that envelope does not expand. Credentials are not written into the UI or a ledger.

What it is / isn’t:
- Is: a local desktop shell around Codex CLI with hard folder boundaries
- Isn’t: cloud agent SaaS, “autonomous anywhere,” or related to Maestro Cue (different product)

Stack / constraints today: Windows 11, Electron, Codex CLI, AppContainer (capability-zero), approved-folder execution only.

Repo: https://github.com/zenovis2-create/cue

I’d love feedback from people who care about agent sandboxing — what’s missing for you to trust a desktop coding agent?

## Reddit

### r/LocalLLaMA

**Title:** Cue: Windows 11 desktop coding agent with capability-zero AppContainer isolation (Codex CLI, approved folders only)

**Body:**

Sharing an early open project: Cue is a Windows 11 Electron app that turns natural-language coding goals into work that can only run inside folders you approve.

It wraps Codex CLI and runs under capability-zero AppContainer isolation. You approve an execution envelope up front; after that, the scope doesn’t silently grow. Credentials aren’t stored in the UI or a ledger.

Not a cloud “do anything” agent, and not related to Maestro Cue.

Repo (looking for security-minded eyes): https://github.com/zenovis2-create/cue

Curious how you’d harden this further for local/agent workflows.

### r/programming

**Title:** Cue – sandboxed desktop coding agent for Windows 11 (AppContainer + approved work folders)

**Body:**

Cue is a Windows 11 Electron app for natural-language coding goals via Codex CLI, constrained to approved work folders.

Security model in short:
- capability-zero AppContainer isolation
- execution envelope approved before work starts; does not expand afterward
- credentials not recorded in UI/ledger

It’s an early open release (security isolation is the point, not growth claims). Unrelated to Maestro Cue.

https://github.com/zenovis2-create/cue

Feedback welcome — especially from folks who’ve shipped sandboxed desktop tooling.

## X / Twitter

### English

1/ Cue is a Windows 11 desktop coding agent: natural-language goals → Codex CLI, only in folders you approve.

2/ Security model: capability-zero AppContainer isolation. You approve an execution envelope; after approval it doesn’t expand.

3/ Credentials aren’t written into the UI or a ledger. Local desktop shell — not a cloud “run anywhere” agent.

4/ Not related to Maestro Cue. Different product, different problem.

5/ Early open release. If you care about sandboxed coding agents on Windows: https://github.com/zenovis2-create/cue

### Korean

1/ Cue는 Windows 11용 데스크톱 코딩 에이전트입니다. 자연어 목표를 Codex CLI로 실행하되, 승인된 작업 폴더 안에서만 돌아갑니다.

2/ 보안 모델: capability-zero AppContainer 격리. 실행 봉투(폴더·범위)를 먼저 승인하고, 승인 이후에는 범위가 커지지 않습니다.

3/ 자격증명은 UI·원장에 기록하지 않습니다. 클라우드 “어디든 실행” 에이전트가 아니라 로컬 데스크톱 셸입니다.

4/ Maestro Cue와는 무관합니다. 다른 제품입니다.

5/ 아직 초기 오픈입니다. Windows에서 격리된 코딩 에이전트에 관심 있으면: https://github.com/zenovis2-create/cue

## Product Hunt

**Tagline:** Sandboxed desktop coding agent for Windows 11

**Short description:** Cue runs natural-language coding goals through Codex CLI inside approved folders only — capability-zero AppContainer isolation, a fixed execution envelope, and no credentials written to the UI or ledger. Built for people who want a local coding agent with hard boundaries. (Not related to Maestro Cue.)
