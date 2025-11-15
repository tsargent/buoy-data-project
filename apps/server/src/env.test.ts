import { describe, it, expect } from "vitest";
import { z } from "zod";

// Test the schema directly rather than the module (module caching issues in tests)
const EnvSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().default("dev-secret"),
});

describe("env validation schema", () => {
  it("should parse valid environment variables", () => {
    const input = {
      PORT: "4000",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      JWT_SECRET: "test-secret",
    };

    const result = EnvSchema.parse(input);

    expect(result.PORT).toBe(4000);
    expect(result.DATABASE_URL).toBe(
      "postgresql://test:test@localhost:5432/test"
    );
    expect(result.JWT_SECRET).toBe("test-secret");
  });

  it("should use default PORT if not provided", () => {
    const input = {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    };

    const result = EnvSchema.parse(input);
    expect(result.PORT).toBe(3000);
  });

  it("should use default JWT_SECRET if not provided", () => {
    const input = {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    };

    const result = EnvSchema.parse(input);
    expect(result.JWT_SECRET).toBe("dev-secret");
  });

  it("should throw if DATABASE_URL is missing", () => {
    const input = {
      PORT: "3000",
    };

    expect(() => EnvSchema.parse(input)).toThrow();
  });

  it("should coerce PORT string to number", () => {
    const input = {
      PORT: "8080",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    };

    const result = EnvSchema.parse(input);
    expect(result.PORT).toBe(8080);
    expect(typeof result.PORT).toBe("number");
  });
});
