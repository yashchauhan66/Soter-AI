// SAML SP metadata endpoint. Returned XML can be uploaded directly to the IdP
// (Okta, Azure AD, Google Workspace, etc.).

import { NextResponse } from "next/server";
import { buildSpMetadata } from "@/lib/enterprise/saml";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const baseUrl = process.env.NEXTAUTH_URL ?? `${url.protocol}//${url.host}`;
  const xml = buildSpMetadata({
    entityId: process.env.SAML_SP_ENTITY_ID ?? `${baseUrl}/api/sso/saml/metadata`,
    acsUrl: process.env.SAML_SP_ACS_URL ?? `${baseUrl}/api/sso/saml/acs`,
  });
  return new NextResponse(xml, {
    status: 200,
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "no-store" },
  });
}
