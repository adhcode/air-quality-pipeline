-- Run this once (via the BigQuery console, or `bq query` CLI) to create the
-- dataset and raw landing table that Postgres data gets loaded into.
-- This table is intentionally a near-exact mirror of ProcessedReading —
-- it's the "raw" layer INSIDE the warehouse, before dbt transforms it.
-- (Confusing naming alert: this is "raw" relative to the warehouse, not the
-- same as the app's RawReading table in Postgres — that one has already been
-- cleaned into ProcessedReading by the time it gets here.)

CREATE SCHEMA IF NOT EXISTS `your_project.air_quality`
OPTIONS (location = 'US');

CREATE TABLE IF NOT EXISTS `your_project.air_quality.processed_readings_raw` (
  id STRING,
  station_id STRING,
  station_name STRING,
  city STRING,
  country STRING,
  latitude FLOAT64,
  longitude FLOAT64,
  parameter STRING,
  value_ug_m3 FLOAT64,
  measured_at TIMESTAMP,
  aqi INT64,
  loaded_at TIMESTAMP
)
PARTITION BY DATE(measured_at); -- partitioning by date keeps queries over date
                                  -- ranges cheap and fast — a real warehouse
                                  -- cost/performance concern, not boilerplate.
