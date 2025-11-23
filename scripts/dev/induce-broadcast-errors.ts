#!/usr/bin/env tsx
/*
 * Induce broadcast errors to validate sse_broadcast_errors_total metric labels.
 * 1. Publish malformed JSON (json_parse)
 * 2. Publish schema-invalid payload (missing stationId, wrong field types)
 */
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const CHANNEL = "observations:new";
const METRICS_URL = process.env.METRICS_URL || "http://localhost:3000/metrics";

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const redis = new Redis(REDIS_URL);
  console.log("Publishing malformed JSON...");
  // Publish a message that is NOT valid JSON to trigger json_parse error
  await redis.publish(CHANNEL, '{"stationId": "bad"'); // truncated JSON

  await sleep(200);

  console.log("Publishing schema-invalid message...");
  // Missing stationId, wrong timestamp format, extra field
  const schemaInvalid = JSON.stringify({
    timestamp: Date.now(), // not ISO string
    waveHeightM: "not-a-number",
    extra: "field",
  });
  await redis.publish(CHANNEL, schemaInvalid);

  await sleep(500);

  console.log("Fetching metrics snapshot...");
  const res = await fetch(METRICS_URL);
  const text = await res.text();
  const lines = text.split("\n");
  const errorLines = lines.filter((l) =>
    l.startsWith("sse_broadcast_errors_total")
  );
  console.log("Broadcast error metric lines:");
  errorLines.forEach((l) => console.log(l));

  await redis.quit();
}

main().catch((err) => {
  console.error("Induce error script failed", err);
  process.exit(1);
});
