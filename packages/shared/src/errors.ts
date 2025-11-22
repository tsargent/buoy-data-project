import { z } from "zod";

export const ErrorCodeEnum = z.enum([
  "INVALID_REQUEST",
  "SERVICE_UNAVAILABLE",
  "METHOD_NOT_ALLOWED",
  "INTERNAL_ERROR",
]);

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: ErrorCodeEnum,
    message: z.string(),
  }),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

export function makeError(code: z.infer<typeof ErrorCodeEnum>, message: string): ErrorResponse {
  return { error: { code, message } };
}
