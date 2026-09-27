# Independent windowless-launch repair review

## Verdict

**PASS offline.** The production launcher delta is exactly one creation-flag addition: `CREATE_NO_WINDOW` (`0x08000000`) is ORed into the prior `0x00080404`. No native gate, PowerShell process, AppContainer, model, provider, ACL operation, marker reset, or repin was performed by this review.

This change is a bounded launch hypothesis. It does not establish that window creation caused the prior `0xC0000142` result, identify a DLL, or authorize another native attempt.

## Preservation and exact delta

- Done contract: `E74910700B5A2A5CC2E6395242198D16B8993BC0C09B19D675684926446DBA7D`
- Archived executed launcher: `16813F36A1DCBED9EAF4014A324EDCF72289693F5C8FC92A8F27512038A13774`
- Archived executed PATHEXT manifest: `7C453E3C739B56721F4AF4ED9B6CC895AE6289DF01836AA934CD06F54041074A`
- Current source launcher: `95320568E09A4193204936EADE23EB1E4BCECC29ADD7FC6DED0A78E9CE92E621`
- Current built launcher: `95320568E09A4193204936EADE23EB1E4BCECC29ADD7FC6DED0A78E9CE92E621`
- Focused test: `DD8136C72E8923DEF7CA3C669E0DEFFC08FAB09CA18E3FE1FE8C284DC8D1E7FF`

The byte diff between the archived executed launcher and current source contains one changed line. `CreateProcess` flags change from `0x00080404` to `0x00080404 | 0x08000000`. Source and built launcher bytes match exactly.

## Invariant review

The resulting exact flag set retains `CREATE_SUSPENDED`, `EXTENDED_STARTUPINFO_PRESENT`, and `CREATE_UNICODE_ENVIRONMENT`, then adds `CREATE_NO_WINDOW`. The process remains suspended while it is assigned to the kill-on-close, active-process-limit-one job, and it resumes only after job assignment and parent-handle observation. Capability-zero AppContainer attributes, inherited NUL standard handles, explicit environment block, fixed executable and command line, held root/executable handles, timeout/cancel handling, process waits, ACL/profile cleanup, and cleanup-frame behavior are unchanged.

The ordinary writer launcher was not modified. The focused test behaviorally parses and evaluates the readonly launch flags, requires the exact four-bit set, and confirms the model-only launcher already contains the same required bits.

Independent command: `node --test scripts/reuse/readonly-verifier-boundary-probe.test.mjs`

Result: **10/10 passed**.

The maker-reported PowerShell AST check, build, and scoped diff check are consistent with the independently observed source/dist parity and exact one-line source delta. They were not redundantly rerun here.
