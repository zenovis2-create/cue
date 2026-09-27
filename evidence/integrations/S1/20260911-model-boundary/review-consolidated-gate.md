# Independent consolidated native gate review

Date: 2026-09-11. Reviewer: /root/cue_fit, read-only diff/evidence review; /root transcribed the verdict and checked artifact attribution. Maker: /root/transport_review.

Gate: build exit0; four focused files, 9 PASS, exit0, 43.67s, 18:01:18 KST. Files are integration-model-boundary, integration-model-boundary-qualification, integration-model-boundary-process-limit, integration-model-boundary-hardkill.

The legacy case retains seven filesystem errno assertions and executes/preserves child and network diagnostics. It no longer requires undocumented Node errno values to establish confinement. Dedicated tests retain actual Job ACTIVE_PROCESS_LIMIT observation, unknown when that event is absent, exact token/Job/SID observations, module-free RX ACL readback, unchanged host files, controlled host pre/post TCP nonces with no child nonce, and hard-kill cleanup. No production source or scanner allowlist was changed for consolidation.

Evidence is separated deliberately:

- controlled-qualification-231ea264-3a0f-4cd6-9ba4-1fc83a81d2b9.json/.jsonl contain the fixed-client controlled qualification cases. Its M2-M3 probe has pid/files/network fields.
- legacy-diagnostics-7db1819f-9864-4c7f-b4a8-9625817ee11f.json contains the legacy child UNKNOWN and network ETIMEDOUT diagnostics, scoped as filesystem regression. A paragraph of the reviewer's initial handoff conflated these paths; root verified and corrected the attribution here.
- Previous failing executions remain preserved and are not retroactively marked passed.

Reviewed hashes:

| File | SHA256 |
|---|---|
| integration-model-boundary.test.ts | e175e3b95bb9ce52e81ac07157fb55441c83b4e89e86a9cee1206406a4b213fc |
| integration-model-boundary-qualification.test.ts | b8366777c134b03ca0f10b179228e83d5a6c6446adc7976a73feb939021a16c9 |
| integration-model-boundary-process-limit.test.ts | dc1668503413148b408b407a0b3177c3c0a914c3a24104460806de66392d6882 |
| integration-model-boundary-hardkill.test.ts | ce59c5c117e8afc40cb6582228d2448fb8eea0caa432b185566ce7e9f5d3d365 |
| model-only-launch.ps1 | 5a2dc5c7019e6ddd5dfa44554056cfe7bfa5b18d068dbe29e58a28c1da973060 |

Verdict: PASS for the focused regression/evidence consolidation. No all-protocol/B3/provider guarantee or candidate eligibility is issued by this review. Canonical subject binding and actual host admission remain separate work.
