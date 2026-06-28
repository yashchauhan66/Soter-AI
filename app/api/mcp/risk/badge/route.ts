import { mcpRiskBadgeSvg } from "@/lib/mcp-risk-scanner";
import type { DriftRiskLevel } from "@/lib/advanced-security/mcpDrift";

const LEVELS = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawLevel = (url.searchParams.get("riskLevel") ?? "LOW").toUpperCase();
  const riskLevel = (LEVELS.has(rawLevel) ? rawLevel : "LOW") as DriftRiskLevel;
  const serverName = (url.searchParams.get("serverName") ?? "").slice(0, 48);
  return new Response(mcpRiskBadgeSvg({ riskLevel, serverName }), {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
