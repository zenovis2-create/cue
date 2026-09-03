PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS result_record (
  artifact_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  record_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (artifact_id, version)
);

CREATE TABLE IF NOT EXISTS annotation_v2 (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES task(id),
  surface TEXT NOT NULL CHECK (surface IN ('work','explain')),
  page_id TEXT,
  artifact_id TEXT,
  artifact_version INTEGER,
  url_label TEXT,
  selector TEXT,
  screenshot_id TEXT NOT NULL,
  korean_text TEXT NOT NULL CHECK (length(trim(korean_text)) > 0),
  created_at TEXT NOT NULL,
  CHECK (
    (surface='work' AND page_id IS NOT NULL AND length(trim(page_id)) > 0 AND artifact_id IS NULL AND artifact_version IS NULL)
    OR
    (surface='explain' AND page_id IS NULL AND artifact_id IS NOT NULL AND length(trim(artifact_id)) > 0 AND artifact_version IS NOT NULL AND artifact_version > 0)
  )
);
CREATE TRIGGER IF NOT EXISTS annotation_v2_no_update BEFORE UPDATE ON annotation_v2
BEGIN SELECT RAISE(ABORT, 'annotations are immutable'); END;
