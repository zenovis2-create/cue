# S5 measured-fact Core containment results

Date: 2026-09-12 KST

Status: **containment PASS**; original Unit 1 remains FINAL BLOCKED.

Product Core no longer constructs the unverified measured-fact store. Both `captureEvaluationMeasuredFact` and `readEvaluationMeasuredFact` synchronously throw the stable error `evaluation_measured_fact_component_unverified`. This occurs before workspace lookup, host capture, evidence resolution, terminal validation, or database writes. Extra caller fields cannot enable the path.

Validation:

- containment plus existing evaluation Core regression: 2/2 PASS;
- host callback count: 0;
- measured-fact writes: 0;
- `node --check ../app/core.mjs`: PASS;
- `tsc --noEmit --incremental false`: PASS;
- `npm run build`: PASS;
- scoped `git diff --check`: PASS, with existing LF/CRLF notices only.

Frozen hashes:

- `app/core.mjs`: `bbc7e32b0424e654b8c3cd139a80a83ce8103477ca70f77c86570064c49a7c27`
- `app/core.d.mts`: `5074acc0fd2bede75ceed0e68412932c3d72fc77bde2be5e075d490131a7d1bf`
- containment test: `935031b9f492f27bc9d1b0953e9c8ac9f0ccf84bf97ab91ff01e07418635de4c`
- existing Core regression: `2b6487481fdc5cbac44be35e0c9850fed64b5cce8013e57c2bc45370eb97d53a`

The first containment test attempt was externally blocked before Core construction because concurrent S4 source referenced migration 036 before it had been copied to `dist`. A normal build copied the shared asset; the unchanged containment tests then passed. This was not a containment failure.

Boundary: migration 034, registries, and the direct measured-fact store remain frozen and FINAL BLOCKED with the original three review blockers. This containment does not repair or approve them, does not close any S5 checklist line, and creates no live or production measurement claim.

Independent containment review: PASS. Review SHA-256: `bb4295b39d17dbf7c79a16d2d699fc230e514424e2224b3aa0452afe60c2e9d0`.
