import { config } from "../config.js";
import type { NormalizedReading } from "../types.js";

// This is the ONLY file in the project that knows the shape of OpenAQ's API
// response. If OpenAQ changes their API, this is the only file you touch.
//
// IMPORTANT: OpenAQ's /v3/locations/{id}/latest endpoint only returns
// datetime, value, coordinates, sensorsId, and locationsId — it does NOT
// include the station name, city, country, parameter name, or unit. Those
// live on a separate /v3/locations/{id} endpoint, which lists the station's
// "sensors" (each with an id + parameter name/unit). So we need to fetch
// BOTH endpoints and join them by sensorsId — a single call isn't enough.

const OPENAQ_BASE_URL = "https://api.openaq.org/v3";

const COUNTRY_CODE_TO_NAME: Record<string, string> = {
  NG: "Nigeria",
  ZA: "South Africa",
  ZM: "Zambia",
  MZ: "Mozambique",
  GM: "Gambia",
  BI: "Burundi",
  ET: "Ethiopia",
};

function resolveCountryName(code: string | null): string | null {
  if (!code) return null;
  return COUNTRY_CODE_TO_NAME[code] ?? code;
}

interface OpenAQLocationResponse {
  results: {
    id: number;
    name: string;
    locality: string | null;
    country: { code: string } | null;
    coordinates: { latitude: number; longitude: number };
    sensors: {
      id: number;
      parameter: { name: string; units: string };
    }[];
  }[];
}

interface OpenAQLatestResponse {
  results: {
    sensorsId: number;
    locationsId: number;
    value: number;
    coordinates: { latitude: number; longitude: number };
    datetime: { utc: string; local: string };
  }[];
}

export async function fetchOpenAQReadings(locationId: string): Promise<NormalizedReading[]> {
  const headers = { "X-API-Key": config.openaqApiKey };

  // Step 1: get station + sensor metadata (names, parameters, units).
  const locationRes = await fetch(`${OPENAQ_BASE_URL}/locations/${locationId}`, { headers });
  if (!locationRes.ok) {
    throw new Error(`OpenAQ location lookup failed for ${locationId}: ${locationRes.status}`);
  }
  const locationData = (await locationRes.json()) as OpenAQLocationResponse;
  const location = locationData.results[0];
  if (!location) {
    throw new Error(`OpenAQ location ${locationId} not found`);
  }

  // Build a lookup: sensorId -> { parameter name, unit } — so we can look up
  // what each latest reading actually measured.
  const sensorInfo = new Map(location.sensors.map((s) => [s.id, s.parameter]));

  // Step 2: get the latest values themselves.
  const latestRes = await fetch(`${OPENAQ_BASE_URL}/locations/${locationId}/latest`, { headers });
  if (!latestRes.ok) {
    throw new Error(`OpenAQ latest request failed for ${locationId}: ${latestRes.status}`);
  }
  const latestData = (await latestRes.json()) as OpenAQLatestResponse;

  // Step 3: join the two — for each latest value, look up its parameter/unit
  // via sensorsId. Skip any sensor we don't have metadata for rather than
  // guess.
  const readings: NormalizedReading[] = [];
  for (const r of latestData.results) {
    const parameter = sensorInfo.get(r.sensorsId);
    if (!parameter) {
      console.warn(`[openaq] no sensor metadata for sensorsId ${r.sensorsId} at location ${locationId}, skipping`);
      continue;
    }

    readings.push({
      sourceId: String(location.id),
      stationName: location.name,
      city: location.locality,
      country: resolveCountryName(location.country?.code ?? null),
      latitude: r.coordinates.latitude,
      longitude: r.coordinates.longitude,
      parameter: parameter.name,
      value: r.value,
      unit: parameter.units,
      measuredAt: new Date(r.datetime.utc),
      source: "openaq",
      rawPayload: r,
    });
  }

  return readings;
}
