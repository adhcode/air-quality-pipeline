-- Staging model: light, 1-to-1 cleanup of the raw landing table.
-- Rule of thumb: staging models rename/cast/filter obvious junk, but don't
-- do business logic (aggregation, joins across concepts) — that's marts' job.

select
    id as reading_id,
    station_id,
    station_name,
    city,
    country,
    latitude,
    longitude,
    lower(parameter) as parameter,
    value_ug_m3,
    measured_at,
    aqi,
    loaded_at
from {{ source('air_quality_raw', 'processed_readings_raw') }}
where value_ug_m3 is not null   -- drop obviously broken rows this early,
  and value_ug_m3 >= 0          -- so nothing downstream has to re-check this
