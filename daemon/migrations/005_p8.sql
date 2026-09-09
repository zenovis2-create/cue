PRAGMA foreign_keys = ON;

-- Written by the session observer.  The UI only reads this ledgered fact.
CREATE TABLE IF NOT EXISTS orphan_session_observation (
  handle TEXT PRIMARY KEY,
  pid INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  observed_at TEXT NOT NULL
);
