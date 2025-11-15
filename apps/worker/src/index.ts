import { Worker, Queue } from "bullmq";
import { env } from "./env.js";
import { prisma } from "../lib/prisma.js";
import { parseNDBCFile } from "../lib/ndbc-parser.js";

// Redis connection from env
const connection = {
  host: new URL(env.REDIS_URL).hostname,
  port: parseInt(new URL(env.REDIS_URL).port || "6379"),
};

// Job queue
const ingestQueue = new Queue("ingest", { connection });

/**
 * Fetch NDBC data for a station
 */
async function fetchStationData(stationId: string): Promise<string> {
  const url = `${env.NDBC_API_BASE}/${stationId}.txt`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${stationId}: ${response.statusText}`);
  }

  return response.text();
}

/**
 * Ingest job processor
 */
const worker = new Worker(
  "ingest",
  async (job) => {
    const { stationId } = job.data as { stationId: string };
    void job.log(`Fetching NDBC data for station ${stationId}`);

    try {
      // Fetch raw data
      const rawData = await fetchStationData(stationId);
      const observations = parseNDBCFile(rawData);

      void job.log(
        `Parsed ${observations.length} observations for ${stationId}`
      );

      // Persist to database (upsert to avoid duplicates)
      let inserted = 0;
      for (const obs of observations) {
        const observedAt = new Date(
          Date.UTC(obs.year, obs.month - 1, obs.day, obs.hour, obs.minute)
        );

        try {
          await prisma.observation.upsert({
            where: {
              // Composite unique key: stationId + observedAt
              stationId_observedAt: {
                stationId,
                observedAt,
              },
            },
            update: {
              waveHeightM: obs.waveHeight,
              windSpeedMps: obs.windSpeed,
              windDirDeg: obs.windDirection,
              waterTempC: obs.waterTemp,
              pressureHpa: obs.pressure,
            },
            create: {
              stationId,
              observedAt,
              waveHeightM: obs.waveHeight,
              windSpeedMps: obs.windSpeed,
              windDirDeg: obs.windDirection,
              waterTempC: obs.waterTemp,
              pressureHpa: obs.pressure,
            },
          });
          inserted++;
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          void job.log(
            `Skipping duplicate or invalid observation: ${errorMsg}`
          );
        }
      }

      void job.log(
        `✅ Ingested ${inserted}/${observations.length} observations for ${stationId}`
      );
      return { stationId, inserted, total: observations.length };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      void job.log(`❌ Error ingesting ${stationId}: ${errorMsg}`);
      throw error;
    }
  },
  { connection }
);

worker.on("completed", (job) => {
  console.log(`✅ Job ${job.id} completed:`, job.returnvalue);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});

// Periodic ingestion scheduler
async function scheduleIngestion() {
  // Fetch active stations from DB
  const stations = await prisma.station.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  console.log(`📅 Scheduling ingestion for ${stations.length} active stations`);

  for (const station of stations) {
    await ingestQueue.add(
      "fetch",
      { stationId: station.id },
      {
        // Remove old jobs for this station
        jobId: `ingest-${station.id}`,
        removeOnComplete: 100,
        removeOnFail: 50,
      }
    );
  }

  console.log(`✅ Queued ${stations.length} ingestion jobs`);
}

// Bootstrap: schedule initial ingestion
await scheduleIngestion();

// Schedule periodic ingestion
setInterval(() => {
  console.log("⏰ Running periodic ingestion...");
  void scheduleIngestion();
}, env.INGEST_INTERVAL_MS);

console.log(
  `✅ Worker running (ingestion interval: ${env.INGEST_INTERVAL_MS}ms)`
);
