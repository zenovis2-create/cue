# Existing-subscription live verification

Authorization: user explicitly approved at most four test executions using existing subscription accounts on 2026-09-16. This supersedes the pending authorization in batch72. No API-key billing fallback, local Qwen activity, account creation or model downloads are authorized by this run.

Done: bounded, durable attempt records (maximum four, reserved before spawn), exact installed executable identity, subscription-mode preflight, response/event and local process-exit evidence, deterministic output verification, and independently reviewed results reflected in the original checklist without upgrading unproven lifecycle/billing/optimization conditions.

Plan: first one short no-tool normal task per available subscription CLI. Reserve remaining capacity for independent result checks or a diagnosed follow-up scenario. Every provider launch consumes a slot even on error or uncertain completion; no automatic application retries. Metadata/help/auth-status preflight does not consume a model execution slot. Root is the sole live executor; workers may implement/test offline and review only.

Attempt cap: four live executions total for this authorization, not four per provider or per shell command. Two edit passes per bounded offline hypothesis; preserve failure evidence and diagnose a new correction if needed. Each offline pass runs focused Node tests; each live execution records preflight, exclusive slot claim, bounded stdout/stderr, result validation, timeout/termination and final slot state. Unknown remote terminal/billing remains unknown.

Sources: the installed signed CLI help receipts in the prior batch and [official Codex configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference) for forced ChatGPT login, disabled shell/web tools and per-provider request/stream retry controls. Existing configured model names are checked before choosing a test model.

Root owns call budget, execution, report and six authoritative documents. Sol workers own only assigned preflight/runner files. No source credentials or session tokens are printed or included in evidence.
