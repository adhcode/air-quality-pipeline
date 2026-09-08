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
      console.error(`[processing] skipping reading ${raw.id}:`, (err as Error).message);
      continue;
    }

    const aqi = raw.parameter.toLowerCase() === "pm25" ? computePm25Aqi(valueUgM3) : null;

    await prisma.processedReading.create({
      data: {
        stationId: raw.stationId,
        parameter: raw.parameter,
        valueUgM3,
        measuredAt: raw.measuredAt,
        aqi,
      },
    });

    // Anomaly check: compare this value against the station's recent history
    // for the same parameter.
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

    if (Math.abs(zScore) >= ANOMALY_Z_THRESHOLD) {
      await prisma.anomaly.create({
        data: { stationId: raw.stationId, parameter: raw.parameter, value: valueUgM3, zScore },
      });
      console.log(`[processing] anomaly flagged: station=${raw.stationId} z=${zScore.toFixed(2)}`);
    }

    await prisma.rawReading.update({ where: { id: raw.id }, data: { processed: true } });
  }
}

  runProcessing()
    .then(() => prisma.$disconnect())
    .catch(async (err) => {
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });

