import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { sanitizeLogText } from "@/lib/guard/logSafety";

const createSchema = z.object({ title: z.string().trim().min(4).max(180), summary: z.string().trim().min(10).max(5000), impact: z.enum(["NONE", "MINOR", "MAJOR", "CRITICAL"]), affectedComponents: z.array(z.string().max(80)).max(10), public: z.boolean().default(false), organizationId: z.string().optional() });
const updateSchema = z.object({ incidentId: z.string(), status: z.enum(["INVESTIGATING", "IDENTIFIED", "MONITORING", "RESOLVED"]), message: z.string().trim().min(4).max(5000), public: z.boolean().default(false) });

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = createSchema.parse(await readJson(request));
    const slug = `${Date.now().toString(36)}-${body.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)}`;
    const incident = await db.incident.create({ data: { organizationId: body.organizationId, createdById: admin.id, slug, title: sanitizeLogText(body.title), summary: sanitizeLogText(body.summary), impact: body.impact, affectedComponents: body.affectedComponents, public: body.public } });
    await db.adminAuditLog.create({ data: { adminUserId: admin.id, organizationId: body.organizationId, action: "incident.created", targetType: "Incident", targetId: incident.id, reason: "Operational incident opened", metadata: { impact: body.impact, public: body.public } } });
    return jsonResponse(incident, { status: 201 });
  } catch (error) { return apiError(error, "Incident could not be created."); }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = updateSchema.parse(await readJson(request));
    const incident = await db.incident.findUnique({ where: { id: body.incidentId } });
    if (!incident) return jsonResponse({ error: true, message: "Incident not found." }, { status: 404 });
    const updated = await db.incident.update({ where: { id: incident.id }, data: { status: body.status, resolvedAt: body.status === "RESOLVED" ? new Date() : null, updates: { create: { authorId: admin.id, status: body.status, message: sanitizeLogText(body.message), public: body.public } } }, include: { updates: true } });
    await db.adminAuditLog.create({ data: { adminUserId: admin.id, organizationId: incident.organizationId, action: "incident.updated", targetType: "Incident", targetId: incident.id, reason: `Incident moved to ${body.status}`, metadata: { public: body.public } } });
    return jsonResponse(updated);
  } catch (error) { return apiError(error, "Incident could not be updated."); }
}
