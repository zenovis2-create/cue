# PATH discovery review

Date: 2026-09-11. Discovery: /root. Independent read-only hash/evidence audit: /root/cue_fit. Root transcribed the audit and corrected its row-count typo against JSON.

inventory.json has20 rows:17 discovered command paths and3 names absent from this PATH (paseo/herdr/pi). It does not prove those products are uninstalled. The reviewer freshly checked recorded existing-path hashes, including wrappers and executables, and checked embedded-versions.json correspondence. No CLI execution, auth access or global configuration change was performed.

Multiple paths resolve the same command name for Codex, Agy, Grok, OpenClaw and Orca. Wrapper hashes identify only those files; canonical target binaries remain to be resolved. Embedded Claude metadata declares Claude Code2.1.267.0 / Anthropic PBC; this is untrusted PE metadata, not signature, authentication or eligibility evidence.

Verdict: PASS for PATH discovery/hash correspondence only. Next: represent candidates by canonical path, distinguish wrappers from native executables, resolve/hash targets without running them where possible, then verify actual protocol/auth/ownership/boundary separately. No discovered tool becomes eligible from this artifact.
