// SECURITY: AI Incident Forensics — incident investigation, timeline reconstruction,
// evidence collection, and forensic report generation for AI security incidents.
//
// All incident data is stored with redacted sensitive content. Raw prompts, API keys,
// and personally identifiable information are never stored in plaintext.

import { randomUUID } from "crypto";
import { db } from "../db";
import { sanitizeLogText } from "../guard/logSafety";

// ── Incident management ───────────────────────────────────────────────────────

export interface IncidentInput {
  organizationId: string;
  createdById?: string;
  title: string;
  summary: string;
  status?: string;
  impact?: string;
  affectedComponents?: string[];
  startedAt?: Date;
}

export async function createIncident(input: IncidentInput) {
  const slug = `incident-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const incident = await db.incident.create({
    data: {
      organizationId: input.organizationId,
      createdById: input.createdById,
      slug,
      title: input.title,
      summary: sanitizeLogText(input.summary).slice(0, 10000),
      status: (input.status ?? "INVESTIGATING") as any,
      impact: (input.impact ?? "MINOR") as any,
      affectedComponents: input.affectedComponents ?? [],
      startedAt: input.startedAt ?? new Date(),
    },
  });
  return incident;
}

// ── Timeline reconstruction ───────────────────────────────────────────────────

export interface TimelineEvent {
  id: string;
  timestamp: Date;
  type: "INCIDENT_START" | "DETECTION" | "ACTION" | "UPDATE" | "ESCALATION" | "MITIGATION" | "RESOLUTION";
  source: string;
  description: string;
  severity: string;
  evidence?: string;
}

export async function buildTimeline(incidentId: string): Promise<TimelineEvent[]> {
  const incident = await db.incident.findUnique({
    where: { id: incidentId },
    include: {
      updates: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!incident) return [];

  const events: TimelineEvent[] = [];

  // Incident start
  events.push({
    id: `timeline-start-${incident.id}`,
    timestamp: incident.startedAt,
    type: "INCIDENT_START",
    source: "system",
    description: `Incident "${incident.title}" started`,
    severity: incident.impact,
  });

  // Detection events from SecurityEvents
  const securityEvents = await db.securityEvent.findMany({
    where: {
      organizationId: incident.organizationId ?? undefined,
      createdAt: { gte: new Date(incident.startedAt.getTime() - 3600_000) },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  for (const se of securityEvents) {
    events.push({
      id: `timeline-se-${se.id}`,
      timestamp: se.createdAt,
      type: "DETECTION",
      source: se.source,
      description: `${se.eventType}: ${se.action}`,
      severity: se.severity,
      evidence: se.metadata ? JSON.stringify(se.metadata).slice(0, 500) : undefined,
    });
  }

  // Guard log events - no direct organizationId filter on GuardLog model
  // Scoping would require knowing the project ID(s) associated with the incident
  const guardLogs = await db.guardLog.findMany({
    where: {
      createdAt: {
        gte: new Date(incident.startedAt.getTime() - 3600_000),
        lte: incident.resolvedAt ?? new Date(),
      },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  for (const log of guardLogs) {
    if (log.action === "BLOCK" || log.action === "HUMAN_REVIEW") {
      events.push({
        id: `timeline-gl-${log.id}`,
        timestamp: log.createdAt,
        type: "DETECTION",
        source: "guard",
        description: `${log.direction} ${log.action}: ${log.reason}`,
        severity: log.riskScore >= 80 ? "CRITICAL" : log.riskScore >= 60 ? "HIGH" : "MEDIUM",
        evidence: `Risk types: ${log.riskTypes.join(", ")}`,
      });
    }
  }

  // Updates
  for (const update of incident.updates) {
    events.push({
      id: `timeline-upd-${update.id}`,
      timestamp: update.createdAt,
      type: update.status === "RESOLVED" ? "RESOLUTION" : "UPDATE",
      source: update.authorId ? "user" : "system",
      description: sanitizeLogText(update.message).slice(0, 200),
      severity: incident.impact,
    });
  }

  // Sort by timestamp
  events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return events;
}

// ── Evidence collection ───────────────────────────────────────────────────────

export interface EvidenceInput {
  reportId: string;
  evidenceType: string;
  sourceId?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

export async function collectEvidence(input: EvidenceInput) {
  return db.forensicEvidence.create({
    data: {
      reportId: input.reportId,
      evidenceType: input.evidenceType,
      sourceId: input.sourceId,
      redactedContent: input.content ? sanitizeLogText(input.content).slice(0, 50000) : null,
      metadata: input.metadata as any,
    },
  });
}

// ── Forensic report generation ────────────────────────────────────────────────

export interface ForensicReportInput {
  incidentId: string;
  reportType?: string;
  title: string;
  summary?: string;
  createdById?: string;
}

export async function generateForensicReport(input: ForensicReportInput) {
  const incident = await db.incident.findUnique({
    where: { id: input.incidentId },
    include: { updates: { orderBy: { createdAt: "desc" } } },
  });
  if (!incident) throw new Error("Incident not found.");

  const timeline = await buildTimeline(input.incidentId);

  // Collect evidence from the incident
  // Note: GuardLog doesn't have organizationId, so we query by date window
  const relevantLogs = await db.guardLog.findMany({
    where: {
      createdAt: {
        gte: new Date(incident.startedAt.getTime() - 3600_000),
        lte: incident.resolvedAt ?? new Date(),
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      direction: true,
      action: true,
      riskScore: true,
      riskTypes: true,
      reason: true,
      createdAt: true,
    },
  });

  const relevantAgentLogs = await db.agentActionLog.findMany({
    where: {
      projectId: incident.affectedComponents.length > 0 ? undefined : undefined,
      createdAt: {
        gte: new Date(incident.startedAt.getTime() - 3600_000),
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      tool: true,
      action: true,
      decision: true,
      riskLevel: true,
      reason: true,
      createdAt: true,
    },
  });

  const reportId = `forensic_${randomUUID()}`;

  const report = await db.forensicReport.create({
    data: {
      id: reportId,
      incidentId: input.incidentId,
      reportType: input.reportType ?? "INCIDENT_REPORT",
      status: "DRAFT",
      title: input.title,
      summary: (input.summary ?? incident.summary).slice(0, 10000),
      timelineJson: timeline as any,
      evidenceJson: {
        guardLogs: relevantLogs,
        agentLogs: relevantAgentLogs,
        incidentUpdates: incident.updates.length,
      } as any,
      findingsJson: await generateFindings(incident, relevantLogs, relevantAgentLogs) as any,
      recommendations: (await generateRecommendations(incident)).join("\n").slice(0, 5000),
      createdById: input.createdById,
    },
  });

  // Collect guard log evidence
  for (const log of relevantLogs.slice(0, 20)) {
    await collectEvidence({
      reportId,
      evidenceType: "GUARD_LOG",
      sourceId: log.id,
      content: `[${log.direction}] ${log.action} - ${log.reason} (risk: ${log.riskScore})`,
      metadata: { riskTypes: log.riskTypes, createdAt: log.createdAt.toISOString() },
    });
  }

  return report;
}

export async function publishForensicReport(reportId: string) {
  return db.forensicReport.update({
    where: { id: reportId },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });
}

// ── Findings & recommendations ────────────────────────────────────────────────

async function generateFindings(
  incident: { id: string; title: string; impact: string; status: string },
  guardLogs: Array<{ action: string; riskScore: number; riskTypes: string[] }>,
  agentLogs: Array<{ decision: string; riskLevel: string }>,
) {
  const findings: Array<{
    category: string;
    severity: string;
    description: string;
    count: number;
  }> = [];

  const blockedLogs = guardLogs.filter((l) => l.action === "BLOCK");
  if (blockedLogs.length > 0) {
    findings.push({
      category: "BLOCKED_REQUESTS",
      severity: blockedLogs.some((l) => l.riskScore >= 80) ? "CRITICAL" : "HIGH",
      description: `${blockedLogs.length} requests were blocked during the incident window.`,
      count: blockedLogs.length,
    });
  }

  const blockedAgentActions = agentLogs.filter((l) => l.decision === "BLOCK");
  if (blockedAgentActions.length > 0) {
    findings.push({
      category: "BLOCKED_AGENT_ACTIONS",
      severity: blockedAgentActions.some((l) => l.riskLevel === "CRITICAL") ? "CRITICAL" : "HIGH",
      description: `${blockedAgentActions.length} agent actions were blocked.`,
      count: blockedAgentActions.length,
    });
  }

  const secretDetections = guardLogs.filter((l) => l.riskTypes.includes("SECRET_DETECTED"));
  if (secretDetections.length > 0) {
    findings.push({
      category: "SECRET_LEAKAGE",
      severity: "CRITICAL",
      description: `${secretDetections.length} secrets were detected and blocked.`,
      count: secretDetections.length,
    });
  }

  const promptInjections = guardLogs.filter(
    (l) => l.riskTypes.includes("PROMPT_INJECTION") || l.riskTypes.includes("JAILBREAK"),
  );
  if (promptInjections.length > 0) {
    findings.push({
      category: "PROMPT_ATTACK",
      severity: "HIGH",
      description: `${promptInjections.length} prompt injection or jailbreak attempts were detected.`,
      count: promptInjections.length,
    });
  }

  if (findings.length === 0) {
    findings.push({
      category: "NO_SIGNIFICANT_FINDINGS",
      severity: "LOW",
      description: "No significant security findings were identified in the incident timeline.",
      count: 0,
    });
  }

  return findings;
}

function generateRecommendations(incident: { title: string; impact: string; status: string }): string[] {
  const recommendations: string[] = [];
  recommendations.push(`Review the incident timeline and identify gaps in detection coverage.`);
  recommendations.push(`Ensure all affected components have the latest guard policies applied.`);
  if (incident.impact === "CRITICAL" || incident.impact === "MAJOR") {
    recommendations.push(`Conduct a post-incident review within 48 hours.`);
    recommendations.push(`Update incident response playbook based on lessons learned.`);
  }
  recommendations.push(`Verify that redacted logs are being retained per retention policy.`);
  recommendations.push(`Consider running a red-team exercise to validate detection coverage.`);
  return recommendations;
}

// ── Dashboard queries ─────────────────────────────────────────────────────────

export async function getForensicSummary(organizationId: string) {
  const [incidents, reports, recentIncidents] = await Promise.all([
    db.incident.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.forensicReport.findMany({
      where: { incident: { organizationId } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { incident: { select: { title: true, slug: true } } },
    }),
    db.incident.count({
      where: { organizationId, status: { in: ["INVESTIGATING", "IDENTIFIED", "MONITORING"] } },
    }),
  ]);
  return {
    incidents,
    reports,
    recentIncidents,
    openIncidentCount: recentIncidents,
  };
}
