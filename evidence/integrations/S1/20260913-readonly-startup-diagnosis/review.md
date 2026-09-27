# Independent startup-diagnosis review

## Verdict

**PASS as a bounded diagnosis and next-experiment selection.** The report identifies a concrete standard-handle contract defect and keeps the PID-matched crash event as corroborating evidence rather than causal proof. It does not assign a DLL cause or authorize another native gate.

## Evidence and source audit

- Diagnosis report: `20A1C3C594690177770EB75AB48CB695680F7CC5E69664AF8F91018CDB66210E`
- Bounded Application events: `DB1ED8BD85358C21B10335AFA5DDF31F695A281D37D2A1A4EE4EE634AEC91A60`
- Done contract: `2E3D1CA075F69772B1949A4B351B45003A319802CF8C5D7F98EE1294914D0957`
- Failed windowless result: `C783546F33AAF02084D9849092F50A902C62F6D2EBA5B7460B3FD01A99EA8A0C`
- Inspected read-only launcher: `95320568E09A4193204936EADE23EB1E4BCECC29ADD7FC6DED0A78E9CE92E621`
- Compared model-only launcher: `83142D09009418737961FB6D1D0456714A940871242FD566D935AD456FEACF6D`

The Application Error event names PID `0xBDEC` / `48620`, matching the retained launcher PID. It records `node.exe`, `ntdll.dll`, and exception `0xc0000008`; the paired WER events repeat that signature. This makes invalid-handle behavior observed for the exact attempt. It does not show which handle or operation was invalid and cannot alone explain the launcher's later `0xC0000142` process exit.

The source defect is independently visible: the read-only launcher opens NUL handles with null security attributes, making them non-inheritable, assigns them as `STARTF_USESTDHANDLES`, and requests handle inheritance without an explicit handle list. Enabling `bInheritHandles` does not turn non-inheritable handles into inheritable ones. The model-only launcher uses the sound contrasting pattern: inheritable pipe child ends, inheritance removed from host ends, and an exact two-handle `PROC_THREAD_ATTRIBUTE_HANDLE_LIST`.

The report correctly ranks a bounded standard-handle repair/experiment ahead of executable staging and ACL hypotheses. Program Files access observations show a real difference from the staged model-only Node image, but process creation, PID reporting, and the matched crash event mean they do not establish an executable-access cause.

## Required next discriminator

Archive the executed launcher and failed manifest, then make only the standard-handle change: create inheritable NUL handles, expand the attribute list to two entries, and pass an explicit list containing only the child input and output handles alongside the existing security-capabilities attribute. Preserve suspended creation, assignment to the one-process kill-on-close job before resume, capability-zero AppContainer state, fixed environment, held executable/root handles, timeout/cancel behavior, and all failure cleanup.

Before any native attempt, offline review must verify security-attribute layout and `bInheritHandle=1`, exact handle-list allocation and byte size, attribute-list count two, membership limited to the NUL input/output handles, allocation cleanup on every failure path, and unchanged security-capability/job/environment contracts. A C# compile/PowerShell AST gate should validate the embedded source. Success there proves the correction is structurally executable; it still does not prove the previous crash cause.

No broad logs, new process launch, native gate, ACL mutation, model, provider, or network operation was performed by this independent review.
