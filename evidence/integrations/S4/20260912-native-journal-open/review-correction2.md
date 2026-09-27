# Native journal-open correction pass 2 review

Verdict: **PASS for the narrow read-only snapshot helper and host seam**. It is safe to connect this seam to change capture/observation next, subject to the production prerequisites below. This is not approval of restore, deletion, replacement, CAS, startup recovery, or final verification.

The initial independent failure receipt remains in `REVIEW.md`: empty files became protocol unknown, `a\\..\\b` was normalized into another readable target, and accessor-backed inputs could change between validation and dispatch. Correction pass 2 closes all three on the frozen bytes.

## Independently verified corrections

- Empty regular files return `state:'ok'`, `byteLength:0`, the SHA-256 of empty bytes, and an exact empty Buffer. Go uses pointer fields so JSON retains zero values.
- Raw path components are validated before native open. Empty, `.`, `..`, trailing-dot/space, reserved device, ADS, absolute, and traversal components are rejected. The independent `a\\..\\b.txt` fixture returns `unavailable/invalid-path` and exposes no bytes.
- Public inputs are snapshotted from own enumerable data descriptors. Proxies, accessors, sparse arrays, symbols, unexpected fields, wrong prototypes, non-string identities, and oversized aggregate requests fail closed. The strengthened independent accessor-array fixture returns `unavailable/request` and invokes its getter zero times.
- Successful response root identity must exactly equal the requested full volume serial and 128-bit file ID. Response records have exact keys; target result bytes, lengths, SHA-256, identities, order, per-target bounds, and aggregate returned bytes are revalidated.

## Native boundary

The retained root handle is established relative to an opened volume with `OBJ_DONT_REPARSE`. The full expected root identity is checked before target iteration. Each target is opened relative to that retained handle with reparse-point semantics and exclusive sharing. Type/link/sparse checks, initial size, identity, byte reads, final size/link/identity, and SHA-256 all refer to the same target handle. The real Windows suite covers direct and swapped ancestor junctions, root junction/substitution, hard links, sparse files, directories, absence, locks, cap+1 files, and exact normal/empty bytes.

## Independent gates on frozen bytes

- Native integration suite: **9/9 PASS**.
- Independent preserved regressions: **3/3 PASS**.
- `go test ./...`: exit 0 (`[no test files]`; native behavior is executed by Vitest).
- `go vet ./...`: exit 0.
- `npx --no-install tsc -p tsconfig.json --noEmit`: exit 0 after the final source mutation.
- Scoped `git diff --check`: exit 0.

Exact SHA-256:

- `change-snapshot.exe`: `CDC021FC3B912C771C54EFA9ECD5C2AB6874A7D7D02BB15C2882CAFB34F38555`
- `main_windows.go`: `B0F16DE74D7FA20811EAF4240C6EEB8F01C6E6C0355088FE9BBCF86346E4BCD7`
- `main_other.go`: `0277D1AF3FC37F03A053DBF431AAAA99F742B84CED351266C445949ACDF055D8`
- `go.mod`: `0EDEBD0660F8677D4FD0806FF805B442F74BCF77FFFDFE1120364685FFB78415`
- `NOTICE.md`: `B52C5D455E55F926837B46B894216CB588A15951DF51A09039DF9B30B4D16C31`
- third-party license: `B5CB7FF7859E7D282D98FC43AB081B0DDA5DC659DC3385CF65740C759A7E6A6C`
- `change-snapshot-host.ts`: `D6EA1B1643CCE0EC976FCB778C59CFA122E6143BD869EE3BA43117F38BB20C2B`
- `integration-change-records-native.test.ts`: `F253E20DA66716FD48C765C9F1DB926D5DA383B3688E6310AACB8A0DC53737A9`
- independent regression: `ABD709EA9C7774B460131E566B1C9C7BCA878E4BB2D32023E2D353544D485D7A`

## Production prerequisites for journal connection

- Bind `identifyChangeSnapshotRoot`'s exact identity into the approved immutable target/worktree contract before attempt launch. Every later snapshot must use that stored identity; a changed identity, `unknown`, or `unavailable` result remains held.
- Treat the fixed helper's import-time hash as tamper detection around execution, not binary provenance. Installation generation must authenticate or otherwise bind the expected helper digest before module import. Do not claim atomic hash-to-execute pinning from this implementation.
- Map every native target result to the exact approved logical target and persist the full identity, byte length, SHA-256, and bytes atomically. Do not fall back to the path-based snapshot code if the native seam is unavailable.
- Keep the current seam read-only. Restoration still requires a separate atomic host with current-postimage CAS semantics and its own OS evidence.

