/**
 * Smoke Test (Task 0.3)
 * ------------------------------------------------------
 * Initially expected to FAIL until Tasks 2.1 (SSE route),
 * 2.2 (connection event), and 3.2 (observation broadcast)
 * are implemented. Commit history should show this file
 * failing before those tasks are completed (test-first gating).
 */
import { describe, it, expect } from "vitest";
import EventSource from "eventsource";
import Redis from "ioredis";

// Helper: publish a test observation payload to Redis
async function publishTestObservation(redisUrl: string) {
  const client = new Redis(redisUrl);
  const payload = {
    stationId: "smoke-station",
    timestamp: new Date().toISOString(),
    waveHeightM: 1.2,
    windSpeedMps: 3.4,
    windDirDeg: 180,
    waterTempC: 12.3,
    pressureHpa: 1005.2,
  };
  try {
    await client.publish("observations:new", JSON.stringify(payload));
  } finally {
    client.disconnect();
  }
}

describe("Stream Smoke Test (pre-implementation gating)", () => {
  it("should receive connection and observation events (EXPECTED TO FAIL UNTIL Tasks 2.1,2.2,3.2)", async () => {
    const streamUrl =
      process.env.SMOKE_STREAM_URL ||
      "http://localhost:3000/v1/observations/stream";
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

    let connectionEventData: string | null = null;
    let observationEventData: string | null = null;

    // NOTE: EventSource will attempt connection; without SSE route (Task 2.1) it will not succeed.
    const es = new EventSource(streamUrl, { retryInterval: 0 });

    es.addEventListener("connection", (evt) => {
      connectionEventData = evt.data;
    });
    es.addEventListener("observation", (evt) => {
      observationEventData = evt.data;
    });
    es.onerror = () => {
      // Swallow errors; expected until route exists.
    };

    // Publish a test observation after small delay (will only be received once subscriber + broadcast exist)
    await new Promise((r) => setTimeout(r, 300));
    await publishTestObservation(redisUrl);

    // Wait up to 2s for events (spec success criteria: 1000ms connection, 2000ms observation)
    await new Promise((r) => setTimeout(r, 2000));
    es.close();

    // Intentional failing expectations until implementation done.
    expect(
      connectionEventData,
      "Connection event should arrive within 1000ms (pending Task 2.1 & 2.2)"
    ).not.toBeNull();
    expect(
      observationEventData,
      "Observation event should arrive within 2000ms (pending Task 3.2)"
    ).not.toBeNull();
  }, 7000); // allow extra time so initial connection attempts don't hang test harness
});
