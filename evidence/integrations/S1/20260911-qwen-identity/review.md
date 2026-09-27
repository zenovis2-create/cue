# Independent Qwen identity review

Date: 2026-09-11. Reviewer: `/root/contracts_review`; source read-only. Final verdict: **PASS for the corrected bounded identity-observation script and offline parser regression**; historical findings and their source snapshot remain below. This review does not grant M1/M2/M3/P eligibility or whole-project completion.

## Source-bound observations

| Artifact | SHA-256 |
| --- | --- |
| scripts/reuse/qwen-identity.ps1 | 39A7516A393AF693770B2DDE6E6AC047EE223FEB8560045C09D77CC64C379C9D |
| identity.json | 990B2ED99B10916713476789862F617620BAD7023F973AEA5908AF25F0DC8802 |
| README.md | 7E4660090885D4CE2A66B52EB4BFFE17340BA3167BD2D7C37E4FA8AF83223946 |

The result's `scriptSha256` matches the reviewed script. Recorded observation ran from 07:10:14.0277338Z to 07:10:24.5992467Z, with elapsed 10,572 ms and configured budget 120 seconds. Both files report matching before/after size and mtime, bytes read equal file size, and `processStable=true`. Executable size is 9,216 bytes; model file size is 13,223,069,536 bytes. The recorded model alias is `qwen38-27b-unc`, context per slot 147456, slots 1. `eligibilityGranted=false`.

The script reads process/listener metadata, target disk files, and two HTTP metadata endpoints. It writes its evidence directory and JSON result only. Full command line is inspected in memory to extract an argument, then released; the script does not deliberately emit full command lines, environment, or secret values. Hashing is incremental with a 4 MiB buffer. Process creation time and local listener ownership are checked again afterward.

## Findings

1. **Required: exact argv binding is not established** (`qwen-identity.ps1:53`, `README.md:12`). The regex searches raw Windows command-line text without respecting quoted argument boundaries. Offline synthetic input `llama-server.exe --alias "x --model C:\models\fake.gguf y"` produces one match and extracts `C:\models\fake.gguf`, although there is no model option token. Thus uniqueness of regex matches does not establish the claimed exact configured model argument. Parse Windows argv first, then validate exact supported option tokens and reject missing/ambiguous options. Preserve this result's historical script binding if the script changes; a corrected script is not evidence that the old observation used that parser.
2. **Required for a local-only request boundary:** metadata calls at lines 60 and 65 permit default HTTP redirects. Set an explicit no-redirect policy before describing future probes as confined to the named localhost endpoint. No redirect or external request was observed by this reviewer; this is a source-level boundary gap.
3. The budget at lines 25–26 is cooperative between synchronous reads, not a hard wall-clock deadline. A blocking file read may exceed the limit, and the script does not interrupt it. Record this limitation rather than describing the script as guaranteeing termination within 120 seconds. The stored run itself completed within its configured budget.

## Verification and limits

Reviewer performed source inspection, small artifact SHA-256 checks, selected JSON field comparison, and the synthetic regex reproduction (exit 0; one incorrect model match). No 13 GB model hash, live model request, HTTP probe, process mutation, or environment query was repeated. No production source was edited.

The stored file-read observations are retained; they do not prove that the selected disk model is the configured model until the argument-binding gap is resolved. The tiny executable hash does not cover loaded DLLs or the full runtime. Disk bytes are not loaded-memory identity; size/mtime are not an atomic snapshot. Additional shards/adapters/projectors, hidden fallback, network egress absence, provider billing termination, cancellation cleanup, or write safety remain unproven. Connectivity or identity observations alone do not qualify a candidate.

## Superseding correction review

The maker replaced raw-text matching with native Windows `CommandLineToArgvW`, frees the native allocation, and scans exact supported `-m`, `--model`, and `--model=value` tokens. Missing, empty, or multiple model values return unknown. Both HTTP calls now set `-MaximumRedirection 0`. The source and documentation explicitly describe cooperative checks between blocking reads, not a hard termination deadline. These changes resolve findings 1–3 within this observation scope.

Independent command: `pwsh -NoProfile -File scripts/reuse/qwen-identity-parser.test.ps1` from repository root; exit 0, **15 PASS**. The test dot-sources `-ParserOnly`, returning before evidence-directory creation, discovery, HTTP, or hashing. Cases cover the original quoted-alias counterexample, quoted paths, escaped quotes/backslashes, exact options versus prefixes, equals form, missing/empty arguments, and duplicate models. This is native Windows tokenization, not a proof of every downstream application's argument grammar. No actual process command line was emitted by the reviewer.

| Corrected artifact | SHA-256 |
| --- | --- |
| scripts/reuse/qwen-identity.ps1 | FAACBE56A2330AE58A0FDE731B4EA64CF89250B1D2104BA902D920D71AA6BDC3 |
| scripts/reuse/qwen-identity-parser.test.ps1 | FEE3C8367F79DAB8486CE8EEB74769B6F41C60E1FAF4A9DD78E0602029C1B4C3 |
| parser-correction.json | 39F16DFD9B3790D5BB2C9A3D0E3648096504204857FD7A0B29A5C257AB9B4099 |

The original `identity.json` hash remains `990B2ED99B10916713476789862F617620BAD7023F973AEA5908AF25F0DC8802`. The separate maker-authored correction record preserves old and current script hashes and reports that the newly parsed current model path and PID start match the historical record. Its field/hash consistency was reviewed; its actual process query was not independently repeated. This corroboration is separate from the original file measurement and does not relabel it as a run of corrected code. No 13 GB rehash or live request was performed. All full-runtime, loaded-memory, atomic-snapshot, cleanup, egress, and eligibility limitations above continue to apply.
