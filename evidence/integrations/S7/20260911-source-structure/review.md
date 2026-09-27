# Independent static source structure review

Verdict: PASS for the bounded standalone source report. No blocking defect found. This is not runtime dependency resolution, impact analysis, security qualification, browser QA or full S7 completion.

Done gate: source/parser/path audit, self-test exit 0, independently recaptured source inventory and graph matching saved evidence, HTML source/hash inspection, and exact script hash. Review cap 1; corrections, if needed, must go to the maker with a new hypothesis (maker cap 2). Only this review artifact was written by the reviewer.

Independent checks on 2026-09-11:
- `node scripts/reuse/cue-source-structure-report.mjs --self-test`: exit 0; AST/type/external/nonliteral syntax, changed bytes and inventory, junction skipping and invalid paths passed.
- Read-only import of exported captureSource/extractGraph: current source digest, saved source revision, complete import records and deduplicated edges all match result.json. 104 files, 212 edges. This operation did not regenerate or overwrite the report.
- HTML source contains the measured revision and source-declared-unverified scope. No external script/link/image HTTP assets found; CSP disables scripts and connections. Actual HTML hash equals delivery receipt. No browser/visual execution was performed; existing not-run receipt fields remain accurate.

SHA256:
- Script: 1FE3A54CE083103BDE0468638749114A4709AA5949462AEDD6CDCE16FACD236C
- HTML: 0496128E8D90AD161CAA1D5595DBCE0D15E4EA9D74DA3FCF0FBEB0BCB439AA67
- source.json: 033B0CDD461A26B94BBB2B17C2BF3AB42EAC27C4828453DFE9B2859B7FDF94D7
- Captured source revision: b8b24f8e10e29b3b898fb9e3dd52311b921a954c3aa9899db4a69b3669e76a78

Findings and limits:
- Uses the actual installed Rolldown parseSync AST with filename-based JS/TS/declaration grammar. Parse errors fail; string/comment text is not searched as fake imports. Dynamic import, type query and require syntax remain labeled observations; require identifiers are explicitly not binding-resolved.
- Only fixed app and daemon/src roots are traversed. Root links reject, descendant links are recorded as skipped, excluded directories are not descended into, paths and UTF-8 are constrained, and file/total/entry/import/AST limits bound accepted input. App references to daemon/dist stay outside-source-roots; compiled product sources were not manually read.
- Exact source paths and .js/.mjs/.cjs source-extension counterparts are distinguished. No alias, package, extensionless/index or runtime loader resolution is invented. Deduplication merges identical source-to-target pairs only; original per-import kind/offset/resolution records remain available.
- Full inventory and file bytes are checked before publication, and the revision binds ordered paths/hashes/lengths plus skipped links. Independent recapture confirms this actual artifact. As the maker states, this is not an OS-atomic snapshot or protection against hostile concurrent replace-and-restore races.
- HTML is produced through existing compiled IR/renderer/delivery; no arbitrary source executes during traversal. Its receipt accurately retains directory-metadata-not-guaranteed durability and unrun browser/upstream checks. Current report hashes are artifact integrity evidence, not proof of semantic correctness of every downstream renderer or parser dependency.

No network, model request, external child process, download, global setting or product source change was part of this review. Self-test created and removed its own temporary fixture only.
