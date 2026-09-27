# Independent review: declarative resource packages

Reviewer `/root/broker_review`, 2026-09-11. Product code read-only. **PASS for the bounded, process-local resource snapshot registry.** No blocking defect found in this scope; no model call or external publication was performed.

## Source identities

- `daemon/src/resources/packages.ts`: `E58BB3015FCB134DB84A88B9FA049DD4F7CB2FC2509719509D9531A3C5E3924A`
- `daemon/test/integration-resources.test.ts`: `3EDD465FC028BE94C6B66F9597B3412F1F391DA9057EC2B177D717F3EB9BA02D`

## Independent verification

- `npx --no-install vitest run test/integration-resources.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` in `daemon`: exit 0, **5 passed**, 213 ms, start 19:57:37 local time.
- `npx --no-install tsc -p tsconfig.json --noEmit` in `daemon`: exit 0.
- An earlier reviewer typecheck was mistakenly invoked from the repository root and resolved its unrelated `tsc` stub, which exited 1 with “This is not the tsc command you are looking for.” No package was installed. Re-running from the correct daemon directory used the actual compiler and passed; this was a reviewer command-location issue, not a product type failure.

The tests exercise actual filesystem resources and Windows directory junctions, not mocked path checks. They prove rejection of an internal junction redirect and a linked package root, preservation of the outside fixture content, exact manifest/content hashes, same-version replacement denial, immutable already-pinned runs across updates/removal, next-run changes, oversized/invalid-UTF8 input rejection, unknown hook fields and host accessor rejection. User-note bytes and the package directory listing remain unchanged by the registry; fixture updates are explicit test writes.

## Contract assessment

- Manifest schema is exact: versioned package identity, HTTPS source without credentials/query/fragment, a 40- or 64-hex revision, and 1–32 declarative skill/rule/knowledge entries. Entry IDs are unique and resource paths are deduplicated case-insensitively. The version has a bounded numeric-triplet/prerelease format; this is not a claim of a full SemVer parser or version-ordering resolver.
- Host-supplied manifest SHA binds raw manifest bytes. Each resource's declared byte length and SHA bind its separately read bytes; UTF-8 decoding is fatal. Limits are 32 KiB manifest, 64 KiB per resource and 1 MiB declared combined resource bytes. Reads allocate at most the applicable limit plus one and cannot expand indefinitely if a file grows.
- Paths allow only bounded relative `.md`, `.txt` or `.json` components and reject traversal, absolute/ADS forms, backslashes, reserved device names and the explicitly excluded sensitive-name families. This is a filename/type exclusion policy, not a general content-secret detector.
- The trusted root is resolved, package-root links are refused, and each component is checked for redirects, containment and file/directory shape. Open-handle identity, size/time checks and a post-read path inspection detect the supported drift cases. Descriptors are closed in finally. These checks do not turn concurrent mutation by an untrusted host process into a supported execution boundary; the module explicitly requires a trusted package root.
- Registration reads and validates all resources before changing registry maps. A same ID/version with a different manifest hash is rejected and cannot replace the active snapshot. Successful registration selects the version for future pins; it does not rewrite previously pinned resource objects.
- Snapshots and nested entries/arrays are frozen, including the decoded text and source/revision/hash metadata. A previously pinned run receives its same snapshot array after updates or removal. `remove` changes the active map only; it does not delete package or user files.
- Public operations are only `register`, `pinRun` and `remove`. Resource text confers no tool, model, verification, permission or executable-hook authority. There are no network requests, user-home writes, MCP installation or evaluation of resource content.

## Limits / remaining S6 work

The source URL and revision are declared provenance bound by a supplied manifest hash; this loader does not fetch the source or prove remote repository authenticity. Registering a package is not evidence that external reusable code has been adopted.

Run pins and version history exist only in memory. The composing host must call `pinRun` at the intended run boundary; the registry does not consult the ledger to discover when a run began, restore pins after restart, or garbage-collect completed-run/version history. This review does not prove durable app wiring, retrieval/indexing, Korean/English search accuracy, extension isolation, or full S6 completion.
