import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db.js";

export const readingsRouter = Router();

const queryParamsSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  parameter: z.string().optional(),
});

// GET /stations/:id/readings?from=&to=&parameter= - historical time series
readingsRouter.get("/:id/readings", async (req, res) => {
  const parsedQuery = queryParamsSchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ error: "Invalid query params", details: parsedQuery.error.flatten() });
  }

  const { id } = req.params;
  const { from, to, parameter } = parsedQuery.data;

  const readings = await prisma.processedReading.findMany({
    where: {
      stationId: id,
      parameter: parameter ?? undefined,
      measuredAt: {
        gte: from ? new Date(from) : undefined,
        lte: to ? new Date(to) : undefined,
      },
    },
    orderBy: { measuredAt: "asc" },
    take: 1000,
  });

  res.json(readings);
});
