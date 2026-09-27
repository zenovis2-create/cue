CREATE TABLE IF NOT EXISTS evaluation_baseline_declaration (
  baseline_id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL UNIQUE,
  run_id TEXT NOT NULL UNIQUE REFERENCES run(id),
  dataset_digest TEXT NOT NULL CHECK(length(dataset_digest)=64),
  case_id TEXT NOT NULL,
  policy_kind TEXT NOT NULL CHECK(policy_kind IN ('monetary','local-invocation')),
  policy_id TEXT NOT NULL,
  policy_revision INTEGER NOT NULL CHECK(policy_revision>=0),
  policy_digest TEXT NOT NULL CHECK(length(policy_digest)=64),
  candidate_id TEXT NOT NULL,
  candidate_revision TEXT NOT NULL,
  candidate_digest TEXT NOT NULL CHECK(length(candidate_digest)=64),
  metric_digest TEXT NOT NULL CHECK(length(metric_digest)=64),
  environment_digest TEXT NOT NULL CHECK(length(environment_digest)=64),
  account_limits_digest TEXT NOT NULL CHECK(length(account_limits_digest)=64),
  enrolled_at_ms INTEGER NOT NULL CHECK(enrolled_at_ms>=0),
  authority_id TEXT NOT NULL,
  authority_revision TEXT NOT NULL,
  authority_digest TEXT NOT NULL CHECK(length(authority_digest)=64),
  request_digest TEXT NOT NULL CHECK(length(request_digest)=64),
  request_payload TEXT NOT NULL CHECK(length(CAST(request_payload AS BLOB))<=1048576),
  authorization_payload TEXT NOT NULL CHECK(length(CAST(authorization_payload AS BLOB))<=1048576)
);
CREATE TRIGGER IF NOT EXISTS evaluation_baseline_declaration_too_late BEFORE INSERT ON evaluation_baseline_declaration
WHEN NOT EXISTS(SELECT 1 FROM run r JOIN task t ON t.id=r.task_id WHERE r.id=NEW.run_id AND t.state IN ('queued','awaiting_approval'))
  OR EXISTS(SELECT 1 FROM approval_event WHERE run_id=NEW.run_id)
  OR EXISTS(SELECT 1 FROM execution_event WHERE run_id=NEW.run_id)
  OR EXISTS(SELECT 1 FROM orchestration_attempt WHERE run_id=NEW.run_id)
BEGIN SELECT RAISE(ABORT,'evaluation baseline too late'); END;
CREATE TRIGGER IF NOT EXISTS evaluation_baseline_declaration_update BEFORE UPDATE ON evaluation_baseline_declaration
BEGIN SELECT RAISE(ABORT,'evaluation baseline immutable'); END;
CREATE TRIGGER IF NOT EXISTS evaluation_baseline_declaration_delete BEFORE DELETE ON evaluation_baseline_declaration
BEGIN SELECT RAISE(ABORT,'evaluation baseline immutable'); END;
CREATE TRIGGER IF NOT EXISTS evaluation_baseline_declaration_replace BEFORE INSERT ON evaluation_baseline_declaration
WHEN EXISTS(SELECT 1 FROM evaluation_baseline_declaration WHERE baseline_id=NEW.baseline_id OR enrollment_id=NEW.enrollment_id OR run_id=NEW.run_id)
BEGIN SELECT RAISE(ABORT,'evaluation baseline immutable'); END;
