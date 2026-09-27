# Native boundary regression implementation

Date: 2026-09-12 KST

`change-snapshot-host.ts` now invokes the fixed reviewed helper through `runProcessSync`, the sole sealed child-process boundary. The helper path, import-time and pre/post execution hashes, five-second timeout, 24 MiB process-output limit, 16 MiB protocol bound, hidden window, and `shell:false` behavior remain intact.

The guarded-entry synthetic installation fixture now copies the exact source and compiled helper executable and manifest into the paths required by the current installation identity closure. It asserts source/compiled hashes match before launching the child; it does not fabricate native identity assets or weaken capture.

## Gates

- Combined six-file `p4`, `p45`, native snapshot, journal-review, guarded-entry, and installation-identity command: exit 0, **53 passed / 3 skipped**. The skips are explicit platform/real-installation gates.
- Scoped `git diff --check`: exit 0.
- Final daemon build reached TypeScript but is temporarily blocked by concurrent S5 edits in `src/evaluation/measured-facts.ts` at lines 25, 26, and 29 (`kind` nullable and `authoritative` possibly undefined). Neither owned file appears in the diagnostics.

## SHA-256

- `daemon/src/change-snapshot-host.ts`: `5B45D38462CBD220C9C27B464391E95143E131E2D4ED7CF23183195A6A510F43`
- `daemon/test/integration-guarded-entry.test.ts`: `98650578D8F103485ED3240AED58B4260CB7813D46B7D66D2763A0D755E98E63`

The native tests execute only the reviewed read-only snapshot helper against owned temporary directories. No provider/model calls, downloads, or production executor sandbox calls were made.

The hashes above cover the final owned source after this correction. The recorded build failure belongs to concurrently changing S5 source and is not a clean whole-tree build result for this source generation; root will rerun the build after the joint source freeze.
