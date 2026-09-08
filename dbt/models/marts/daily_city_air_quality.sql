-- Marts model: the analytics-ready output. This is what a dashboard, a
-- report, or a data analyst would actually query — not the staging table.
-- Aggregation and business logic (like "what counts as an unhealthy day")
-- belong here, not in staging.

with daily_by_station as (
    select
        city,
        country,
        station_id,
        parameter,
        date(measured_at) as reading_date,
        avg(value_ug_m3) as avg_value_ug_m3,
        max(value_ug_m3) as max_value_ug_m3,
        avg(aqi) as avg_aqi,
        max(aqi) as max_aqi,
        count(*) as reading_count
    from {{ ref('stg_readings') }}
    group by city, country, station_id, parameter, reading_date
)

select
    city,
    country,
    reading_date,
    parameter,
    round(avg(avg_value_ug_m3), 2) as city_avg_value_ug_m3,
    round(max(max_value_ug_m3), 2) as city_max_value_ug_m3,
    round(avg(avg_aqi), 0) as city_avg_aqi,
    max(max_aqi) as city_max_aqi,
    -- A simple, transparent business rule: was any station in this city
    -- above the "unhealthy for sensitive groups" AQI threshold that day?
    max(max_aqi) >= 101 as had_unhealthy_reading,
    count(distinct station_id) as station_count
from daily_by_station
group by city, country, reading_date, parameter
