import express from "express";
import { config } from "../config.js";
import { stationsRouter } from "./routes/stations.js";
import { readingsRouter } from "./routes/readings.js";
import { alertsRouter } from "./routes/alerts.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/stations", stationsRouter);
app.use("/stations", readingsRouter); // adds /stations/:id/readings
app.use("/alerts", alertsRouter);

// Ingestion + processing are no longer scheduled here — Airflow's
// `air_quality_pipeline` DAG owns that now (see airflow/dags/air_quality_dag.py).
// This server's only job is to serve data.

app.listen(config.port, () => {
  console.log(`[api] listening on port ${config.port}`);
});
