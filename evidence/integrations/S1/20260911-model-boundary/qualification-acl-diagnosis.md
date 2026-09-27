# ACL readback diagnosis

Date: 2026-09-11. Independent source review: /root/cue_fit. Local representation check: /root. No AppContainer or provider call repeated for this diagnosis.

The qualification helper filters IdentityReference.Value by the SID prefix. An NTAccount value is a name, so this can drop the actual package ACL entry before comparison. The correction is explicit Translate(SecurityIdentifier).Value, with translation errors remaining failures. Broadening string matching is not a valid correction.

Root ran an isolated .NET conversion using the well-known built-in Users SID S-1-5-32-545. Exit0; exact output:

```json
{"representationType":"System.Security.Principal.NTAccount","valueHasSidPrefix":false,"translatedSidMatches":true}
```

This establishes representation behavior, not the missing historical package ACL or M qualification. Previous raw ACL output was not retained; do not reconstruct it. The maker's qualification-failed-attempts.md preserves the available failure excerpts and retention limits.

The separate source review confirmed the diagnostic hold only accepts boolean true under ProbeHarness, waits at most5 seconds after child exit, and retains finally cleanup on timeout. It enables post-exit host inspection, not post-exit child enforcement.

Next bounded correction: preserve raw controlled observations before assertions, normalize the ACL identities, run only the affected controlled qualification case once, then independently review its evidence. No production policy relaxation, no full suite repetition, no UNKNOWN/ETIMEDOUT allowlist substitution. Any fresh failure requires stopping and identifying its distinct cause.
