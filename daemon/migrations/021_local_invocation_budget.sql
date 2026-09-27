CREATE TABLE IF NOT EXISTS local_invocation_budget (
  run_id TEXT PRIMARY KEY REFERENCES run(id),
  limit_count INTEGER NOT NULL CHECK(typeof(limit_count)='integer' AND limit_count BETWEEN 1 AND 100000),
  payload TEXT NOT NULL, digest TEXT NOT NULL CHECK(length(digest)=64)
);
CREATE TABLE IF NOT EXISTS local_invocation_reservation (
  request_id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL UNIQUE REFERENCES orchestration_attempt(attempt_id),
  run_id TEXT NOT NULL REFERENCES local_invocation_budget(run_id), task_id TEXT NOT NULL,
  candidate_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('producer','checker')),
  payload TEXT NOT NULL, digest TEXT NOT NULL CHECK(length(digest)=64)
);
CREATE TRIGGER IF NOT EXISTS local_invocation_budget_no_update BEFORE UPDATE ON local_invocation_budget
BEGIN SELECT RAISE(ABORT,'local invocation immutable'); END;
CREATE TRIGGER IF NOT EXISTS local_invocation_budget_no_delete BEFORE DELETE ON local_invocation_budget
BEGIN SELECT RAISE(ABORT,'local invocation immutable'); END;
CREATE TRIGGER IF NOT EXISTS local_invocation_budget_no_replace BEFORE INSERT ON local_invocation_budget
WHEN EXISTS(SELECT 1 FROM local_invocation_budget WHERE run_id=NEW.run_id)
BEGIN SELECT RAISE(ABORT,'local invocation immutable'); END;
CREATE TRIGGER IF NOT EXISTS local_invocation_reservation_no_update BEFORE UPDATE ON local_invocation_reservation
BEGIN SELECT RAISE(ABORT,'local invocation immutable'); END;
CREATE TRIGGER IF NOT EXISTS local_invocation_reservation_no_delete BEFORE DELETE ON local_invocation_reservation
BEGIN SELECT RAISE(ABORT,'local invocation immutable'); END;
CREATE TRIGGER IF NOT EXISTS local_invocation_reservation_no_replace BEFORE INSERT ON local_invocation_reservation
WHEN EXISTS(SELECT 1 FROM local_invocation_reservation WHERE request_id=NEW.request_id OR attempt_id=NEW.attempt_id)
BEGIN SELECT RAISE(ABORT,'local invocation immutable'); END;
CREATE TRIGGER IF NOT EXISTS local_invocation_excludes_money BEFORE INSERT ON local_invocation_budget
WHEN EXISTS(SELECT 1 FROM integration_budget WHERE run_id=NEW.run_id)
BEGIN SELECT RAISE(ABORT,'local invocation incompatible budget'); END;
CREATE TRIGGER IF NOT EXISTS money_excludes_local_invocation BEFORE INSERT ON integration_budget
WHEN EXISTS(SELECT 1 FROM local_invocation_budget WHERE run_id=NEW.run_id)
BEGIN SELECT RAISE(ABORT,'local invocation incompatible budget'); END;
CREATE TRIGGER IF NOT EXISTS local_invocation_reservation_limit BEFORE INSERT ON local_invocation_reservation
WHEN (SELECT count(*) FROM local_invocation_reservation WHERE run_id=NEW.run_id) >=
     (SELECT limit_count FROM local_invocation_budget WHERE run_id=NEW.run_id)
BEGIN SELECT RAISE(ABORT,'local invocation limit exceeded'); END;
CREATE TRIGGER IF NOT EXISTS local_invocation_reservation_lineage BEFORE INSERT ON local_invocation_reservation
WHEN NOT EXISTS(SELECT 1 FROM orchestration_attempt WHERE attempt_id=NEW.attempt_id AND run_id=NEW.run_id
  AND task_id=NEW.task_id AND candidate_id=NEW.candidate_id AND state='running')
BEGIN SELECT RAISE(ABORT,'local invocation attempt mismatch'); END;
