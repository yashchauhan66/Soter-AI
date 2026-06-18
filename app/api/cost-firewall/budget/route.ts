import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireProjectPermission } from "@/lib/auth/guards";
import { setBudget, getBudget, listBudgets, getCostSummary, recordCostTransaction } from "@/lib/cost-firewall";

const budgetSchema = z.object({
  projectId: z.string().optional(),
  monthlyLimitPaise: z.number().int().positive(),
  hardStop: z.boolean().default(true),
  alertThreshold: z.number().min(0).max(1).default(0.8),
});

const transactionSchema = z.object({
  projectId: z.string().optional(),
  amountPaise: z.number().int(),
  currency: z.string().default("INR"),
  category: z.string().default("API_CALL"),
  description: z.string().max(500).optional(),
  providerName: z.string().max(100).optional(),
  modelName: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(request: Request) {
  try {
    const body = budgetSchema.parse(await readJson(request));
    const access = await requireProjectPermission(body.projectId ?? "", "cost:manage");
    const budget = await setBudget({
      organizationId: access.org.id,
      projectId: body.projectId,
      monthlyLimitPaise: body.monthlyLimitPaise,
      hardStop: body.hardStop,
      alertThreshold: body.alertThreshold,
    });
    return jsonResponse(budget, { status: 201 });
  } catch (error) {
    return apiError(error, "Budget could not be set.");
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const access = await requireProjectPermission(projectId ?? "", "cost:read");

    if (projectId) {
      const budget = await getBudget(access.org.id, projectId);
      return jsonResponse(budget ?? { error: true, message: "No budget configured." }, { status: budget ? 200 : 404 });
    }
    const budgets = await listBudgets(access.org.id);
    const summary = await getCostSummary(access.org.id);
    return jsonResponse({ budgets, summary });
  } catch (error) {
    return apiError(error, "Could not fetch budgets.");
  }
}

export async function PUT(request: Request) {
  try {
    const body = transactionSchema.parse(await readJson(request));
    const access = await requireProjectPermission(body.projectId ?? "", "cost:manage");
    const result = await recordCostTransaction({
      organizationId: access.org.id,
      projectId: body.projectId,
      amountPaise: body.amountPaise,
      currency: body.currency,
      category: body.category,
      description: body.description,
      providerName: body.providerName,
      modelName: body.modelName,
      metadata: body.metadata,
    });
    return jsonResponse(result);
  } catch (error) {
    return apiError(error, "Cost transaction could not be recorded.");
  }
}
