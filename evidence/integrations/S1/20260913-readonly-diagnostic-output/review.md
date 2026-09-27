# Independent explicit diagnostic-output review

Status: **PASS for the offline client primitive.** No native gate or child execution is authorized by this review.

## Frozen artifacts

- Explicit-output client: `873D09CAAEC780494E29286F7289C657F601290F1DC37D9D2E2416424C615AD2`
- Executable test: `DAF14AB7D9DF1824853287800631F0BA0D662B22B402F5C3AE3CAF9A61E5924A`
- Done contract: `031F0FF7D8DEFCE01FB0524B9EAAB9214015A7A9CA4D4A2E07B18D7FF670B4FC`
- Preserved prior staged client: `64BFCA108AFF18D020001962C32027468C0F658420B54B8F27632704E2B16CB9`

The read-only source basis was the prior diagnostic follow-up and review. This new file does not replace or mutate the historical client or consumed gates.

## Contract findings

- Invocation accepts exactly fixed port `48193`, one 64-character lowercase-hex nonce, and a bounded printable local-drive absolute Windows output root. Relative, UNC, device-prefix, forward-slash, traversal, control/NUL, oversized, missing, and extra argv forms are rejected.
- The wrapper validates the explicit output root before use and uses only that root for `writable.txt`, `result.json`, and `diagnostic.json`. `env.TEMP` is not used as write authority. This proves code routing only; it does not establish the actual child-effective `TEMP` in a future launch.
- Result and diagnostic writes remain exclusive `wx`. Recording is marked single-shot before hostile property access or persistence, handlers are removed on completion, and later callbacks cannot create a result after a diagnostic attempt.
- A successfully persisted bounded diagnostic remains exit 71. Diagnostic persistence failures map only the closed current stage to fixed exits: evaluation 80, setup 81, port 82, socket 83, callback 84, and result-write 85. These codes contain no raw message or path and establish no permission, user-command, or acceptance authority.
- Diagnostic JSON remains the exact bounded version/stage/nonce/name/code record. Hostile getters, malformed fields, and write failures cannot escape into recursive recording or leak raw error messages.
- Normal completion retains the original permission observation shape and emits no diagnostic. Missing/malformed result data and diagnostic/result coexistence remain invalid evidence. A future gate must independently pin the explicit output argv in its expected command digest and reject any diagnostic existence.

## Executed offline evidence

- `node --test scripts/reuse/fixtures/readonly-verifier-diagnostic-output-client.test.cjs`: **18/18 PASS**, exit 0.
- `node --check` on client and test: PASS.

The executable suite covers exact and hostile argv, a differing `TEMP`, exact output routing, all six diagnostic-success stages, every stage-specific diagnostic-write-failure exit, exclusive files, hostile error objects, late process events, handler removal, single-shot behavior, normal observations, invalid/missing results, coexistence rejection, and preservation of the historical client hash.

No native child, AppContainer/profile operation, model, provider, credential, or real network action occurred. A separately frozen and independently reviewed gate is required before any actual use.
