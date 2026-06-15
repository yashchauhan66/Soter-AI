import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireOrganizationAccess, requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { sanitizeLogText } from "@/lib/guard/logSafety";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = z.object({ ticketId: z.string(), message: z.string().trim().min(1).max(5000), internal: z.boolean().default(false) }).parse(await readJson(request));
    const ticket = await db.supportTicket.findUnique({ where: { id: body.ticketId } });
    if (!ticket) return jsonResponse({ error: true, message: "Ticket not found." }, { status: 404 });
    const access = await requireOrganizationAccess(ticket.organizationId);
    const internal = body.internal && user.isAdmin;
    const message = await db.supportMessage.create({ data: { ticketId: ticket.id, authorId: user.id, body: sanitizeLogText(body.message), internal } });
    await db.supportTicket.update({ where: { id: ticket.id }, data: { status: user.isAdmin ? "WAITING_ON_CUSTOMER" : "OPEN" } });
    await db.organizationAuditLog.create({ data: { organizationId: ticket.organizationId, actorUserId: access.user.id, action: "support.message_created", category: "SUPPORT", metadata: { ticketId: ticket.id, internal } } });
    return jsonResponse(message, { status: 201 });
  } catch (error) { return apiError(error, "Support message could not be added."); }
}
