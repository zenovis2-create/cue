# Read-only inherited-standard-handle repair receipt

## Result

The read-only launcher now opens its NUL standard handles through one private production helper using inheritable security attributes. `Launch` supplies exactly the read and write handles through `PROC_THREAD_ATTRIBUTE_HANDLE_LIST` while retaining the capability-zero security attribute, suspended/Unicode/extended-startup/no-window flags, one-process job, and existing cleanup.

Attribute-list deletion is guarded by successful initialization; allocated list memory is freed whenever allocated. The test exercises the same private helper used by `Launch` through reflection, queries both real NUL handles with `GetHandleInformation`, verifies the inherit flag, and closes them. It creates no child or AppContainer.

Microsoft's `UpdateProcThreadAttribute` contract requires handle-list members to be inheritable and `CreateProcess` handle inheritance to be enabled: <https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-updateprocthreadattribute>.

## Verification

- Focused boundary contract and exact embedded-C# compilation: 11/11 passed.
- PowerShell AST parsing: passed.
- Build and asset copy: passed.
- Source/dist launcher parity: `1E4BCEC83430F439758C379B7405809CD67BB037748C464FE3A4C4C2B52695BF`.
- Focused test SHA-256: `1FCC89B97C5979F46E3E4910437DAE3BC34ED6A57ED3F3773480D78254D792BA`.
- Scoped diff check: passed.

Archived before editing:

- Failed windowless launcher: `95320568E09A4193204936EADE23EB1E4BCECC29ADD7FC6DED0A78E9CE92E621`.
- Failed windowless gate manifest: `08CDAF2598F08AF5811F18F8C823D384B8C4B9B8AD2DF263051B7B7D8A2CB577`.

No native child, AppContainer, model, provider, or network call was made. The PID-matched invalid-handle event is consistent with the repaired defect but does not prove this change fully resolves worker startup. Prior gate attempts remain failed and closed.

Independent offline review: PASS; `review.md` SHA-256 `041C1DC7E109176F8945BE12C9307102B027C3AB3E56611544186ABD8895B60A`.
