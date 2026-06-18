import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireProjectPermission } from "@/lib/auth/guards";
import { storeCredential, listCredentials, rotateCredential, revokeCredential, revealCredential, validateServerUrl } from "@/lib/credentials/vault";

const createSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  serverUrl: z.string().min(1).max(2048),
  secret: z.string().min(1).max(8000),
  description: z.string().max(500).optional(),
});

const rotateSchema = z.object({
  projectId: z.string().min(1),
  id: z.string().min(1),
  newSecret: z.string().min(1).max(8000),
});

const revealSchema = z.object({
  projectId: z.string().min(1),
  id: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = createSchema.parse(await readJson(request));
    const access = await requireProjectPermission(body.projectId, "credentials:manage");

    const urlCheck = validateServerUrl(body.serverUrl);
    if (!urlCheck.valid) return jsonResponse({ error: true, message: urlCheck.error }, { status: 400 });

    const credential = await storeCredential({
      organizationId: access.org.id,
      projectId: body.projectId,
      name: body.name,
      serverUrl: body.serverUrl,
      secret: body.secret,
      description: body.description,
      createdById: access.user.id,
    });
    return jsonResponse(credential, { status: 201 });
  } catch (error) {
    return apiError(error, "Credential could not be stored.");
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) return jsonResponse({ error: true, message: "projectId is required." }, { status: 400 });
    const access = await requireProjectPermission(projectId, "credentials:read");
    const credentials = await listCredentials(access.org.id);
    return jsonResponse({ credentials });
  } catch (error) {
    return apiError(error, "Could not fetch credentials.");
  }
}

export async function PUT(request: Request) {
  try {
    const body = rotateSchema.parse(await readJson(request));
    const access = await requireProjectPermission(body.projectId, "credentials:manage");
    const id = body.id;
    const credential = await rotateCredential(id, access.org.id, body.newSecret, access.user.id);
    return jsonResponse(credential);
  } catch (error) {
    return apiError(error, "Credential could not be rotated.");
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await readJson(request) as { id: string; projectId: string };
    if (!body.id) return jsonResponse({ error: true, message: "id is required." }, { status: 400 });
    if (!body.projectId) return jsonResponse({ error: true, message: "projectId is required." }, { status: 400 });
    const access = await requireProjectPermission(body.projectId, "credentials:manage");
    await revokeCredential(body.id, access.org.id, access.user.id);
    return jsonResponse({ revoked: true });
  } catch (error) {
    return apiError(error, "Credential could not be revoked.");
  }
}

export async function PATCH(request: Request) {
  try {
    const body = revealSchema.parse(await readJson(request));
    const access = await requireProjectPermission(body.projectId, "credentials:manage");
    const result = await revealCredential(body.id, access.org.id, access.user.id);
    return jsonResponse({ ...result, secret: undefined, revealed: true });
  } catch (error) {
    return apiError(error, "Credential could not be revealed.");
  }
}
