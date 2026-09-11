import { prisma } from "../db.js";
import { normalizeToUgM3, computePm25Aqi } from "./normalize.js";
import { computeZScore, ANOMALY_Z_THRESHOLD } from "./anomaly.js";

// Processes any raw readings that haven't been turned into ProcessedReadings
// yet. Running this as a separate step from ingestion (rather than inline)
// means you can fix a bug in normalization logic and reprocess history
// without re-fetching anything from the external API.
export async function runProcessing() {
  const unprocessed = await prisma.rawReading.findMany({
    where: { processed: false },
    include: { station: true },
    take: 500,
  });

  console.log(`[processing] found ${unprocessed.length} raw readings to process`);

  for (const raw of unprocessed) {
    let valueUgM3: number;
    try {
      valueUgM3 = normalizeToUgM3(raw.value, raw.unit, raw.parameter);
    } catch (err) {
      // This reading isn't a pollutant we know how to convert (e.g. some
      // low-cost OpenAQ devices report temperature/humidity/particle-count
      // metadata alongside pollution readings). The raw data stays intact
      // in RawReading either way — we just mark it processed so it isn't
      // retried forever, without producing a ProcessedReading for it.
      console.log(`[processing] not a tracked pollutant, leaving raw only ${raw.id}: ${(err as Error).message}`);
      await prisma.rawReading.update({ where: { id: raw.id }, data: { processed: true } });
      continue;
    }

    const aqi = raw.parameter.toLowerCase() === "pm25" ? computePm25Aqi(valueUgM3) : null;

    // Fetch history BEFORE inserting the new reading — otherwise the new
    // reading would already be in this result set, comparing itself against
    // itself and skewing the z-score toward zero (making real spikes look
    // less anomalous than they are, especially with limited history).
    const recentHistory = await prisma.processedReading.findMany({
      where: { stationId: raw.stationId, parameter: raw.parameter },
      orderBy: { measuredAt: "desc" },
      take: 30,
      select: { valueUgM3: true },
    });

    const zScore = computeZScore(
      valueUgM3,
      recentHistory.map((h) => h.valueUgM3)
    );

    // These three writes — save the clean reading, maybe flag an anomaly,
    // and mark the raw row processed — must all succeed together or not at
    // all. Without a transaction, a crash between them could leave a
    // ProcessedReading saved but the raw row still marked unprocessed,
    // causing a duplicate ProcessedReading the next time this runs.
    await prisma.$transaction(async (tx) => {
      await tx.processedReading.create({
        data: {
          stationId: raw.stationId,
          parameter: raw.parameter,
          valueUgM3,
          measuredAt: raw.measuredAt,
          aqi,
        },
      });

      if (Math.abs(zScore) >= ANOMALY_Z_THRESHOLD) {
        await tx.anomaly.create({
          data: { stationId: raw.stationId, parameter: raw.parameter, value: valueUgM3, zScore },
        });
        console.log(`[processing] anomaly flagged: station=${raw.stationId} z=${zScore.toFixed(2)}`);
      }

      await tx.rawReading.update({ where: { id: raw.id }, data: { processed: true } });
    });
  }
}

// Same reasoning as run-ingestion.ts: this file is only ever run directly
// via `npm run process`, so we run unconditionally rather than relying on
// a path-comparison check that can silently fail to match.
runProcessing()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });