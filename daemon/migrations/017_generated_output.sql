CREATE TABLE IF NOT EXISTS generated_output_target (
  run_id TEXT NOT NULL REFERENCES run(id), target_id TEXT NOT NULL,
  payload TEXT NOT NULL, digest TEXT NOT NULL, input_bytes BLOB NOT NULL,
  PRIMARY KEY(run_id,target_id)
);
CREATE TRIGGER IF NOT EXISTS generated_target_before_approval BEFORE INSERT ON generated_output_target
WHEN NOT EXISTS(SELECT 1 FROM requirement_contract_binding WHERE run_id=NEW.run_id)
 OR EXISTS(SELECT 1 FROM approval_event WHERE run_id=NEW.run_id AND decision='accept')
 OR EXISTS(SELECT 1 FROM orchestration_attempt WHERE run_id=NEW.run_id)
BEGIN SELECT RAISE(ABORT,'generated_target_too_late_or_missing_criteria'); END;
CREATE TRIGGER IF NOT EXISTS generated_target_no_replace BEFORE INSERT ON generated_output_target
WHEN EXISTS(SELECT 1 FROM generated_output_target WHERE run_id=NEW.run_id AND target_id=NEW.target_id)
BEGIN SELECT RAISE(ABORT,'immutable_generated_target'); END;
CREATE TRIGGER IF NOT EXISTS generated_target_no_update BEFORE UPDATE ON generated_output_target
BEGIN SELECT RAISE(ABORT,'immutable_generated_target'); END;
CREATE TRIGGER IF NOT EXISTS generated_target_no_delete BEFORE DELETE ON generated_output_target
BEGIN SELECT RAISE(ABORT,'immutable_generated_target'); END;
CREATE TABLE IF NOT EXISTS generated_output_observation (
  observation_id TEXT PRIMARY KEY, run_id TEXT NOT NULL, target_id TEXT NOT NULL,
  attempt_id TEXT NOT NULL REFERENCES orchestration_attempt(attempt_id),
  payload TEXT NOT NULL, digest TEXT NOT NULL, bytes BLOB NOT NULL,
  FOREIGN KEY(run_id,target_id) REFERENCES generated_output_target(run_id,target_id),
  UNIQUE(run_id,target_id,attempt_id)
);
CREATE TRIGGER IF NOT EXISTS generated_observation_no_replace BEFORE INSERT ON generated_output_observation
WHEN EXISTS(SELECT 1 FROM generated_output_observation WHERE observation_id=NEW.observation_id
 OR (run_id=NEW.run_id AND target_id=NEW.target_id AND attempt_id=NEW.attempt_id))
BEGIN SELECT RAISE(ABORT,'immutable_generated_observation'); END;
CREATE TRIGGER IF NOT EXISTS generated_observation_no_update BEFORE UPDATE ON generated_output_observation
BEGIN SELECT RAISE(ABORT,'immutable_generated_observation'); END;
CREATE TRIGGER IF NOT EXISTS generated_observation_no_delete BEFORE DELETE ON generated_output_observation
BEGIN SELECT RAISE(ABORT,'immutable_generated_observation'); END;
