export const DEFAULT_DYNAMODB_EVENTS_TABLE = "soterai_events";

export function envFlag(name: string, fallback = false): boolean {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  return value.toLowerCase() === "true" || value === "1";
}

export function envInt(name: string, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

export function dynamoEventsConfig() {
  return {
    enabled: envFlag("DYNAMODB_EVENTS_ENABLED"),
    dualWrite: envFlag("DYNAMODB_EVENTS_DUAL_WRITE"),
    readFallbackPostgres: envFlag("DYNAMODB_EVENTS_READ_FALLBACK_POSTGRES", true),
    region: process.env.AWS_REGION || "ap-south-1",
    tableName: process.env.DYNAMODB_EVENTS_TABLE || DEFAULT_DYNAMODB_EVENTS_TABLE,
    endpoint: process.env.DYNAMODB_ENDPOINT || undefined,
    maxInputPreviewChars: envInt("DYNAMODB_EVENTS_MAX_INPUT_PREVIEW_CHARS", 2000, 0, 20_000),
    maxOutputPreviewChars: envInt("DYNAMODB_EVENTS_MAX_OUTPUT_PREVIEW_CHARS", 2000, 0, 20_000),
    maxMetadataBytes: envInt("DYNAMODB_EVENTS_MAX_METADATA_BYTES", 12_000, 256, 100_000),
  };
}

