CREATE TABLE IF NOT EXISTS run_session_epoch (
  run_id TEXT PRIMARY KEY REFERENCES run(id),
  session_epoch TEXT NOT NULL,
  approval_state TEXT NOT NULL CHECK(approval_state IN ('prepared','approved','executing'))
);
