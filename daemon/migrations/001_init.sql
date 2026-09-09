PRAGMA foreign_keys = ON;

CREATE TABLE task (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK (state IN ('queued','running','awaiting_approval','blocked','completed','failed')),
  blocked_reason TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE run (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES task(id),
  envelope_hash TEXT NOT NULL,
  write_in_progress INTEGER NOT NULL DEFAULT 0 CHECK (write_in_progress IN (0,1)),
  started_at TEXT NOT NULL
);
CREATE TABLE envelope (
  envelope_hash TEXT PRIMARY KEY,
  worktree_realpath TEXT NOT NULL,
  egress_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TRIGGER envelope_no_update BEFORE UPDATE ON envelope
BEGIN SELECT RAISE(ABORT, 'envelope is immutable'); END;
CREATE TABLE approval_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES run(id),
  envelope_hash TEXT NOT NULL REFERENCES envelope(envelope_hash),
  thread_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  approval_id TEXT,
  request_ordinal INTEGER NOT NULL CHECK (request_ordinal >= 0),
  decision TEXT NOT NULL CHECK (decision IN ('accept','decline')),
  created_at TEXT NOT NULL,
  UNIQUE(run_id,envelope_hash,thread_id,item_id,approval_id,request_ordinal)
);
CREATE UNIQUE INDEX approval_event_replay_null_safe ON approval_event(
  run_id,envelope_hash,thread_id,item_id,ifnull(approval_id,''),request_ordinal
);
CREATE TABLE execution_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES run(id),
  thread_id TEXT NOT NULL,
  item_id TEXT,
  approval_id TEXT,
  execution_id TEXT NOT NULL,
  execution_ordinal INTEGER NOT NULL CHECK (execution_ordinal >= 0),
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX execution_event_replay_null_safe ON execution_event(
  run_id,thread_id,ifnull(item_id,''),ifnull(approval_id,''),execution_id,execution_ordinal
);
CREATE TABLE session_handle (
  handle TEXT PRIMARY KEY,
  pid INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  cwd TEXT NOT NULL,
  task_id TEXT NOT NULL REFERENCES task(id),
  run_id TEXT NOT NULL REFERENCES run(id)
);
CREATE TABLE artifact (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL REFERENCES task(id),
  run_id TEXT NOT NULL REFERENCES run(id),
  kind TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE annotation (id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL REFERENCES task(id), body TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE recovery_attempt (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL REFERENCES run(id), outcome TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE verification (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL REFERENCES run(id), check_name TEXT NOT NULL, verdict TEXT NOT NULL, evidence TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE run_autonomy (
  run_id TEXT PRIMARY KEY REFERENCES run(id),
  level INTEGER NOT NULL CHECK (level IN (1,2,3)),
  retry_cap INTEGER NOT NULL CHECK (retry_cap >= 0),
  recorded_at TEXT NOT NULL
);
CREATE TABLE autonomy_change (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES run(id),
  from_level INTEGER NOT NULL,
  requested_level INTEGER NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('lowered','stop_new_run')),
  created_at TEXT NOT NULL
);
CREATE TABLE recovery_attempt_v2 (
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
