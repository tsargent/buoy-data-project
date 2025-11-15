-- CreateTable
CREATE TABLE "Station" (
    "id" VARCHAR(16) NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'NDBC',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Station_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Observation" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "waveHeightM" DOUBLE PRECISION,
    "windSpeedMps" DOUBLE PRECISION,
    "windDirDeg" INTEGER,
    "waterTempC" DOUBLE PRECISION,
    "pressureHpa" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Observation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Observation_stationId_observedAt_idx" ON "Observation"("stationId", "observedAt");

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
