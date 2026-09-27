# Maker receipt — current parent-watchdog gate

The single authorized OS attempt was consumed.

## Measured result

- Vitest exit status 0, no signal or spawn error.
- Five test files passed; ten tests passed.
- The isolated temp base was `D:\Temp\User\cue-parent-watchdog-current-yHydwN`.
- The runner verified the base was a direct child of the resolved OS temp directory, used the exact owned prefix, and was not a symbolic-link root before recursive removal. Removal was verified.
- Selected source, compiled launchers/modules, and tests had identical hashes before and after the gate. Exact pins are in `result.json`.
- The passing tests require worker/process death and profile absence before their fallback cleanup can run; fallback cannot turn the captured boolean assertions into success.

## Evidence limitation

The plan required preservation of the raw `P12_PARENT_DEATH_IDENTITY` console line. Vitest intercepted console output for the passing test, so `gate.log` contains the aggregate 5-file/10-test result but no identity line, and `result.json.identityLines` is empty. The test behavior passed, but this maker receipt does not claim an independently inspectable raw PID/creation-time record or profile enumeration record.

The actual cap is exhausted; the gate was not rerun with console interception disabled. Provider terminal acknowledgment, billing stop, unknown Codex identity, and local-model support remain outside scope.

## Artifact hashes

- PLAN: `80F3706B88D780DC029E5A9495E8BD1EB27E91DE62463F82C0BEDD874DFF991F`
- runner: `45364AAD381F8320FB07D711A5B6D369BBC76A05040007BA127620EE36477907`
- result: `173A28CD4A83D5A78269FF668DBAD7E015281C2DA4E2DC7632AB5EEA01CEB5E0`
- gate log: `F5D527B5C0ECA9F531837966703103DFF86267486D23AD124AB2918F0355AADB`

