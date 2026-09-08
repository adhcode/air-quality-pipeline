# Air Quality & Environmental Risk Pipeline

An ETL pipeline + REST API that ingests real-time air quality data (OpenAQ),
normalizes it across units/sources, detects anomalous pollution spikes, and
serves it as an API with an alerts feed.

## Architecture

```
OpenAQ API ─▶ ingestion/ ─▶ RawReading (Postgres) ─▶ processing/ ─▶ ProcessedReading + Anomaly ─▶ api/ (Express)
                    ▲                                      ▲                    │
                    └──────────── orchestrated by Airflow ─┴────────────────────┘
                                                                                  ▼
                                                          warehouse/ ─▶ BigQuery raw table
                                                                                  ▼
                                                          dbt (staging ─▶ marts) ─▶ daily_city_air_quality
```

- **Ingestion** (`src/ingestion/`) — pulls data from external sources, stores it
  untouched. Each source gets its own "adapter" file that outputs a common
  `NormalizedReading` shape (`src/types.ts`). Currently two sources:
  - **OpenAQ** (`openaq.ts`) — global coverage, sparse in Africa. Makes 2 API
    calls per station (station/sensor metadata + latest values), since
    OpenAQ's `/latest` endpoint alone doesn't include names or units.
  - **AirQo** (`airqo.ts`) — Africa-focused, covers Lagos and 16+ other
    African cities; added as a second source specifically for African
    coverage OpenAQ lacks
  Adding a source only means writing a new adapter + a new loop in
  `run-ingestion.ts` — storage, processing, warehouse loading, and the API
  never need to change.
- **Processing** (`src/processing/`) — reads unprocessed raw rows, normalizes
  units, computes AQI, checks for anomalies (z-score vs recent history), and
  writes clean data.
- **Warehouse loading** (`warehouse/`) — incrementally loads new
  `ProcessedReading` rows into a raw BigQuery table. Postgres stays the
  operational/serving store; BigQuery is the analytics store.
- **Transformation** (`dbt/`) — SQL models turn the raw warehouse table into
  analytics-ready output: `stg_readings` (cleanup) → `daily_city_air_quality`
  (daily city-level aggregates), with automated data-quality tests.
- **Orchestration** (`airflow/dags/air_quality_dag.py`) — an Airflow DAG runs
  the full chain — ingest → process → load → dbt run → dbt test — every 30
  minutes, with retries and explicit task dependencies.
- **API** (`src/api/`) — Express routes serving processed data from Postgres.
  Its only job is serving — it doesn't schedule or run pipeline jobs itself.
- **Database** — Postgres via Prisma. Schema in `prisma/schema.prisma`.
  Raw and processed data are kept in separate tables on purpose: if you ever
  fix a bug in normalization logic, you can reprocess all of history without
  re-fetching anything from the external API.

## Setup

1. Copy `.env.example` to `.env` and fill in:
   - `OPENAQ_API_KEY` — free key from https://explore.openaq.org/register
   - `TRACKED_LOCATION_IDS` — comma-separated OpenAQ location IDs to monitor
     (look these up via OpenAQ's `/v3/locations` search endpoint for your
     city/region of interest)
   - `AIRQO_API_TOKEN` — free token from https://analytics.airqo.net/user/login
     (Account Settings → API tab → register a client app → generate token)
   - `TRACKED_AIRQO_GRID_IDS` — comma-separated AirQo grid IDs (e.g. Lagos)
     from AirQo's `/v2/devices/grids` endpoint or their analytics dashboard
   - `GOOGLE_APPLICATION_CREDENTIALS` — path to a GCP service account key
     (create a free BigQuery project, then a service account with
     "BigQuery Data Editor" + "BigQuery Job User" roles, download its JSON key)

2. Start the app's Postgres locally:
   ```bash
   docker compose up -d
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Create the database tables:
   ```bash
   npm run prisma:migrate
   ```

5. Create the BigQuery dataset/table — run the contents of
   `warehouse/schema.sql` in the BigQuery console's query editor (replace
   `your_project` with your actual GCP project ID first).

6. Set up dbt — edit `dbt/profiles.yml` with your real GCP project ID and
   service account key path, then from `dbt/`:
   ```bash
   pip install dbt-bigquery
   dbt debug   # confirms the warehouse connection works
   ```

7. Run a manual pass through the whole pipeline to seed some data (optional
   — Airflow will also do this once it's running):
   ```bash
   npm run ingest
   npm run process
   npm run load:warehouse
   cd dbt && dbt run && dbt test && cd ..
   ```

8. Start the API:
   ```bash
   npm run dev:api
   ```

9. Start Airflow (in a separate terminal, from the project root):
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.airflow.yml up -d --build
   ```
   Then open http://localhost:8080 (default login: `airflow` / `airflow` in
   standalone mode — check the container logs on first boot if it generated
   a random password instead), find the `air_quality_pipeline` DAG, and
   switch it on.

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/stations` | List all monitored stations |
| GET | `/stations/:id/current` | Latest reading per parameter for a station |
| GET | `/stations/:id/readings?from=&to=&parameter=` | Historical time series |
| GET | `/alerts` | Active (unresolved) anomalies |

## Suggested next steps

- Swap the simplified AQI formula in `processing/normalize.ts` for the full
  EPA breakpoint table.
- Add a second source (e.g. Open-Meteo Air Quality API) as a new adapter in
  `src/ingestion/` — the rest of the pipeline needs zero changes.
- Add a webhook/email notifier that fires when a new `Anomaly` row is created.
- Move the cron job to a proper queue (BullMQ + Redis) if you scale beyond a
  handful of stations.
- Add tests for `normalize.ts` and `anomaly.ts` — they're pure functions,
  so they're the cheapest, highest-value things to test first.
