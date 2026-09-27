CREATE TABLE IF NOT EXISTS resource_snapshot (
 package_id TEXT NOT NULL CHECK(length(package_id) BETWEEN 1 AND 128), version TEXT NOT NULL CHECK(length(version) BETWEEN 1 AND 64), manifest_sha256 TEXT NOT NULL CHECK(length(manifest_sha256)=64),
 snapshot_sha256 TEXT NOT NULL CHECK(length(snapshot_sha256)=64), payload_json TEXT NOT NULL CHECK(typeof(payload_json)='text' AND length(CAST(payload_json AS BLOB))<=8388608),
 PRIMARY KEY(package_id,version), UNIQUE(package_id,version,snapshot_sha256)
);
CREATE TABLE IF NOT EXISTS resource_active (
 package_id TEXT NOT NULL CHECK(length(package_id) BETWEEN 1 AND 128), revision INTEGER NOT NULL CHECK(revision>0), snapshot_version TEXT CHECK(snapshot_version IS NULL OR length(snapshot_version) BETWEEN 1 AND 64), snapshot_sha256 TEXT CHECK(snapshot_sha256 IS NULL OR length(snapshot_sha256)=64),
 previous_sha256 TEXT CHECK(previous_sha256 IS NULL OR length(previous_sha256)=64), event_sha256 TEXT NOT NULL CHECK(length(event_sha256)=64),
 PRIMARY KEY(package_id,revision),
 CHECK((snapshot_version IS NULL)=(snapshot_sha256 IS NULL)),
 FOREIGN KEY(package_id,snapshot_version,snapshot_sha256) REFERENCES resource_snapshot(package_id,version,snapshot_sha256)
);
CREATE TABLE IF NOT EXISTS resource_run_pin (
 run_id TEXT PRIMARY KEY REFERENCES run(id), payload_json TEXT NOT NULL CHECK(typeof(payload_json)='text' AND length(CAST(payload_json AS BLOB))<=16384),
 pin_sha256 TEXT NOT NULL CHECK(length(pin_sha256)=64)
);
CREATE TRIGGER IF NOT EXISTS resource_snapshot_no_update BEFORE UPDATE ON resource_snapshot BEGIN SELECT RAISE(ABORT,'immutable_resource_snapshot'); END;
CREATE TRIGGER IF NOT EXISTS resource_snapshot_no_delete BEFORE DELETE ON resource_snapshot BEGIN SELECT RAISE(ABORT,'immutable_resource_snapshot'); END;
CREATE TRIGGER IF NOT EXISTS resource_snapshot_no_replace BEFORE INSERT ON resource_snapshot
WHEN EXISTS(SELECT 1 FROM resource_snapshot WHERE package_id=NEW.package_id AND version=NEW.version)
BEGIN SELECT RAISE(ABORT,'immutable_resource_snapshot'); END;
CREATE TRIGGER IF NOT EXISTS resource_active_no_update BEFORE UPDATE ON resource_active BEGIN SELECT RAISE(ABORT,'immutable_resource_active'); END;
CREATE TRIGGER IF NOT EXISTS resource_active_no_delete BEFORE DELETE ON resource_active BEGIN SELECT RAISE(ABORT,'immutable_resource_active'); END;
CREATE TRIGGER IF NOT EXISTS resource_active_append_only BEFORE INSERT ON resource_active
WHEN NEW.revision != COALESCE((SELECT MAX(revision)+1 FROM resource_active WHERE package_id=NEW.package_id),1)
 OR NEW.previous_sha256 IS NOT (SELECT event_sha256 FROM resource_active WHERE package_id=NEW.package_id ORDER BY revision DESC LIMIT 1)
BEGIN SELECT RAISE(ABORT,'immutable_resource_active'); END;
CREATE TRIGGER IF NOT EXISTS resource_run_pin_no_update BEFORE UPDATE ON resource_run_pin BEGIN SELECT RAISE(ABORT,'immutable_resource_pin'); END;
CREATE TRIGGER IF NOT EXISTS resource_run_pin_no_delete BEFORE DELETE ON resource_run_pin BEGIN SELECT RAISE(ABORT,'immutable_resource_pin'); END;
CREATE TRIGGER IF NOT EXISTS resource_run_pin_no_replace BEFORE INSERT ON resource_run_pin
WHEN EXISTS(SELECT 1 FROM resource_run_pin WHERE run_id=NEW.run_id)
BEGIN SELECT RAISE(ABORT,'immutable_resource_pin'); END;
