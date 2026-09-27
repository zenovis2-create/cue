# Native journal open implementation evidence

Verdict: maker gate PASS for the disconnected, read-only Windows snapshot boundary. Production change-record wiring and every restore/CAS claim remain unavailable. `identifyRoot` is only a host preapproval observation; a future journal seam must bind its exact identity to the approved target contract before an attempt.

The Go helper opens a drive root and resolves the requested worktree in one relative `NtCreateFile` call using `RootDirectory` and `OBJ_DONT_REPARSE`. It rejects a reparse anywhere in that absolute-root resolution, queries the full volume serial plus 128-bit `FILE_ID_INFO`, retains the matched root handle, and verifies the caller's expected root identity before opening any target. Targets are relative `NtCreateFile` opens with `OBJ_DONT_REPARSE`, `FILE_OPEN_REPARSE_POINT`, and exclusive sharing. The helper rejects non-regular, reparse, sparse, and multi-link files, bounds bytes before allocation, and reads, hashes, and re-queries size/link/identity through the same handle. Only native object/path-not-found statuses establish absence; unsupported guarantees and observation errors remain explicit `unavailable` or `unknown`.

The TypeScript host fixes the module-relative executable path and records its import-time SHA-256, rechecks bytes around execution, accepts no executable override, uses `shell:false`, a five-second timeout, 24 MiB process-output cap, 16 MiB total requested-byte cap, nonces, strict structural validation, and recomputes returned byte hashes. This hash detects drift only; it is not a protected-installation or publisher identity claim. The host has no persistence, restore, remove, rename, or CAS API.

The relative open pattern is adapted from Microsoft hcsshim `internal/safefile/safeopen.go` pinned at `d4c646bd990824b805e33443a0618d62466f97eb`. `NOTICE.md` names the exact source, and the pinned upstream MIT text is preserved in `THIRD_PARTY_LICENSE_MICROSOFT_HCSSHIM.txt`.

## Actual Windows gate

- `C:\Program Files\Go\bin\go.exe version`: `go1.26.4 windows/amd64`.
- `go test ./...`: exit 0.
- Focused Vitest after correction pass 2: 1 file, 9/9 PASS, exit 0. The independent preserved regressions also pass 3/3. These tests used actual owned Windows temporary directories/files and the compiled helper. They cover regular and empty bytes/hash/full identity, atomically established absence, cap+1 and total-byte refusal, component traversal before cleaning, accessor rejection without evaluation, direct and swapped-ancestor junctions, root-ancestor junction rejection, root substitution, hard links, sparse files, directories, ADS/absolute/traversal rejection, and exclusive-share behavior.
- `npx --no-install tsc -p tsconfig.json --noEmit`: exit 0.
- Scoped `git diff --check`: exit 0.

Two corrections of the cap of three were used. Pass 1 handled Node's inability to freeze a nonempty Buffer view. Pass 2 preserved explicit zero-byte success fields, rejected traversal components before path cleaning, rejected accessor/proxy/sparse target arrays without evaluating accessors, snapshot all request values once, strictly validated identities and response shapes, compared the response root identity to the expected identity, and bounded total native bytes. The final focused and independent regression runs passed.

## SHA-256

- `change-snapshot.exe`: `CDC021FC3B912C771C54EFA9ECD5C2AB6874A7D7D02BB15C2882CAFB34F38555`
- `main_windows.go`: `B0F16DE74D7FA20811EAF4240C6EEB8F01C6E6C0355088FE9BBCF86346E4BCD7`
- `NOTICE.md`: `B52C5D455E55F926837B46B894216CB588A15951DF51A09039DF9B30B4D16C31`
- `THIRD_PARTY_LICENSE_MICROSOFT_HCSSHIM.txt`: `B5CB7FF7859E7D282D98FC43AB081B0DDA5DC659DC3385CF65740C759A7E6A6C`
- `change-snapshot-host.ts`: `D6EA1B1643CCE0EC976FCB778C59CFA122E6143BD869EE3BA43117F38BB20C2B`
- `integration-change-records-native.test.ts`: `F253E20DA66716FD48C765C9F1DB926D5DA383B3688E6310AACB8A0DC53737A9`

No existing change-record, ledger, copy-assets, source-build, model/provider, executor/sandbox profile, credential, or system-setting file was changed.
