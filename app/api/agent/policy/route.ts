import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { defaultAgentFirewallPolicy } from "@/lib/agent-firewall";

export const dynamic = "force-dynamic";

const policySchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(1).max(120).default("Default Agent Firewall Policy"),
  enabled: z.boolean().default(true),
  allowedDomains: z.array(z.string().trim().min(1).max(200)).max(100).default([]),
  blockedDomains: z.array(z.string().trim().min(1).max(200)).max(100).default([]),
  allowedWorkspaceDir: z.string().trim().max(1000).optional().or(z.literal("")),
  blockedFilePatterns: z.array(z.string().trim().min(1).max(200)).max(100).default([]),
  toolsRequiringApproval: z.array(z.string().trim().min(1).max(160)).max(100).default([]),
  toolsAlwaysBlocked: z.array(z.string().trim().min(1).max(160)).max(100).default([]),
  piiMode: z.enum(["redact", "approval", "block"]).default("approval"),
  secretsMode: z.enum(["redact", "approval", "block"]).default("block"),
  failClosed: z.boolean().default(true),
  maxRiskWithoutApproval: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
});

export async function GET(request: Request) {
  try {
    const projectId = new URL(request.url).searchParams.get("projectId");
    if (!projectId) return jsonResponse({ error: true, message: "projectId required." }, { status: 400 });
    await requireProjectPermission(projectId, "policy:manage");
    const rows = await db.$queryRaw<Array<{ id: string; name: string; enabled: boolean; rulesJson: unknown }>>`
      SELECT "id", "name", "enabled", "rulesJson"
      FROM "AgentPolicy"
      WHERE "projectId" = ${projectId}
      ORDER BY "updatedAt" DESC
      LIMIT 1
    `;
    return jsonResponse(rows[0] ?? { rulesJson: defaultAgentFirewallPolicy() });
  } catch (error) {
    return apiError(error, "Agent Firewall policy could not be loaded.");
  }
}

export async function PUT(request: Request) {
  try {
    const body = policySchema.parse(await readJson(request));
    await requireProjectPermission(body.projectId, "policy:manage");
    const rulesJson = defaultAgentFirewallPolicy({
      allowedDomains: body.allowedDomains,
      blockedDomains: body.blockedDomains,
      allowedWorkspaceDir: body.allowedWorkspaceDir || undefined,
      blockedFilePatterns: body.blockedFilePatterns.length ? body.blockedFilePatterns : undefined,
      toolsRequiringApproval: body.toolsRequiringApproval.length ? body.toolsRequiringApproval : undefined,
      toolsAlwaysBlocked: body.toolsAlwaysBlocked.length ? body.toolsAlwaysBlocked : undefined,
      piiMode: body.piiMode,
      secretsMode: body.secretsMode,
      failClosed: body.failClosed,
      maxRiskWithoutApproval: body.maxRiskWithoutApproval,
    });
    const existing = await db.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "AgentPolicy"
      WHERE "projectId" = ${body.projectId} AND "name" = ${body.name}
      LIMIT 1
    `;
    if (existing[0]?.id) {
      await db.$executeRaw`
        UPDATE "AgentPolicy"
        SET "enabled" = ${body.enabled}, "rulesJson" = ${JSON.stringify(rulesJson)}::jsonb, "updatedAt" = NOW()
        WHERE "id" = ${existing[0].id}
      `;
      return jsonResponse({ id: existing[0].id, name: body.name, enabled: body.enabled, rulesJson });
    }
    const id = crypto.randomUUID();
    await db.$executeRaw`
      INSERT INTO "AgentPolicy" ("id", "projectId", "name", "enabled", "rulesJson", "createdAt", "updatedAt")
      VALUES (${id}, ${body.projectId}, ${body.name}, ${body.enabled}, ${JSON.stringify(rulesJson)}::jsonb, NOW(), NOW())
    `;
    return jsonResponse({ id, name: body.name, enabled: body.enabled, rulesJson });
  } catch (error) {
    return apiError(error, "Agent Firewall policy could not be saved.");
  }
}
