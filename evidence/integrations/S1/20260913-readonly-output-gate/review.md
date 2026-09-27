# Independent explicit-output gate preflight

Status: **PASS — ready for one root-authorized invocation of the frozen command.** No native launch occurred during review.

## Frozen inputs

- Runner: `36943784595EFD64916EC4E6B8E42DD0B5FF6177EFF99DD0B70537D7EF1B9C99`
- Test: `6A6844A2721183FEE433D1882C0EA40EC4CE852D0530C192735919FAD5DFE3AC`
- Manifest: `26552AF4A4671AC51D466D5D74CA5D9DAE3D9965D78EC5688DC03E6B30A56A08`
- Done contract: `48012CF0DFFD4DB8FB3B21453E3B830B9492A14033EB064CFE897FF23372AC84`
- Explicit-output client: `873D09CAAEC780494E29286F7289C657F601290F1DC37D9D2E2416424C615AD2`
- Repaired launcher: `1E4BCEC83430F439758C379B7405809CD67BB037748C464FE3A4C4C2B52695BF`

The experiment owns only `D:\Temp\User\Cue.ReadonlyVerifier.OutputGate1` and `actual-attempt1`. The owned root and intent, expected, and result paths were absent. Prior consumed gate evidence remains separate and unchanged. The manifest caps execution at one boundary launch and zero model, provider, and external-network calls.

## Contract findings

- The run path verifies eleven closure pins before importing authority helpers or creating the exclusive intent marker. The closure includes runner, test, explicit-output client, launcher, Node executable, helper adapter, three compiled helpers, and the change-snapshot manifest/helper.
- Child argv is exactly fixed port, derived 64-character nonce, and the gate-owned absolute runtime root. The runtime path is therefore included in the exact command-line digest written with nonce to exclusive `expected.json` before launch.
- The child environment remains the production eight-key shape. The client uses the explicit argv runtime for result and diagnostic output rather than treating child `TEMP` as authority.
- Strict result parsing requires the exact ten observation keys and string values. Missing, malformed, partial, or extra-shaped results cannot pass.
- Diagnostic parsing requires exact schema/version, matching nonce, a closed stage, and bounded name/code. Status 71 can label a valid diagnostic only. Statuses 80–85 remain stage-limited diagnostic-write failures and never contribute permission authority.
- Any `diagnostic.json` existence, including malformed content or coexistence with a valid result, makes success false. Success also retains exact exit/cleanup frames, PID death, root identity, SDDL, profile, original-byte, controlled-loopback, and every permission-observation requirement.
- Failed attempts retain the owned root and bounded raw post-observations. Missing worker output is read as null without skipping the post-state observations.

## Offline evidence

- `node --test scripts/reuse/readonly-verifier-output-gate.test.mjs`: **18/18 PASS**, exit 0.
- `node --check` on runner and test: PASS.
- Independent hashes matched the frozen receipt; the focused suite verified all runtime pins.
- The fresh owned root and all three attempt receipts remained absent after preflight.

The exact one-use command is:

```text
node scripts/reuse/readonly-verifier-output-gate.mjs --run
```

Any nonzero status, diagnostic existence, missing/malformed result, or failed postcondition closes this gate without retry. A diagnostic result can narrow a stage but cannot prove the user command or permission checks ran.
