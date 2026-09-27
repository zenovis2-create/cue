import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { buildDefault as renderDefaultReadonlyWfpLauncher } from './build-readonly-wfp-launcher.mjs';
const sha256 = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const { EXISTING_FILE_WORKLOAD_SHA256 } = await import('../dist/src/evaluation/workload-release.js');
const workloadSource = new URL('../evaluation/existing-files-v1.json', import.meta.url);
if (sha256(workloadSource) !== EXISTING_FILE_WORKLOAD_SHA256) throw Error('evaluation_workload_release');
mkdirSync(new URL('../dist/evaluation/', import.meta.url), { recursive: true });
copyFileSync(workloadSource, new URL('../dist/evaluation/existing-files-v1.json', import.meta.url));
if (sha256(new URL('../dist/evaluation/existing-files-v1.json', import.meta.url)) !== EXISTING_FILE_WORKLOAD_SHA256) throw Error('evaluation_workload_release');
const reviewedHelperSha256 = '82ff0f80ecb63293de0eed39296bf66ad51b4cfdeee2d8d7aaea062fae80d07e';
const nativeRoot = new URL('../native/change-snapshot/', import.meta.url);
const nativeManifestUrl = new URL('manifest.json', nativeRoot);
const nativeManifest = JSON.parse(readFileSync(nativeManifestUrl, 'utf8'));
const failNative = reason => { throw new Error(`change_snapshot_asset_invalid:${reason}`); };
if (nativeManifest?.schema !== 'cue-native-helper-manifest-v1' || nativeManifest?.protocol !== 'cue-change-snapshot-v1'
  || nativeManifest?.artifact?.path !== 'change-snapshot.exe' || nativeManifest?.artifact?.platform !== 'win32'
  || nativeManifest?.artifact?.arch !== 'x64' || nativeManifest?.artifact?.sha256 !== reviewedHelperSha256
  || !Array.isArray(nativeManifest?.sources) || nativeManifest.sources.length !== 5) failNative('manifest');
for (const entry of [nativeManifest.artifact, ...nativeManifest.sources]) {
  if (!entry || typeof entry.path !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256)
    || entry.path.includes('/') || entry.path.includes('\\') || sha256(new URL(entry.path, nativeRoot)) !== entry.sha256) failNative(entry?.path ?? 'entry');
}
mkdirSync(new URL('../dist/migrations/', import.meta.url), { recursive: true });
copyFileSync(new URL('../migrations/001_init.sql', import.meta.url), new URL('../dist/migrations/001_init.sql', import.meta.url));
copyFileSync(new URL('../migrations/002_p5.sql', import.meta.url), new URL('../dist/migrations/002_p5.sql', import.meta.url));
copyFileSync(new URL('../migrations/003_p6.sql', import.meta.url), new URL('../dist/migrations/003_p6.sql', import.meta.url));
copyFileSync(new URL('../migrations/004_p7.sql', import.meta.url), new URL('../dist/migrations/004_p7.sql', import.meta.url));
copyFileSync(new URL('../migrations/005_p8.sql', import.meta.url), new URL('../dist/migrations/005_p8.sql', import.meta.url));
copyFileSync(new URL('../migrations/006_p10c.sql', import.meta.url), new URL('../dist/migrations/006_p10c.sql', import.meta.url));
copyFileSync(new URL('../migrations/007_workspace_write_lease.sql', import.meta.url), new URL('../dist/migrations/007_workspace_write_lease.sql', import.meta.url));
copyFileSync(new URL('../migrations/008_integration_budget.sql', import.meta.url), new URL('../dist/migrations/008_integration_budget.sql', import.meta.url));
copyFileSync(new URL('../migrations/009_selection_policy.sql', import.meta.url), new URL('../dist/migrations/009_selection_policy.sql', import.meta.url));
copyFileSync(new URL('../migrations/010_orchestration.sql', import.meta.url), new URL('../dist/migrations/010_orchestration.sql', import.meta.url));
copyFileSync(new URL('../migrations/011_capability_evidence.sql', import.meta.url), new URL('../dist/migrations/011_capability_evidence.sql', import.meta.url));
copyFileSync(new URL('../migrations/012_stage_envelope.sql', import.meta.url), new URL('../dist/migrations/012_stage_envelope.sql', import.meta.url));
copyFileSync(new URL('../migrations/013_requirement_contract.sql', import.meta.url), new URL('../dist/migrations/013_requirement_contract.sql', import.meta.url));
copyFileSync(new URL('../migrations/014_requirement_acceptance.sql', import.meta.url), new URL('../dist/migrations/014_requirement_acceptance.sql', import.meta.url));
copyFileSync(new URL('../migrations/015_selection_preference.sql', import.meta.url), new URL('../dist/migrations/015_selection_preference.sql', import.meta.url));
copyFileSync(new URL('../migrations/016_orchestration_retry.sql', import.meta.url), new URL('../dist/migrations/016_orchestration_retry.sql', import.meta.url));
copyFileSync(new URL('../migrations/017_generated_output.sql', import.meta.url), new URL('../dist/migrations/017_generated_output.sql', import.meta.url));
copyFileSync(new URL('../migrations/018_cleanup_observation.sql', import.meta.url), new URL('../dist/migrations/018_cleanup_observation.sql', import.meta.url));
copyFileSync(new URL('../migrations/019_resource_store.sql', import.meta.url), new URL('../dist/migrations/019_resource_store.sql', import.meta.url));
copyFileSync(new URL('../migrations/020_local_host_settings.sql', import.meta.url), new URL('../dist/migrations/020_local_host_settings.sql', import.meta.url));
copyFileSync(new URL('../migrations/021_local_invocation_budget.sql', import.meta.url), new URL('../dist/migrations/021_local_invocation_budget.sql', import.meta.url));
copyFileSync(new URL('../migrations/022_local_selection_policy.sql', import.meta.url), new URL('../dist/migrations/022_local_selection_policy.sql', import.meta.url));
copyFileSync(new URL('../migrations/023_retrospective.sql', import.meta.url), new URL('../dist/migrations/023_retrospective.sql', import.meta.url));
copyFileSync(new URL('../migrations/024_native_execution_identity.sql', import.meta.url), new URL('../dist/migrations/024_native_execution_identity.sql', import.meta.url));
copyFileSync(new URL('../migrations/025_attempt_selection.sql', import.meta.url), new URL('../dist/migrations/025_attempt_selection.sql', import.meta.url));
copyFileSync(new URL('../migrations/026_evaluation_enrollment.sql', import.meta.url), new URL('../dist/migrations/026_evaluation_enrollment.sql', import.meta.url));
copyFileSync(new URL('../migrations/027_evaluation_observation.sql', import.meta.url), new URL('../dist/migrations/027_evaluation_observation.sql', import.meta.url));
copyFileSync(new URL('../migrations/028_evaluation_trial_projection.sql', import.meta.url), new URL('../dist/migrations/028_evaluation_trial_projection.sql', import.meta.url));
copyFileSync(new URL('../migrations/029_evaluation_baseline.sql', import.meta.url), new URL('../dist/migrations/029_evaluation_baseline.sql', import.meta.url));
copyFileSync(new URL('../migrations/030_evaluation_comparison.sql', import.meta.url), new URL('../dist/migrations/030_evaluation_comparison.sql', import.meta.url));
copyFileSync(new URL('../migrations/031_orchestration_handoff_activity.sql', import.meta.url), new URL('../dist/migrations/031_orchestration_handoff_activity.sql', import.meta.url));
copyFileSync(new URL('../migrations/032_provider_execution_lifecycle.sql', import.meta.url), new URL('../dist/migrations/032_provider_execution_lifecycle.sql', import.meta.url));
copyFileSync(new URL('../migrations/033_orchestration_handoff_integrity.sql', import.meta.url), new URL('../dist/migrations/033_orchestration_handoff_integrity.sql', import.meta.url));
copyFileSync(new URL('../migrations/034_evaluation_measured_fact.sql', import.meta.url), new URL('../dist/migrations/034_evaluation_measured_fact.sql', import.meta.url));
copyFileSync(new URL('../migrations/035_orchestration_wait_checkpoint.sql', import.meta.url), new URL('../dist/migrations/035_orchestration_wait_checkpoint.sql', import.meta.url));
copyFileSync(new URL('../migrations/036_s4_recovery_revision.sql', import.meta.url), new URL('../dist/migrations/036_s4_recovery_revision.sql', import.meta.url));
copyFileSync(new URL('../migrations/037_s4_change_recovery.sql', import.meta.url), new URL('../dist/migrations/037_s4_change_recovery.sql', import.meta.url));
copyFileSync(new URL('../migrations/038_s4_native_change_journal.sql', import.meta.url), new URL('../dist/migrations/038_s4_native_change_journal.sql', import.meta.url));
copyFileSync(new URL('../migrations/039_readonly_verifier_identity.sql', import.meta.url), new URL('../dist/migrations/039_readonly_verifier_identity.sql', import.meta.url));
copyFileSync(new URL('../migrations/040_initial_default.sql', import.meta.url), new URL('../dist/migrations/040_initial_default.sql', import.meta.url));
copyFileSync(new URL('../migrations/041_exploration_budget.sql', import.meta.url), new URL('../dist/migrations/041_exploration_budget.sql', import.meta.url));
copyFileSync(new URL('../migrations/042_exploration_consent.sql', import.meta.url), new URL('../dist/migrations/042_exploration_consent.sql', import.meta.url));
copyFileSync(new URL('../migrations/043_account_identity.sql', import.meta.url), new URL('../dist/migrations/043_account_identity.sql', import.meta.url));
copyFileSync(new URL('../migrations/044_selection_policy_promotion.sql', import.meta.url), new URL('../dist/migrations/044_selection_policy_promotion.sql', import.meta.url));
mkdirSync(new URL('../dist/native/change-snapshot/', import.meta.url), { recursive: true });
copyFileSync(new URL('change-snapshot.exe', nativeRoot), new URL('../dist/native/change-snapshot/change-snapshot.exe', import.meta.url));
copyFileSync(nativeManifestUrl, new URL('../dist/native/change-snapshot/manifest.json', import.meta.url));
if (sha256(new URL('../dist/native/change-snapshot/change-snapshot.exe', import.meta.url)) !== nativeManifest.artifact.sha256
  || sha256(new URL('../dist/native/change-snapshot/manifest.json', import.meta.url)) !== sha256(nativeManifestUrl)) failNative('copy');
mkdirSync(new URL('../dist/src/', import.meta.url), { recursive: true });
mkdirSync(new URL('../dist/src/verification/', import.meta.url), { recursive: true });
copyFileSync(new URL('../src/verification/json-format-checker.cjs', import.meta.url), new URL('../dist/src/verification/json-format-checker.cjs', import.meta.url));
copyFileSync(new URL('../src/json-checker-client.cjs', import.meta.url), new URL('../dist/src/json-checker-client.cjs', import.meta.url));
copyFileSync(new URL('../src/verification/goal-proposal-checker.cjs', import.meta.url), new URL('../dist/src/verification/goal-proposal-checker.cjs', import.meta.url));
copyFileSync(new URL('../src/goal-proposal-checker-client.cjs', import.meta.url), new URL('../dist/src/goal-proposal-checker-client.cjs', import.meta.url));
copyFileSync(new URL('../src/network-guard.cjs', import.meta.url), new URL('../dist/src/network-guard.cjs', import.meta.url));
copyFileSync(new URL('../src/appcontainer-launch.ps1', import.meta.url), new URL('../dist/src/appcontainer-launch.ps1', import.meta.url));
copyFileSync(new URL('../src/readonly-verifier-launch.ps1', import.meta.url), new URL('../dist/src/readonly-verifier-launch.ps1', import.meta.url));
copyFileSync(new URL('../../scripts/reuse/native/readonly-wfp-collector.cs', import.meta.url), new URL('../dist/src/readonly-wfp-collector.cs', import.meta.url));
copyFileSync(new URL('../src/readonly-wfp-observation.cs', import.meta.url), new URL('../dist/src/readonly-wfp-observation.cs', import.meta.url));
writeFileSync(new URL('../dist/src/readonly-verifier-wfp-launch.ps1', import.meta.url), renderDefaultReadonlyWfpLauncher(), 'utf8');
copyFileSync(new URL('../src/appcontainer-profile-cleanup.ps1', import.meta.url), new URL('../dist/src/appcontainer-profile-cleanup.ps1', import.meta.url));
copyFileSync(new URL('../src/model-only-launch.ps1', import.meta.url), new URL('../dist/src/model-only-launch.ps1', import.meta.url));
copyFileSync(new URL('../src/model-only-profile-cleanup.ps1', import.meta.url), new URL('../dist/src/model-only-profile-cleanup.ps1', import.meta.url));
copyFileSync(new URL('../src/native-process-observation.ps1', import.meta.url), new URL('../dist/src/native-process-observation.ps1', import.meta.url));
copyFileSync(new URL('../src/model-only-client.cjs', import.meta.url), new URL('../dist/src/model-only-client.cjs', import.meta.url));
copyFileSync(new URL('../src/model-boundary-probe.cjs', import.meta.url), new URL('../dist/src/model-boundary-probe.cjs', import.meta.url));
copyFileSync(new URL('../src/job-object-launch.ps1', import.meta.url), new URL('../dist/src/job-object-launch.ps1', import.meta.url));
copyFileSync(new URL('../migrations/045_handoff_cost_attribution.sql', import.meta.url), new URL('../dist/migrations/045_handoff_cost_attribution.sql', import.meta.url));
copyFileSync(new URL('../migrations/046_change_publication.sql', import.meta.url), new URL('../dist/migrations/046_change_publication.sql', import.meta.url));
copyFileSync(new URL('../migrations/047_attempt_staging_authority.sql', import.meta.url), new URL('../dist/migrations/047_attempt_staging_authority.sql', import.meta.url));
copyFileSync(new URL('../migrations/048_attempt_staging_discard.sql', import.meta.url), new URL('../dist/migrations/048_attempt_staging_discard.sql', import.meta.url));
copyFileSync(new URL('../migrations/049_cost_observation.sql', import.meta.url), new URL('../dist/migrations/049_cost_observation.sql', import.meta.url));
copyFileSync(new URL('../migrations/050_native_runtime_receipt.sql', import.meta.url), new URL('../dist/migrations/050_native_runtime_receipt.sql', import.meta.url));
copyFileSync(new URL('../migrations/051_attempt_staging_task_authority.sql', import.meta.url), new URL('../dist/migrations/051_attempt_staging_task_authority.sql', import.meta.url));
copyFileSync(new URL('../migrations/052_evaluation_staged_input.sql', import.meta.url), new URL('../dist/migrations/052_evaluation_staged_input.sql', import.meta.url));
copyFileSync(new URL('../migrations/053_workspace_management.sql', import.meta.url), new URL('../dist/migrations/053_workspace_management.sql', import.meta.url));
copyFileSync(new URL('../migrations/054_run_session_epoch.sql', import.meta.url), new URL('../dist/migrations/054_run_session_epoch.sql', import.meta.url));

// These daemon modules share the app's privately issued installation identity.
// tsc preserves source-relative imports although dist adds one directory level.
// Relocate only this exact import; never copy the issuer and split its WeakMap.
for (const [name, sourceSpecifier, emittedSpecifier] of [
  ['native-provider-measurement-subject', "from '../../app/provider-installation.mjs'", "from '../../../app/provider-installation.mjs'"],
  ['native-account-observation', "from '../../app/provider-installation.mjs'", "from '../../../app/provider-installation.mjs'"],
  ['adapters/claude-cli-executor', "from '../../../app/provider-installation.mjs'", "from '../../../../app/provider-installation.mjs'"],
  ['adapters/claude-cli-executor', "from '../../../app/claude-configuration.mjs'", "from '../../../../app/claude-configuration.mjs'"],
]) {
  const emitted = new URL(`../dist/src/${name}.js`, import.meta.url);
  const code = readFileSync(emitted, 'utf8');
  const originalCount = code.split(sourceSpecifier).length - 1;
  const relocatedCount = code.split(emittedSpecifier).length - 1;
  if (originalCount === 1 && relocatedCount === 0) {
    writeFileSync(emitted, code.replace(sourceSpecifier, emittedSpecifier), 'utf8');
  } else if (originalCount !== 0 || relocatedCount !== 1) {
    throw new Error(`native_installation_import_invalid:${name}`);
  }
}
