import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyOrchestrationRetryMigration } from './orchestration/retry-migration.js';

export type Ledger = Database.Database;
function canonicalJson(value:unknown):string{if(value===null||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);if(typeof value==='number'){if(!Number.isSafeInteger(value))throw Error('cue_canonical_json_number');return JSON.stringify(value);}if(Array.isArray(value))return`[${value.map(canonicalJson).join(',')}]`;if(!value||typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype)throw Error('cue_canonical_json_object');return`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonicalJson((value as Record<string,unknown>)[key])}`).join(',')}}`;}

/** Exact DDL for one trigger, taken from its own migration file. Statements in these files
 * always start at column 0, so the next top-level CREATE terminates the block. */
function triggerStatement(migration: string, name: string): string {
  const start = migration.indexOf(`CREATE TRIGGER ${name} `) >= 0
    ? migration.indexOf(`CREATE TRIGGER ${name} `) : migration.indexOf(`CREATE TRIGGER ${name}\n`);
  if (start < 0) throw Error(`migration_trigger_missing:${name}`);
  const next = migration.indexOf('\nCREATE ', start);
  const statement = (next < 0 ? migration.slice(start) : migration.slice(start, next)).trim();
  if (!statement.endsWith('END;')) throw Error(`migration_trigger_unterminated:${name}`);
  return statement;
}

/** Replace one legacy trigger in place. The session-handle lineage in migrations 039 and 050
 * originally required the handle to carry the PLAN task id, but the stage binder only ever
 * emits the stage task id (`stage-task-<sha>`), so no launcher-produced receipt could satisfy
 * it. Existing ledgers carry that unusable text and must be upgraded, not refused. */
function upgradeLegacyTrigger(db: Ledger, migration: string, name: string): void {
  const live = db.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name=?").get(name) as { sql: string } | undefined;
  const current = triggerStatement(migration, name);
  // Only the complete historical definition authorizes replacement. A marker in a
  // comment or a modified legacy body must reach the schema check unchanged.
  // sqlite_master preserves CREATE text but omits its final statement semicolon.
  const legacy = current
    .replace(/^[ \t]*JOIN orchestration_stage_envelope e ON e.attempt_id=a.attempt_id\r?\n/m, '')
    .replace('h.run_id=e.attempt_id AND h.task_id=e.stage_task_id', 'h.run_id=a.attempt_id AND h.task_id=a.task_id')
    .slice(0, -1);
  if (!live || live.sql !== legacy) return;
  db.exec(`DROP TRIGGER ${name};`);
  db.exec(current);
}

export function openLedger(filename = ':memory:'): Ledger {
  const db = new Database(filename);
  try {
  db.pragma('busy_timeout = 5000');
  db.function('cue_sha256', { deterministic: true }, (value: string | Buffer) => {
    if (typeof value !== 'string' && !Buffer.isBuffer(value)) throw Error('cue_sha256_bytes_required');
    return createHash('sha256').update(value).digest('hex');
  });
  db.function('cue_handoff_terminal_authorized', (_attemptId: unknown, _payloadSha256: unknown) => 0);
  db.function('cue_canonical_json', {deterministic:true}, (value:string|Buffer) => canonicalJson(JSON.parse(Buffer.isBuffer(value)?value.toString('utf8'):value)));
  const here = dirname(fileURLToPath(import.meta.url));
  const migration = join(here, '..', 'migrations', '001_init.sql');
  db.pragma('foreign_keys = ON');
  db.transaction(() => {
  const initialized = db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name='task'").get() as { n: number };
  if (!initialized.n) db.exec(readFileSync(migration, 'utf8'));
  db.exec(readFileSync(join(here, '..', 'migrations', '002_p5.sql'), 'utf8'));
  db.exec(readFileSync(join(here, '..', 'migrations', '003_p6.sql'), 'utf8'));
  db.exec(readFileSync(join(here, '..', 'migrations', '004_p7.sql'), 'utf8'));
  db.exec(readFileSync(join(here, '..', 'migrations', '005_p8.sql'), 'utf8'));
  db.exec(readFileSync(join(here, '..', 'migrations', '006_p10c.sql'), 'utf8'));
  db.exec(readFileSync(join(here, '..', 'migrations', '007_workspace_write_lease.sql'), 'utf8'));
  db.transaction(() => db.exec(readFileSync(join(here, '..', 'migrations', '008_integration_budget.sql'), 'utf8')))();
  db.transaction(() => db.exec(readFileSync(join(here, '..', 'migrations', '009_selection_policy.sql'), 'utf8')))();
  db.transaction(() => db.exec(readFileSync(join(here, '..', 'migrations', '010_orchestration.sql'), 'utf8')))();
  db.transaction(() => db.exec(readFileSync(join(here, '..', 'migrations', '011_capability_evidence.sql'), 'utf8')))();
  db.transaction(() => db.exec(readFileSync(join(here, '..', 'migrations', '012_stage_envelope.sql'), 'utf8')))();
  db.transaction(() => db.exec(readFileSync(join(here, '..', 'migrations', '013_requirement_contract.sql'), 'utf8')))();
  db.transaction(() => db.exec(readFileSync(join(here, '..', 'migrations', '014_requirement_acceptance.sql'), 'utf8')))();
  db.transaction(() => db.exec(readFileSync(join(here, '..', 'migrations', '015_selection_preference.sql'), 'utf8')))();
  }).immediate();
  applyOrchestrationRetryMigration(db);
  db.transaction(() => {
  db.transaction(() => db.exec(readFileSync(join(here, '..', 'migrations', '017_generated_output.sql'), 'utf8')))();
  db.transaction(() => db.exec(readFileSync(join(here, '..', 'migrations', '018_cleanup_observation.sql'), 'utf8')))();
  db.transaction(() => db.exec(readFileSync(join(here, '..', 'migrations', '019_resource_store.sql'), 'utf8')))();
  db.transaction(() => db.exec(readFileSync(join(here, '..', 'migrations', '020_local_host_settings.sql'), 'utf8')))();
  db.transaction(() => db.exec(readFileSync(join(here, '..', 'migrations', '021_local_invocation_budget.sql'), 'utf8')))();
  db.transaction(() => db.exec(readFileSync(join(here, '..', 'migrations', '022_local_selection_policy.sql'), 'utf8')))();
  db.transaction(() => db.exec(readFileSync(join(here, '..', 'migrations', '023_retrospective.sql'), 'utf8')))();
  db.transaction(() => db.exec(readFileSync(join(here, '..', 'migrations', '024_native_execution_identity.sql'), 'utf8')))();
  db.transaction(() => db.exec(readFileSync(join(here, '..', 'migrations', '025_attempt_selection.sql'), 'utf8')))();
  db.transaction(() => db.exec(readFileSync(join(here, '..', 'migrations', '026_evaluation_enrollment.sql'), 'utf8')))();
  db.transaction(() => db.exec(readFileSync(join(here, '..', 'migrations', '027_evaluation_observation.sql'), 'utf8')))();
  db.transaction(() => db.exec(readFileSync(join(here, '..', 'migrations', '028_evaluation_trial_projection.sql'), 'utf8')))();
  db.transaction(() => db.exec(readFileSync(join(here, '..', 'migrations', '029_evaluation_baseline.sql'), 'utf8')))();
  db.transaction(() => db.exec(readFileSync(join(here, '..', 'migrations', '030_evaluation_comparison.sql'), 'utf8')))();
  db.transaction(() => db.exec(readFileSync(join(here, '..', 'migrations', '031_orchestration_handoff_activity.sql'), 'utf8')))();
  db.transaction(() => db.exec(readFileSync(join(here, '..', 'migrations', '032_provider_execution_lifecycle.sql'), 'utf8')))();
  const handoffIntegrityInstalled = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='orchestration_handoff_integrity_migration'").get();
  if (!handoffIntegrityInstalled) db.transaction(() => db.exec(readFileSync(join(here, '..', 'migrations', '033_orchestration_handoff_integrity.sql'), 'utf8')))();
  db.transaction(() => db.exec(readFileSync(join(here, '..', 'migrations', '034_evaluation_measured_fact.sql'), 'utf8')))();
  db.transaction(() => {
    const installed = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='orchestration_wait_migration'").get();
    if (!installed) db.exec(readFileSync(join(here, '..', 'migrations', '035_orchestration_wait_checkpoint.sql'), 'utf8'));
  }).immediate();
  db.transaction(() => {
    const installed = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='orchestration_recovery_migration'").get();
    if (!installed) db.exec(readFileSync(join(here, '..', 'migrations', '036_s4_recovery_revision.sql'), 'utf8'));
  }).immediate();
  db.transaction(() => {
    const installed = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='change_recovery_migration'").get();
    if (!installed) db.exec(readFileSync(join(here, '..', 'migrations', '037_s4_change_recovery.sql'), 'utf8'));
  }).immediate();
  db.transaction(() => {
    const installed = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='native_change_journal_migration'").get();
    if (!installed) db.exec(readFileSync(join(here, '..', 'migrations', '038_s4_native_change_journal.sql'), 'utf8'));
  }).immediate();
  db.transaction(() => {
    const installed = db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table' AND name IN ('readonly_verifier_migration','readonly_verifier_identity','readonly_verifier_cleanup')").get() as { n: number };
    const readonlyMigration = readFileSync(join(here, '..', 'migrations', '039_readonly_verifier_identity.sql'), 'utf8');
    if (installed.n === 0) db.exec(readonlyMigration);
    else if (installed.n !== 3) throw Error('readonly_verifier_migration_partial');
    else upgradeLegacyTrigger(db, readonlyMigration, 'readonly_verifier_identity_lineage');
    // Same tamper detection 050 gets: a missing or rewritten guard must refuse the ledger rather
    // than survive reopen. Without this, a deleted lineage trigger was silently acceptable.
    const readonlyGuards = db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='trigger' AND name GLOB 'readonly_verifier_*'").get() as { n: number };
    if (readonlyGuards.n !== 13 || !db.prepare("SELECT 1 FROM readonly_verifier_migration WHERE singleton=1 AND version='cue-readonly-verifier-v1'").get()) throw Error('readonly_verifier_migration_partial');
    const readonlyReference = new Database(':memory:');
    try {
      readonlyReference.function('cue_sha256', { deterministic: true }, (value: string | Buffer) => createHash('sha256').update(value).digest('hex'));
      readonlyReference.exec("CREATE TABLE orchestration_attempt(attempt_id TEXT PRIMARY KEY,run_id TEXT,task_id TEXT,candidate_id TEXT);CREATE TABLE orchestration_step(run_id TEXT,task_id TEXT,PRIMARY KEY(run_id,task_id));CREATE TABLE orchestration_launch_intent(attempt_id TEXT PRIMARY KEY,expected_subject_digest TEXT);CREATE TABLE orchestration_plan(run_id TEXT PRIMARY KEY,payload TEXT);CREATE TABLE orchestration_stage_envelope(attempt_id TEXT PRIMARY KEY,stage_task_id TEXT);CREATE TABLE session_handle(handle TEXT PRIMARY KEY,pid INTEGER,start_time TEXT,cwd TEXT,task_id TEXT,run_id TEXT);");
      readonlyReference.exec(readonlyMigration);
      const readonlySchema = "SELECT type,name,sql FROM sqlite_master WHERE name GLOB 'readonly_verifier_*' AND type IN('table','trigger') ORDER BY type,name";
      if (JSON.stringify(db.prepare(readonlySchema).all()) !== JSON.stringify(readonlyReference.prepare(readonlySchema).all())) throw Error('readonly_verifier_migration_definition');
    } finally { readonlyReference.close(); }
  }).immediate();
  db.transaction(() => {
    const installed = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='initial_default_migration'").get();
    if (!installed) db.exec(readFileSync(join(here, '..', 'migrations', '040_initial_default.sql'), 'utf8'));
  }).immediate();
  db.transaction(() => {
    const installed = db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table' AND name IN ('exploration_budget_authorization','exploration_budget_reservation')").get() as {n:number};
    if (installed.n === 0) db.exec(readFileSync(join(here, '..', 'migrations', '041_exploration_budget.sql'), 'utf8'));
    else if(installed.n !== 2) throw Error('exploration_budget_migration_partial');
    const guards=db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='trigger' AND name IN ('exploration_budget_authorization_insert_guard','exploration_budget_reservation_insert_guard','exploration_budget_authorization_no_update','exploration_budget_authorization_no_delete','exploration_budget_authorization_no_replace','exploration_budget_reservation_no_update','exploration_budget_reservation_no_delete','exploration_budget_reservation_no_replace')").get() as {n:number};
    if(guards.n!==8)throw Error('exploration_budget_migration_partial');
  }).immediate();
  db.transaction(() => {
    const installed = db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table' AND name='exploration_consent'").get() as {n:number};
    if (installed.n === 0) db.exec(readFileSync(join(here, '..', 'migrations', '042_exploration_consent.sql'), 'utf8'));
    const guards=db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='trigger' AND name IN ('exploration_consent_insert_guard','exploration_consent_no_update','exploration_consent_no_delete','exploration_consent_no_replace')").get() as {n:number};
    if(installed.n>1||guards.n!==4)throw Error('exploration_consent_migration_partial');
  }).immediate();
  db.transaction(() => {
    const installed=db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table' AND name IN ('account_identity_migration','orchestration_account_identity')").get() as {n:number};
    if(installed.n===0)db.exec(readFileSync(join(here,'..','migrations','043_account_identity.sql'),'utf8'));
    else if(installed.n!==2)throw Error('account_identity_migration_partial');
    const guards=db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='trigger' AND name IN ('account_identity_no_update','account_identity_no_delete','account_identity_no_replace','account_identity_insert_guard')").get() as {n:number};if(guards.n!==4||!db.prepare("SELECT 1 FROM account_identity_migration WHERE singleton=1 AND version='cue-account-identity-v1'").get())throw Error('account_identity_migration_partial');
  }).immediate();
  db.transaction(() => {
    const installed = db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table' AND name IN ('policy_deployment_migration','selection_policy_qualification','selection_policy_deployment_transition','selection_policy_deployment_head')").get() as {n:number};
    if (installed.n === 0) db.exec(readFileSync(join(here, '..', 'migrations', '044_selection_policy_promotion.sql'), 'utf8'));
    else if (installed.n !== 4) throw Error('policy_deployment_migration_partial');
    const guards = db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='trigger' AND name IN ('selection_policy_qualification_insert_guard','selection_policy_qualification_no_update','selection_policy_qualification_no_delete','selection_policy_deployment_transition_insert_guard','selection_policy_deployment_transition_no_update','selection_policy_deployment_transition_no_delete','selection_policy_deployment_head_insert_guard','selection_policy_deployment_head_update_guard','selection_policy_deployment_head_no_delete')").get() as {n:number};
    if (guards.n !== 9 || !db.prepare("SELECT 1 FROM policy_deployment_migration WHERE singleton=1 AND version='cue-policy-deployment-v1'").get()) throw Error('policy_deployment_migration_partial');
  }).immediate();
  db.transaction(() => {
    const installed = db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table' AND name IN ('handoff_cost_attribution_migration','evaluation_handoff_cost_projection_legacy','handoff_cost_attribution','evaluation_handoff_cost_projection')").get() as {n:number};
    if (installed.n === 0) db.exec(readFileSync(join(here, '..', 'migrations', '045_handoff_cost_attribution.sql'), 'utf8'));
    else if (installed.n !== 4) throw Error('handoff_cost_attribution_migration_partial');
    const guards = db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='trigger' AND name IN ('handoff_cost_attribution_migration_no_update','handoff_cost_attribution_migration_no_delete','handoff_cost_attribution_migration_no_replace','evaluation_handoff_cost_projection_legacy_no_update','evaluation_handoff_cost_projection_legacy_no_delete','evaluation_handoff_cost_projection_legacy_no_insert','handoff_cost_attribution_insert_guard','handoff_cost_attribution_no_update','handoff_cost_attribution_no_delete','evaluation_handoff_cost_projection_insert_guard','evaluation_handoff_cost_projection_no_update','evaluation_handoff_cost_projection_no_delete')").get() as {n:number};
    if (guards.n !== 12 || !db.prepare("SELECT 1 FROM handoff_cost_attribution_migration WHERE singleton=1 AND version='cue-handoff-cost-attribution-v1' AND baseline_fact_rowid>=0").get()) throw Error('handoff_cost_attribution_migration_partial');
  }).immediate();
  db.transaction(() => {
    const installed = db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table' AND name IN ('change_publication_migration','change_publication_intent','change_publication_result')").get() as {n:number};
    const publicationMigration = readFileSync(join(here, '..', 'migrations', '046_change_publication.sql'), 'utf8');
    if (installed.n === 0) db.exec(publicationMigration);
    else if (installed.n !== 3) throw Error('change_publication_migration_partial');
    const guards = db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='trigger' AND name IN ('change_publication_migration_no_update','change_publication_migration_no_delete','change_publication_migration_no_replace','change_publication_intent_insert_guard','change_publication_intent_no_update','change_publication_intent_no_delete','change_publication_intent_no_replace','change_publication_result_insert_guard','change_publication_result_no_update','change_publication_result_no_delete','change_publication_result_no_replace','change_publication_lease_no_unsafe_delete','change_publication_lease_no_unsafe_update','change_publication_lease_no_unsafe_replace')").get() as {n:number};
    if (guards.n !== 14 || !db.prepare("SELECT 1 FROM change_publication_migration WHERE singleton=1 AND version='cue-change-publication-v1'").get()) throw Error('change_publication_migration_partial');
    // Let SQLite canonicalize the shipped definitions instead of accepting names alone.
    const reference = new Database(':memory:');
    try {
      reference.exec('CREATE TABLE workspace_write_lease(worktree_realpath TEXT,run_id TEXT,acquired_at TEXT)');
      reference.exec(publicationMigration);
      const schema = "SELECT type,name,sql FROM sqlite_master WHERE name GLOB 'change_publication_*' AND type IN ('table','trigger') ORDER BY type,name";
      if (JSON.stringify(db.prepare(schema).all()) !== JSON.stringify(reference.prepare(schema).all())) throw Error('change_publication_migration_definition');
    } finally { reference.close(); }
  }).immediate();
  db.transaction(() => {
    const discardInstalled=db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table' AND name IN ('attempt_staging_discard_migration','attempt_staging_discard_authorization','attempt_staging_discard')").get() as {n:number};
    if(discardInstalled.n!==0&&discardInstalled.n!==3)throw Error('attempt_staging_discard_migration_partial');
    const installed=db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table' AND name IN ('attempt_staging_migration','run_staging_authority','attempt_staging_setup','attempt_staging_authority','attempt_staging_cleanup')").get() as {n:number};
    const stagingMigration=readFileSync(join(here,'..','migrations','047_attempt_staging_authority.sql'),'utf8');
    if(installed.n===0)db.exec(stagingMigration);else if(installed.n!==5)throw Error('attempt_staging_migration_partial');
    const guards=db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='trigger' AND (name GLOB 'run_staging_authority*' OR (name GLOB 'attempt_staging_*' AND name NOT GLOB 'attempt_staging_discard*'))").get() as {n:number};
    if(guards.n!==22||!db.prepare("SELECT 1 FROM attempt_staging_migration WHERE singleton=1 AND version='cue-attempt-staging-authority-v1'").get())throw Error('attempt_staging_migration_partial');
    const reference=new Database(':memory:');try{
      reference.function('cue_canonical_json',{deterministic:true},(value:string|Buffer)=>canonicalJson(JSON.parse(Buffer.isBuffer(value)?value.toString('utf8'):value)));
      reference.exec("CREATE TABLE orchestration_attempt(attempt_id TEXT PRIMARY KEY);CREATE TABLE orchestration_step(run_id TEXT,task_id TEXT,PRIMARY KEY(run_id,task_id));CREATE TABLE orchestration_stage_envelope(stage_envelope_hash TEXT UNIQUE);CREATE TABLE workspace_write_lease(worktree_realpath TEXT,run_id TEXT,acquired_at TEXT);");reference.exec(stagingMigration);
      if(discardInstalled.n===3)reference.exec(readFileSync(join(here,'..','migrations','048_attempt_staging_discard.sql'),'utf8'));
      if(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='run_staging_task_authority'").get())
        reference.exec(readFileSync(join(here,'..','migrations','051_attempt_staging_task_authority.sql'),'utf8'));
      const schema="SELECT type,name,sql FROM sqlite_master WHERE (name GLOB 'run_staging_authority*' OR (name GLOB 'attempt_staging_*' AND name NOT GLOB 'attempt_staging_discard*')) AND type IN('table','trigger') ORDER BY type,name";
      if(JSON.stringify(db.prepare(schema).all())!==JSON.stringify(reference.prepare(schema).all()))throw Error('attempt_staging_migration_definition');
    }finally{reference.close();}
  }).immediate();
  db.transaction(() => {
    const installed=db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table' AND name IN ('attempt_staging_discard_migration','attempt_staging_discard_authorization','attempt_staging_discard')").get() as {n:number};
    const discardMigration=readFileSync(join(here,'..','migrations','048_attempt_staging_discard.sql'),'utf8');
    if(installed.n===0)db.exec(discardMigration);else if(installed.n!==3)throw Error('attempt_staging_discard_migration_partial');
    const guards=db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='trigger' AND name GLOB 'attempt_staging_discard*'").get() as {n:number};
    if(guards.n!==11||!db.prepare("SELECT 1 FROM attempt_staging_discard_migration WHERE singleton=1 AND version='cue-attempt-staging-discard-v1'").get())throw Error('attempt_staging_discard_migration_partial');
    const reference=new Database(':memory:');try{
      reference.function('cue_canonical_json',{deterministic:true},(value:string|Buffer)=>canonicalJson(JSON.parse(Buffer.isBuffer(value)?value.toString('utf8'):value)));
      reference.exec("CREATE TABLE orchestration_attempt(attempt_id TEXT PRIMARY KEY);CREATE TABLE orchestration_step(run_id TEXT,task_id TEXT,PRIMARY KEY(run_id,task_id));CREATE TABLE orchestration_stage_envelope(stage_envelope_hash TEXT UNIQUE);CREATE TABLE workspace_write_lease(worktree_realpath TEXT,run_id TEXT,acquired_at TEXT);");
      reference.exec(readFileSync(join(here,'..','migrations','047_attempt_staging_authority.sql'),'utf8'));reference.exec(discardMigration);
      const schema="SELECT type,name,sql FROM sqlite_master WHERE (name GLOB 'attempt_staging_discard*' OR name GLOB 'attempt_staging_lease_*') AND type IN('table','trigger') ORDER BY type,name";
      if(JSON.stringify(db.prepare(schema).all())!==JSON.stringify(reference.prepare(schema).all()))throw Error('attempt_staging_discard_migration_definition');
    }finally{reference.close();}
  }).immediate();
  db.transaction(() => {
    const installed = db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table' AND name IN ('cost_observation_migration','orchestration_cost_observation')").get() as { n: number };
    const costMigration = readFileSync(join(here, '..', 'migrations', '049_cost_observation.sql'), 'utf8');
    if (installed.n === 0) db.exec(costMigration);
    else if (installed.n !== 2) throw Error('cost_observation_migration_partial');
    const guards = db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='trigger' AND name GLOB 'cost_observation_*'").get() as { n: number };
    if (guards.n !== 4 || !db.prepare("SELECT 1 FROM cost_observation_migration WHERE singleton=1 AND version='cue-persisted-cost-observation-v1'").get()) throw Error('cost_observation_migration_partial');
    const reference = new Database(':memory:');
    try {
      reference.exec('CREATE TABLE run(id TEXT PRIMARY KEY); CREATE TABLE orchestration_attempt(attempt_id TEXT PRIMARY KEY,run_id TEXT,candidate_id TEXT)');
      reference.exec(costMigration);
      const schema = "SELECT type,name,sql FROM sqlite_master WHERE (name GLOB 'cost_observation_*' OR name='orchestration_cost_observation') AND type IN ('table','trigger') ORDER BY type,name";
      if (JSON.stringify(db.prepare(schema).all()) !== JSON.stringify(reference.prepare(schema).all())) throw Error('cost_observation_migration_definition');
    } finally { reference.close(); }
  }).immediate();
  db.transaction(() => {
    const installed=db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table' AND name IN ('native_runtime_receipt_migration','native_runtime_receipt')").get() as {n:number};
    const migration=readFileSync(join(here,'..','migrations','050_native_runtime_receipt.sql'),'utf8');
    if(installed.n===0)db.exec(migration);else if(installed.n!==2)throw Error('native_runtime_receipt_migration_partial');
    if(installed.n===2)upgradeLegacyTrigger(db,migration,'native_runtime_receipt_insert_guard');
    const guards=db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='trigger' AND name GLOB 'native_runtime_receipt*'").get() as {n:number};
    if(guards.n!==7||!db.prepare("SELECT 1 FROM native_runtime_receipt_migration WHERE singleton=1 AND version='cue-native-runtime-receipt-v1'").get())throw Error('native_runtime_receipt_migration_partial');
    const reference=new Database(':memory:');try{
      reference.function('cue_sha256',{deterministic:true},(value:string|Buffer)=>createHash('sha256').update(value).digest('hex'));
      reference.function('cue_canonical_json',{deterministic:true},(value:string|Buffer)=>canonicalJson(JSON.parse(Buffer.isBuffer(value)?value.toString('utf8'):value)));
      reference.exec('CREATE TABLE orchestration_attempt(attempt_id TEXT PRIMARY KEY,run_id TEXT,task_id TEXT,candidate_id TEXT);CREATE TABLE orchestration_step(run_id TEXT,task_id TEXT,PRIMARY KEY(run_id,task_id));CREATE TABLE orchestration_stage_envelope(attempt_id TEXT PRIMARY KEY,stage_task_id TEXT);CREATE TABLE session_handle(handle TEXT PRIMARY KEY,run_id TEXT,task_id TEXT);');reference.exec(migration);
      const schema="SELECT type,name,sql FROM sqlite_master WHERE name GLOB 'native_runtime_receipt*' AND type IN('table','trigger') ORDER BY type,name";
      if(JSON.stringify(db.prepare(schema).all())!==JSON.stringify(reference.prepare(schema).all()))throw Error('native_runtime_receipt_migration_definition');
    }finally{reference.close();}
  }).immediate();
  db.transaction(() => {
    const migration=readFileSync(join(here,'..','migrations','051_attempt_staging_task_authority.sql'),'utf8');
    const installed=db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table' AND name='run_staging_task_authority'").get() as {n:number};
    if(installed.n===0)db.exec(migration);
    else if(installed.n!==1)throw Error('attempt_staging_task_migration_partial');
    const guards=db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='trigger' AND name GLOB 'run_staging_task_authority_*'").get() as {n:number};
    if(guards.n!==4)throw Error('attempt_staging_task_migration_partial');
    const reference=new Database(':memory:');try{
      reference.function('cue_canonical_json',{deterministic:true},(value:string|Buffer)=>canonicalJson(JSON.parse(Buffer.isBuffer(value)?value.toString('utf8'):value)));
      reference.exec("CREATE TABLE orchestration_attempt(attempt_id TEXT PRIMARY KEY);CREATE TABLE orchestration_step(run_id TEXT,task_id TEXT,PRIMARY KEY(run_id,task_id));CREATE TABLE orchestration_stage_envelope(stage_envelope_hash TEXT UNIQUE);CREATE TABLE workspace_write_lease(worktree_realpath TEXT,run_id TEXT,acquired_at TEXT);");
      reference.exec(readFileSync(join(here,'..','migrations','047_attempt_staging_authority.sql'),'utf8'));
      reference.exec(migration);
      const schema="SELECT type,name,sql FROM sqlite_master WHERE (name GLOB 'run_staging_task_authority*' OR name='attempt_staging_setup_insert_guard') AND type IN('table','trigger') ORDER BY type,name";
      if(JSON.stringify(db.prepare(schema).all())!==JSON.stringify(reference.prepare(schema).all()))throw Error('attempt_staging_task_migration_definition');
    }finally{reference.close();}
  }).immediate();
  db.transaction(() => {
    const migration=readFileSync(join(here,'..','migrations','052_evaluation_staged_input.sql'),'utf8');
    const installed=db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table' AND name IN ('evaluation_staged_input_migration','evaluation_staged_input_observation')").get() as {n:number};
    if(installed.n===0)db.exec(migration);else if(installed.n!==2)throw Error('evaluation_staged_input_migration_partial');
    const guards=db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='trigger' AND name GLOB 'evaluation_staged_input_*'").get() as {n:number};
    if(guards.n!==7||!db.prepare("SELECT 1 FROM evaluation_staged_input_migration WHERE singleton=1 AND version='cue-staged-input-observation-v1'").get())throw Error('evaluation_staged_input_migration_partial');
    const reference=new Database(':memory:');try{
      reference.exec(migration);
      const schema="SELECT type,name,sql FROM sqlite_master WHERE name GLOB 'evaluation_staged_input_*' AND type IN('table','trigger') ORDER BY type,name";
      if(JSON.stringify(db.prepare(schema).all())!==JSON.stringify(reference.prepare(schema).all()))throw Error('evaluation_staged_input_migration_definition');
    }finally{reference.close();}
  }).immediate();
  db.transaction(() => {
    const migration=readFileSync(join(here,'..','migrations','053_workspace_management.sql'),'utf8');
    const installed=db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table' AND name IN ('cue_project','cue_user_session','cue_user_session_run')").get() as {n:number};
    if(installed.n===0)db.exec(migration);else if(installed.n!==3)throw Error('workspace_management_migration_partial');
    const reference=new Database(':memory:');try{
      reference.exec('CREATE TABLE run(id TEXT PRIMARY KEY); CREATE TABLE envelope(envelope_hash TEXT PRIMARY KEY,worktree_realpath TEXT);');
      reference.exec(migration);
      const schema="SELECT type,name,sql FROM sqlite_master WHERE name GLOB 'cue_project*' OR name GLOB 'cue_user_session*' ORDER BY type,name";
      if(JSON.stringify(db.prepare(schema).all())!==JSON.stringify(reference.prepare(schema).all()))throw Error('workspace_management_migration_definition');
    }finally{reference.close();}
  }).immediate();
  db.exec(readFileSync(join(here,'..','migrations','054_run_session_epoch.sql'),'utf8'));
  }).immediate();
  return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
