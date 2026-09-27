-- Applied exactly once by retry-migration.ts, with FK checks before/after the
-- exclusive rebuild. Existing receipt/activity/stage FKs retain this table name.
CREATE TABLE orchestration_attempt_next (
  attempt_id TEXT PRIMARY KEY, run_id TEXT NOT NULL, task_id TEXT NOT NULL,
  candidate_id TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('running','completed','failed','blocked')),
  claim_payload TEXT NOT NULL, worktree_realpath TEXT NOT NULL, lease_acquired_at TEXT,
  cleanup_verified INTEGER NOT NULL DEFAULT 0 CHECK(cleanup_verified IN (0,1)),
  FOREIGN KEY(run_id,task_id) REFERENCES orchestration_step(run_id,task_id)
);
INSERT INTO orchestration_attempt_next SELECT * FROM orchestration_attempt;
DROP TABLE orchestration_attempt;
ALTER TABLE orchestration_attempt_next RENAME TO orchestration_attempt;
CREATE UNIQUE INDEX orchestration_one_unresolved_attempt ON orchestration_attempt(run_id,task_id)
  WHERE state='running' OR cleanup_verified=0;
CREATE TRIGGER orchestration_attempt_no_replace BEFORE INSERT ON orchestration_attempt
WHEN EXISTS(SELECT 1 FROM orchestration_attempt WHERE attempt_id=NEW.attempt_id)
BEGIN SELECT RAISE(ABORT,'immutable_attempt_identity'); END;
CREATE TRIGGER orchestration_attempt_no_delete BEFORE DELETE ON orchestration_attempt
BEGIN SELECT RAISE(ABORT,'immutable_attempt_identity'); END;
CREATE TRIGGER orchestration_attempt_identity BEFORE UPDATE OF attempt_id,run_id,task_id,candidate_id,claim_payload,worktree_realpath,lease_acquired_at ON orchestration_attempt
BEGIN SELECT RAISE(ABORT,'immutable_attempt_identity'); END;
CREATE TABLE orchestration_retry_contract (
  run_id TEXT PRIMARY KEY REFERENCES run(id), payload TEXT NOT NULL, digest TEXT NOT NULL
);
CREATE TRIGGER orchestration_retry_contract_no_replace BEFORE INSERT ON orchestration_retry_contract
WHEN EXISTS(SELECT 1 FROM orchestration_retry_contract WHERE run_id=NEW.run_id)
BEGIN SELECT RAISE(ABORT,'immutable_retry_contract'); END;
CREATE TRIGGER orchestration_retry_contract_no_update BEFORE UPDATE ON orchestration_retry_contract
BEGIN SELECT RAISE(ABORT,'immutable_retry_contract'); END;
CREATE TRIGGER orchestration_retry_contract_no_delete BEFORE DELETE ON orchestration_retry_contract
BEGIN SELECT RAISE(ABORT,'immutable_retry_contract'); END;
CREATE TRIGGER orchestration_retry_before_approval BEFORE INSERT ON orchestration_retry_contract
WHEN NOT EXISTS(SELECT 1 FROM requirement_contract_binding WHERE run_id=NEW.run_id)
 OR EXISTS(SELECT 1 FROM approval_event WHERE run_id=NEW.run_id AND decision='accept')
 OR EXISTS(SELECT 1 FROM orchestration_attempt WHERE run_id=NEW.run_id)
BEGIN SELECT RAISE(ABORT,'retry_contract_too_late_or_missing_criteria'); END;
CREATE TABLE orchestration_retry_link (
  attempt_id TEXT PRIMARY KEY REFERENCES orchestration_attempt(attempt_id),
  previous_attempt_id TEXT NOT NULL UNIQUE REFERENCES orchestration_attempt(attempt_id),
  receipt_id TEXT NOT NULL REFERENCES orchestration_receipt(receipt_id),
  contract_digest TEXT NOT NULL, payload TEXT NOT NULL
);
CREATE TRIGGER orchestration_retry_link_no_replace BEFORE INSERT ON orchestration_retry_link
WHEN EXISTS(SELECT 1 FROM orchestration_retry_link WHERE attempt_id=NEW.attempt_id OR previous_attempt_id=NEW.previous_attempt_id)
BEGIN SELECT RAISE(ABORT,'immutable_retry_link'); END;
CREATE TRIGGER orchestration_retry_link_no_update BEFORE UPDATE ON orchestration_retry_link
BEGIN SELECT RAISE(ABORT,'immutable_retry_link'); END;
CREATE TRIGGER orchestration_retry_link_no_delete BEFORE DELETE ON orchestration_retry_link
BEGIN SELECT RAISE(ABORT,'immutable_retry_link'); END;
CREATE TABLE orchestration_retry_schema(version INTEGER PRIMARY KEY CHECK(version=1));
INSERT INTO orchestration_retry_schema VALUES(1);
