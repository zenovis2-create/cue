# Recovery implementation source refresh

Done means one new bounded static generation after the recovery fixes have final independent source reviews and a successful shared daemon build. The new JS/TS digest must differ from the active generation. An independent audit must verify the pointer, five artifacts, current source hashes, before/after Git source basis, and preservation of every previously retained generation and failed-stage file.

Cap: one invocation of `node scripts/reuse/cue-current-source-report.mjs`, from the repository root. Do not invoke until app and daemon/src writes are frozen. A failure is retained without a retry under this contract. Before execution, record the old pointer, historical artifact hashes, generator hash, and new source digest. After execution, retain the complete command receipt and verify old artifacts remain unchanged.

Completion requires exit 0 and ready:true plus the independent read-only audit. No native/model gate, browser check, clean-worktree claim, C#/PowerShell extraction, or full-suite rerun is implied. Earlier report and native failures remain historical evidence.
