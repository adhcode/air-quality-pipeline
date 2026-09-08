import { BigQuery } from "@google-cloud/bigquery";
import { prisma } from "../src/db.js";

// This is the "L" in ELT: extract already-cleaned data from Postgres and
// load it into the warehouse, untransformed. dbt (next step) does the
// actual transformation work INSIDE BigQuery, on top of this table — not here.

const bigquery = new BigQuery(); // auth via GOOGLE_APPLICATION_CREDENTIALS env var
const DATASET = "air_quality";
const TABLE = "processed_readings_raw";

export async function loadToWarehouse() {
  // Only load rows measured since the last load, so this can run repeatedly
  // (e.g. daily, via the same Airflow DAG) without re-loading everything.
  const lastLoad = await getLastLoadTimestamp();

  const readings = await prisma.processedReading.findMany({
    where: { measuredAt: { gt: lastLoad } },
    include: { station: true },
    orderBy: { measuredAt: "asc" },
    take: 5000,
  });

  if (readings.length === 0) {
    console.log("[warehouse] nothing new to load");
    return;
  }

  const rows = readings.map((r) => ({
    id: r.id,
    station_id: r.stationId,
    station_name: r.station.name,
    city: r.station.city,
    country: r.station.country,
    latitude: r.station.latitude,
    longitude: r.station.longitude,
    parameter: r.parameter,
    value_ug_m3: r.valueUgM3,
    measured_at: r.measuredAt.toISOString(),
    aqi: r.aqi,
    loaded_at: new Date().toISOString(),
  }));

  await bigquery.dataset(DATASET).table(TABLE).insert(rows);
  console.log(`[warehouse] loaded ${rows.length} rows into BigQuery`);
}

// Tracks the watermark (last successfully loaded timestamp) so re-runs are
// incremental rather than full reloads. A simple file-based watermark is
// fine for a portfolio project; a real production setup would store this
// in a small control table instead.
async function getLastLoadTimestamp(): Promise<Date> {
  const fs = await import("fs/promises");
  try {
    const raw = await fs.readFile(".warehouse-watermark", "utf-8");
    return new Date(raw.trim());
  } catch {
    return new Date(0); // no watermark yet — load everything
  }
}

async function saveLastLoadTimestamp(ts: Date) {
  const fs = await import("fs/promises");
  await fs.writeFile(".warehouse-watermark", ts.toISOString());
}

  loadToWarehouse()
    .then(async () => {
      await saveLastLoadTimestamp(new Date());
      await prisma.$disconnect();
    })
    .catch(async (err) => {
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });

