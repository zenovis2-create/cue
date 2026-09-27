# Native account observation source

Read on 2026-09-16 using the OpenAI Docs skill: [official App Server authentication documentation](https://learn.chatgpt.com/docs/app-server#auth-endpoints), reached from the official developers.openai.com Codex App Server URL.

The documented account read supports an optional token refresh flag and reports account/provider information. The `requiresOpenaiAuth` field describes the active provider's requirement, not proof of a logged-in account. ChatGPT rate-limit reads expose usage windows; they do not establish a monetary charge or per-model entitlement.

Cue implementation inference: bind observations to the owned, pinned app-server process and exact installation/profile/subject/account reference; reject incomplete, stale, changed, or unauthenticated observations. Keep model entitlement separate. Do not accept a caller-authored authenticated flag or use cached account/plan/quota fields to manufacture model access.

The same official page documents `account/usage/read` as requiring Codex-service-backed authentication. The new producer uses a successful, validated response only as a scoped service-acceptance observation; this is an implementation inference, not proof of model access or billing finality. No such real service observation was performed in this batch.

This research performed no provider authentication operation, token refresh, model request, account change, or local-model access. The new producer is implemented and tested only through offline fixture processes until an actual observation is separately run within the user's authorization.
