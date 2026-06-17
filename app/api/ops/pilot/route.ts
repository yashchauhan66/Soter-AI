import { z } from "zod";
import { auth } from "@/auth";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { db } from "@/lib/db";
import { sanitizeLogText } from "@/lib/guard/logSafety";
import { enforcePublicRateLimit } from "@/lib/publicRateLimit";

const schema = z.object({
  companyName: z.string().trim().min(2).max(160), contactName: z.string().trim().min(2).max(120), contactEmail: z.string().email().max(254),
  useCase: z.string().trim().min(20).max(4000), chatbotType: z.string().trim().min(2).max(100), usesRag: z.boolean(),
  expectedMonthlyMessages: z.number().int().min(1).max(1_000_000_000), securityRequirements: z.string().trim().min(10).max(4000),
  needsSso: z.boolean(), needsScim: z.boolean(), deploymentPreference: z.enum(["cloud", "self-hosted", "hybrid"]), organizationId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await readJson(request));
    const limited = await enforcePublicRateLimit({
      request,
      scope: "form:enterprise-pilot",
      limit: 5,
      windowMs: 60 * 60_000,
      subject: body.contactEmail,
      message: "Too many pilot requests. Please try again later.",
    });
    if (limited) return limited;
    const session = await auth();
    const organization = body.organizationId && session?.user?.id ? await db.organizationMember.findFirst({ where: { organizationId: body.organizationId, userId: session.user.id } }) : null;
    const pilot = await db.enterprisePilot.create({ data: {
      organizationId: organization?.organizationId, requestedById: session?.user?.id, companyName: body.companyName, contactName: body.contactName,
      contactEmail: body.contactEmail.toLowerCase(), useCase: sanitizeLogText(body.useCase), chatbotType: body.chatbotType, usesRag: body.usesRag,
      expectedMonthlyMessages: body.expectedMonthlyMessages, securityRequirements: sanitizeLogText(body.securityRequirements), needsSso: body.needsSso,
      needsScim: body.needsScim, deploymentPreference: body.deploymentPreference,
      successCriteria: ["Guard integration completed", "Authorized red-team report reviewed", "Latency target agreed", "No unresolved critical findings"],
      checklist: ["Scope approved", "Data flow mapped", "Integration owner assigned", "Success review scheduled"],
      deliverables: ["Security assessment", "Guard integration", "Red-team report", "OWASP LLM Top 10 alignment report", "SIEM setup", "Final recommendation"],
    } });
    return jsonResponse({ id: pilot.id, status: pilot.status }, { status: 201 });
  } catch (error) { return apiError(error, "Pilot request could not be submitted."); }
}
