// SECURITY: Server-side agent-incident PDF generation.
// - Runs in Node runtime (pdfkit needs Buffer).
// - The PDF contains only already-redacted replay fields: decision, risk level,
//   tool/action names, and reasons. Raw secrets and raw content are never
//   included.
// - Each export is HMAC-signed so downstream verifiers can confirm provenance.

import PDFDocument from "pdfkit";
import { createHmac } from "crypto";

export interface ReplayTimelineEvent {
  type?: string;
  id?: string;
  tool?: string;
  action?: string;
  decision?: string;
  riskLevel?: string;
  reason?: string;
  createdAt?: Date | string;
}

export interface IncidentPdfInput {
  sessionId: string;
  projectId: string;
  summary: string;
  riskLevel: string;
  timeline: ReplayTimelineEvent[];
}

function incidentSigningSecret() {
  const secret =
    process.env.REPORT_SIGNING_SECRET ?? process.env.AUDIT_EXPORT_SECRET ?? process.env.API_KEY_PEPPER;
  if (!secret || secret.length < 24 || (process.env.NODE_ENV === "production" && secret === "development-only")) {
    throw new Error("REPORT_SIGNING_SECRET, AUDIT_EXPORT_SECRET, or API_KEY_PEPPER must be configured before signing incident reports.");
  }
  return secret;
}

const RISK_COLOR: Record<string, string> = {
  LOW: "#16a34a",
  MEDIUM: "#d97706",
  HIGH: "#ea580c",
  CRITICAL: "#dc2626",
};

const DECISION_COLOR: Record<string, string> = {
  ALLOW: "#16a34a",
  READ_ONLY: "#64748b",
  SANDBOX_ONLY: "#64748b",
  REDACT: "#2563eb",
  ASK_APPROVAL: "#d97706",
  APPROVED: "#16a34a",
  DENIED: "#dc2626",
  BLOCK: "#dc2626",
};

export function buildAgentIncidentPdf(input: IncidentPdfInput): Promise<Buffer> {
  const signature = createHmac("sha256", incidentSigningSecret())
    .update(`${input.sessionId}:${input.projectId}:${input.timeline.length}`)
    .digest("hex");
  const blocked = input.timeline.filter((event) => event.decision === "BLOCK").length;
  const approvals = input.timeline.filter((event) =>
    event.decision === "ASK_APPROVAL" || event.decision === "APPROVED" || event.decision === "DENIED").length;

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    const accent = "#31d7c8";
    doc.fillColor(accent).rect(48, 48, 499, 4).fill();
    doc.fontSize(11).fillColor("#475569").text("Agent firewall incident", 48, 64);
    doc.fontSize(24).fillColor("#0f172a").text("Replay & forensics report");
    doc.fontSize(9).fillColor("#64748b").text(`Session: ${input.sessionId}`);
    doc.fontSize(8).fillColor("#94a3b8").text(`Project: ${input.projectId}`);
    doc.moveTo(48, doc.y + 6).lineTo(547, doc.y + 6).strokeColor("#cbd5e1").lineWidth(0.5).stroke();

    doc.moveDown(1.2);
    doc.fontSize(11).fillColor("#475569").text("Overall risk");
    doc.fontSize(22).fillColor(RISK_COLOR[input.riskLevel] ?? "#0f172a").text(input.riskLevel || "UNKNOWN");
    doc.moveDown(0.4);
    doc.fontSize(11).fillColor("#1f2937").text(input.summary || "No summary available.", { width: 499 });

    doc.moveDown(0.8);
    doc.fontSize(10).fillColor("#475569")
      .text(`Timeline events: ${input.timeline.length}    Blocked: ${blocked}    Approval-related: ${approvals}`);

    doc.moveDown(1);
    doc.fontSize(13).fillColor("#0f172a").text("Timeline");
    doc.moveDown(0.4);

    if (input.timeline.length === 0) {
      doc.fontSize(10).fillColor("#64748b").text("No timeline events recorded for this session.");
    }
    input.timeline.forEach((event, index) => {
      if (doc.y > 760) doc.addPage();
      const when = event.createdAt ? new Date(event.createdAt).toUTCString() : "-";
      const label = `${event.type ?? "event"} | ${event.tool ?? "-"} ${event.action ?? ""}`.trim();
      doc.fontSize(10).fillColor("#0f172a").text(`${index + 1}. ${label}`, { continued: true });
      doc.fillColor(DECISION_COLOR[event.decision ?? ""] ?? "#475569")
        .text(`   ${event.decision ?? "-"}`, { align: "right" });
      doc.fontSize(8).fillColor("#94a3b8").text(`${when}  -  risk ${event.riskLevel ?? "-"}`);
      if (event.reason) doc.fontSize(9).fillColor("#475569").text(event.reason, { width: 499 });
      doc.moveDown(0.4);
    });

    doc.moveDown(1);
    doc.fontSize(9).fillColor("#64748b").text(
      "This report contains redacted aggregate forensic data only. Raw secrets, credentials, and raw content are never included. Pattern detection produces false positives and negatives; use alongside secure development practices.",
      { width: 499 },
    );
    doc.moveDown(0.4);
    doc.fontSize(8).fillColor("#94a3b8").text(`Generated ${new Date().toUTCString()} | Powered by cybersecurityguard`);
    doc.fontSize(7).fillColor("#94a3b8").text(`Signature: ${signature}`);

    doc.end();
  });
}
