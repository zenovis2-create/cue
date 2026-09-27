CREATE TABLE IF NOT EXISTS local_selection_policy_snapshot (
  policy_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK(revision > 0),
  digest TEXT NOT NULL CHECK(length(digest)=64),
  policy_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  source_version TEXT NOT NULL,
  PRIMARY KEY(policy_id,revision),
  UNIQUE(policy_id,revision,digest)
);
CREATE TABLE IF NOT EXISTS local_selection_run_policy (
  run_id TEXT PRIMARY KEY REFERENCES run(id),
  policy_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  digest TEXT NOT NULL,
  bound_at TEXT NOT NULL,
  FOREIGN KEY(policy_id,revision,digest) REFERENCES local_selection_policy_snapshot(policy_id,revision,digest)
);
CREATE TRIGGER IF NOT EXISTS local_policy_no_update BEFORE UPDATE ON local_selection_policy_snapshot BEGIN SELECT RAISE(ABORT,'immutable_local_policy'); END;
CREATE TRIGGER IF NOT EXISTS local_policy_no_delete BEFORE DELETE ON local_selection_policy_snapshot BEGIN SELECT RAISE(ABORT,'immutable_local_policy'); END;
CREATE TRIGGER IF NOT EXISTS local_policy_no_replace BEFORE INSERT ON local_selection_policy_snapshot
WHEN EXISTS(SELECT 1 FROM local_selection_policy_snapshot WHERE policy_id=NEW.policy_id AND revision=NEW.revision)
BEGIN SELECT RAISE(ABORT,'immutable_local_policy'); END;
CREATE TRIGGER IF NOT EXISTS local_run_policy_no_update BEFORE UPDATE ON local_selection_run_policy BEGIN SELECT RAISE(ABORT,'immutable_local_run_policy'); END;
CREATE TRIGGER IF NOT EXISTS local_run_policy_no_delete BEFORE DELETE ON local_selection_run_policy BEGIN SELECT RAISE(ABORT,'immutable_local_run_policy'); END;
CREATE TRIGGER IF NOT EXISTS local_run_policy_no_replace BEFORE INSERT ON local_selection_run_policy
WHEN EXISTS(SELECT 1 FROM local_selection_run_policy WHERE run_id=NEW.run_id)
BEGIN SELECT RAISE(ABORT,'immutable_local_run_policy'); END;
CREATE TRIGGER IF NOT EXISTS local_policy_binding_guard BEFORE INSERT ON local_selection_run_policy
WHEN NOT EXISTS(SELECT 1 FROM run WHERE id=NEW.run_id)
  OR EXISTS(SELECT 1 FROM approval_event WHERE run_id=NEW.run_id)
  OR EXISTS(SELECT 1 FROM orchestration_attempt WHERE run_id=NEW.run_id)
  OR EXISTS(SELECT 1 FROM selection_run_policy WHERE run_id=NEW.run_id)
BEGIN SELECT RAISE(ABORT,'local_policy_binding_denied'); END;
-- Also fence legacy execution paths which need not retain orchestration attempts.
-- Separate additive guard applies even where the earlier 022 draft was initialized.
CREATE TRIGGER IF NOT EXISTS local_policy_execution_guard BEFORE INSERT ON local_selection_run_policy
WHEN EXISTS(SELECT 1 FROM run WHERE id=NEW.run_id AND write_in_progress<>0)
  OR EXISTS(SELECT 1 FROM execution_event WHERE run_id=NEW.run_id)
  OR EXISTS(SELECT 1 FROM session_handle WHERE run_id=NEW.run_id)
BEGIN SELECT RAISE(ABORT,'local_policy_binding_denied'); END;
CREATE TRIGGER IF NOT EXISTS monetary_policy_excludes_local BEFORE INSERT ON selection_run_policy
WHEN EXISTS(SELECT 1 FROM local_selection_run_policy WHERE run_id=NEW.run_id)
BEGIN SELECT RAISE(ABORT,'local_policy_binding_denied'); END;
