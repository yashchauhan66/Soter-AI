import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "./auth/guards";
import { isDatabaseUnavailableError } from "./databaseErrors";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

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

export async function readJson(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 32_000) {
    throw new ZodError([{ code: "custom", path: [], message: "Request body is too large." }]);
  }
  try {
    return await request.json();
  } catch {
    throw new ZodError([{ code: "custom", path: [], message: "Request body must be valid JSON." }]);
  }
}
