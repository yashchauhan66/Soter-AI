import { randomUUID } from "crypto";
import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const schema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(1).max(120),
  domains: z.array(z.string().min(1).max(255)).min(1).max(50),
  category: z.enum(["email", "document", "spreadsheet", "source_code", "ticketing", "crm", "chat", "knowledge_base", "internal_app", "unknown"]),
  enabled: z.boolean().default(true),
  sensitivity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
});

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!organizationId) return jsonResponse({ error: true, message: "organizationId required." }, { status: 400 });
    const sourceApps = await db.$queryRaw<Array<Record<string, unknown>>>`
      SELECT "id", "name", "domains", "category", "enabled", "sensitivity", "createdAt", "updatedAt"
      FROM "SourceAppConfig"
      WHERE "organizationId" = ${organizationId}
      ORDER BY "name" ASC
    `;
    return jsonResponse({ sourceApps });
  } catch (error) {
    return apiError(error, "Source apps could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = schema.parse(await readJson(request));
    const id = randomUUID();
    await db.$executeRaw`
      INSERT INTO "SourceAppConfig" ("id", "organizationId", "name", "domains", "category", "enabled", "sensitivity", "createdAt", "updatedAt")
      VALUES (${id}, ${body.organizationId}, ${body.name}, ${body.domains}, ${body.category}, ${body.enabled}, ${body.sensitivity}, NOW(), NOW())
    `;
    return jsonResponse({ sourceApp: { id, ...body } }, { status: 201 });
  } catch (error) {
    return apiError(error, "Source app could not be created.");
  }
}
