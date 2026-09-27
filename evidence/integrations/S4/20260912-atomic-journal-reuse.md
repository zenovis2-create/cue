# S4 atomic journal reuse note (2026-09-12)

## Decision

Keep restore disabled. Replace the current pathname `lstat`/`realpath`/`open` observation with a small Windows native helper adapted from Microsoft hcsshim's pinned `safefile` implementation. That closes the safe-open/identity/read boundary, but it does **not** provide exact compare-and-replace. Do not describe `ReplaceFileW`, `MoveFileEx`, `os.Root.Rename`, or ordinary rename as CAS.

Current gap: [`snapshot`](../../../daemon/src/change-records.ts) validates ancestors by pathname and later opens the pathname. An ancestor can be exchanged between those operations. There are no product consumers of the optional `AtomicRestoreHost`, and absence of that host correctly returns `atomic-race-closure-unsupported`.

## Reuse comparison (two primary-source candidates)

### 1. Microsoft hcsshim `internal/safefile` — choose as source adaptation

- Pin: [`microsoft/hcsshim@d4c646bd990824b805e33443a0618d62466f97eb`, `internal/safefile/safeopen.go`](https://github.com/microsoft/hcsshim/blob/d4c646bd990824b805e33443a0618d62466f97eb/internal/safefile/safeopen.go#L31-L92).
- It opens an owned root directory handle, passes that handle as `OBJECT_ATTRIBUTES.RootDirectory`, and sets `OBJ_DONT_REPARSE` in one `NtCreateFile` resolution. Its comment and exported `OpenRelative` contract explicitly fail when any intermediate component is a reparse point. It also rejects `:`/ADS and non-relative paths.
- `LstatRelative` opens the target itself with `FILE_OPEN_REPARSE_POINT`; `EnsureNotReparsePointRelative` rejects a reparse anywhere. `RemoveRelative` deletes through the opened target handle, avoiding a second source pathname lookup ([same pinned file](https://github.com/microsoft/hcsshim/blob/d4c646bd990824b805e33443a0618d62466f97eb/internal/safefile/safeopen.go#L231-L397)).
- Limitation: Go's `internal` rule prevents importing this package from Cue. It has hcsshim-local `winapi`/`longpath` and `go-winio` dependencies. Adapt the narrow open/stat/read pieces with attribution; do not vendor the container-oriented remainder.
- License at this pin: [MIT](https://github.com/microsoft/hcsshim/blob/d4c646bd990824b805e33443a0618d62466f97eb/LICENSE). Integration cost: medium (small native helper and protocol; Windows-only tests). Reuse value: high because the security-sensitive `NtCreateFile` flags and relative-root pattern already exist and are maintained by Microsoft.

### 2. Bytecode Alliance `cap-std` / `cap-primitives` — portable fallback, larger fit cost

- Pin: [`bytecodealliance/cap-std@b7acf8e8807fe3fab991884d2208b7e03d35a409`](https://github.com/bytecodealliance/cap-std/tree/b7acf8e8807fe3fab991884d2208b7e03d35a409). Its capability `Dir` API supports Windows and prevents resolution escaping its directory ([README](https://github.com/bytecodealliance/cap-std/blob/b7acf8e8807fe3fab991884d2208b7e03d35a409/README.md#capability-based-security)). The manual resolver opens path components individually with no-follow opens ([implementation](https://github.com/bytecodealliance/cap-std/blob/b7acf8e8807fe3fab991884d2208b7e03d35a409/cap-primitives/src/fs/manually/open.rs)). Windows directory handles are opened without `FILE_SHARE_DELETE` specifically to prevent races ([options](https://github.com/bytecodealliance/cap-std/blob/b7acf8e8807fe3fab991884d2208b7e03d35a409/cap-primitives/src/fs/open_options.rs#L340-L347)).
- Qualification: this sandbox permits safe in-root symlink traversal by design. Cue's stricter policy rejects every reparse component, so the public API needs careful no-follow composition and hostile junction proof. It still supplies no exact-postimage CAS.
- License at this pin: [Apache-2.0](https://github.com/bytecodealliance/cap-std/blob/b7acf8e8807fe3fab991884d2208b7e03d35a409/LICENSE-APACHE) WITH LLVM exception or [MIT](https://github.com/bytecodealliance/cap-std/blob/b7acf8e8807fe3fab991884d2208b7e03d35a409/LICENSE-MIT). Integration cost: high here (new Rust build/artifact/dependency chain plus Node IPC/FFI). Use it only if Cue adopts Rust for a broader native filesystem boundary.

Version floor matters: the upstream Windows device-name advisory says `cap-primitives`, `cap-std`, and `cap-async-std` before 3.4.1 are affected; 3.4.1 is fixed ([GHSA-hxf5-99xg-86hw](https://github.com/bytecodealliance/cap-std/security/advisories/GHSA-hxf5-99xg-86hw)). The pinned head includes the fix, but any eventual dependency must be locked and audited.

## Native boundary and what it proves

Microsoft documents that a non-null `RootDirectory` makes the object name relative to that directory handle and `OBJ_DONT_REPARSE` follows no reparse points, failing with `STATUS_REPARSE_POINT_ENCOUNTERED` ([`OBJECT_ATTRIBUTES`](https://learn.microsoft.com/en-us/windows/win32/api/ntdef/ns-ntdef-_object_attributes)). This is the direct native alternative underlying candidate 1.

The helper should keep the root handle for the whole request and return only bounded records. For every target: open relative to that handle with `OBJ_DONT_REPARSE`; require a regular file and one link; query `FILE_ID_INFO`; read from the same handle up to the contract cap while hashing; query identity/size again on the same handle; reject drift, short/over-cap reads, reparse/sparse/unsupported files, and all errors except an atomically established absent result. `FILE_ID_INFO` combines volume serial with a 128-bit file ID and is Microsoft's documented same-file comparison ([documentation](https://learn.microsoft.com/en-us/windows/win32/api/winbase/ns-winbase-file_id_info)). Preserve that full identity in the journal rather than narrowing it to Node's `dev:ino` string.

Safe open and exact replacement are separate claims. Windows rename information offers `REPLACE_IF_EXISTS`, but it identifies no expected destination file ID or content digest; without the flag it merely fails if *any* destination exists ([`FileRenameInformationEx`](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-fscc/4217551b-d2c0-42cb-9dc1-69a716cf6d0c)). Therefore it cannot express “replace only if destination is this exact recorded postimage.” Holding a comparison handle and then closing it before replacement reopens the race; keeping an incompatible share mode blocks replacement. A same-directory temp plus flush plus rename gives atomic publication, not CAS.

Until a proven native protocol supplies the missing conditional operation (or Cue owns exclusive filesystem mutation for the full interval), `replaceIfExact` and `removeIfExact` must remain unavailable. Candidate 1's handle-based `RemoveRelative` is path-safe, but by itself it does not prove that the opened object still equals the recorded postimage; compare on that same handle immediately before handle-based deletion is required.

## Smallest next implementation unit

Implement a **read-only `snapshotRelative` native helper** from the pinned hcsshim open pattern. Wire capture/observe to it behind a fixed host-owned executable identity and bounded request/response protocol; leave restore unimplemented and returning `atomic-race-closure-unsupported`. This unit is independently useful because it removes the current ancestor-swap window without inventing a CAS claim.

Executable Windows tests for that unit:

```powershell
npx --no-install vitest run test/integration-change-records-native.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
npm run build
git diff --check -- daemon/src daemon/test
```

The focused test must use real temporary directories and the real helper: regular bounded read returns bytes/hash/full file ID; target/ancestor junction and symlink reject; ADS/reserved/absolute/`..` reject; concurrent ancestor rename/swap cannot redirect; target replacement during read yields conflict/unknown rather than a mixed snapshot; cap+1 data never returns bytes; hard link and sparse/non-regular inputs are non-restorable; helper timeout/oversize/malformed output fails closed. A mock-only suite cannot close this boundary.

## Scope

Research only. No product/source/build edit, install, binary download, provider/model/credential access, or external write was performed. This note closes neither the restore boundary nor S4.
