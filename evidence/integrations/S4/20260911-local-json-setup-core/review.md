# Independent core local JSON setup review

Verdict: PASS after one diagnosed metadata correction. No remaining blocker found. Scope is protected core setup/readiness behavior, not main activation or live execution.

Done gate: read-only source review, focused setup/core/template/preference tests, typecheck and hashes. Correction cap 2; parent maker performed one source correction. Reviewer made no product edits and wrote only this artifact.

Finding resolved: localJsonSetup initially treated any generated JSON host as available beside accountingKind local-invocation, including a monetary generated host. It now requires supported V2 settings, enabled intent, generated parent, actual local-invocation host and no restart flag. The strengthened existing monetary-host fixture stores enabled V2 settings with restartRequired=false and still verifies available=false; the assertion therefore tests accounting-kind separation, not merely absent settings.

Independent gates, 2026-09-11:
- Initial setup/template/preference gate: 11 passed, exit 0, 21:57:59, 2.15 s; source review identified the untested readiness mismatch despite passing tests.
- Final cwd daemon: `npx --no-install vitest run test/integration-local-json-setup-core.test.ts test/integration-driver-core.test.ts test/integration-json-template-core.test.ts test/integration-selection-preference-core.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`: exit 0, 15 passed in 4 files, 22:00:20, 3.19 s.
- Final `npx --no-install tsc -p tsconfig.json --noEmit`: exit 0.

Confirmed:
- Read API projects fixed setup metadata, bounded persisted limits and reference state only; no raw input, arbitrary paths, policy authority or qualification payload is exposed. Reads do not write to the ledger.
- configureLocalJson takes exact own-data expectedRevision/enabled/limits and supplies its own timestamp. Existing protected atomic setup service owns policy/settings creation. Invalid input/getters and CAS conflicts do not set restartRequired.
- Only a successful save sets restartRequired. New goal/template preparation and mode changes are blocked until a deliberate restart. Existing prepared records, their approval data and runtime ownership are not replaced or retroactively edited.
- Existing prepared approval remains valid as its prior immutable contract. This is not a live driver replacement or an implicit cancellation feature.
- Reopening restores exact settings/limits and clears the process-local restart flag. A deliberately constructed legacy core still reports local setup unavailable; no legacy fallback is activated by setup.
- Tests observe no session or capability-evidence creation. Enabled configuration is not authentication, M qualification or permission to invoke a model. Fixed IDs/endpoint identify the intended supported pair, with ranking explicitly not performed.

Limits: no active real model/native worker was used. Tests prove preparation/approval preservation and zero invocation during setup, not all live runtime lifecycle scenarios. UI/IPC setup operations and actual Electron bootstrap are separately owned and remain outside this review.

Final SHA256:
- app/core.mjs: B1795BD75AEA1B26A1E89146AD315DC60C0D704BDDF9A218FA44DDB21D17A17B
- app/core.d.mts: 850E5DB4ED97067D8A6FA43656B0AB5628B20F08E605FBD960913E7E04CA3D86
- daemon/test/integration-local-json-setup-core.test.ts: 68A5DD80E0325EDC1F4EC5374D19B50EF845542DBDA5CD946D67863B01023164
- daemon/test/integration-driver-core.test.ts: 6FF7F43B597DCCA3D7DC088D01AB45D46E7897D4BEF657091E56F7E40AA8599D

