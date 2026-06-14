import { scimResponse, SCIM_USER_SCHEMA, SCIM_GROUP_SCHEMA } from "@/lib/enterprise/scim";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const baseUrl = process.env.NEXTAUTH_URL ?? `${url.protocol}//${url.host}`;
  return scimResponse({
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
    documentationUri: `${baseUrl}/docs/compliance/access-control.md`,
    patch: { supported: true },
    bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
    filter: { supported: true, maxResults: 200 },
    changePassword: { supported: false },
    sort: { supported: false },
    etag: { supported: false },
    authenticationSchemes: [
      {
        type: "oauthbearertoken",
        name: "OAuth Bearer Token",
        description: "Bearer token issued via /api/enterprise/scim-tokens.",
      },
    ],
    meta: { resourceType: "ServiceProviderConfig", location: `${baseUrl}/api/scim/v2/ServiceProviderConfig` },
    _supportedSchemas: [SCIM_USER_SCHEMA, SCIM_GROUP_SCHEMA],
  });
}
