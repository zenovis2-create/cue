CREATE TABLE IF NOT EXISTS orchestration_stage_envelope (
  attempt_id TEXT PRIMARY KEY REFERENCES orchestration_attempt(attempt_id),
  workflow_run_id TEXT NOT NULL REFERENCES run(id), plan_task_id TEXT NOT NULL,
  stage_task_id TEXT NOT NULL UNIQUE REFERENCES task(id), stage_run_id TEXT NOT NULL UNIQUE REFERENCES run(id),
  parent_envelope_hash TEXT NOT NULL REFERENCES envelope(envelope_hash),
  stage_envelope_hash TEXT NOT NULL UNIQUE REFERENCES envelope(envelope_hash),
  plan_digest TEXT NOT NULL, policy_digest TEXT NOT NULL,
  parent_json TEXT NOT NULL, stage_json TEXT NOT NULL, scope_json TEXT NOT NULL, request_json TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS stage_envelope_no_update BEFORE UPDATE ON orchestration_stage_envelope
BEGIN SELECT RAISE(ABORT, 'immutable_stage_binding'); END;
CREATE TRIGGER IF NOT EXISTS stage_envelope_no_delete BEFORE DELETE ON orchestration_stage_envelope
BEGIN SELECT RAISE(ABORT, 'immutable_stage_binding'); END;
CREATE TRIGGER IF NOT EXISTS stage_envelope_no_replace BEFORE INSERT ON orchestration_stage_envelope
WHEN EXISTS(SELECT 1 FROM orchestration_stage_envelope WHERE attempt_id=NEW.attempt_id
  OR stage_task_id=NEW.stage_task_id OR stage_run_id=NEW.stage_run_id OR stage_envelope_hash=NEW.stage_envelope_hash)
BEGIN SELECT RAISE(ABORT, 'immutable_stage_binding'); END;
CREATE TRIGGER IF NOT EXISTS stage_run_lineage_no_update BEFORE UPDATE OF id,task_id,envelope_hash ON run
WHEN EXISTS(SELECT 1 FROM orchestration_stage_envelope s WHERE s.stage_run_id=OLD.id OR s.workflow_run_id=OLD.id)
  AND (NEW.id<>OLD.id OR NEW.task_id<>OLD.task_id OR NEW.envelope_hash<>OLD.envelope_hash)
BEGIN SELECT RAISE(ABORT, 'immutable_stage_run_lineage'); END;
CREATE TRIGGER IF NOT EXISTS stage_run_lineage_no_replace BEFORE INSERT ON run
WHEN EXISTS(SELECT 1 FROM orchestration_stage_envelope s WHERE s.stage_run_id=NEW.id OR s.workflow_run_id=NEW.id)
BEGIN SELECT RAISE(ABORT, 'immutable_stage_run_lineage'); END;
CREATE TRIGGER IF NOT EXISTS stage_bound_envelope_no_replace BEFORE INSERT ON envelope
WHEN EXISTS(SELECT 1 FROM orchestration_stage_envelope s WHERE s.stage_envelope_hash=NEW.envelope_hash OR s.parent_envelope_hash=NEW.envelope_hash)
BEGIN SELECT RAISE(ABORT, 'immutable_stage_envelope'); END;
CREATE TRIGGER IF NOT EXISTS stage_bound_envelope_no_delete BEFORE DELETE ON envelope
WHEN EXISTS(SELECT 1 FROM orchestration_stage_envelope s WHERE s.stage_envelope_hash=OLD.envelope_hash OR s.parent_envelope_hash=OLD.envelope_hash)
BEGIN SELECT RAISE(ABORT, 'immutable_stage_envelope'); END;
