# Independent installation identity helper review

Result: no actionable blocker found within the helper's stated scope. Independent **14 PASS** at 2026-09-11 21:41:37 local time, duration 2.23 seconds. No model calls or product edits.

Reviewed SHA-256:

- `app/installation-identity.mjs`: `3E5DFBE46F2ADDBF60099C392C4B766E265849639D21160F855AD710944D8354`
- `app/installation-identity.d.mts`: `720E4054CFDB1840723B5D47A61ED328F62055F1093BDE1ACC3D630F0AF9233E`
- `daemon/test/integration-installation-identity.test.ts`: `A31D246083979EE6CC291D5E1AA6809A896494DFE04705DC296A1D9250ABD998`

The helper imports only Node builtins and does not execute any inventoried project loader or native addon. Fixture files deliberately throw if executed, including fake native bytes; capture and exact recapture still pass. Snapshot and nested entries are frozen, and assertCurrent remeasures rather than trusting cached filenames.

The inventory includes fixed app/source/compiled/migration trees, package/lock files and the full better-sqlite3 subtree. Supported package identity is explicitly better-sqlite3 13.0.3 with its own lib/index.js loader and node-addon-api as its only declared dependency; at least one native file is required and all present native files are hashed. It does not reuse the obsolete external bindings-loader assumption. Runtime executable bytes, Node/Electron/ABI/platform/architecture and the helper's own file identity are captured separately.

Component-by-component canonical path checks reject symlinks/junction escapes. File descriptors are compared with the initial path metadata before hashing, bytes are bounded, descriptor/path metadata are checked afterward, and a full second inventory detects directory/file-set drift. Limits are 256 MiB per file, 1 GiB total hashed data, 8192 entries and depth 32. Read growth exceeding the originally observed file size fails immediately rather than extending an unbounded stream.

Tests verify source, compiled output, migration, lock, loader and native mutations; added/deleted files; unsupported package/dependency versions; missing native files; oversized files; actual junction escapes and getter rejection. Command: `npx vitest run test/integration-installation-identity.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` from daemon, exit 0. Maker reports build exit 0; no repeat shared build was needed for this JavaScript helper review.

Limits are material: callers must capture before importing project/native code, bind the supplied roots to the actual loader roots, and assert after dynamic imports and before issuance/dispatch. The helper itself does not detect or erase already-loaded modules, inspect arbitrary Node preload/module-loader configuration, prove that an entry point followed this sequence, or discover arbitrary third-party runtime dependencies. Entry/main/collector wiring remains separate and unproven here. Host-exclusive roots and trusted builtins/OS/helper import are preconditions; hostile write-and-revert or changes before the helper's trusted import are explicitly outside its guarantee. This helper pass is neither production qualification nor evidence that stale loaded code has already been prevented in the application.
