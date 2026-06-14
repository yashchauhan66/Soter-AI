import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { ssoProviderSchema } from "@/lib/enterprise/sso";

export async function POST(request: Request) { try { const body = ssoProviderSchema.parse(await readJson(request)); await requirePermission(body.organizationId, "member:manage"); const provider = await db.ssoProvider.upsert({ where: { organizationId_name: { organizationId: body.organizationId, name: body.name } }, update: { metadataUrl: body.metadataUrl || null, entityId: body.entityId, ssoUrl: body.ssoUrl || null, certificate: body.certificate, enabled: body.enabled }, create: { organizationId: body.organizationId, name: body.name, metadataUrl: body.metadataUrl || null, entityId: body.entityId, ssoUrl: body.ssoUrl || null, certificate: body.certificate, enabled: body.enabled } }); return jsonResponse({ id: provider.id, enabled: provider.enabled }); } catch (error) { return apiError(error, "SAML configuration could not be saved."); } }
