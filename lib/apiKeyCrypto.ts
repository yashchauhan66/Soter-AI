import { createHash, randomBytes } from "crypto";

function getApiKeyPepper() {
  const pepper = process.env.API_KEY_PEPPER;
  if (!pepper || pepper.length < 32 || pepper === "replace-with-a-long-random-secret") {
    throw new Error("API_KEY_PEPPER must be configured with at least 32 characters.");
  }
  return pepper;
}

export function hashApiKey(rawKey: string) {
  return createHash("sha256").update(`${getApiKeyPepper()}:${rawKey}`).digest("hex");
}

export function generateApiKey(environment: "test" | "live" = "test") {
  const rawKey = `ck_${environment}_${randomBytes(24).toString("base64url")}`;
  return { rawKey, prefix: rawKey.slice(0, 15), keyHash: hashApiKey(rawKey) };
}
