# Offline smoke preparation

The diagnostic smoke runner is frozen for one root-owned native invocation. No AppContainer, WFP, worker, network, model/provider, elevation, policy change, or historical gate ran during preparation.

Final artifacts:

- runner SHA-256: `70E6E582997446762C994A67E5948F896E18E43B381B723481875FBBFBAAC966`
- test SHA-256: `136B48E44B3282662E24944DAA29A64C342B6C76C6C8E666C6848728B56ABAEF`
- manifest SHA-256: `8891477DB9D48B939858129AB35698EC91F10D48CB2B2F60EAED8B1CB7DDE5D2`
- generated WFP launcher SHA-256: `F5E03DE26E29B95DC42A012F280E8B37A1A1E76CF2A02B54D2ECF4F5557EB9D3`
- eagerly loaded legacy client SHA-256: `530651732FD977FC32D44463A8128D40F7DEB4FA8BAD797778F4F7D08B950587`
- eagerly read canonical base launcher SHA-256: `9181E9D20C4137FB7472FAC8D0FEF1C43583DF0E5AD71FB3FDBD593F496FB3C9`
- independent amended review SHA-256: `286A7872196411BCC6C516CA248447200034B13D629B6FF5018F96B9974800A7`

`node --test scripts/reuse/readonly-wfp-diagnostic-smoke.test.mjs` passed 10/10, and `node --check scripts/reuse/readonly-wfp-diagnostic-smoke.mjs` passed. Dependency pins, exact owned-path absence, and the scoped diff check also passed independently.

The first reported 10/10 result did not prove durable-intent ordering because its source-index assertion could pass with `indexOf(...) == -1`. The next READY verdict was withdrawn because the eager observer import also loaded a legacy client and read the canonical base launcher without pinning them. The final test requires every actual call index to be present before asserting durable intent precedes owned-directory creation and native launch, and the final manifest pins both eager dependencies. Only the final corrected 10/10 and amended review support the readiness claim.

The runner durably writes the one-shot intent outside the removable owned root and durably records the expected nonce and identities before launch. It accepts exactly one PID/FileTime frame. Missing, duplicate, malformed, live, unknown, or PID-reused observations fail closed and retain owned state. A PASS additionally requires the exact exit frame, successful benign worker outcome, exact root identity and ACL restoration, absent profile, cleanup flags, unchanged sentinel, and a valid non-overflow `captured` WFP diagnostic. That diagnostic remains informational and does not prove network denial, qualification, or production registration.

The only authorized native command is:

```text
node scripts/reuse/readonly-wfp-diagnostic-smoke.mjs --run
```

Root owns that single invocation; this maker did not execute it.
