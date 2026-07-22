import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getEmailClient } from "@/lib/email/client";
import { sanitizeLogText } from "@/lib/guard/logSafety";

const schema = z.object({
  kind: z.enum(["contact", "pilot", "support"]),
  id: z.string().trim().min(5).max(200),
  subject: z.string().trim().min(3).max(160),
  body: z.string().trim().min(5).max(5000),
});

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function renderReplyEmail(input: { body: string }) {
  const safeBody = escapeHtml(input.body).replace(/\n/g, "<br>");
  return {
    text: `${input.body}\n\nSoterAI Support\nsupport@soterai.in`,
    html: `<div style="font-family:Arial,sans-serif;max-width:640px;color:#0f172a;line-height:1.6">
      <div style="background:#08111f;color:#ffffff;padding:18px 22px;border-radius:12px 12px 0 0">
        <strong>SoterAI Support</strong>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:0;padding:22px;border-radius:0 0 12px 12px">
        <p>${safeBody}</p>
        <p style="margin-top:24px;color:#64748b;font-size:13px">SoterAI Support<br>support@soterai.in</p>
      </div>
    </div>`,
  };
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = schema.parse(await readJson(request));
    const subject = sanitizeLogText(body.subject);
    const replyBody = sanitizeLogText(body.body);

    let to = "";
    let organizationId: string | null = null;
    let targetType = "";
    let afterSend: (() => Promise<void>) | null = null;

    if (body.kind === "contact") {
      const lead = await db.contactLead.findUnique({ where: { id: body.id } });
      if (!lead) return jsonResponse({ error: true, message: "Contact query not found." }, { status: 404 });
      to = lead.email;
      targetType = "ContactLead";
      afterSend = async () => {
        await db.contactLead.update({ where: { id: lead.id }, data: { status: "CONTACTED" } });
      };
    }

    if (body.kind === "pilot") {
      const pilot = await db.enterprisePilot.findUnique({ where: { id: body.id } });
      if (!pilot) return jsonResponse({ error: true, message: "Pilot query not found." }, { status: 404 });
      to = pilot.contactEmail;
      organizationId = pilot.organizationId;
      targetType = "EnterprisePilot";
      afterSend = async () => {
        await db.enterprisePilot.update({ where: { id: pilot.id }, data: { status: "QUALIFYING" } });
      };
    }

    if (body.kind === "support") {
      const ticket = await db.supportTicket.findUnique({
        where: { id: body.id },
        include: { createdBy: { select: { email: true } } },
      });
      if (!ticket) return jsonResponse({ error: true, message: "Support ticket not found." }, { status: 404 });
      to = ticket.createdBy.email;
      organizationId = ticket.organizationId;
      targetType = "SupportTicket";
      afterSend = async () => {
        await db.$transaction([
          db.supportMessage.create({ data: { ticketId: ticket.id, authorId: admin.id, body: replyBody, internal: false } }),
          db.supportTicket.update({
            where: { id: ticket.id },
            data: { status: "WAITING_ON_CUSTOMER", assignedToId: admin.id },
          }),
        ]);
      };
    }

    if (!to) return jsonResponse({ error: true, message: "Recipient email not found." }, { status: 404 });

    const rendered = renderReplyEmail({ body: replyBody });
    const result = await getEmailClient().send({ to: [to], subject, html: rendered.html, text: rendered.text });
    await afterSend?.();

    await db.adminAuditLog.create({
      data: {
        adminUserId: admin.id,
        organizationId,
        action: "query.email_sent",
        targetType,
        targetId: body.id,
        reason: `Email sent to ${to}`,
        metadata: { kind: body.kind, provider: result.provider, mocked: result.mocked, emailId: result.id },
      },
    });

    return jsonResponse({ ok: true, provider: result.provider, mocked: result.mocked, id: result.id });
  } catch (error) {
    return apiError(error, "Query reply could not be sent.");
  }
}
