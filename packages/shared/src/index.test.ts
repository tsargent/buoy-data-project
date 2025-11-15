import { describe, it, expect } from "vitest";

// Import schemas
import { StationSchema, ObservationSchema } from "../src/index.js";

describe("StationSchema", () => {
  it("should validate a complete station object", () => {
    const station = {
      id: "44009",
      name: "Delaware Bay",
      lat: 38.461,
      lon: -74.703,
    };

    const result = StationSchema.safeParse(station);
    expect(result.success).toBe(true);
  });

  it("should reject missing required fields", () => {
    const invalid = {
      id: "44009",
      name: "Delaware Bay",
      // missing lat, lon
    };

    const result = StationSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("should reject invalid types", () => {
    const invalid = {
      id: "44009",
      name: "Delaware Bay",
      lat: "not-a-number", // should be number
      lon: -74.703,
    };

    const result = StationSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe("ObservationSchema", () => {
  it("should validate a complete observation", () => {
    const observation = {
      id: "clxyz123",
      stationId: "44009",
      observedAt: "2025-11-14T12:00:00Z",
      waveHeightM: 1.5,
      windSpeedMps: 8.2,
      windDirDeg: 180,
      waterTempC: 12.4,
      pressureHpa: 1013.2,
    };

    const result = ObservationSchema.safeParse(observation);
    expect(result.success).toBe(true);
  });

  it("should allow null optional fields", () => {
    const observation = {
      id: "clxyz123",
      stationId: "44009",
      observedAt: "2025-11-14T12:00:00Z",
      waveHeightM: null,
      windSpeedMps: null,
      windDirDeg: null,
      waterTempC: null,
      pressureHpa: null,
    };

    const result = ObservationSchema.safeParse(observation);
    expect(result.success).toBe(true);
  });

  it("should allow missing optional fields", () => {
    const observation = {
      id: "clxyz123",
      stationId: "44009",
      observedAt: "2025-11-14T12:00:00Z",
    };

    const result = ObservationSchema.safeParse(observation);
    expect(result.success).toBe(true);
  });

  it("should reject missing required fields", () => {
    const invalid = {
      id: "clxyz123",
      // missing stationId, observedAt
    };

    const result = ObservationSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
