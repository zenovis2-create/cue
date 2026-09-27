-- User preference only; execution authority remains the bound selection policy.
CREATE TABLE IF NOT EXISTS selection_preference (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  mode TEXT NOT NULL CHECK (mode IN ('efficiency','performance','value','speed')),
  revision INTEGER NOT NULL CHECK (revision > 0 AND revision < 9007199254740991)
);
