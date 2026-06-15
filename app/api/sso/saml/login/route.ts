// SP-initiated login. Redirects the browser to the IdP's SSO URL with an
// AuthnRequest.

import { NextResponse } from "next/server";
import { apiError, jsonResponse } from "@/lib/apiResponse";
import { safeCallbackUrl } from "@/lib/auth/callback";
import { db } from "@/lib/db";
import { buildAuthnRequest } from "@/lib/enterprise/saml";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const orgSlug = url.searchParams.get("org");
    const orgId = url.searchParams.get("organizationId");
    if (!orgSlug && !orgId) {
      return jsonResponse({ error: true, message: "Missing org slug or organizationId." }, { status: 400 });
    }
    const provider = await db.samlProvider.findFirst({
      where: {
        enabled: true,
        organization: orgId ? { id: orgId } : { slug: orgSlug! },
      },
    });
    if (!provider) return jsonResponse({ error: true, message: "SAML is not configured for this organization." }, { status: 404 });
    const baseUrl = process.env.NEXTAUTH_URL ?? `${url.protocol}//${url.host}`;
    const sp = {
      entityId: process.env.SAML_SP_ENTITY_ID ?? `${baseUrl}/api/sso/saml/metadata`,
      acsUrl: process.env.SAML_SP_ACS_URL ?? `${baseUrl}/api/sso/saml/acs`,
    };
    const idp = { entityId: provider.entityId, ssoUrl: provider.ssoUrl, x509Certificate: provider.x509Certificate };
    const relayState = safeCallbackUrl(url.searchParams.get("relayState") ?? "/dashboard");
    const { redirectUrl } = buildAuthnRequest(sp, idp, relayState);
    await db.samlLoginAttempt.create({
      data: {
        organizationId: provider.organizationId,
        providerId: provider.id,
        status: "REQUESTED",
        ip: request.headers.get("x-forwarded-for") ?? null,
        error: null,
        email: null,
      },
    });
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    return apiError(error, "SAML login could not be started.");
  }
}
