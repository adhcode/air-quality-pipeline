-- CreateTable
CREATE TABLE "Station" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "country" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Station_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawReading" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "parameter" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RawReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedReading" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "parameter" TEXT NOT NULL,
    "valueUgM3" DOUBLE PRECISION NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "aqi" INTEGER,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Anomaly" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "parameter" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "zScore" DOUBLE PRECISION NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Anomaly_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Station_sourceId_key" ON "Station"("sourceId");

-- CreateIndex
CREATE INDEX "RawReading_stationId_measuredAt_idx" ON "RawReading"("stationId", "measuredAt");

-- CreateIndex
CREATE INDEX "RawReading_processed_idx" ON "RawReading"("processed");

-- CreateIndex
CREATE INDEX "ProcessedReading_stationId_parameter_measuredAt_idx" ON "ProcessedReading"("stationId", "parameter", "measuredAt");

-- CreateIndex
CREATE INDEX "Anomaly_stationId_resolved_idx" ON "Anomaly"("stationId", "resolved");

-- AddForeignKey
ALTER TABLE "RawReading" ADD CONSTRAINT "RawReading_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessedReading" ADD CONSTRAINT "ProcessedReading_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anomaly" ADD CONSTRAINT "Anomaly_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
