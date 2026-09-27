CREATE TABLE IF NOT EXISTS retrospective_draft (
  draft_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES run(id),
  digest TEXT NOT NULL CHECK(length(digest)=64),
  payload TEXT NOT NULL CHECK(length(CAST(payload AS BLOB))<=1048576)
);
CREATE TRIGGER IF NOT EXISTS retrospective_no_update BEFORE UPDATE ON retrospective_draft
BEGIN SELECT RAISE(ABORT,'retrospective immutable'); END;
CREATE TRIGGER IF NOT EXISTS retrospective_no_delete BEFORE DELETE ON retrospective_draft
BEGIN SELECT RAISE(ABORT,'retrospective immutable'); END;
CREATE TRIGGER IF NOT EXISTS retrospective_no_replace BEFORE INSERT ON retrospective_draft
WHEN EXISTS(SELECT 1 FROM retrospective_draft WHERE draft_id=NEW.draft_id)
BEGIN SELECT RAISE(ABORT,'retrospective immutable'); END;
