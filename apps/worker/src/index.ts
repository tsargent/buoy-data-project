import { Queue } from "bullmq";
import { config } from "dotenv";
config();

const queue = new Queue("ingest", {
  connection: { host: "127.0.0.1", port: 6379 },
});
await queue.add("hello", { message: "world" });

console.log("✅ Worker bootstrapped and job queued");
