CREATE TABLE cue_project (
  project_id TEXT PRIMARY KEY,
  worktree_realpath TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  registered_at TEXT NOT NULL,
  archived_at TEXT
);
CREATE TABLE cue_user_session (
  session_id TEXT PRIMARY KEY,
  worktree_realpath TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  archived_at TEXT,
  FOREIGN KEY (worktree_realpath) REFERENCES cue_project(worktree_realpath)
);
CREATE INDEX cue_user_session_workspace ON cue_user_session(worktree_realpath,archived_at,created_at);
CREATE TABLE cue_user_session_run (
  run_id TEXT PRIMARY KEY REFERENCES run(id),
  session_id TEXT NOT NULL REFERENCES cue_user_session(session_id),
  attached_at TEXT NOT NULL
);
CREATE INDEX cue_user_session_run_session ON cue_user_session_run(session_id,attached_at);
CREATE TRIGGER cue_user_session_run_scope BEFORE INSERT ON cue_user_session_run
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM cue_user_session s JOIN run r ON r.id=NEW.run_id
    JOIN task t ON t.id=r.task_id JOIN envelope e ON e.envelope_hash=r.envelope_hash
    WHERE s.session_id=NEW.session_id AND s.archived_at IS NULL
      AND s.worktree_realpath=e.worktree_realpath AND t.state='awaiting_approval'
  ) THEN RAISE(ABORT,'cue session scope denied') END;
END;
CREATE TRIGGER cue_user_session_run_no_update BEFORE UPDATE ON cue_user_session_run BEGIN SELECT RAISE(ABORT,'cue session link immutable'); END;
CREATE TRIGGER cue_user_session_run_no_delete BEFORE DELETE ON cue_user_session_run BEGIN SELECT RAISE(ABORT,'cue session link immutable'); END;
