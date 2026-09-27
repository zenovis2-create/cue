# Read-only worker startup diagnosis

## Observed result

The windowless gate remains failed and closed. Its retained launcher output records PID `48620`, created file time `134337317266244235`, no worker result, and process exit `-1073741502` / `0xC0000142`. Root identity, original SDDL, file bytes, profile absence, runtime absence, and process closure were preserved by the separate actual review.

A six-minute Windows Application-log query around the intent time (`2026-09-13T00:08:45.464Z`) found three matching events. Application Error event 1000 at `2026-09-13T09:08:46.8962671+09:00` identifies:

- process ID `0xBDEC`, decimal `48620`;
- faulting application `C:\Program Files\nodejs\node.exe`, version `24.18.0.0`;
- faulting module `C:\WINDOWS\SYSTEM32\ntdll.dll`;
- exception `0xc0000008` (`STATUS_INVALID_HANDLE`);
- offset `0x000000000016447a`.

Two Windows Error Reporting events for the same report repeat `node.exe`, `ntdll.dll`, and `c0000008`. The bounded event export is `application-events.json`, SHA-256 `DB1ED8BD85358C21B10335AFA5DDF31F695A281D37D2A1A4EE4EE634AEC91A60`.

## Concrete launch defect

The read-only launcher creates its NUL input/output handles with `lpSecurityAttributes=IntPtr.Zero` at source line 90. Such handles are non-inheritable. Line 92 places those handles in `STARTUPINFO` with `STARTF_USESTDHANDLES`; line 103 calls `CreateProcess` with handle inheritance enabled, but it has no `PROC_THREAD_ATTRIBUTE_HANDLE_LIST` and cannot inherit non-inheritable handles. This is a concrete standard-handle contract defect. The exact PID-matched `STATUS_INVALID_HANDLE` event is consistent with that defect and makes handle validity the strongest next discriminator, but it does not by itself prove the defect caused this crash.

The model-only launcher differs materially: it creates pipes using a security-attributes structure with inheritance enabled (lines 234-236), clears inheritance on the host ends, and supplies the two child ends through `PROC_THREAD_ATTRIBUTE_HANDLE_LIST` (lines 237-243). This is a reviewed working pattern for valid, bounded child standard handles.

The next correction should apply that existing pattern to the read-only launcher: create inheritable NUL handles, include only those handles in an explicit process handle list, expand the attribute list for the security-capabilities and handle-list attributes, and retain existing handle cleanup. Offline tests must verify inheritable security attributes, exact handle-list membership, and unchanged security-capability/job/flag contracts before any new native gate is considered.

## Executable access observation

Read-only `icacls` observations show `node.exe` and its immediate `C:\Program Files\nodejs` parent grant inherited RX to `BUILTIN\Users` and `Authenticated Users`, but do not list `ALL APPLICATION PACKAGES`. `C:\Program Files` itself lists RX for `ALL APPLICATION PACKAGES`. The model-only launcher instead copies `node.exe` into its owned task root (line 421) and grants the exact AppContainer identity read-only access across that sealed root (lines 445-466).

This is a separate access-contract difference, not the established cause of the current crash: Windows created and started the exact Program Files image far enough to emit the PID-matched invalid-handle fault. After the standard-handle defect is corrected, executable staging/access remains the next item to validate if startup still fails. No Program Files ACL was changed.

## Environment and process comparison

- Read-only worker environment: eight explicit keys (`APPDATA`, `HOME`, `LOCALAPPDATA`, `TEMP`, `TMP`, `USERPROFILE`, `SystemRoot`, `WINDIR`); standard streams point to NUL.
- Model-only environment: seven explicit keys, with profile-scoped paths; standard streams use private inherited pipes and an explicit handle list.
- Both use capability-zero AppContainer security capabilities, suspended creation, extended startup information, Unicode environment, no-window creation, and owned jobs.
- Read-only launcher limits the job to one active process; model-only owns a richer private pipe/completion-port lifecycle.

No new worker, AppContainer, helper, model, provider, or network request was launched for this diagnosis. The only OS observations were the narrowly bounded Application events and read-only ACL queries. No source or ACL was changed.

## Evidence hashes

- Windowless actual result: `C783546F33AAF02084D9849092F50A902C62F6D2EBA5B7460B3FD01A99EA8A0C`
- Windowless actual review: `E4699A6235554C5D6ED5DB800A94505231388901DEAD1363C1059381447B193B`
- Read-only launcher inspected: `95320568E09A4193204936EADE23EB1E4BCECC29ADD7FC6DED0A78E9CE92E621`
- Model-only launcher inspected: `83142D09009418737961FB6D1D0456714A940871242FD566D935AD456FEACF6D`
