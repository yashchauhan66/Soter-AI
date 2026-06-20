const TEMPORARY_DATABASE_ERROR_CODES = new Set([
  "P1001", // Cannot reach the database server.
  "P1002", // Database server connection timed out.
  "P1008", // Database operation timed out.
  "P1017", // Database server closed the connection.
  "P2024", // Connection pool timeout.
]);

export function isDatabaseUnavailableError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const candidate = error as { name?: unknown; code?: unknown };
  if (candidate.name === "PrismaClientInitializationError") return true;

  return typeof candidate.code === "string" && TEMPORARY_DATABASE_ERROR_CODES.has(candidate.code);
}
