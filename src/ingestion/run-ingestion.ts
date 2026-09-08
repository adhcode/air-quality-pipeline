import { config } from "../config.js";
import { prisma } from "../db.js";
import { fetchOpenAQReadings } from "./openaq.js";
import { fetchAirQoReadings } from "./airqo.js";
import type { NormalizedReading } from "../types.js";

// Upserts a station (creates it if new, otherwise leaves it) and stores its
// reading as a RawReading — untouched, alongside the original payload.
// Notice this function doesn't know or care which source the reading came
// from — that's the whole point of normalizing to NormalizedReading first.
async function storeReading(reading: NormalizedReading) {
  const station = await prisma.station.upsert({
    where: { sourceId: reading.sourceId },
    update: {},
    create: {
      sourceId: reading.sourceId,
      name: reading.stationName,
      city: reading.city,
      country: reading.country,
      latitude: reading.latitude,
      longitude: reading.longitude,
    },
  });

  await prisma.rawReading.create({
    data: {
      stationId: station.id,
      parameter: reading.parameter,
      value: reading.value,
      unit: reading.unit,
      measuredAt: reading.measuredAt,
      source: reading.source,
      rawPayload: reading.rawPayload as object,
    },
  });
}

export async function runIngestion() {
  let succeeded = 0;
  let failed = 0;

  // --- OpenAQ ---
  console.log(`[ingestion] starting OpenAQ run for ${config.trackedLocationIds.length} stations`);
  for (const locationId of config.trackedLocationIds) {
    try {
      const readings = await fetchOpenAQReadings(locationId);
      for (const reading of readings) {
        await storeReading(reading);
      }
      succeeded++;
    } catch (err) {
      console.error(`[ingestion] OpenAQ failed for location ${locationId}:`, err);
      failed++;
    }
  }

  // --- AirQo ---
  console.log(`[ingestion] starting AirQo run for ${config.trackedAirqoGridIds.length} grids`);
  for (const gridId of config.trackedAirqoGridIds) {
    try {
      const readings = await fetchAirQoReadings(gridId);
      for (const reading of readings) {
        await storeReading(reading);
      }
      succeeded++;
    } catch (err) {
      console.error(`[ingestion] AirQo failed for grid ${gridId}:`, err);
      failed++;
    }
  }

  console.log(`[ingestion] done. succeeded=${succeeded} failed=${failed}`);
}

// Allows running this file directly via `npm run ingest`
  runIngestion()
    .then(() => prisma.$disconnect())
    .catch(async (err) => {
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });

