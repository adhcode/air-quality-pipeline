import "dotenv/config";
import { z } from "zod";

// Validating env vars at startup means the app fails fast with a clear error
// instead of crashing mysteriously three steps into an ingestion run.
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  OPENAQ_API_KEY: z.string().min(1),
  TRACKED_LOCATION_IDS: z.string().default(""),
  AIRQO_API_TOKEN: z.string().default(""),
  TRACKED_AIRQO_GRID_IDS: z.string().default(""),
  PORT: z.string().default("3000"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  databaseUrl: parsed.data.DATABASE_URL,
  openaqApiKey: parsed.data.OPENAQ_API_KEY,
  trackedLocationIds: parsed.data.TRACKED_LOCATION_IDS.split(",").filter(Boolean),
  airqoApiToken: parsed.data.AIRQO_API_TOKEN,
  trackedAirqoGridIds: parsed.data.TRACKED_AIRQO_GRID_IDS.split(",").filter(Boolean),
  port: Number(parsed.data.PORT),
};
