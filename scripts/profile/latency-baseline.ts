#!/usr/bin/env tsx
/*
 * Latency Baseline Script (Task 2.4)
 * Publishes synthetic observation events with publishedAt timestamps and
 * measures end-to-end latency (publish -> client receipt) and retrieves
 * loop latency samples from debug endpoint.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - eventsource lacks types; acceptable for profiling script
import EventSource from "eventsource";
import Redis from "ioredis";
import fs from "node:fs";
import path from "node:path";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const STREAM_URL =
  process.env.STREAM_URL || "http://localhost:3000/v1/observations/stream";
const LOOP_DEBUG_URL =
  process.env.LOOP_DEBUG_URL ||
  "http://localhost:3000/v1/debug/sse-loop-latencies";
const CHANNEL = "observations:new";
const SAMPLE_COUNT = parseInt(process.env.SAMPLES || "60");

interface Sample {
  publishedAt: string;
  receivedAt: string;
  endToEndMs: number;
  loopMs?: number;
  stationId: string;
  seq: number;
}

function p50(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor(0.5 * (sorted.length - 1));
  return sorted[idx];
}
function p95(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor(0.95 * (sorted.length - 1));
  return sorted[idx];
}

async function main() {
  console.log(`Starting latency baseline: ${SAMPLE_COUNT} samples`);
  const redis = new Redis(REDIS_URL);
  const samples: Sample[] = [];
  let connected = false;

  await new Promise<void>((resolve, reject) => {
    const es = new EventSource(STREAM_URL);
    es.addEventListener("connection", () => {
      connected = true;
      console.log("SSE connected");
      resolve();
    });
    es.addEventListener("observation", (evt: MessageEvent) => {
      try {
        const receivedAt = new Date().toISOString();
        const data = JSON.parse(evt.data);
        if (!data.publishedAt) return; // ignore legacy messages
        const endToEndMs =
          Date.parse(receivedAt) - Date.parse(data.publishedAt);
        samples.push({
          publishedAt: data.publishedAt,
          receivedAt,
          endToEndMs,
          stationId: data.stationId,
          seq: samples.length + 1,
        });
      } catch (err) {
        console.error("Parse error", err);
      }
    });
    es.onerror = (err: unknown) => {
      console.error("EventSource error", err);
      if (!connected) reject(err as any);
    };
  });

  // Publish synthetic events sequentially
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const publishedAt = new Date().toISOString();
    const payload = JSON.stringify({
      stationId: "baseline-station",
      timestamp: publishedAt, // reuse timestamp for simplicity
      publishedAt,
      waveHeightM: Math.random() * 5,
      windSpeedMps: Math.random() * 10,
      windDirDeg: Math.round(Math.random() * 360),
      waterTempC: 10 + Math.random() * 10,
      pressureHpa: 1000 + Math.random() * 20,
    });
    await redis.publish(CHANNEL, payload);
    await new Promise((r) => setTimeout(r, 50)); // slight pacing
  }

  // Wait for receipts
  await new Promise((r) => setTimeout(r, 2000));

  // Fetch loop latency samples
  let loopLatencies: number[] = [];
  try {
    const res = await fetch(LOOP_DEBUG_URL);
    if (res.ok) {
      const json = (await res.json()) as { samples: number[] };
      loopLatencies = json.samples.slice(-SAMPLE_COUNT);
      // Align loop latency to samples order (best effort)
      samples.forEach((s, idx) => {
        s.loopMs = loopLatencies[idx];
      });
    } else {
      console.warn("Debug endpoint unavailable, loop latency omitted");
    }
  } catch (err) {
    console.warn("Failed to fetch loop latency samples", err);
  }

  const endToEnd = samples.map((s) => s.endToEndMs);
  const loops = samples
    .filter((s) => typeof s.loopMs === "number")
    .map((s) => s.loopMs as number);

  const summary = {
    sampleCount: samples.length,
    endToEndP50: p50(endToEnd),
    endToEndP95: p95(endToEnd),
    loopP50: p50(loops),
    loopP95: p95(loops),
    timestamp: new Date().toISOString(),
  };

  console.log("Latency summary:", summary);

  // Append to test-results artifact
  const artifactPath = path.join(
    process.cwd(),
    "specs/002-realtime-stream/test-results.md"
  );
  const line =
    `\n### Latency Baseline Run (${summary.timestamp})\n\n` +
    "```json\n" +
    JSON.stringify({ summary, samples }, null, 2) +
    "\n```\n";
  fs.appendFileSync(artifactPath, line, "utf8");

  await redis.quit();
}

main().catch((err) => {
  console.error("Baseline script failed", err);
  process.exit(1);
});
