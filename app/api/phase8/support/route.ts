import crypto from "crypto";
import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { getActiveOrganization, requireAdmin, requireOrganizationAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { sanitizeLogText } from "@/lib/guard/logSafety";

const SUPPORT_PAGE_SIZE = 25;

const createSchema = z.object({
  projectId: z.string().optional(),
  category: z.enum([
    "INTEGRATION_HELP",
    "BILLING",
    "FALSE_POSITIVE",
    "MISSED_DETECTION",
    "RAG_ISSUE",
    "WEBHOOK_ISSUE",
    "ENTERPRISE_SETUP",
    "SECURITY_CONCERN",
  ]),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  subject: z.string().trim().min(4).max(180),
  message: z.string().trim().min(10).max(5000),
  redactedContext: z.string().max(5000).optional(),
});
const updateSchema = z.object({
  ticketId: z.string(),
  status: z.enum(["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER", "RESOLVED", "CLOSED"]),
  assignedToId: z.string().nullable().optional(),
});

function parseCursorDate(value: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function GET(request: Request) {
  try {
    const active = await getActiveOrganization();
    if (!active) return jsonResponse({ tickets: [], nextCursor: null });
    const params = new URL(request.url).searchParams;
    const cursor = parseCursorDate(params.get("cursor"));
    const limit = Math.min(50, Math.max(1, Number(params.get("limit") ?? SUPPORT_PAGE_SIZE)));
    const rows = await db.supportTicket.findMany({
      where: { organizationId: active.org.id, ...(cursor ? { updatedAt: { lt: cursor } } : {}) },
      orderBy: { updatedAt: "desc" },
      take: limit + 1,
      select: {
        id: true,
        ticketNumber: true,
        category: true,
        priority: true,
        status: true,
        subject: true,
        redactedContext: true,
        createdAt: true,
        updatedAt: true,
        messages: {
          where: { internal: false },
          orderBy: { createdAt: "asc" },
          take: 25,
          select: { id: true, body: true, createdAt: true, internal: true, authorId: true },
        },
      },
    });
    const tickets = rows.slice(0, limit);
    return jsonResponse({ tickets, nextCursor: rows.length > limit ? tickets.at(-1)?.updatedAt.toISOString() ?? null : null });
  } catch (error) {
    return apiError(error, "Support tickets could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const active = await getActiveOrganization();
    if (!active) return jsonResponse({ error: true, message: "No active organization." }, { status: 404 });
    const body = createSchema.parse(await readJson(request));
    if (body.projectId) {
      const project = await db.project.findFirst({
        where: { id: body.projectId, organizationId: active.org.id },
        select: { id: true },
      });
      if (!project) return jsonResponse({ error: true, message: "Project not found." }, { status: 404 });
    }
    const ticketNumber = `CRG-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
    const ticket = await db.supportTicket.create({
      data: {
        ticketNumber,
        organizationId: active.org.id,
        projectId: body.projectId,
        createdById: active.membership.userId,
        category: body.category,
        priority: body.priority,
        subject: sanitizeLogText(body.subject),
        redactedContext: body.redactedContext ? sanitizeLogText(body.redactedContext) : null,
        messages: { create: { authorId: active.membership.userId, body: sanitizeLogText(body.message) } },
      },
      select: {
        id: true,
        ticketNumber: true,
        category: true,
        priority: true,
        status: true,
        subject: true,
        messages: { select: { id: true, body: true, createdAt: true } },
      },
    });
    await db.organizationAuditLog.create({
      data: {
        organizationId: active.org.id,
        actorUserId: active.membership.userId,
        action: "support.ticket_created",
        category: "SUPPORT",
        metadata: { ticketId: ticket.id, category: ticket.category, priority: ticket.priority },
      },
    });
    return jsonResponse(ticket, { status: 201 });
  } catch (error) {
    return apiError(error, "Support ticket could not be created.");
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = updateSchema.parse(await readJson(request));
    const ticket = await db.supportTicket.findUnique({ where: { id: body.ticketId } });
    if (!ticket) return jsonResponse({ error: true, message: "Ticket not found." }, { status: 404 });
    await requireOrganizationAccess(ticket.organizationId);
    const updated = await db.supportTicket.update({
      where: { id: ticket.id },
      data: {
        status: body.status,
        assignedToId: body.assignedToId,
        resolvedAt: body.status === "RESOLVED" || body.status === "CLOSED" ? new Date() : null,
      },
    });
    await db.adminAuditLog.create({
      data: {
        adminUserId: admin.id,
        organizationId: ticket.organizationId,
        action: "support.ticket_updated",
        targetType: "SupportTicket",
        targetId: ticket.id,
        reason: `Status changed to ${body.status}`,
        metadata: { assignedToId: body.assignedToId },
      },
    });
    return jsonResponse(updated);
  } catch (error) {
    return apiError(error, "Support ticket could not be updated.");
  }
}
