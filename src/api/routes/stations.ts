import { Router } from "express";
import { prisma } from "../../db.js";

export const stationsRouter = Router();

// GET /stations - list all monitored stations
stationsRouter.get("/", async (_req, res) => {
  const stations = await prisma.station.findMany({
    select: { id: true, name: true, city: true, country: true, latitude: true, longitude: true },
  });
  res.json(stations);
});

// GET /stations/:id/current - latest reading per parameter for one station
stationsRouter.get("/:id/current", async (req, res) => {
  const { id } = req.params;

  const station = await prisma.station.findUnique({ where: { id } });
  if (!station) {
    return res.status(404).json({ error: "Station not found" });
  }

  const readings = await prisma.processedReading.findMany({
    where: { stationId: id },
    orderBy: { measuredAt: "desc" },
    distinct: ["parameter"],
    take: 10,
  });

  res.json({ station, readings });
});
