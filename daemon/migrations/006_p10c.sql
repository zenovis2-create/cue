PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS session_runtime (
  handle TEXT PRIMARY KEY REFERENCES session_handle(handle),
  role TEXT NOT NULL CHECK (role IN ('controller','tool_worker')),
  boundary TEXT NOT NULL CHECK (boundary IN ('host-model-only','appcontainer-capability-zero')),
  parent_handle TEXT REFERENCES session_handle(handle),
  created_at TEXT NOT NULL
);
