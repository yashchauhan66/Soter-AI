import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireProjectPermission } from "@/lib/auth/guards";
import { createIncident, generateForensicReport, publishForensicReport, buildTimeline, getForensicSummary } from "@/lib/forensics";

const createIncidentSchema = z.object({
  projectId: z.string().optional(),
  title: z.string().trim().min(2).max(200),
  summary: z.string().min(1).max(5000),
  status: z.enum(["INVESTIGATING", "IDENTIFIED", "MONITORING", "RESOLVED"]).default("INVESTIGATING"),
  impact: z.enum(["NONE", "MINOR", "MAJOR", "CRITICAL"]).default("MINOR"),
  affectedComponents: z.array(z.string()).default([]),
});

const reportSchema = z.object({
  projectId: z.string().optional(),
  incidentId: z.string().min(1),
  title: z.string().trim().min(2).max(200),
  reportType: z.string().default("INCIDENT_REPORT"),
});

export async function POST(request: Request) {
  try {
    const body = createIncidentSchema.parse(await readJson(request));
    const access = await requireProjectPermission(body.projectId ?? "", "forensics:manage");
    const incident = await createIncident({
      organizationId: access.org.id,
      createdById: access.user.id,
      title: body.title,
      summary: body.summary,
      status: body.status,
      impact: body.impact,
      affectedComponents: body.affectedComponents,
    });
    return jsonResponse(incident, { status: 201 });
  } catch (error) {
    return apiError(error, "Incident could not be created.");
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const incidentId = searchParams.get("incidentId");
    const timeline = searchParams.get("timeline") === "true";

    const access = await requireProjectPermission(projectId ?? "", "forensics:read");

    if (incidentId && timeline) {
      const events = await buildTimeline(incidentId);
      return jsonResponse({ events });
    }

    if (incidentId) {
      const report = await generateForensicReport({
        incidentId,
        title: `Forensic Report - ${incidentId}`,
        reportType: "INCIDENT_REPORT",
      });
      return jsonResponse(report);
    }

    const summary = await getForensicSummary(access.org.id);
    return jsonResponse(summary);
  } catch (error) {
    return apiError(error, "Could not fetch forensic data.");
  }
}

export async function PUT(request: Request) {
  try {
    const body = reportSchema.parse(await readJson(request));
    const access = await requireProjectPermission(body.projectId ?? "", "forensics:manage");
    const report = await generateForensicReport({
      incidentId: body.incidentId,
      title: body.title,
      reportType: body.reportType,
      createdById: access.user.id,
    });
    return jsonResponse(report, { status: 201 });
  } catch (error) {
    return apiError(error, "Forensic report could not be generated.");
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await readJson(request) as { reportId: string; projectId: string };
    if (!body.reportId) return jsonResponse({ error: true, message: "reportId is required." }, { status: 400 });
    if (!body.projectId) return jsonResponse({ error: true, message: "projectId is required." }, { status: 400 });
    await requireProjectPermission(body.projectId, "forensics:manage");
    const report = await publishForensicReport(body.reportId);
    return jsonResponse(report);
  } catch (error) {
    return apiError(error, "Report could not be published.");
  }
}
