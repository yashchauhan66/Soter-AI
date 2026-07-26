import openApiSpec from "@/docs/api/openapi.v1.json";
import { jsonResponse } from "@/lib/apiResponse";

export const runtime = "nodejs";

export async function GET() {
  return jsonResponse(openApiSpec, {
    headers: {
      "Content-Type": "application/vnd.oai.openapi+json; charset=utf-8",
    },
  });
}
