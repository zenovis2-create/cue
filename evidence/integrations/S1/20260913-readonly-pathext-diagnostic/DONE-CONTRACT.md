# Fixed-PATHEXT host utility diagnostic done contract

Done means one host-only Windows PowerShell process invokes the absolute sealed `System32\\icacls.exe` path with `/ ?` help semantics under exactly `SystemRoot`, `WINDIR`, and fixed `PATHEXT=.EXE`. It persists bounded status, signal, structured error, stdout, stderr, exact argv, executable hash, and environment-key/value contract, then reports whether the utility executed.

The cap is one host process call. No retry, AppContainer, ACL read/change, project mutation, native helper, network, model, provider, credential, historical marker reset, or corrected-boundary execution is permitted. This experiment distinguishes fixed executable activation from boundary behavior and grants no native retry authority.
