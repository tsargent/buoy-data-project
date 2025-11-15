import { buildApp } from "./app";
import { env } from "./env.js";

const app = await buildApp();
await app.listen({ port: env.PORT, host: "0.0.0.0" });
console.log(`API on :${env.PORT}`);
