// SAML test connection. Accepts an IdP entity id + ssoUrl + cert, parses
// optional metadata XML, and returns whether the configuration would be
// accepted. No assertion is issued during a test.

import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { parseIdpMetadata, SamlError } from "@/lib/enterprise/saml";

export const dynamic = "force-dynamic";

const schema = z.object({
  organizationId: z.string().min(1),
  metadataXml: z.string().max(200_000).optional(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await readJson(request));
    await requirePermission(body.organizationId, "member:manage");
    const provider = await db.samlProvider.findFirst({ where: { organizationId: body.organizationId } });
    if (body.metadataXml) {
      // Validate metadata can be parsed.
      const parsed = parseIdpMetadata(body.metadataXml);
      return jsonResponse({
        ok: true,
        parsed: { entityId: parsed.entityId, ssoUrl: parsed.ssoUrl, certPreview: parsed.x509Certificate.slice(0, 80) },
      });
    }
    if (!provider) {
      return jsonResponse({ error: true, message: "No SAML provider configured." }, { status: 404 });
    }
    return jsonResponse({
      ok: true,
      provider: {
        entityId: provider.entityId,
        ssoUrl: provider.ssoUrl,
        acsUrl: provider.acsUrl,
        enabled: provider.enabled,
        defaultRole: provider.defaultRole,
      },
    });
  } catch (error) {
    if (error instanceof SamlError) {
      return jsonResponse({ error: true, message: error.message }, { status: 400 });
    }
    return apiError(error, "SAML test failed.");
  }
}
