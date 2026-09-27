CREATE TABLE handoff_cost_attribution_migration(singleton INTEGER PRIMARY KEY CHECK(singleton=1),version TEXT NOT NULL CHECK(version='cue-handoff-cost-attribution-v1'),baseline_fact_rowid INTEGER NOT NULL CHECK(baseline_fact_rowid>=0)) STRICT;
CREATE TABLE evaluation_handoff_cost_projection_legacy(fact_id TEXT PRIMARY KEY REFERENCES evaluation_measured_fact(fact_id),reason TEXT NOT NULL CHECK(reason='legacy-handoff-cost-projection-unavailable')) STRICT;
INSERT INTO evaluation_handoff_cost_projection_legacy SELECT fact_id,'legacy-handoff-cost-projection-unavailable' FROM evaluation_measured_fact;
INSERT INTO handoff_cost_attribution_migration SELECT 1,'cue-handoff-cost-attribution-v1',coalesce(max(rowid),0) FROM evaluation_measured_fact;

CREATE TABLE handoff_cost_attribution(
 attribution_id TEXT PRIMARY KEY,run_id TEXT NOT NULL,request_id TEXT NOT NULL,attempt_id TEXT NOT NULL,
 budget_receipt_id TEXT NOT NULL,budget_receipt_revision INTEGER NOT NULL,budget_receipt_digest TEXT NOT NULL,
 handoff_id TEXT NOT NULL, handoff_digest TEXT NOT NULL,execution_receipt_id TEXT NOT NULL,execution_receipt_revision INTEGER NOT NULL,
 total_units INTEGER NOT NULL,base_units INTEGER NOT NULL,retry_units INTEGER NOT NULL,verification_units INTEGER NOT NULL,handoff_units INTEGER NOT NULL,
 currency TEXT NOT NULL,unit TEXT NOT NULL CHECK(unit IN ('minor','micro')),evidence_ref TEXT NOT NULL,evidence_digest TEXT NOT NULL,observed_at_ms INTEGER NOT NULL,
 payload TEXT NOT NULL,digest TEXT NOT NULL,
 UNIQUE(run_id,request_id),UNIQUE(attempt_id),UNIQUE(budget_receipt_id),UNIQUE(handoff_id),
 FOREIGN KEY(run_id,request_id) REFERENCES integration_budget_reservation(run_id,request_id),
 FOREIGN KEY(attempt_id) REFERENCES orchestration_attempt(attempt_id),FOREIGN KEY(handoff_id) REFERENCES orchestration_handoff(handoff_id),
 CHECK(budget_receipt_revision>=1 AND execution_receipt_revision>=0 AND total_units>=0 AND base_units>=0 AND retry_units>=0 AND verification_units>=0 AND handoff_units>=0 AND observed_at_ms>=0),
 CHECK(length(budget_receipt_digest)=64 AND length(handoff_digest)=64 AND length(evidence_digest)=64 AND length(digest)=64)
) STRICT;

CREATE TABLE evaluation_handoff_cost_projection(
 fact_id TEXT PRIMARY KEY REFERENCES evaluation_measured_fact(fact_id),accounting_digest TEXT,
 attribution_cutoff_rowid INTEGER NOT NULL CHECK(attribution_cutoff_rowid>=0),handoff_cutoff_rowid INTEGER NOT NULL CHECK(handoff_cutoff_rowid>=0),
 inventory_digest TEXT NOT NULL CHECK(length(inventory_digest)=64),payload TEXT NOT NULL,digest TEXT NOT NULL CHECK(length(digest)=64)
) STRICT;

CREATE TRIGGER handoff_cost_attribution_migration_no_update BEFORE UPDATE ON handoff_cost_attribution_migration BEGIN SELECT RAISE(ABORT,'handoff cost attribution migration immutable'); END;
CREATE TRIGGER handoff_cost_attribution_migration_no_delete BEFORE DELETE ON handoff_cost_attribution_migration BEGIN SELECT RAISE(ABORT,'handoff cost attribution migration immutable'); END;
CREATE TRIGGER handoff_cost_attribution_migration_no_replace BEFORE INSERT ON handoff_cost_attribution_migration BEGIN SELECT RAISE(ABORT,'handoff cost attribution migration immutable'); END;
CREATE TRIGGER evaluation_handoff_cost_projection_legacy_no_update BEFORE UPDATE ON evaluation_handoff_cost_projection_legacy BEGIN SELECT RAISE(ABORT,'legacy handoff cost projection immutable'); END;
CREATE TRIGGER evaluation_handoff_cost_projection_legacy_no_delete BEFORE DELETE ON evaluation_handoff_cost_projection_legacy BEGIN SELECT RAISE(ABORT,'legacy handoff cost projection immutable'); END;
CREATE TRIGGER evaluation_handoff_cost_projection_legacy_no_insert BEFORE INSERT ON evaluation_handoff_cost_projection_legacy BEGIN SELECT RAISE(ABORT,'legacy handoff cost projection membership closed'); END;
CREATE TRIGGER handoff_cost_attribution_insert_guard BEFORE INSERT ON handoff_cost_attribution WHEN cue_sha256(NEW.payload)<>NEW.digest BEGIN SELECT RAISE(ABORT,'handoff cost attribution digest'); END;
CREATE TRIGGER handoff_cost_attribution_no_update BEFORE UPDATE ON handoff_cost_attribution BEGIN SELECT RAISE(ABORT,'handoff cost attribution immutable'); END;
CREATE TRIGGER handoff_cost_attribution_no_delete BEFORE DELETE ON handoff_cost_attribution BEGIN SELECT RAISE(ABORT,'handoff cost attribution immutable'); END;
CREATE TRIGGER evaluation_handoff_cost_projection_insert_guard BEFORE INSERT ON evaluation_handoff_cost_projection WHEN cue_sha256(NEW.payload)<>NEW.digest BEGIN SELECT RAISE(ABORT,'handoff cost projection digest'); END;
CREATE TRIGGER evaluation_handoff_cost_projection_no_update BEFORE UPDATE ON evaluation_handoff_cost_projection BEGIN SELECT RAISE(ABORT,'handoff cost projection immutable'); END;
CREATE TRIGGER evaluation_handoff_cost_projection_no_delete BEFORE DELETE ON evaluation_handoff_cost_projection BEGIN SELECT RAISE(ABORT,'handoff cost projection immutable'); END;
