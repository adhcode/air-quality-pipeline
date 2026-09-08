/**
 * Ingestion verification script.
 *
 * Run this BEFORE trusting `npm run ingest` — it checks each moving part on
 * its own, so if something's broken, you know exactly which piece, instead
 * of a confusing error from the full pipeline.
 *
 * Usage: npx tsx scripts/verify-ingestion.ts
 */
import { config } from "../src/config.js";
import { prisma } from "../src/db.js";
import { fetchOpenAQReadings } from "../src/ingestion/openaq.js";
import { fetchAirQoReadings } from "../src/ingestion/airqo.js";

async function checkDatabaseConnection() {
  console.log("\n[1/4] Checking database connection...");
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("  ✅ Connected to Postgres successfully.");
  } catch (err) {
    console.error("  ❌ Could not connect to Postgres. Is `docker compose up -d` running?");
    console.error("     Error:", (err as Error).message);
    throw err;
  }
}

async function checkConfig() {
  console.log("\n[2/4] Checking configuration...");
  console.log(`  OpenAQ API key set: ${config.openaqApiKey ? "yes" : "❌ NO"}`);
  console.log(`  Tracked OpenAQ location IDs: ${config.trackedLocationIds.length || "❌ NONE — set TRACKED_LOCATION_IDS in .env"}`);
  console.log(`  AirQo API token set: ${config.airqoApiToken ? "yes" : "(not set — AirQo will be skipped)"}`);
  console.log(`  Tracked AirQo grid IDs: ${config.trackedAirqoGridIds.length || "(none set)"}`);

  if (!config.openaqApiKey || config.trackedLocationIds.length === 0) {
    throw new Error("Missing required OpenAQ config — check your .env file.");
  }
}

async function checkOpenAQ() {
  console.log("\n[3/4] Checking OpenAQ adapter (live API call, no DB write)...");
  for (const locationId of config.trackedLocationIds) {
    try {
      const readings = await fetchOpenAQReadings(locationId);
      console.log(`  ✅ Location ${locationId}: got ${readings.length} readings.`);
      if (readings[0]) {
        console.log(
          `     Sample: ${readings[0].parameter} = ${readings[0].value}${readings[0].unit} at ${readings[0].stationName}`
        );
      } else {
        console.warn(`     ⚠️  Zero readings returned — location ID may be wrong or station is offline.`);
      }
    } catch (err) {
      console.error(`  ❌ Location ${locationId} failed:`, (err as Error).message);
    }
  }
}

async function checkAirQo() {
  console.log("\n[4/4] Checking AirQo adapter (live API call, no DB write)...");
  if (!config.airqoApiToken || config.trackedAirqoGridIds.length === 0) {
    console.log("  Skipped — AIRQO_API_TOKEN or TRACKED_AIRQO_GRID_IDS not set yet.");
    return;
  }
  for (const gridId of config.trackedAirqoGridIds) {
    try {
      const readings = await fetchAirQoReadings(gridId);
      console.log(`  ✅ Grid ${gridId}: got ${readings.length} readings.`);
      if (readings[0]) {
        console.log(
          `     Sample: ${readings[0].parameter} = ${readings[0].value}${readings[0].unit} at ${readings[0].stationName}`
        );
      } else {
        console.warn(`     ⚠️  Zero readings returned — grid ID may be wrong, or check the field names in airqo.ts against a real response.`);
      }
    } catch (err) {
      console.error(`  ❌ Grid ${gridId} failed:`, (err as Error).message);
      console.error(`     If this is a field-name mismatch, compare against a raw response:`);
      console.error(`     curl "https://api.airqo.net/api/v2/devices/measurements/grids/${gridId}/recent?token=YOUR_TOKEN"`);
    }
  }
}

async function main() {
  console.log("=== Ingestion Verification ===");
  try {
    await checkDatabaseConnection();
    await checkConfig();
    await checkOpenAQ();
    await checkAirQo();
    console.log("\n=== Done. Review any ❌ or ⚠️ above before running `npm run ingest` for real. ===");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("\nVerification stopped early:", err.message);
  process.exit(1);
});
