import { config } from "../config.js";
import type { NormalizedReading } from "../types.js";

// This is the ONLY file in the project that knows the shape of AirQo's API
// response — same rule as openaq.ts. AirQo is Africa-focused and covers
// Lagos, unlike OpenAQ which has sparse African coverage.
//
// NOTE: AirQo's public API docs don't fully spell out every response field.
// The shape below is based on their documented "recent measurements by grid"
// endpoint — verify it against a real response (just hit the URL in a
// browser with your token) before your first production run, and adjust
// field names if theirs differ slightly. This is a normal first step when
// integrating any new third-party API, not something specific to AirQo.

const AIRQO_BASE_URL = "https://api.airqo.net/api/v2";

interface AirQoMeasurement {
  device_id: string;
  device: string;
  site_id: string;
  siteDetails?: {
    name?: string;
    city?: string;
    country?: string;
    approximate_latitude: number;
    approximate_longitude: number;
  };
  pm2_5?: { value: number };
  pm10?: { value: number };
  no2?: { value: number };
  time: string; // ISO timestamp
}

interface AirQoRecentResponse {
  measurements: AirQoMeasurement[];
}

// gridId identifies a geographic grouping in AirQo's system (e.g. a city).
// Find your target grid's ID via AirQo's `/v2/devices/grids` endpoint or
// their analytics dashboard.
export async function fetchAirQoReadings(gridId: string): Promise<NormalizedReading[]> {
  const url = `${AIRQO_BASE_URL}/devices/measurements/grids/${gridId}/recent?token=${config.airqoApiToken}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`AirQo request failed for grid ${gridId}: ${response.status}`);
  }

  const data = (await response.json()) as AirQoRecentResponse;
  const readings: NormalizedReading[] = [];

  for (const m of data.measurements) {
    // A single measurement can report multiple parameters (pm2_5, pm10, no2)
    // — unlike OpenAQ, which returns one parameter per record. We expand
    // each into its own NormalizedReading so downstream code (which expects
    // one parameter per reading) doesn't need to know this difference.
    const parameterValues: { parameter: string; value: number }[] = [];
    if (m.pm2_5) parameterValues.push({ parameter: "pm25", value: m.pm2_5.value });
    if (m.pm10) parameterValues.push({ parameter: "pm10", value: m.pm10.value });
    if (m.no2) parameterValues.push({ parameter: "no2", value: m.no2.value });

    for (const { parameter, value } of parameterValues) {
      readings.push({
        sourceId: m.device_id,
        stationName: m.device,
        city: m.siteDetails?.city ?? null,
        country: m.siteDetails?.country ?? null,
        latitude: m.siteDetails?.approximate_latitude ?? 0,
        longitude: m.siteDetails?.approximate_longitude ?? 0,
        parameter,
        value,
        unit: "µg/m³", // AirQo reports PM values in µg/m³ already normalized
        measuredAt: new Date(m.time),
        source: "airqo",
        rawPayload: m,
      });
    }
  }

  return readings;
}
