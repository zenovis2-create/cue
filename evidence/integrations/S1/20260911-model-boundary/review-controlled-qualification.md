# Independent controlled qualification review

Reviewer: /root/cue_fit (read-only source/evidence review). Transcribed by /root from the reviewer's terminal result, 2026-09-11. No additional provider or AppContainer call in this review.

Evidence: controlled-qualification-7700edc6-1d9e-4245-ae1d-ce359d306b74.json and .jsonl. Affected test execution: 1 PASS / 2 SKIP, exit0. Test SHA256 b8366777c134b03ca0f10b179228e83d5a6c6446adc7976a73feb939021a16c9; launcher SHA256 5a2dc5c7019e6ddd5dfa44554056cfe7bfa5b18d068dbe29e58a28c1da973060.

The module-free host ACL helper uses File.GetAccessControl and GetAccessRules with SecurityIdentifier. A prior isolated host-only check verified those APIs work without the failing Microsoft.PowerShell.Security autoload. The earlier failed experiments and missing raw data remain documented; the SID representation issue was not their sole established cause.

Observed current-path evidence:

- All16 create/append/overwrite/delete attempts across work/profile/actual TEMP/outside returned EPERM; host post-exit target contents remained unchanged and forbidden files absent.
- Pre/post ACL observations found the exact AppContainer SID, RX mask1179817 (0x1200A9), and no writable allow mask in inspected package rules.
- Suspended native observation bound PID92496, SID, cap0, Job flags8200, active-process limit1, exact member PID, and no loopback exemption.
- The same owned TCP listener received both host control nonces and no child nonce; the confined child reported no successful connect or send.
- Private task root and profile absence were observed after cleanup.

Verdict: PASS for the narrow controlled M2/M3 observation of this source path. ETIMEDOUT alone is not the basis. This is not B3 packet-drop proof, all-protocol experimentation, provider confinement, complete M1 evidence, a canonical measurement subject, or issued candidate eligibility. An absent process-limit event remains unknown for that observation.

The reviewer supports replacing the obsolete error-code-only child/network qualification assertions with their dedicated native process-limit and controlled network evidence, preserving historical failures. Do not add an UNKNOWN/ETIMEDOUT allowlist or silently skip required coverage.
