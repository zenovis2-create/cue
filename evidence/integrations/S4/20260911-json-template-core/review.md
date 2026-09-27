# Independent explicit JSON preparation and bootstrap delta review

Verdict: PASS for explicit JSON preparation and the narrow default-bootstrap input tightening. No blocking defect found. No native/model execution, live qualification or main activation was performed.

Completion gate: source/type audit, focused tests, typecheck and current file hashes. Review cap 1; no product edits by reviewer. Test maker and parent production maker are separate from this reviewer. Prior bootstrap review remains historical for its prior source; this document covers the subsequent explicit-input delta.

Independent validation on 2026-09-11:
- cwd daemon: `npx --no-install vitest run test/integration-json-template-core.test.ts test/integration-driver-core.test.ts test/integration-resource-core.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`: 13 passed, exit 0, 21:45:24, 2.92 s.
- After bootstrap delta stabilized: `npx --no-install vitest run test/integration-default-generated-json-bootstrap.test.ts test/integration-json-template-core.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`: 17 passed, exit 0, 21:46:10, 1.67 s. The two commands overlap; these are not 30 distinct tests.
- `npx --no-install tsc -p tsconfig.json --noEmit`: exit 0 on the final reviewed snapshot.

Confirmed:
- prepareJsonTemplate accepts exact plain-data templateId/inputText/autonomy/selectionMode fields. Proxy/accessor/inherited/extra fields, invalid UTF-8 roundtrip, malformed JSON, oversized bytes and invalid choices fail before writes.
- Each preparation owns a frozen run.template and exact bytes; no mutable current-editor callback supplies later input. Separate inputs/modes retain independent targets. The private run extension is not included in the public approval DTO.
- Existing driver preparation binds real generated-output target data. Core checks exactly one formatted-json target, matching input SHA256 and UTF-8 byte length, inside its outer transaction before publishing the core prepared map. A mismatched capture rolls back task/run/pin/plan/requirements/generated target and cannot be approved. Subsequent valid preparation succeeds.
- Existing driver rollback handling can retain a private rejected entry until stop/settled/close; persisted-state checks prevent activation, and test teardown successfully clears the rolled-back preparation. This is not a claim of immediate deletion from every private map.
- Public approval includes metadata and fixed formatting purpose, not JSON input text. Tests verify private markers and Korean input values do not occur in serialized approval.
- requiresExplicitTemplate is opt-in for general hosts. Flagged hosts refuse free-form prepareGoal; explicitly constructed legacy hosts retain their existing behavior.
- Default bootstrap no longer accepts authority.inputForRun. It derives input only from exact run.template {id,inputText} and returns a frozen host with requiresExplicitTemplate:true. Missing template is rejected; non-JSON goal prose does not replace explicit JSON bytes. Existing same-DB evidence and mandatory loaded-installation guards remain in place.

Limits: tests compose actual core, driver, generated target store and local host around synthetic qualification data and no-launch executor seams. They prove preparation and rollback contracts, not real Qwen execution or production loaded-code identity. Basic JSON parsing is followed by the existing generated-template checker bounds; this does not establish arbitrary document/code semantics. IPC/UI template entry, fresh Electron qualification and actual default startup remain separate gates.

Current SHA256:
- app/core.mjs: 1905EEE6C122F1158A6C88132B5F1E5A1B1083A87825666295DDFD0F3B691CAA
- app/core.d.mts: 3463119AB7E94005035631FAA835F45F97F3A9C7089D5F029E6418EA08C19EEF
- app/orchestration-driver.d.mts: 3429F1F36D59C118864A995C1B2E0BF08FEA66ADC53BDF919AFDE00B69A4D5F0
- daemon/test/integration-json-template-core.test.ts: 76C119CC49210B1BB79B4BD73201B76DC422E2E2FEB9D4ADDD54D649118C1DC9
- app/default-generated-json-bootstrap.mjs: 8BC37DB499314E6FEE189859F25E5A786D93A356F7F958E11DD216106387F452
- app/default-generated-json-bootstrap.d.mts: 3AC7BDD4CBF0748C3CA2B60D48482B652E1ABB4D0ED83A14C2101E800B570A01
- daemon/test/integration-default-generated-json-bootstrap.test.ts: DC54D0AD9FFC235B65D92C681BED329B742C628F89D7C73A5FFDA4351C56EAAC

