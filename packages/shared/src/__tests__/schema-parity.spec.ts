import { describe, it, expect } from "vitest";
import { ConnectionEventSchema, ObservationEventSchema } from "../events";
import { ErrorResponseSchema, ErrorCodeEnum } from "../errors";

// Interface keys mirrored via constants to enable runtime parity checks
const ConnectionEventKeys = ["status", "timestamp"] as const;
const ObservationEventKeys = [
  "stationId",
  "timestamp",
  "waveHeightM",
  "windSpeedMps",
  "windDirDeg",
  "waterTempC",
  "pressureHpa",
] as const;
const ErrorResponseKeys = ["error"] as const;
const ErrorInnerKeys = ["code", "message"] as const;

function keysOfShape(shape: Record<string, unknown>): string[] {
  return Object.keys(shape);
}

describe("Schema parity", () => {
  it("ConnectionEvent schema matches interface keys", () => {
    const schemaKeys = keysOfShape(ConnectionEventSchema.shape);
    expect(schemaKeys.sort()).toEqual([...ConnectionEventKeys].sort());
  });

  it("ObservationEvent schema matches interface keys", () => {
    const schemaKeys = keysOfShape(ObservationEventSchema.shape);
    expect(schemaKeys.sort()).toEqual([...ObservationEventKeys].sort());
  });

  it("ErrorResponse schema top-level key parity", () => {
    const schemaKeys = keysOfShape(ErrorResponseSchema.shape);
    expect(schemaKeys.sort()).toEqual([...ErrorResponseKeys].sort());
  });

  it("ErrorResponse inner error object key parity", () => {
    const errorObj = ErrorResponseSchema.shape.error; // z.ZodObject
    const innerShape: Record<string, unknown> = (errorObj as typeof errorObj)
      .shape;
    const innerKeys = keysOfShape(innerShape);
    expect(innerKeys.sort()).toEqual([...ErrorInnerKeys].sort());
  });

  it("Error codes enumeration contains expected codes", () => {
    expect(ErrorCodeEnum.options.sort()).toEqual(
      [
        "INVALID_REQUEST",
        "SERVICE_UNAVAILABLE",
        "METHOD_NOT_ALLOWED",
        "INTERNAL_ERROR",
      ].sort()
    );
  });
});
