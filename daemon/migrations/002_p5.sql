PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS run_autonomy (
  run_id TEXT PRIMARY KEY REFERENCES run(id),
  level INTEGER NOT NULL CHECK (level IN (1,2,3)),
  retry_cap INTEGER NOT NULL CHECK (retry_cap >= 0),
  recorded_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS autonomy_change (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES run(id),
  from_level INTEGER NOT NULL,
  requested_level INTEGER NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('lowered','stop_new_run')),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS recovery_attempt_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES run(id),
  parent_attempt_id INTEGER REFERENCES recovery_attempt_v2(id),
  ordinal INTEGER NOT NULL CHECK (ordinal > 0),
  rung INTEGER NOT NULL CHECK (rung BETWEEN 1 AND 4),
  hypothesis TEXT NOT NULL CHECK (length(trim(hypothesis)) > 0),
  outcome TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(run_id, ordinal)
);
