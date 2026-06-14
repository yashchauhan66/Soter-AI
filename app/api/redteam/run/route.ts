import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { enqueueBackgroundJob, jobAcceptedResponse } from "@/lib/backgroundJobs";
import { safeRedTeamScenarios } from "@/lib/redteam/scenarios";

const schema = z.object({ projectId: z.string().min(1), confirmed: z.literal(true) });

export async function POST(request: Request) {
  try {
    const body = schema.parse(await readJson(request));
    const access = await requireProjectPermission(body.projectId, "policy:manage");
    const suite = await db.redTeamSuite.create({
      data: {
        organizationId: access.org.id,
        projectId: access.project.id,
        name: `Defensive suite ${new Date().toISOString()}`,
        scenarios: {
          create: safeRedTeamScenarios.map((scenario) => ({
            key: scenario.key,
            category: scenario.category,
            severity: scenario.severity,
            promptTemplate: scenario.prompt,
            expectedAction: scenario.expectedActions.join("|"),
            owaspMapping: scenario.owaspMapping,
          })),
        },
      },
    });
    const run = await db.redTeamRun.create({
      data: {
        organizationId: access.org.id,
        projectId: access.project.id,
        suiteId: suite.id,
        confirmedByUserId: access.user.id,
        status: "PENDING",
      },
    });
    const job = await enqueueBackgroundJob({
      type: "REDTEAM_RUN",
      dedupeKey: `redteam-run:${run.id}`,
      payload: {
        runId: run.id,
        suiteId: suite.id,
        projectId: body.projectId,
        authorizedProjectId: access.project.id,
      },
    });
    return jsonResponse(jobAcceptedResponse(job, { runId: run.id }), { status: 202 });
  } catch (error) {
    return apiError(error, "Authorized red-team suite could not run.");
  }
}
