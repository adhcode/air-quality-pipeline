// A normalized shape we convert every source's data into, before it touches the DB.
// This is the "adapter pattern" — each external API gets its own small adapter
// that outputs this same shape, so the rest of the pipeline never needs to know
// or care which source a reading came from.
export interface NormalizedReading {
  sourceId: string; // external station id
  stationName: string;
  city: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  parameter: string; // "pm25" | "pm10" | "no2" | "o3" | "so2" | "co"
  value: number;
  unit: string;
  measuredAt: Date;
  source: string;
  rawPayload: unknown;
}
