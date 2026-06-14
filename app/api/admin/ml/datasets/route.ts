import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import {
  createDatasetWithExamples,
  parseCsvDataset,
  parseJsonDataset,
  listDatasets,
  type MLDatasetExampleInput,
} from "@/lib/ml";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  format: z.enum(["json", "jsonl", "csv", "examples"]).default("examples"),
  examples: z.array(z.object({ text: z.string().min(1), label: z.string().min(1), language: z.string().optional(), source: z.string().optional() })).optional(),
  payload: z.string().max(2_000_000).optional(),
});

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = createSchema.parse(await readJson(request));
    let examples: MLDatasetExampleInput[] = [];
    if (body.format === "examples" && body.examples) {
      examples = body.examples.map((example) => ({
        text: example.text,
        label: example.label.toUpperCase() as MLDatasetExampleInput["label"],
        language: example.language,
        source: example.source,
      }));
    } else if ((body.format === "json" || body.format === "jsonl") && body.payload) {
      examples = parseJsonDataset(body.payload);
    } else if (body.format === "csv" && body.payload) {
      examples = parseCsvDataset(body.payload);
    }
    if (!examples.length) {
      return jsonResponse({ error: true, message: "No examples to import." }, { status: 400 });
    }
    const dataset = await createDatasetWithExamples({
      organizationId: body.organizationId,
      name: body.name,
      description: body.description,
      examples,
    });
    return jsonResponse({ id: dataset.id, name: dataset.name, version: dataset.version, exampleCount: dataset.exampleCount }, { status: 201 });
  } catch (error) {
    return apiError(error, "Dataset import failed.");
  }
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId");
    if (!organizationId) return jsonResponse({ error: true, message: "organizationId is required." }, { status: 400 });
    const datasets = await listDatasets(organizationId);
    return jsonResponse({ datasets: datasets.map((dataset) => ({ id: dataset.id, name: dataset.name, version: dataset.version, isActive: dataset.isActive, exampleCount: dataset._count.examples, createdAt: dataset.createdAt })) });
  } catch (error) {
    return apiError(error, "Could not list datasets.");
  }
}
