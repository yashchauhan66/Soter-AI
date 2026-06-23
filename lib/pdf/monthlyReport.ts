// SECURITY: Server-side PDF generation.
// - Runs in Node runtime (pdfkit is pure JS but needs Buffer).
// - The PDF mirrors the white-label web report; raw user text is never
//   included, only aggregate counts and risk-type names.

import PDFDocument from "pdfkit";
import { createHmac } from "crypto";
import { db } from "../db";
import { generateAndStoreMonthlyReport } from "../reports";

export interface PdfReportInput {
  projectId: string;
  month: number;
  year: number;
}

function reportSigningSecret() {
  const secret = process.env.REPORT_SIGNING_SECRET ?? process.env.AUDIT_EXPORT_SECRET ?? process.env.API_KEY_PEPPER;
  if (!secret || secret.length < 24 || (process.env.NODE_ENV === "production" && secret === "development-only")) {
    throw new Error("REPORT_SIGNING_SECRET, AUDIT_EXPORT_SECRET, or API_KEY_PEPPER must be configured before signing PDF reports.");
  }
  return secret;
}

export async function buildMonthlyReportPdf(input: PdfReportInput): Promise<Buffer> {
  const { projectId, month, year } = input;
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { client: { include: { agency: { include: { branding: true } } } } },
  });
  if (!project) throw new Error("Project not found.");
  const branding = project.client?.agency?.branding ?? null;
  const summary = await generateAndStoreMonthlyReport(projectId, new Date(Date.UTC(year, month - 1, 1)));
  const monthLabel = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" })
    .format(new Date(Date.UTC(year, month - 1, 1)));

  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 1));

  const [piiRedactions, secretsBlocked, unsafeBlocked, trendLogs, reportRecord] = await Promise.all([
    db.guardLog.count({
      where: {
        projectId,
        action: "ALLOW_WITH_REDACTION",
        OR: [{ riskTypes: { has: "PII_DETECTED" } }, { riskTypes: { has: "INDIA_PII_DETECTED" } }],
        createdAt: { gte: periodStart, lt: periodEnd },
      },
    }),
    db.guardLog.count({
      where: { projectId, riskTypes: { has: "SECRET_DETECTED" }, createdAt: { gte: periodStart, lt: periodEnd } },
    }),
    db.guardLog.count({
      where: { projectId, action: "BLOCK", riskTypes: { has: "UNSAFE_OUTPUT" }, createdAt: { gte: periodStart, lt: periodEnd } },
    }),
    db.guardLog.findMany({ where: { projectId, createdAt: { gte: periodStart, lt: periodEnd } }, select: { createdAt: true, action: true } }),
    db.report.findUnique({ where: { projectId_month_year: { projectId, month, year } } }),
  ]);
  if (!reportRecord) throw new Error("Report record was not created.");
  const reportSignature = createHmac("sha256", reportSigningSecret())
    .update(`${reportRecord.id}:${projectId}:${year}-${month}`).digest("hex");
  const weeklyTrend = Array.from({ length: 5 }, (_, week) => ({ week: week + 1, total: 0, blocked: 0 }));
  for (const log of trendLogs) {
    const week = Math.min(4, Math.floor((log.createdAt.getUTCDate() - 1) / 7));
    weeklyTrend[week].total += 1;
    if (log.action === "BLOCK") weeklyTrend[week].blocked += 1;
  }

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    const accent = parseColor(branding?.brandColor ?? "#31d7c8");
    const agencyName = branding?.agencyName ?? project.client?.agency?.name ?? "SoterAI";
    const projectName = project.publicName ?? project.name;
    const clientName = project.client?.name ?? null;

    // Header
    doc.fillColor(accent).rect(48, 48, 499, 4).fill();
    doc.moveDown();
    doc.fontSize(11).fillColor("#475569").text("Prepared by", 48, 60);
    doc.fontSize(20).fillColor("#0f172a").text(agencyName, { continued: false });
    if (branding?.contactEmail) {
      doc.fontSize(10).fillColor("#64748b").text(branding.contactEmail);
    }
    doc.moveTo(48, 110).lineTo(547, 110).strokeColor("#cbd5e1").lineWidth(0.5).stroke();

    // Title block
    doc.moveDown(1);
    doc.fontSize(11).fillColor("#475569").text("Monthly security report");
    doc.fontSize(28).fillColor("#0f172a").text(monthLabel);
    doc.fontSize(11).fillColor(accent).text("OWASP LLM Top 10 aligned");
    doc.fontSize(8).fillColor("#64748b").text(`Report ID: ${reportRecord.id}`);

    doc.moveDown(1);
    doc.fontSize(11).fillColor("#475569").text("Project");
    doc.fontSize(18).fillColor("#0f172a").text(projectName);
    if (clientName) {
      doc.fontSize(10).fillColor("#64748b").text(`Client: ${clientName}`);
    }

    // Metric grid
    const metrics: [string, string | number][] = [
      ["Total requests", summary.totalRequests],
      ["Blocked requests", summary.blockedRequests],
      ["PII redactions", piiRedactions],
      ["Secrets prevented", secretsBlocked],
      ["Unsafe outputs blocked", unsafeBlocked],
      ["Average risk score", summary.avgRiskScore],
    ];

    doc.moveDown(1.2);
    const cellY = doc.y;
    const cellWidth = 162;
    const cellHeight = 70;
    const cellGap = 6;
    metrics.forEach((metric, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = 48 + col * (cellWidth + cellGap);
      const y = cellY + row * (cellHeight + cellGap);
      doc.roundedRect(x, y, cellWidth, cellHeight, 8).strokeColor("#cbd5e1").lineWidth(0.7).stroke();
      doc.fontSize(9).fillColor("#475569").text(String(metric[0]).toUpperCase(), x + 12, y + 12);
      doc.fontSize(22).fillColor(accent).text(String(metric[1]), x + 12, y + 28);
    });
    doc.y = cellY + 2 * (cellHeight + cellGap);

    // Top risk types
    doc.moveDown(1);
    doc.fontSize(13).fillColor("#0f172a").text("Top risk types");
    doc.moveDown(0.4);
    if (summary.topRiskTypes.length) {
      summary.topRiskTypes.forEach((item) => {
        doc.fontSize(11).fillColor("#0f172a")
          .text(`${item.type.replaceAll("_", " ")}`, { continued: true })
          .fillColor(accent).text(`   ${item.count}`, { align: "right" });
      });
    } else {
      doc.fontSize(10).fillColor("#64748b").text("No material risks recorded this month.");
    }

    // Recommendations
    doc.moveDown(1);
    doc.fontSize(13).fillColor("#0f172a").text("Recommendations");
    doc.moveDown(0.4);
    summary.recommendations.forEach((recommendation) => {
      doc.fontSize(10).fillColor("#1f2937").text(`- ${recommendation}`);
    });

    if (doc.y > 650) doc.addPage();
    doc.moveDown(1);
    doc.fontSize(13).fillColor("#0f172a").text("Risk trend by week");
    doc.moveDown(0.4);
    weeklyTrend.forEach((item) => doc.fontSize(10).fillColor("#334155").text(`Week ${item.week}: ${item.total} requests, ${item.blocked} blocked`));

    // OWASP block
    doc.moveDown(1);
    doc.fontSize(13).fillColor("#0f172a").text("OWASP LLM Top 10 alignment");
    doc.fontSize(10).fillColor("#475569").text(
      "SoterAI reduces risk for prompt injection, sensitive information disclosure, improper output handling, and unbounded consumption. Alignment supports defence in depth and is not a certification or claim of complete coverage.",
      { width: 499 },
    );

    // Disclaimer
    doc.moveDown(1.2);
    doc.fontSize(9).fillColor("#64748b").text(
      branding?.reportFooter ??
        "OWASP LLM Top 10 aligned risk reduction, not complete protection. Pattern detection produces false positives and negatives. Use alongside secure development practices.",
      { width: 499 },
    );
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor("#94a3b8").text(`Generated ${new Date().toUTCString()} | Powered by SoterAI`);
    doc.fontSize(7).fillColor("#94a3b8").text(`Signature: ${reportSignature}`);

    doc.end();
  });
}

function parseColor(input: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(input)) return input;
  return "#31d7c8";
}
