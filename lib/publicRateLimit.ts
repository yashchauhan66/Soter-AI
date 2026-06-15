import { createHash } from "crypto";
import { jsonResponse } from "./apiResponse";
import { checkRedisFixedWindowRateLimit } from "./rateLimit";

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

function safeKeyPart(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

export async function enforcePublicRateLimit(input: {
  request: Request;
  scope: string;
  limit: number;
  windowMs: number;
  subject?: string | null;
  message?: string;
}) {
  const parts = [input.scope, safeKeyPart(clientIp(input.request))];
  if (input.subject) parts.push(safeKeyPart(input.subject.toLowerCase()));
  const rateLimit = await checkRedisFixedWindowRateLimit(parts.join(":"), input.limit, input.windowMs);
  if (rateLimit.allowed) return null;
  return jsonResponse(
    { error: true, message: input.message ?? "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))),
        "X-RateLimit-Limit": String(input.limit),
        "X-RateLimit-Remaining": String(rateLimit.remaining),
      },
    },
  );
}
