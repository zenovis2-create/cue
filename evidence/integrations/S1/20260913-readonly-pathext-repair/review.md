# Independent PATHEXT diagnostic and repair review

## Verdict

**PASS for the bounded diagnostic and minimal offline repair.** No PowerShell, native helper, AppContainer, ACL, network, model, provider, or cleanup operation was invoked by this review. The failed historical gates remain closed and unchanged; this review authorizes no rerun.

The one consumed diagnostic establishes that the absolute sealed `C:\WINDOWS\System32\icacls.exe` can be activated by Windows PowerShell under exactly `{SystemRoot, WINDIR, PATHEXT: '.EXE'}`: status `0`, no signal, no spawn error, 4,548 bytes of stdout, and empty stderr. It establishes fixed `.EXE` as sufficient for this host-only activation test. It does not exercise the ACL grant arguments, launcher, AppContainer, or cleanup path and therefore does not prove a boundary pass.

## Evidence preservation

- Diagnostic contract: `134DA89927BE41D047DDC25686AB330B7089BBEC710439031F228F86478CFF1D`
- Diagnostic script: `A3E34248A38B34C57EF8B2B6CF308BA8D90DE63E7869E91363FA251239C01B8F`
- Diagnostic intent: `1DAB1D76CC6FC863EF0B122020B86196622917B11374E897FC95E5634EA06ACD`
- Raw diagnostic result: `A2EC6EA91BBAA8B12164E3EE72E1F483A052ED2A95790A0DCCBAED20594E90CA`
- Archived pre-edit helper: `C6C689FCD6ED28BE4577EE42DE826C3EBA7C77A394E0FB939A99462D4B4D75FF`
- Archived pre-edit test: `48E05FCF3FC8DA4011C61A6E103C6F81FA8A346BAD7C8C554F27F80C46852CC5`
- Archived executed corrected-gate manifest: `92F8D9994CA3E7E9A1700CF848C3DBCEF49968E973C8E0A4CC0D0030B92CB4D3`

The live executed manifest remains byte-identical at `92F8D9994CA3E7E9A1700CF848C3DBCEF49968E973C8E0A4CC0D0030B92CB4D3`; its intent remains `DFCA06C39ED097211401614D68FC156B5FBB4060D80383C0FF3D2840E17F4D66`, and its failed result remains `E5F353431A9EA39448DE6493D21645DDC6D15B7D32F84D690EF6D3C58BE74738`.

## Repair audit

The shared `sanitizedHostEnvironment` now returns exactly three host keys: caller-derived system root under `SystemRoot` and `WINDIR`, plus the constant `PATHEXT: '.EXE'`. The adapter overwrites any caller `env`, so caller `PATH`, a hostile `PATHEXT`, credentials, and ambient variables cannot enter. Both production read-only worker PowerShell launches use the same explicit three-key object.

The isolated AppContainer payload remains exactly its prior eight keys: `APPDATA`, `HOME`, `LOCALAPPDATA`, `TEMP`, `TMP`, `USERPROFILE`, `SystemRoot`, and `WINDIR`. `PATHEXT` was not added to that payload, and `environmentContractDigest` retains the same eight-key contract. The repair therefore changes host PowerShell executable activation without broadening the verifier process environment or invalidating its command digest.

Current reviewed hashes:

- Shared helper: `AD287C573FA1BD0CE096F09AA265C310527CA77C2607CB2E0172CEE3A57CDF3B`
- Shared helper test: `1CDC81C4F09A517B100DFAB6AFAD9D48E2ADA7A4FA7416EA5C29C46B8C62BC35`
- Production worker: `DC3136E8F6387B3C0D7A2DF8D164AB3D2261CBD968B42E0933EAD545D2D4294C`

Independent command: `node --test scripts/reuse/readonly-verifier-boundary-probe.test.mjs`

Result: **9/9 passed**. The environment test behaviorally supplies hostile caller `PATH` and `PATHEXT` and observes only the fixed three-key child environment, while retaining bounded raw diagnostics. Existing authorization and receipt tests remain fail closed. Shared worker mocked/bootstrap/build evidence is owned by the separate reviewer and was not duplicated here.

This is a proportional repair for the observed PowerShell executable-activation prerequisite. It does not prove that the prior gate would otherwise complete, and it grants no production registration, durable identity, code acceptance, P13, entitlement, or public qualification.
