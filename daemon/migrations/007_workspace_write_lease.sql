PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workspace_write_lease (
  worktree_realpath TEXT PRIMARY KEY,
  run_id TEXT NOT NULL UNIQUE REFERENCES run(id),
  acquired_at TEXT NOT NULL
);
