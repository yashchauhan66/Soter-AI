import { jsonResponse } from "@/lib/apiResponse";
import { loadBadgeStatus } from "@/lib/badge";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const status = await loadBadgeStatus(slug);
  if (!status) return jsonResponse({ error: true, message: "Badge not found." }, { status: 404 });
  return jsonResponse(status, {
    headers: {
      "Cache-Control": "public, max-age=60, s-maxage=60",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
