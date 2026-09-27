# Independent actual-run review

Status: **PASS for the single retained actual generator run.** I did not rerun the generator, tests, or build.

## Audited receipt

- `actual-command.json` records tool receipt `97adfd`, exit code 0, and parseable stdout whose value exactly matches its structured result.
- The result is `ready:true` and `reused:true`. Its generation and snapshot digest are both `097ef304a7ea63788d36e0c6951f2ca323340c6f198a926e7ca07f7d6cf7fcd5`, matching the generation recorded before the run.
- The reported structure and comparison hashes match the corresponding retained generation artifacts.
- The generator source remains at the independently reviewed SHA-256 `7F9C8A75DF1AD4194FCE0869A914EA4D3B9DC6F7B4309C29C5AAAE6215688455`.

## Before/after integrity

- `actual-before.json` and `actual-after.json` contain the same 14 paths with zero added, missing, or changed hashes: generator source, current pointer, six active-generation files, and six files in the preserved failed staging directory.
- A read-only comparison against the current filesystem also found zero mismatches across those 14 hashes.
- The current pointer still selects `generations/097ef304a7ea63788d36e0c6951f2ca323340c6f198a926e7ca07f7d6cf7fcd5`; its manifest hash matches the retained `generation.json` hash.
- The staging-directory inventory is unchanged and contains only `.staging-cb93d71b-d95d-4ed7-9980-e15e71db330b`. No new staging directory remains, and all six preserved-stage file hashes are unchanged.

The retained evidence supports one successful reuse of the byte-identical active generation without rewriting the pointer, generation, or historical failed stage. This review makes no claim about any additional generator execution.
