CREATE TABLE evaluation_staged_input_migration(
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 version TEXT NOT NULL CHECK(version='cue-staged-input-observation-v1')
);
INSERT INTO evaluation_staged_input_migration VALUES(1,'cue-staged-input-observation-v1');
CREATE TABLE evaluation_staged_input_observation(
 attempt_id TEXT PRIMARY KEY REFERENCES orchestration_launch_intent(attempt_id),
 enrollment_id TEXT NOT NULL REFERENCES evaluation_enrollment(enrollment_id),
 run_id TEXT NOT NULL,task_id TEXT NOT NULL,
 stage_envelope_hash TEXT NOT NULL CHECK(length(stage_envelope_hash)=64),
 observed_at_ms INTEGER NOT NULL CHECK(observed_at_ms>=0),
 payload_digest TEXT NOT NULL UNIQUE CHECK(length(payload_digest)=64),
 payload TEXT NOT NULL CHECK(length(CAST(payload AS BLOB)) BETWEEN 1 AND 8192)
);
CREATE TRIGGER evaluation_staged_input_insert_guard BEFORE INSERT ON evaluation_staged_input_observation
WHEN cue_sha256(NEW.payload)<>NEW.payload_digest OR cue_canonical_json(NEW.payload)<>NEW.payload
 OR json_valid(NEW.payload)<>1 OR (SELECT count(*) FROM json_each(NEW.payload))<>21
 OR json_extract(NEW.payload,'$.version') IS NOT 'cue-staged-input-observation-v1'
 OR json_extract(NEW.payload,'$.authority') IS NOT 'point-in-time-staged-seed-observation-only'
 OR json_extract(NEW.payload,'$.attemptId') IS NOT NEW.attempt_id
 OR json_extract(NEW.payload,'$.enrollmentId') IS NOT NEW.enrollment_id
 OR json_extract(NEW.payload,'$.runId') IS NOT NEW.run_id
 OR json_extract(NEW.payload,'$.taskId') IS NOT NEW.task_id
 OR json_extract(NEW.payload,'$.stageEnvelopeHash') IS NOT NEW.stage_envelope_hash
 OR json_extract(NEW.payload,'$.observedAtMs') IS NOT NEW.observed_at_ms
 OR json_type(NEW.payload,'$.executedInputVerified') IS NOT 'false'
 OR json_type(NEW.payload,'$.executionAuthorized') IS NOT 'false'
 OR json_type(NEW.payload,'$.promotionEligible') IS NOT 'false'
 OR NOT EXISTS(SELECT 1 FROM evaluation_enrollment e
   JOIN orchestration_attempt a ON a.run_id=e.run_id
   JOIN attempt_staging_setup s ON s.attempt_id=a.attempt_id AND s.run_id=a.run_id AND s.task_id=a.task_id AND s.candidate_id=a.candidate_id
   JOIN attempt_staging_authority sa ON sa.attempt_id=a.attempt_id
   JOIN orchestration_launch_intent l ON l.attempt_id=a.attempt_id AND l.run_id=a.run_id AND l.task_id=a.task_id AND l.candidate_id=a.candidate_id
   WHERE e.enrollment_id=NEW.enrollment_id AND e.run_id=NEW.run_id AND e.case_id=json_extract(NEW.payload,'$.caseId')
     AND e.dataset_digest=json_extract(NEW.payload,'$.datasetDigest')
     AND json_extract(e.payload,'$.inputDigest')=json_extract(NEW.payload,'$.inputDigest')
     AND a.attempt_id=NEW.attempt_id AND a.task_id=NEW.task_id AND a.state='running' AND a.cleanup_verified=0
     AND sa.stage_envelope_hash=NEW.stage_envelope_hash AND l.stage_envelope_hash=NEW.stage_envelope_hash
     AND sa.parent_envelope_hash=l.parent_envelope_hash AND sa.plan_digest=l.plan_digest AND sa.policy_digest=l.policy_digest
     AND l.plan_digest=json_extract(NEW.payload,'$.planDigest') AND l.policy_digest=json_extract(NEW.payload,'$.policyDigest')
     AND sa.execution_worktree_realpath=(SELECT worktree_realpath FROM envelope WHERE envelope_hash=sa.stage_envelope_hash)
     AND NOT EXISTS(SELECT 1 FROM attempt_staging_cleanup c WHERE c.attempt_id=a.attempt_id))
BEGIN SELECT RAISE(ABORT,'staged input observation invalid'); END;
CREATE TRIGGER evaluation_staged_input_no_update BEFORE UPDATE ON evaluation_staged_input_observation BEGIN SELECT RAISE(ABORT,'staged input observation immutable'); END;
CREATE TRIGGER evaluation_staged_input_no_delete BEFORE DELETE ON evaluation_staged_input_observation BEGIN SELECT RAISE(ABORT,'staged input observation immutable'); END;
CREATE TRIGGER evaluation_staged_input_no_replace BEFORE INSERT ON evaluation_staged_input_observation
WHEN EXISTS(SELECT 1 FROM evaluation_staged_input_observation WHERE attempt_id=NEW.attempt_id OR payload_digest=NEW.payload_digest)
BEGIN SELECT RAISE(ABORT,'staged input observation immutable'); END;
CREATE TRIGGER evaluation_staged_input_migration_no_update BEFORE UPDATE ON evaluation_staged_input_migration BEGIN SELECT RAISE(ABORT,'staged input migration immutable'); END;
CREATE TRIGGER evaluation_staged_input_migration_no_delete BEFORE DELETE ON evaluation_staged_input_migration BEGIN SELECT RAISE(ABORT,'staged input migration immutable'); END;
CREATE TRIGGER evaluation_staged_input_migration_no_replace BEFORE INSERT ON evaluation_staged_input_migration BEGIN SELECT RAISE(ABORT,'staged input migration immutable'); END;
