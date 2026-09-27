# Independent diagnostic gate preflight

Status: **PASS — ready for one root-authorized execution of the frozen command.** No native launch occurred in this review.

## Frozen gate

- Runner: `9B101C3EA7A1434AC30BB67E241E74E40F6CF2E9612AD401FBD7125A6B720BD7`
- Test: `733F98AF66021DB408C51561ABE2C4E94DB8C08F55344BDFD0A878A3E14CB6A8`
- Manifest: `630030ED4357AD710C4DF292717222FF3C5A321BA6E88DC151E7AD6184E5CCDB`
- Done contract: `14233306C3062DD53F40F3D04A6BE369809C4D65DA8A78BD50FDDD1FB14BC74C`
- Diagnostic client: `64BFCA108AFF18D020001962C32027468C0F658420B54B8F27632704E2B16CB9`
- Repaired launcher: `1E4BCEC83430F439758C379B7405809CD67BB037748C464FE3A4C4C2B52695BF`

The gate owns only `D:\Temp\User\Cue.ReadonlyVerifier.DiagnosticGate1` and `actual-attempt1`. The owned root and intent, expected, and result paths were absent. Historical gate roots and markers are separate and are not reset. The manifest caps the experiment at one boundary launch and zero model, provider, and external-network calls.

## Contract review

- All eleven authority inputs are hash-checked before dynamic authority imports and before the exclusive intent marker. They cover runner, test, diagnostic client, launcher, Node executable, helper adapter, three compiled runtime helpers, and the change-snapshot manifest/helper.
- The exact child argv is fixed port `48193` followed by the derived 64-character lowercase-hex nonce. The executable argv behavior is covered offline. The payload preserves the production eight-key isolated environment.
- `expected.json` uses `wx` and records the exact nonce and command-line SHA-256 before the native launcher call.
- Worker results require the exact ten-key observation schema with string values. Missing, malformed, partial, or extra-shaped results become null and cannot pass.
- A diagnostic file is parsed only with the exact five-key schema, fixed version, matching nonce, one of six closed stages, and bounded typed name/code. It is recognized as diagnostic evidence only when native status is 71. Status 72 remains diagnostic-persistence failure.
- Any existence of `diagnostic.json`, including malformed content or coexistence with a valid result, makes `passed` false. Diagnostic content never contributes permission authority.
- Success still requires exact nonce exit-zero and cleanup frames, positive PID plus death verification, successful bounded launcher/ACL/profile observations, exact root identity and SDDL restoration, unchanged fixtures, absent profile, zero worker loopback connections, and every required result value.
- Missing worker output does not throw before post-observation. Failure retains the owned root and bounded raw launcher, ACL, profile, expected, diagnostic-existence, and parsed-diagnostic facts.

## Offline execution

- `node --test scripts/reuse/readonly-verifier-diagnostic-gate.test.mjs`: **18/18 PASS**, exit 0.
- `node --check` on runner and test: PASS.
- Independent top-level hashes matched the frozen manifest; the focused test matched every runtime authority pin.
- No-run/absence checks confirmed the exact fresh root and evidence paths remain unused.

The exact one-use command is:

```text
node scripts/reuse/readonly-verifier-diagnostic-gate.mjs --run
```

A diagnostic outcome, exit 71, exit 72, missing result, malformed result, or any nonzero terminal outcome remains a failed and closed gate. This experiment can distinguish bounded startup stages; it cannot establish that a user command or permission test ran unless the strict normal result and every independent gate condition also pass. No retry is authorized by this review.
