CREATE TABLE IF NOT EXISTS selection_policy_snapshot (
  policy_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  digest TEXT NOT NULL CHECK (length(digest) = 64),
  policy_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  source_version TEXT NOT NULL,
  PRIMARY KEY (policy_id, revision),
  UNIQUE (policy_id, revision, digest)
);
CREATE TABLE IF NOT EXISTS selection_run_policy (
  run_id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  digest TEXT NOT NULL,
  bound_at TEXT NOT NULL,
  FOREIGN KEY (policy_id, revision, digest) REFERENCES selection_policy_snapshot(policy_id, revision, digest)
);
CREATE TRIGGER IF NOT EXISTS selection_policy_snapshot_no_update
BEFORE UPDATE ON selection_policy_snapshot BEGIN SELECT RAISE(ABORT, 'immutable_selection_policy'); END;
-- REPLACE may skip DELETE triggers when recursive_triggers is off (SQLite default).
CREATE TRIGGER IF NOT EXISTS selection_policy_snapshot_no_replace
BEFORE INSERT ON selection_policy_snapshot
WHEN EXISTS (SELECT 1 FROM selection_policy_snapshot WHERE policy_id=NEW.policy_id AND revision=NEW.revision)
BEGIN SELECT RAISE(ABORT, 'immutable_selection_policy'); END;
CREATE TRIGGER IF NOT EXISTS selection_policy_snapshot_no_delete
BEFORE DELETE ON selection_policy_snapshot BEGIN SELECT RAISE(ABORT, 'immutable_selection_policy'); END;
CREATE TRIGGER IF NOT EXISTS selection_run_policy_no_update
BEFORE UPDATE ON selection_run_policy BEGIN SELECT RAISE(ABORT, 'immutable_run_policy'); END;
CREATE TRIGGER IF NOT EXISTS selection_run_policy_no_replace
BEFORE INSERT ON selection_run_policy
WHEN EXISTS (SELECT 1 FROM selection_run_policy WHERE run_id=NEW.run_id)
BEGIN SELECT RAISE(ABORT, 'immutable_run_policy'); END;
CREATE TRIGGER IF NOT EXISTS selection_run_policy_no_delete
BEFORE DELETE ON selection_run_policy BEGIN SELECT RAISE(ABORT, 'immutable_run_policy'); END;
