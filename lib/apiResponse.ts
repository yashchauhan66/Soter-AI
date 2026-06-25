import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "./auth/guards";
import { isDatabaseUnavailableError } from "./databaseErrors";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

// SECURITY: Maximum body size enforced on the actual received bytes,
// not on the client-supplied content-length header (which is forgeable).
const MAX_BODY_BYTES = 32_000;

export function jsonResponse(data: unknown, init: ResponseInit = {}) {
  return NextResponse.json(data, {
    ...init,
    headers: { ...NO_STORE_HEADERS, ...init.headers },
  });
}

export function apiError(error: unknown, fallback = "Unexpected server error.") {
  if (error instanceof ZodError) {
    return jsonResponse({ error: true, message: error.issues[0]?.message ?? "Invalid request body." }, { status: 400 });
  }
  if (error instanceof AuthError) {
    return jsonResponse({ error: true, message: error.message }, { status: error.status });
  }
  if (isDatabaseUnavailableError(error)) {
    console.error("database.unavailable", {
      name: error instanceof Error ? error.name : "unknown",
      code: error && typeof error === "object" && "code" in error ? error.code : undefined,
    });
    return jsonResponse(
      { error: true, message: "Service temporarily unavailable. Please try again shortly." },
      { status: 503, headers: { "Retry-After": "30" } },
    );
  }
  console.error(error);
  return jsonResponse({ error: true, message: fallback }, { status: 500 });
}

/**
 * CSRF mitigation layer: browsers cannot set Content-Type: application/json
 * in a cross-site HTML form POST. Returning a response here short-circuits
 * the handler before any body is read.
 */
export function requireJsonContentType(request: Request): Response | null {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") return null;
  const ct = request.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    return jsonResponse(
      { error: true, message: "Content-Type must be application/json." },
      { status: 415 },
    );
  }
  return null;
}

/**
 * Reads the request body as JSON with a hard byte limit enforced on the
 * actual streamed bytes — not on the client-supplied content-length header.
 */
export async function readJson(request: Request) {
  const body = request.body;
  if (!body) {
    throw new ZodError([{ code: "custom", path: [], message: "Request body must be valid JSON." }]);
  }
  const reader = body.getReader();
  let bytesRead = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > MAX_BODY_BYTES) {
        throw new ZodError([{ code: "custom", path: [], message: "Request body is too large." }]);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const raw = Buffer.concat(chunks).toString("utf-8");
  try {
    return JSON.parse(raw);
  } catch {
    throw new ZodError([{ code: "custom", path: [], message: "Request body must be valid JSON." }]);
  }
}

