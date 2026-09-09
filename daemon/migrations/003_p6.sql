PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS conversation_route (
  run_id TEXT PRIMARY KEY REFERENCES run(id),
  channel_id TEXT NOT NULL,
  thread_root TEXT NOT NULL,
  approved_at TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS conversation_route_no_update BEFORE UPDATE ON conversation_route
BEGIN SELECT RAISE(ABORT, 'approved conversation route is immutable'); END;
