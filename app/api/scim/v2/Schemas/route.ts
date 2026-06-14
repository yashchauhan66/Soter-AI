import { scimResponse, SCIM_USER_SCHEMA, SCIM_GROUP_SCHEMA, SCIM_ENTERPRISE_USER_SCHEMA } from "@/lib/enterprise/scim";

export const dynamic = "force-dynamic";

export async function GET() {
  return scimResponse({
    schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
    totalResults: 3,
    Resources: [
      { id: SCIM_USER_SCHEMA, name: "User", description: "SCIM core User schema (subset).", attributes: [
        { name: "userName", type: "string", required: true, multiValued: false, mutability: "readWrite", returned: "always", uniqueness: "server" },
        { name: "active", type: "boolean", required: false, multiValued: false, mutability: "readWrite", returned: "default" },
        { name: "name", type: "complex", subAttributes: [
          { name: "givenName", type: "string", multiValued: false, mutability: "readWrite", returned: "default" },
          { name: "familyName", type: "string", multiValued: false, mutability: "readWrite", returned: "default" },
        ] },
        { name: "emails", type: "complex", multiValued: true, mutability: "readWrite", returned: "default" },
      ] },
      { id: SCIM_GROUP_SCHEMA, name: "Group", description: "SCIM core Group schema (subset).", attributes: [
        { name: "displayName", type: "string", required: true, multiValued: false, mutability: "readWrite", returned: "always", uniqueness: "server" },
        { name: "members", type: "complex", multiValued: true, mutability: "readWrite", returned: "default" },
      ] },
      { id: SCIM_ENTERPRISE_USER_SCHEMA, name: "EnterpriseUser", description: "Enterprise extension (informational).", attributes: [] },
    ],
  });
}
