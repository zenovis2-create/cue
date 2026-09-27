CREATE TABLE IF NOT EXISTS orchestration_plan (
  run_id TEXT PRIMARY KEY REFERENCES run(id), envelope_hash TEXT NOT NULL,
  digest TEXT NOT NULL, payload TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS orchestration_plan_no_update BEFORE UPDATE ON orchestration_plan
BEGIN SELECT RAISE(ABORT, 'orchestration plan immutable'); END;
CREATE TRIGGER IF NOT EXISTS orchestration_plan_no_replace BEFORE INSERT ON orchestration_plan
WHEN EXISTS(SELECT 1 FROM orchestration_plan WHERE run_id=NEW.run_id)
BEGIN SELECT RAISE(ABORT, 'orchestration plan immutable'); END;
CREATE TRIGGER IF NOT EXISTS orchestration_plan_no_delete BEFORE DELETE ON orchestration_plan
BEGIN SELECT RAISE(ABORT, 'orchestration plan immutable'); END;
CREATE TABLE IF NOT EXISTS orchestration_step (
  run_id TEXT NOT NULL REFERENCES orchestration_plan(run_id), task_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('pending','running','completed','failed','blocked')),
  PRIMARY KEY(run_id,task_id)
);
CREATE TABLE IF NOT EXISTS orchestration_attempt (
  attempt_id TEXT PRIMARY KEY, run_id TEXT NOT NULL, task_id TEXT NOT NULL,
  candidate_id TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('running','completed','failed','blocked')),
  claim_payload TEXT NOT NULL, worktree_realpath TEXT NOT NULL, lease_acquired_at TEXT,
  cleanup_verified INTEGER NOT NULL DEFAULT 0 CHECK(cleanup_verified IN (0,1)),
  UNIQUE(run_id,task_id), FOREIGN KEY(run_id,task_id) REFERENCES orchestration_step(run_id,task_id)
);
CREATE TABLE IF NOT EXISTS orchestration_receipt (
  receipt_id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL REFERENCES orchestration_attempt(attempt_id),
  revision INTEGER NOT NULL, payload TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS orchestration_receipt_revision ON orchestration_receipt(attempt_id,revision);
CREATE TABLE IF NOT EXISTS orchestration_activity (
  event_id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL REFERENCES orchestration_attempt(attempt_id),
  ordinal INTEGER NOT NULL, payload TEXT NOT NULL, UNIQUE(attempt_id,ordinal)
);
CREATE TRIGGER IF NOT EXISTS orchestration_activity_no_replace BEFORE INSERT ON orchestration_activity
WHEN EXISTS(SELECT 1 FROM orchestration_activity WHERE event_id=NEW.event_id OR (attempt_id=NEW.attempt_id AND ordinal=NEW.ordinal))
BEGIN SELECT RAISE(ABORT, 'orchestration activity immutable'); END;
CREATE TRIGGER IF NOT EXISTS orchestration_activity_no_update BEFORE UPDATE ON orchestration_activity
BEGIN SELECT RAISE(ABORT, 'orchestration activity immutable'); END;
CREATE TRIGGER IF NOT EXISTS orchestration_activity_no_delete BEFORE DELETE ON orchestration_activity
BEGIN SELECT RAISE(ABORT, 'orchestration activity immutable'); END;
CREATE TRIGGER IF NOT EXISTS orchestration_receipt_no_replace BEFORE INSERT ON orchestration_receipt
WHEN EXISTS(SELECT 1 FROM orchestration_receipt WHERE receipt_id=NEW.receipt_id OR (attempt_id=NEW.attempt_id AND revision=NEW.revision))
BEGIN SELECT RAISE(ABORT, 'orchestration receipt immutable'); END;
CREATE TRIGGER IF NOT EXISTS orchestration_receipt_no_update BEFORE UPDATE ON orchestration_receipt
BEGIN SELECT RAISE(ABORT, 'orchestration receipt immutable'); END;
CREATE TRIGGER IF NOT EXISTS orchestration_receipt_no_delete BEFORE DELETE ON orchestration_receipt
BEGIN SELECT RAISE(ABORT, 'orchestration receipt immutable'); END;
-- Existing writer ownership table remains the only writer registry. Generic recovery
-- cannot discard an orchestration lease while cleanup is still unverified.
CREATE TRIGGER IF NOT EXISTS orchestration_lease_no_unsafe_delete BEFORE DELETE ON workspace_write_lease
WHEN EXISTS(SELECT 1 FROM orchestration_attempt a WHERE a.run_id=OLD.run_id
  AND a.worktree_realpath=OLD.worktree_realpath AND a.lease_acquired_at=OLD.acquired_at AND a.cleanup_verified=0)
BEGIN SELECT RAISE(ABORT, 'orchestration cleanup unverified'); END;
CREATE TRIGGER IF NOT EXISTS orchestration_lease_no_unsafe_update BEFORE UPDATE ON workspace_write_lease
WHEN EXISTS(SELECT 1 FROM orchestration_attempt a WHERE a.run_id=OLD.run_id
  AND a.worktree_realpath=OLD.worktree_realpath AND a.lease_acquired_at=OLD.acquired_at AND a.cleanup_verified=0)
BEGIN SELECT RAISE(ABORT, 'orchestration cleanup unverified'); END;
CREATE TRIGGER IF NOT EXISTS orchestration_lease_no_unsafe_replace BEFORE INSERT ON workspace_write_lease
WHEN EXISTS(SELECT 1 FROM workspace_write_lease w JOIN orchestration_attempt a
  ON a.run_id=w.run_id AND a.worktree_realpath=w.worktree_realpath AND a.lease_acquired_at=w.acquired_at
  WHERE (w.worktree_realpath=NEW.worktree_realpath OR w.run_id=NEW.run_id) AND a.cleanup_verified=0)
BEGIN SELECT RAISE(ABORT, 'orchestration cleanup unverified'); END;
