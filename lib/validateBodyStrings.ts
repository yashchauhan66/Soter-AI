import { ZodError } from "zod";

/**
 * Default maximum string length for any string value in a request body.
 * This is a defense-in-depth layer: individual Zod schemas may be more
 * restrictive, but this catch-all prevents excessively long strings from
 * reaching downstream parsers, DB queries, or log sinks.
 */
export const DEFAULT_MAX_STRING_LENGTH = 10_000;

/**
 * Recursively walks a parsed JSON body and validates that every string value
 * does not exceed `maxLength`. Throws a ZodError on the first violation.
 *
 * This is a defense-in-depth layer. Individual route schemas with Zod .max()
 * constraints remain the primary validation; this ensures no string can
 * bypass those checks via schema gaps or misspelled field names.
 *
 * Pure function — no Next.js or runtime dependencies.
 */
export function validateBodyStrings(body: unknown, maxLength = DEFAULT_MAX_STRING_LENGTH): void {
  if (typeof body === "string") {
    if (body.length > maxLength) {
      throw new ZodError([{
        code: "too_big",
        path: [],
        message: `String value exceeds maximum length of ${maxLength} characters.`,
        maximum: maxLength,
        type: "string",
        inclusive: true,
        exact: false,
      }]);
    }
    return;
  }

  if (Array.isArray(body)) {
    for (let i = 0; i < body.length; i++) {
      try {
        validateBodyStrings(body[i], maxLength);
      } catch (error) {
        if (error instanceof ZodError) {
          throw new ZodError(error.issues.map((issue) => ({
            ...issue,
            path: [String(i), ...issue.path],
          })));
        }
        throw error;
      }
    }
    return;
  }

  if (body !== null && typeof body === "object") {
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      try {
        validateBodyStrings(value, maxLength);
      } catch (error) {
        if (error instanceof ZodError) {
          throw new ZodError(error.issues.map((issue) => ({
            ...issue,
            path: [key, ...issue.path],
          })));
        }
        throw error;
      }
    }
    return;
  }

  // Primitives (number, boolean, null) — no validation needed.
}
