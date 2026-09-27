# Independent stdio repair review

Status: **PASS for the bounded offline repair; no native-launch or crash-resolution claim.**

Done was the contract in `DONE-CONTRACT.md`: preserve the executed failed launcher and gate manifest, make the NUL standard handles inheritable, restrict inheritance to the two NUL handles while retaining the security-capabilities attribute, preserve the existing job/flags/environment/root and executable holds, and prove the embedded C# and handle flags without creating a child or profile. The review allowed at most two correction hypotheses and ran the focused gate after each material correction.

## Independent findings

- The archived launcher is unchanged at `95320568E09A4193204936EADE23EB1E4BCECC29ADD7FC6DED0A78E9CE92E621`; the archived windowless gate manifest is unchanged at `08CDAF2598F08AF5811F18F8C823D384B8C4B9B8AD2DF263051B7B7D8A2CB577`.
- Final `daemon/src/readonly-verifier-launch.ps1` is `1E4BCEC83430F439758C379B7405809CD67BB037748C464FE3A4C4C2B52695BF`. The focused test is `1FCC89B97C5979F46E3E4910437DAE3BC34ED6A57ED3F3773480D78254D792BA`.
- The final delta adds a correctly sized sequential `SECURITY_ATTRIBUTES` with `bInheritHandle=1`, opens NUL read/write handles through one private `OpenInheritableNull` helper, and production `Launch` calls that same helper. There is no public test-only production method.
- The attribute list is initialized for exactly two attributes: the existing zero-capability security attribute and `PROC_THREAD_ATTRIBUTE_HANDLE_LIST`. The handle list contains exactly `[nullRead, nullWrite]`; stdout and stderr share `nullWrite`. `CreateProcess` still uses inherited handles, suspended/Unicode/extended-startup/no-window flags, and the existing job assignment before resume.
- Failure cleanup frees the handle-list allocation, closes both NUL handles, and now calls `DeleteProcThreadAttributeList` only after successful initialization; the allocation itself is freed whenever present.
- The archive/current diff contains no change to the job limits, environment construction, root/executable holds, cancellation, process termination, or wait behavior.

## Executed evidence

`node --test scripts/reuse/readonly-verifier-boundary-probe.test.mjs` passed **11/11** (exit 0). Its final test extracts and compiles the actual embedded C#, reflects the private production helper, opens the read/write NUL handles in the same process, independently queries both with `GetHandleInformation`, verifies `HANDLE_FLAG_INHERIT`, and closes them. It also binds `Launch` to that helper and checks the exact two-handle allowlist and initialized-list cleanup guard.

The maker's frozen receipt reports PowerShell AST parse, build, source/generated parity, and scoped diff checks at exit 0. I did not repeat the build because the frozen parity artifact was sufficient and the independent focused executable gate covered the changed boundary.

This proves the specific inherited-standard-handle contract defect is repaired offline. It does not establish that invalid standard handles caused either prior `0xC0000142` result, that the worker now starts successfully, or that the AppContainer read/write/network boundary passes. No child, AppContainer profile, model, provider, or network operation was run in this review.
