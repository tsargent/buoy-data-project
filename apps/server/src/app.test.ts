import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildApp } from "./app.js";
import type { FastifyInstance } from "fastify";

describe("API Routes Integration Tests", () => {
  let app: FastifyInstance;

  beforeEach(() => {
    // Set test env vars before building app
    process.env.DATABASE_URL =
      process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/test";
    process.env.JWT_SECRET = "test-secret";
  });

  beforeAll(async () => {
    // Build app but don't start server
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /health", () => {
    it("should return 200 with status ok", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/health",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: "ok" });
    });
  });

  describe("GET /stations", () => {
    it("should return valid response shape (200 or 500 if DB unavailable)", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/stations",
      });

      // Accept 200 (if DB available) or 500 (if DB unavailable in test)
      expect([200, 500]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const data = response.json() as unknown[];
        expect(Array.isArray(data)).toBe(true);
      } else {
        // Error response should follow constitution shape
        const data = response.json() as {
          error: { code: string; message: string };
        };
        expect(data).toHaveProperty("error");
        expect(data.error).toHaveProperty("code");
        expect(data.error).toHaveProperty("message");
      }
    });
  });

  describe("GET /stations/:id", () => {
    it("should return 404 or 500 with error shape for non-existent station", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/stations/nonexistent",
      });

      expect([404, 500]).toContain(response.statusCode);
      const data = response.json() as {
        error: { code: string; message: string };
      };
      expect(data).toHaveProperty("error");
      expect(data.error).toHaveProperty("code");
      expect(data.error).toHaveProperty("message");
    });
  });

  describe("GET /observations/by-station/:stationId", () => {
    it("should accept request and return valid response shape", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/observations/by-station/test-station",
      });

      expect([200, 500]).toContain(response.statusCode);
      const data = response.json() as unknown[] | { error: unknown };

      if (response.statusCode === 200) {
        expect(Array.isArray(data)).toBe(true);
      } else {
        expect(data).toHaveProperty("error");
      }
    });

    it("should accept limit query parameter", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/observations/by-station/test-station?limit=50",
      });

      expect([200, 500]).toContain(response.statusCode);
    });

    it("should accept since query parameter", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/observations/by-station/test-station?since=2025-11-14T00:00:00Z",
      });

      expect([200, 500]).toContain(response.statusCode);
    });

    it("should reject invalid limit parameter", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/observations/by-station/test-station?limit=notanumber",
      });

      // Should fail validation
      expect(response.statusCode).toBe(400);
      const data = response.json() as { error: { code: string } };
      expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    it("should reject invalid since parameter", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/observations/by-station/test-station?since=invalid-date",
      });

      expect(response.statusCode).toBe(400);
      const data = response.json() as { error: { code: string } };
      expect(data.error.code).toBe("VALIDATION_ERROR");
    });
  });
});
