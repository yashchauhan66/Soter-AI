import { scimResponse } from "@/lib/enterprise/scim";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const baseUrl = process.env.NEXTAUTH_URL ?? `${url.protocol}//${url.host}`;
  return scimResponse({
    schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
    totalResults: 2,
    Resources: [
      {
        id: "User",
        name: "User",
        endpoint: "/Users",
        description: "User Account",
        schema: "urn:ietf:params:scim:schemas:core:2.0:User",
        meta: { location: `${baseUrl}/api/scim/v2/ResourceTypes/User`, resourceType: "ResourceType" },
      },
      {
        id: "Group",
        name: "Group",
        endpoint: "/Groups",
        description: "Group",
        schema: "urn:ietf:params:scim:schemas:core:2.0:Group",
        meta: { location: `${baseUrl}/api/scim/v2/ResourceTypes/Group`, resourceType: "ResourceType" },
      },
    ],
  });
}
