# Independent preflight — read-only WFP diagnostic smoke

## Verdict

**READY for one root-owned execution of the exact frozen command.** The first READY was withdrawn when a final closure audit found two eager observer inputs were not pinned; this verdict applies only to the corrected manifest below.

```text
node scripts/reuse/readonly-wfp-diagnostic-smoke.mjs --run
```

This authorizes one bounded diagnostic smoke only. It is not a retry of an exhausted network qualification gate and cannot establish network denial, permission qualification, production registration, identity authority, or general Unit A readiness.

## Frozen evidence

- runner: `70E6E582997446762C994A67E5948F896E18E43B381B723481875FBBFBAAC966`
- test: `136B48E44B3282662E24944DAA29A64C342B6C76C6C8E666C6848728B56ABAEF`
- plan: `EC6E1F9912A2BD802F7F3865B05F1B5BE3F7D93A0CE6C21686F3B3E9966A1973`
- manifest: `8891477DB9D48B939858129AB35698EC91F10D48CB2B2F60EAED8B1CB7DDE5D2`
- generated launcher pinned by the manifest: `F5E03DE26E29B95DC42A012F280E8B37A1A1E76CF2A02B54D2ECF4F5557EB9D3`

Independent offline execution passed **10/10** Node tests, `node --check`, manifest dependency pins, owned-path absence checks, and scoped `git diff --check`. At review time the exact owned root, intent, expected, and result paths were all absent.

## Safety and fail-closed findings

The manifest fixes one fresh D-drive temp root, current sealed Node, generated launcher, parser, process observer, and the read-only helper closure. The corrected closure also pins the observer's eagerly executed legacy client (`530651732FD977FC32D44463A8128D40F7DEB4FA8BAD797778F4F7D08B950587`) and eagerly read canonical base launcher (`9181E9D20C4137FB7472FAC8D0FEF1C43583DF0E5AD71FB3FDBD593F496FB3C9`). Imports have no execution side effect beyond those bounded reads/module initialization. All hashes and scope paths are checked before the exclusive intent. The intent and expected binding use `wx`, write, `fsync`, then close; the test positively checks that the actual intent call precedes owned-root creation and the launcher call.

The worker command is fixed to `node -e process.exit(0)`. The runner creates no listener or network request and invokes no model/provider. It requires exactly one PID/FILETIME frame; missing, duplicate, malformed, alive, ambiguous, or PID-reused observations remain unknown and fail. A created identity is not treated as resumed or dead. Pass additionally requires clean launcher status, exactly one nonce-bound exit frame, empty stderr/error/signal, exact root identity, successful ACL observation and equality, strict profile absence, unchanged sentinel, exact cleanup nonce/root, cleanup ACL/profile flags, and a non-overflowing `captured` diagnostic accepted only after those predicates.

Failure retains the owned state and raw result. Successful owned-root removal uses an exact resolved containment check and occurs before the final external result receipt, as stated by the corrected plan. Missing worker identity or unknown death never authorizes guessed cleanup or a pass.

## Limits

No native worker, generated PowerShell launcher, WFP query/subscription, AppContainer profile, process cleanup, network connection, or model ran during preflight. The created-identity prerequisite has only limited runtime evidence: ordering/refusal/no-resume uses the production-shared seam, while `GetProcessTimes` failure through the complete `LaunchCore` native cleanup remains source-inspected rather than runtime-proven. The smoke compensates by requiring a separate exact post-run PID/creation-time death observation and fails closed otherwise.
