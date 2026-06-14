// SAML ACS — assertion consumer endpoint. Receives the IdP's SAMLResponse,
// validates it, performs JIT provisioning, and redirects to the dashboard.

import { NextResponse } from "next/server";
import { apiError, jsonResponse } from "@/lib/apiResponse";
import { db } from "@/lib/db";
import { SamlError, validateSamlResponse } from "@/lib/enterprise/saml";
import { jitProvisionFromSaml } from "@/lib/enterprise/samlProvisioning";
import { markAndCheckReplay } from "@/lib/enterprise/samlReplayStore";

export const dynamic = "force-dynamic";

async function readForm(request: Request): Promise<{ samlResponse: string; relayState?: string }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/x-www-form-urlencoded") && !contentType.includes("multipart/form-data")) {
    throw new SamlError("ACS expects form-encoded POST.");
  }
  const form = await request.formData();
  const samlResponse = form.get("SAMLResponse");
  const relayState = form.get("RelayState");
  if (typeof samlResponse !== "string" || !samlResponse) throw new SamlError("Missing SAMLResponse.");
  return { samlResponse, relayState: typeof relayState === "string" ? relayState : undefined };
}

export async function POST(request: Request) {
  let providerId: string | null = null;
  try {
    const { samlResponse, relayState } = await readForm(request);
    // Find the provider by matching the issuer in the assertion. We do not
    // trust the issuer until after signature verification.
    const decoded = Buffer.from(samlResponse, "base64").toString("utf8");
    const issuerMatch = decoded.match(/<(?:saml2?:)?Issuer[^>]*>([^<]+)<\/(?:saml2?:)?Issuer>/);
    if (!issuerMatch) {
      return jsonResponse({ error: true, message: "SAML response has no Issuer." }, { status: 400 });
    }
    const issuer = issuerMatch[1].trim();
    const provider = await db.samlProvider.findFirst({ where: { entityId: issuer, enabled: true } });
    if (!provider) {
      return jsonResponse({ error: true, message: "No enabled SAML provider for this issuer." }, { status: 404 });
    }
    providerId = provider.id;

    const url = new URL(request.url);
    const baseUrl = process.env.NEXTAUTH_URL ?? `${url.protocol}//${url.host}`;
    const sp = {
      entityId: process.env.SAML_SP_ENTITY_ID ?? `${baseUrl}/api/sso/saml/metadata`,
      acsUrl: process.env.SAML_SP_ACS_URL ?? `${baseUrl}/api/sso/saml/acs`,
    };
    const idp = { entityId: provider.entityId, ssoUrl: provider.ssoUrl, x509Certificate: provider.x509Certificate };
    const result = await validateSamlResponse(samlResponse, {
      sp,
      idp,
      isReplay: markAndCheckReplay,
    });

    const jit = await jitProvisionFromSaml(provider, result.attributes);
    await db.samlLoginAttempt.create({
      data: {
        organizationId: provider.organizationId,
        providerId: provider.id,
        email: result.attributes.email,
        status: "SUCCESS",
        ip: request.headers.get("x-forwarded-for") ?? null,
      },
    });

    // We do NOT mint a NextAuth session here (NextAuth v5 credentials provider
    // is the source of truth). Instead, we redirect to a one-time SSO landing
    // page that completes credential exchange. In a deployment with custom
    // session minting (e.g. SCIM-managed accounts), wire this up in auth.ts.
    const redirect = `/signin?ssoEmail=${encodeURIComponent(result.attributes.email)}&orgId=${encodeURIComponent(jit.organizationId)}&relay=${encodeURIComponent(relayState ?? "/dashboard")}`;
    return NextResponse.redirect(new URL(redirect, baseUrl));
  } catch (error) {
    if (providerId) {
      await db.samlLoginAttempt.create({
        data: {
          organizationId: (await db.samlProvider.findUnique({ where: { id: providerId } }))?.organizationId ?? "unknown",
          providerId,
          status: "FAILURE",
          error: (error as Error).message,
          ip: request.headers.get("x-forwarded-for") ?? null,
        },
      });
    }
    return apiError(error, "SAML response could not be validated.");
  }
}
