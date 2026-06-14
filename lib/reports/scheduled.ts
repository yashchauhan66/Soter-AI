import { createHmac } from "crypto";
import { db } from "../db";
import { sendTemplateEmail } from "../email/send";
import { buildMonthlyReportPdf } from "../pdf/monthlyReport";
import { generateAndStoreMonthlyReport } from "../reports";

export function nextMonthlyRun(from = new Date()) {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1, 6, 0, 0));
}

export function signReportDelivery(input: { scheduledReportId: string; reportId: string; createdAt: Date }) {
  const secret = process.env.REPORT_SIGNING_SECRET ?? process.env.AUDIT_EXPORT_SECRET ?? process.env.API_KEY_PEPPER;
  if (!secret) throw new Error("REPORT_SIGNING_SECRET or a signing fallback must be configured.");
  return createHmac("sha256", secret).update(`${input.scheduledReportId}:${input.reportId}:${input.createdAt.toISOString()}`).digest("hex");
}

export async function deliverScheduledReport(scheduledReportId: string, now = new Date()) {
  const schedule = await db.scheduledReport.findUnique({ where: { id: scheduledReportId }, include: { project: true } });
  if (!schedule || !schedule.enabled) return { skipped: true };
  const delivery = await db.scheduledReportDelivery.create({ data: { scheduledReportId: schedule.id } });
  try {
    const reportDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const summary = await generateAndStoreMonthlyReport(schedule.projectId, reportDate);
    const report = await db.report.findUniqueOrThrow({ where: { projectId_month_year: { projectId: schedule.projectId, month: summary.month, year: summary.year } } });
    const pdf = await buildMonthlyReportPdf({ projectId: schedule.projectId, month: summary.month, year: summary.year });
    const signature = signReportDelivery({ scheduledReportId: schedule.id, reportId: report.id, createdAt: delivery.createdAt });
    const attachments = [{ filename: `cyberrakshak-${summary.year}-${String(summary.month).padStart(2, "0")}.pdf`, content: pdf, contentType: "application/pdf" }];
    if (schedule.attachAuditSummary) {
      const auditSummary = Buffer.from(JSON.stringify({ reportId: report.id, projectId: schedule.projectId, month: summary.month, year: summary.year, totalRequests: summary.totalRequests, blockedRequests: summary.blockedRequests, redactedRequests: summary.redactedRequests, signature }, null, 2));
      attachments.push({ filename: `audit-summary-${report.id}.json`, content: auditSummary, contentType: "application/json" });
    }
    await sendTemplateEmail({ to: schedule.recipients, template: "monthly-report-ready", data: { projectName: schedule.project.name }, attachments });
    await db.$transaction([
      db.scheduledReportDelivery.update({ where: { id: delivery.id }, data: { status: "SENT", sentAt: new Date(), reportId: report.id, signature } }),
      db.scheduledReport.update({ where: { id: schedule.id }, data: { lastSentAt: new Date(), nextRunAt: nextMonthlyRun(now) } }),
    ]);
    return { sent: true, deliveryId: delivery.id, reportId: report.id, signature };
  } catch (error) {
    await db.scheduledReportDelivery.update({ where: { id: delivery.id }, data: { status: "FAILED", error: error instanceof Error ? error.message.slice(0, 1000) : "Unknown delivery error" } });
    throw error;
  }
}

export async function processDueScheduledReports(limit = 25, now = new Date()) {
  const due = await db.scheduledReport.findMany({ where: { enabled: true, nextRunAt: { lte: now } }, orderBy: { nextRunAt: "asc" }, take: limit });
  const results = [];
  for (const schedule of due) {
    try { results.push(await deliverScheduledReport(schedule.id, now)); }
    catch (error) { results.push({ sent: false, scheduleId: schedule.id, error: error instanceof Error ? error.message : "Unknown error" }); }
  }
  return results;
}
