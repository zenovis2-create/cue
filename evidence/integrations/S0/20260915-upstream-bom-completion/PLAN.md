# Applicable upstream source/BOM completion plan

## Done

The catalog distinguishes externally selected bytes from research-only candidates, aligns every claimed limited source with the immutable revision in its reuse decision, records retrieved LICENSE/NOTICE/API/seam evidence hashes plus runtime/install/update facts, and lists exact remaining unknowns. It must not turn source metadata into a compatibility or legal verdict and must keep every adoption authorization false. Existing reuse-manifest validation must remain green.

## Attempt cap

Three correction passes. Each failed validation or independent finding requires a new hypothesis. Preserve fetched response hashes and do not execute or install fetched code.

## Per-pass gate

Validate JSON parsing and catalog invariants, run the existing reuse-manifest focused test and four manifest CLI validations, verify every evidence-file hash, and run scoped diff checking. Independent review must confirm scope/revision/source facts before completion.

## Boundaries

Only `docs/reuse-decisions/upstream-source-catalog.json` and this evidence directory may change. No six main integration documents, product source, dependencies, installation, provider/model call, credential, native helper, or fetched-code execution.
