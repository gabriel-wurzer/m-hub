-- parametric_calibration
--
-- Measured per-period constants for the parametric model. The nightly run reads
-- these (load_calibration() in parametric_model.py) and uses them INSTEAD of the
-- hard-coded placeholders; a missing (period, metric) falls back to the
-- placeholder, so an empty table == the code's default behaviour.
--
-- Rows are (re)computed from real plans / point-cloud slices / IFC uploaded
-- through the plan tool -- the calibration loop (see project_processing_core).
-- `value` is the current mean over `n_samples` measurements for that
-- (period, metric); the plan-tool extension upserts new samples in.

CREATE TABLE IF NOT EXISTS parametric_calibration (
    period      text             NOT NULL,   -- normalized building-period key (e.g. '1919-1945', 'Nach 1976')
    metric      text             NOT NULL,   -- 'wall_thickness_m' | 'interior_wall_lfm_per_m2' | 'storey_height_m'
    value       double precision NOT NULL,   -- current mean of the samples
    n_samples   integer          NOT NULL DEFAULT 0,
    updated_at  timestamptz      NOT NULL DEFAULT now(),
    PRIMARY KEY (period, metric)
);

COMMENT ON TABLE parametric_calibration IS
  'Measured per-period constants for the parametric model; overrides the code placeholders. Grown from plan-tool uploads (calibration loop).';
