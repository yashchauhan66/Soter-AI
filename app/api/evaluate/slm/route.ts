import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { SlmJudge } from "@/lib/evaluation/slmJudge";
import { authenticateApiKeyRequest } from "@/lib/apiKeyMiddleware";
import { readJson } from "@/lib/apiResponse";
import {
  requireProjectPermission,
} from "@/lib/auth/guards";
import { DEFAULT_EVALUATION_CRITERIA, QUICK_EVALUATION_CRITERIA, DEEP_EVALUATION_CRITERIA } from "@/lib/evaluation/criteria";
import type { EvaluationCriterion } from "@/lib/evaluation/types";

/**
 * POST /api/evaluate/slm — Trigger an SLM evaluation
 * Requires project-level "evaluate:create" permission.
 *
 * Body:
 *   projectId: string
 *   promptText: string
 *   responseText: string
 *   contextText?: string
 *   mode?: "quick" | "standard" | "deep" (default: "standard")
 *   criteria?: EvaluationCriterion[] (overrides mode)
 */
export async function POST(request: NextRequest) {
  try {
    await authenticateApiKeyRequest(request);
    const body = await readJson(request) as {
      projectId: string;
      promptText: string;
      responseText: string;
      contextText?: string;
      mode?: "quick" | "standard" | "deep";
      criteria?: EvaluationCriterion[];
    };

    if (!body.projectId || !body.promptText || !body.responseText) {
      return Response.json(
        { error: true, message: "projectId, promptText, and responseText are required." },
        { status: 400 }
      );
    }

    await requireProjectPermission(body.projectId, "evaluate:create");

    let criteria: EvaluationCriterion[];
    if (body.criteria && body.criteria.length > 0) {
      criteria = body.criteria;
    } else if (body.mode === "quick") {
      criteria = QUICK_EVALUATION_CRITERIA;
    } else if (body.mode === "deep") {
      criteria = DEEP_EVALUATION_CRITERIA;
    } else {
      criteria = DEFAULT_EVALUATION_CRITERIA;
    }

    const judge = new SlmJudge();
    const result = await judge.evaluate({
      projectId: body.projectId,
      promptText: body.promptText,
      responseText: body.responseText,
      contextText: body.contextText,
      criteria,
    });

    return Response.json({
      ok: true,
      evaluation: {
        id: result.id,
        overallScore: result.overallScore,
        overallPassed: result.overallPassed,
        scores: result.scores,
        latencyMs: result.latencyMs,
        modelUsed: result.modelUsed,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SLM evaluation failed";
    return Response.json({ error: true, message }, { status: 500 });
  }
}

/**
 * GET /api/evaluate/slm?projectId=<id> — List recent evaluations
 * Requires project-level "evaluate:read" permission.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);

    if (!projectId) {
      return Response.json(
        { error: true, message: "projectId query parameter is required." },
        { status: 400 }
      );
    }

    await requireProjectPermission(projectId, "evaluate:read");

    const evaluations = await db.$queryRaw<Array<{
      id: string;
      projectId: string;
      promptText: string;
      responseText: string;
      overallScore: number;
      overallPassed: boolean;
      modelUsed: string;
      latencyMs: number;
      createdAt: Date;
    }>>`
      SELECT "id", "projectId", "promptText", "responseText",
        "overallScore", "overallPassed", "modelUsed", "latencyMs", "createdAt"
      FROM "SlmEvaluation"
      WHERE "projectId" = ${projectId}
      ORDER BY "createdAt" DESC
      LIMIT ${limit}
    `;

    return Response.json({ ok: true, evaluations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch evaluations";
    return Response.json({ error: true, message }, { status: 500 });
  }
}
