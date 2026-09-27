# Native journal-open independent review

Verdict: **BLOCKED for capture/observer wiring**.

The Windows handle-relative kernel boundary passes its seven maker tests and prevents the tested junction/root-substitution cases. Three independently reproduced protocol/input defects make the current host seam unsafe to connect to the existing journal. No restore or CAS behavior was reviewed or claimed.

## Blocking findings

1. **Empty regular files cannot be observed successfully.** `result.ByteLength` and `result.Bytes` use `omitempty`. For an empty file, Go omits both zero values even though the result state is `ok`; the TypeScript parser requires a safe integer length and string bytes, so the whole call becomes `{state:'unknown', reason:'protocol'}`. Empty approved files are ordinary journal targets and must retain exact zero-byte identity. The independent benign fixture reproduces this.

2. **Traversal components are normalized into another readable target.** `relativeName` calls `filepath.Clean` before checking only the cleaned prefix. `a\\..\\b.txt` becomes `b.txt`, is opened relative to the trusted root, and returns its bytes with state `ok`. This does not escape the worktree, but it can substitute a different in-root file for the approved logical target and violates exact target binding. The helper must reject `.` and `..` components before cleaning.

3. **Caller target accessors can switch the validated target before dispatch.** `snapshotRelativeNative` accepts non-plain arrays and reads each element during `.some`, again during JSON serialization, and again during response validation. The independent accessor fixture observed three reads; it can return `approved.txt` during validation and `other.txt` during dispatch/matching, causing the helper to read the latter. Snapshot the input once from strict own data descriptors, reject proxies/accessors/sparse arrays, and use only that frozen copy.

## Required host hardening

- The response parser accepts any structurally valid `rootIdentity` and does not compare it with the requested `expectedRoot`. The genuine current helper performs the comparison before target iteration, so this is defense at the host/protocol boundary rather than a bypass of the tested binary. It should still fail closed before journal wiring.
- `identity()` validates `String(value)` and then casts the original value to `string`. Require actual strings before regex validation. Current helper JSON decoding usually turns numeric substitution into an unavailable response, so this is typed seam hardening rather than the main exploit.
- The executable hash is captured from whatever binary exists at module import. Before/after hashing detects many runtime replacements but does not establish trusted provenance and cannot make hash-check-to-spawn atomic. Treat installation-generation verification and trusted installed bytes as an explicit prerequisite. This seam must not be described as cryptographic binary pinning.

## Verified native properties

- The helper opens the worktree relative to an open volume handle with `OBJ_DONT_REPARSE`, checks the full volume serial and 128-bit file ID against `expectedRoot`, and does so before iterating targets.
- Targets are opened relative to the retained root handle with reparse-point semantics and exclusive sharing. Metadata, full identity, bytes, SHA-256, and final size/link/identity checks use the same target handle.
- The helper rejects the exercised direct/swapped ancestor junctions, root junction/substitution, target reparse points, hard links, sparse files, directories, ADS, absolute paths, and cap+1 content. Missing status remains distinct from other open failures.
- Limits are bounded to 64 targets, 16 MiB per request aggregate at the host, 16 MiB per target at the helper, five seconds, and 24 MiB process output.
- No production module imports the two host exports. The boundary remains disconnected.

## Evidence

- Existing focused Windows Vitest: **7/7 PASS**.
- Independent benign regressions: **0/3 PASS**, reproducing all three blockers above.
- Go package check: exit 0 (`[no test files]`; substantive native execution is exercised by Vitest).
- TypeScript no-emit check: exit 0.
- Scoped `git diff --check`: exit 0.

Exact reviewed SHA-256 values:

- `change-snapshot.exe`: `0BD272B4CA4F30D6E062C6F498DE32D779DA317673AD460EBC870BBC0D0CAF9C`
- `main_windows.go`: `DAE0294DF261EEDFF6E495F2A5DE3A2EBEA3537ADA6553843836DFE3813D55F0`
- `main_other.go`: `0277D1AF3FC37F03A053DBF431AAAA99F742B84CED351266C445949ACDF055D8`
- `go.mod`: `0EDEBD0660F8677D4FD0806FF805B442F74BCF77FFFDFE1120364685FFB78415`
- `NOTICE.md`: `B52C5D455E55F926837B46B894216CB588A15951DF51A09039DF9B30B4D16C31`
- third-party license: `B5CB7FF7859E7D282D98FC43AB081B0DDA5DC659DC3385CF65740C759A7E6A6C`
- `change-snapshot-host.ts`: `E8BEC0BF2D7AE1B5CDC0E8D4209BDFB2BE6BC3F57C79588BC6BDBC7C850C6622`
- `integration-change-records-native.test.ts`: `A1818E5D338F4D4A69DF3003241C7404D9FF75EDD7359E32F5A4AD6574919A3C`

The host hash differs from the maker implementation note's `9CBC...` value; this review records and judges the exact current `E8BE...` bytes.

Executable counterexamples are preserved in `review-regressions.test.ts`.

