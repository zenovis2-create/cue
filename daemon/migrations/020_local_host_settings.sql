CREATE TABLE IF NOT EXISTS local_host_settings_snapshot (
  settings_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  digest TEXT NOT NULL CHECK (length(digest) = 64),
  settings_json TEXT NOT NULL CHECK (length(settings_json) <= 16384),
  created_at TEXT NOT NULL,
  source_version TEXT NOT NULL,
  PRIMARY KEY (settings_id, revision)
);
CREATE TRIGGER IF NOT EXISTS local_host_settings_no_update
BEFORE UPDATE ON local_host_settings_snapshot BEGIN SELECT RAISE(ABORT, 'immutable_local_host_settings'); END;
CREATE TRIGGER IF NOT EXISTS local_host_settings_no_delete
BEFORE DELETE ON local_host_settings_snapshot BEGIN SELECT RAISE(ABORT, 'immutable_local_host_settings'); END;
-- REPLACE must fail even with recursive_triggers OFF.
CREATE TRIGGER IF NOT EXISTS local_host_settings_no_replace
BEFORE INSERT ON local_host_settings_snapshot
WHEN EXISTS (SELECT 1 FROM local_host_settings_snapshot WHERE settings_id=NEW.settings_id AND revision=NEW.revision)
BEGIN SELECT RAISE(ABORT, 'immutable_local_host_settings'); END;
