import { Router } from "express";
import { prisma } from "../../db.js";

export const alertsRouter = Router();

// GET /alerts - active (unresolved) anomalies across all stations
alertsRouter.get("/", async (_req, res) => {
  const alerts = await prisma.anomaly.findMany({
    where: { resolved: false },
    include: { station: { select: { name: true, city: true, country: true } } },
    orderBy: { detectedAt: "desc" },
    take: 100,
  });
  res.json(alerts);
});
