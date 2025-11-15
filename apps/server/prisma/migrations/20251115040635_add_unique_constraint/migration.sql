/*
  Warnings:

  - A unique constraint covering the columns `[stationId,observedAt]` on the table `Observation` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Observation_stationId_observedAt_key" ON "Observation"("stationId", "observedAt");
