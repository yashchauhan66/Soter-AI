import { createHash } from "crypto";
import { jsonResponse } from "./apiResponse";
import { checkRedisFixedWindowRateLimit } from "./rateLimit";

/**
 * SECURITY: Trusted-proxy-depth-aware client IP extraction.
 *
 * `x-forwarded-for` is a comma-separated list where each proxy appends the
 * address it received the connection from. The *rightmost* IPs are added by
 * trusted infrastructure; the *leftmost* can be forged by the client.
 *
 * TRUSTED_PROXY_DEPTH (default 1) tells us how many hops of trusted
 * infrastructure sit between the internet and this process:
 *   - 0: no proxy — ignore XFF entirely, use the direct connection (unavailable
 *        in Next.js serverless; falls back to "unknown").
 *   - 1: one reverse proxy (nginx, ALB, Cloudflare) — take the rightmost IP
 *        added by the client, i.e. XFF[-TRUSTED_PROXY_DEPTH].
 *
 * Example: XFF = "1.2.3.4, 10.0.0.1, 172.16.0.5" with TRUSTED_PROXY_DEPTH=1
 *   → trusted proxy added "172.16.0.5", so the real client is "10.0.0.1"
 *   → index from right: parts[parts.length - 1 - 1] = parts[1] = "10.0.0.1"
 */
const TRUSTED_PROXY_DEPTH = Math.max(0, Number(process.env.TRUSTED_PROXY_DEPTH ?? "1"));

export function trustedClientIp(request: Request): string {
  if (TRUSTED_PROXY_DEPTH === 0) {
    // No proxy — XFF cannot be trusted; use x-real-ip set by nginx or "unknown".
    return request.headers.get("x-real-ip") ?? "unknown";
  }
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    // Take the IP that is TRUSTED_PROXY_DEPTH hops from the right.
    const idx = parts.length - TRUSTED_PROXY_DEPTH;
    if (idx >= 0 && parts[idx]) return parts[idx];
  }
  return request.headers.get("x-real-ip") ?? "unknown";
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
  const parts = [input.scope, safeKeyPart(trustedClientIp(input.request))];
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
