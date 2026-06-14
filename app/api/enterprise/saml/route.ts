// Phase 6: SAML provider configuration API. Accepts metadata XML or manual
// IdP fields, persists the SamlProvider row, and audits the change.

import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { parseIdpMetadata, SamlError } from "@/lib/enterprise/saml";

export const dynamic = "force-dynamic";

const samlConfigSchema = z.object({
  organizationId: z.string().min(1),
  metadataXml: z.string().max(200_000).optional(),
  entityId: z.string().min(1).max(500).optional(),
  ssoUrl: z.string().url().refine((value) => value.startsWith("https://"), "SSO URL must use HTTPS.").optional(),
  x509Certificate: z.string().min(1).max(20_000).optional(),
  metadataUrl: z.string().url().optional().or(z.literal("")),
  defaultRole: z.enum(["OWNER", "ADMIN", "DEVELOPER", "SECURITY_ANALYST", "BILLING", "VIEWER"]).default("VIEWER"),
  emailDomain: z.string().max(253).optional().or(z.literal("")),
  enabled: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    const body = samlConfigSchema.parse(await readJson(request));
    const access = await requirePermission(body.organizationId, "member:manage");

    let entityId = body.entityId;
    let ssoUrl = body.ssoUrl;
    let x509Certificate = body.x509Certificate;
    if (body.metadataXml) {
      const parsed = parseIdpMetadata(body.metadataXml);
      entityId = parsed.entityId;
      ssoUrl = parsed.ssoUrl;
      x509Certificate = parsed.x509Certificate;
    }
    if (!entityId || !ssoUrl || !x509Certificate) {
      return jsonResponse({ error: true, message: "Provide IdP metadata XML or entityId, ssoUrl, and x509Certificate." }, { status: 400 });
    }
    if (!x509Certificate.includes("BEGIN CERTIFICATE")) {
      return jsonResponse({ error: true, message: "x509Certificate must be a PEM block." }, { status: 400 });
    }

    const url = new URL(request.url);
    const baseUrl = process.env.NEXTAUTH_URL ?? `${url.protocol}//${url.host}`;
    const acsUrl = process.env.SAML_SP_ACS_URL ?? `${baseUrl}/api/sso/saml/acs`;
    const issuer = process.env.SAML_SP_ENTITY_ID ?? `${baseUrl}/api/sso/saml/metadata`;

    const provider = await db.samlProvider.upsert({
      where: { organizationId: body.organizationId },
      create: {
        organizationId: body.organizationId,
        entityId,
        ssoUrl,
        acsUrl,
        issuer,
        x509Certificate,
        metadataUrl: body.metadataUrl || null,
        enabled: body.enabled,
        defaultRole: body.defaultRole,
        emailDomain: body.emailDomain || null,
      },
      update: {
        entityId,
        ssoUrl,
        acsUrl,
        issuer,
        x509Certificate,
        metadataUrl: body.metadataUrl || null,
        enabled: body.enabled,
        defaultRole: body.defaultRole,
        emailDomain: body.emailDomain || null,
      },
    });

    await db.organizationAuditLog.create({
      data: {
        organizationId: body.organizationId,
        actorUserId: access.user.id,
        action: "saml_config_updated",
        category: "auth",
        metadata: { providerId: provider.id, enabled: provider.enabled, entityId: provider.entityId, defaultRole: provider.defaultRole },
      },
    });

    return jsonResponse({
      id: provider.id,
      enabled: provider.enabled,
      entityId: provider.entityId,
      ssoUrl: provider.ssoUrl,
      acsUrl: provider.acsUrl,
      defaultRole: provider.defaultRole,
    });
  } catch (error) {
    if (error instanceof SamlError) {
      return jsonResponse({ error: true, message: error.message }, { status: 400 });
    }
    return apiError(error, "Could not save SAML configuration.");
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId");
    if (!organizationId) return jsonResponse({ error: true, message: "organizationId is required." }, { status: 400 });
    await requirePermission(organizationId, "member:manage");
    const provider = await db.samlProvider.findFirst({ where: { organizationId } });
    if (!provider) return jsonResponse({ provider: null });
    return jsonResponse({
      provider: {
        id: provider.id,
        entityId: provider.entityId,
        ssoUrl: provider.ssoUrl,
        acsUrl: provider.acsUrl,
        issuer: provider.issuer,
        enabled: provider.enabled,
        defaultRole: provider.defaultRole,
        emailDomain: provider.emailDomain,
        certPreview: provider.x509Certificate.slice(0, 80),
      },
    });
  } catch (error) {
    return apiError(error, "Could not load SAML configuration.");
  }
}
