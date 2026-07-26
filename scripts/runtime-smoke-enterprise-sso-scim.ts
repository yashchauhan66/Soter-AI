import assert from "node:assert/strict";
import { db } from "../lib/db";

process.env.API_KEY_PEPPER = process.env.API_KEY_PEPPER ?? "enterprise-runtime-smoke-api-key-pepper";
process.env.SCIM_TOKEN_PEPPER = process.env.SCIM_TOKEN_PEPPER ?? "enterprise-runtime-smoke-scim-token-pepper";
process.env.NEXTAUTH_URL = "https://soterai.example";
process.env.SAML_SP_ENTITY_ID = "https://soterai.example/api/sso/saml/metadata";
process.env.SAML_SP_ACS_URL = "https://soterai.example/api/sso/saml/acs";

type MutableDb = typeof db & Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>>;

const mutableDb = db as MutableDb;
const originals = {
  scimTokenFindUnique: mutableDb.scimToken.findUnique,
  scimTokenUpdate: mutableDb.scimToken.update,
  scimUserMappingFindMany: mutableDb.scimUserMapping.findMany,
  scimUserMappingFindFirst: mutableDb.scimUserMapping.findFirst,
  scimUserMappingCreate: mutableDb.scimUserMapping.create,
  scimUserMappingUpdate: mutableDb.scimUserMapping.update,
  scimGroupMappingFindMany: mutableDb.scimGroupMapping.findMany,
  userFindUnique: mutableDb.user.findUnique,
  userCreate: mutableDb.user.create,
  userUpdate: mutableDb.user.update,
  userFindUniqueOrThrow: mutableDb.user.findUniqueOrThrow,
  organizationMemberUpsert: mutableDb.organizationMember.upsert,
  organizationMemberDeleteMany: mutableDb.organizationMember.deleteMany,
  organizationAuditLogCreate: mutableDb.organizationAuditLog.create,
  samlProviderFindFirst: mutableDb.samlProvider.findFirst,
  samlLoginAttemptCreate: mutableDb.samlLoginAttempt.create,
  transaction: mutableDb.$transaction,
};

const organizationId = "org_enterprise_runtime_smoke";
const otherOrganizationId = "org_enterprise_runtime_other";
const now = new Date("2026-07-26T15:00:00.000Z");
const users = new Map<string, { id: string; email: string; name: string | null; ssoOnly: boolean; jitProvisionedFrom: string; emailVerifiedAt: Date; createdAt: Date; updatedAt: Date }>();
const mappings = new Map<string, { id: string; organizationId: string; userId: string; externalId: string | null; active: boolean; createdAt: Date; updatedAt: Date; user: { id: string; email: string; name: string | null } }>();
const auditLogs: Array<{ action: string; category: string; metadata: Record<string, unknown>; organizationId: string }> = [];
const membershipOps: Array<{ action: string; organizationId: string; userId: string; role?: string }> = [];
const samlAttempts: Array<{ organizationId: string; providerId: string; status: string; ip?: string | null; error?: string | null; email?: string | null }> = [];
let tokenLastUsedUpdates = 0;

function installDbMocks(scimTokenHash: string, otherScimTokenHash: string) {
  mutableDb.scimToken.findUnique = async ({ where }: { where?: { tokenHash?: string } }) => {
    if (where?.tokenHash === scimTokenHash) {
      return { id: "scim_token_runtime", organizationId, tokenHash: scimTokenHash, revokedAt: null, expiresAt: new Date(Date.now() + 60_000) };
    }
    if (where?.tokenHash === otherScimTokenHash) {
      return { id: "scim_token_other", organizationId: otherOrganizationId, tokenHash: otherScimTokenHash, revokedAt: null, expiresAt: new Date(Date.now() + 60_000) };
    }
    return null;
  };
  mutableDb.scimToken.update = async () => {
    tokenLastUsedUpdates += 1;
    return { id: "scim_token_runtime" };
  };
  mutableDb.scimUserMapping.findMany = async ({ where, include }: { where?: Record<string, unknown>; include?: Record<string, unknown> } = {}) => {
    const items = [...mappings.values()].filter((mapping) => {
      if (where?.organizationId && mapping.organizationId !== where.organizationId) return false;
      if (where?.externalId && mapping.externalId !== where.externalId) return false;
      if (where?.active !== undefined && mapping.active !== where.active) return false;
      const id = where?.id as { in?: string[] } | undefined;
      if (id?.in && !id.in.includes(mapping.id)) return false;
      return true;
    });
    if (include?.user) return items;
    return items.map(({ user: _user, ...mapping }) => mapping);
  };
  mutableDb.scimUserMapping.findFirst = async ({ where, include }: { where?: Record<string, unknown>; include?: Record<string, unknown> } = {}) => {
    const items = await mutableDb.scimUserMapping.findMany({ where, include });
    const or = where?.OR as Array<Record<string, unknown>> | undefined;
    if (or?.length) {
      return [...mappings.values()].find((mapping) =>
        mapping.organizationId === where?.organizationId &&
        or.some((condition) =>
          condition.externalId === mapping.externalId ||
          ((condition.user as { email?: string } | undefined)?.email === mapping.user.email),
        ),
      ) ?? null;
    }
    return (items as unknown[])[0] ?? null;
  };
  mutableDb.scimUserMapping.create = async ({ data }: { data: { organizationId: string; userId: string; externalId: string; active: boolean } }) => {
    const user = users.get(data.userId);
    assert.ok(user);
    const mapping = {
      id: `mapping_${mappings.size + 1}`,
      organizationId: data.organizationId,
      userId: data.userId,
      externalId: data.externalId,
      active: data.active,
      createdAt: now,
      updatedAt: now,
      user: { id: user.id, email: user.email, name: user.name },
    };
    mappings.set(mapping.id, mapping);
    return mapping;
  };
  mutableDb.scimUserMapping.update = async ({ where, data }: { where: { id: string }; data: { active?: boolean } }) => {
    const mapping = mappings.get(where.id);
    assert.ok(mapping);
    if (typeof data.active === "boolean") mapping.active = data.active;
    mapping.updatedAt = new Date(now.getTime() + 1000);
    mappings.set(mapping.id, mapping);
    return mapping;
  };
  mutableDb.scimGroupMapping.findMany = async () => [];
  mutableDb.user.findUnique = async ({ where }: { where: { email?: string; id?: string } }) => {
    if (where.email) return [...users.values()].find((user) => user.email === where.email) ?? null;
    if (where.id) return users.get(where.id) ?? null;
    return null;
  };
  mutableDb.user.create = async ({ data }: { data: { email: string; name: string | null; ssoOnly: boolean; jitProvisionedFrom: string; emailVerifiedAt: Date } }) => {
    const user = { id: `user_${users.size + 1}`, ...data, createdAt: now, updatedAt: now };
    users.set(user.id, user);
    return user;
  };
  mutableDb.user.update = async ({ where, data }: { where: { id: string }; data: { email?: string; name?: string | null } }) => {
    const user = users.get(where.id);
    assert.ok(user);
    if (data.email) user.email = data.email;
    if (data.name !== undefined) user.name = data.name;
    user.updatedAt = new Date(now.getTime() + 1000);
    return user;
  };
  mutableDb.user.findUniqueOrThrow = async ({ where }: { where: { id: string } }) => {
    const user = users.get(where.id);
    if (!user) throw new Error("User not found");
    return user;
  };
  mutableDb.organizationMember.upsert = async ({ where, create, update }: { where: { organizationId_userId: { organizationId: string; userId: string } }; create: { role: string }; update?: { role?: string } }) => {
    membershipOps.push({
      action: "upsert",
      organizationId: where.organizationId_userId.organizationId,
      userId: where.organizationId_userId.userId,
      role: update?.role ?? create.role,
    });
    return { id: "member_runtime" };
  };
  mutableDb.organizationMember.deleteMany = async ({ where }: { where: { organizationId: string; userId: string } }) => {
    membershipOps.push({ action: "deleteMany", organizationId: where.organizationId, userId: where.userId });
    return { count: 1 };
  };
  mutableDb.organizationAuditLog.create = async ({ data }: { data: { organizationId: string; action: string; category: string; metadata: Record<string, unknown> } }) => {
    auditLogs.push(data);
    return { id: `audit_${auditLogs.length}`, ...data };
  };
  mutableDb.$transaction = async (operations: Array<Promise<unknown>> | ((tx: MutableDb) => Promise<unknown>)) => {
    if (Array.isArray(operations)) return await Promise.all(operations);
    return await operations(mutableDb);
  };
  mutableDb.samlProvider.findFirst = async ({ where }: { where?: Record<string, unknown> }) => {
    const organization = where?.organization as { slug?: string; id?: string } | undefined;
    if (where?.enabled !== true) return null;
    if (organization?.slug !== "acme" && organization?.id !== organizationId) return null;
    return {
      id: "saml_provider_runtime",
      organizationId,
      entityId: "https://idp.example/entity",
      ssoUrl: "https://idp.example/sso",
      x509Certificate: "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----",
      enabled: true,
    };
  };
  mutableDb.samlLoginAttempt.create = async ({ data }: { data: { organizationId: string; providerId: string; status: string; ip?: string | null; error?: string | null; email?: string | null } }) => {
    samlAttempts.push(data);
    return { id: `saml_attempt_${samlAttempts.length}`, ...data };
  };
}

function restoreDbMocks() {
  mutableDb.scimToken.findUnique = originals.scimTokenFindUnique;
  mutableDb.scimToken.update = originals.scimTokenUpdate;
  mutableDb.scimUserMapping.findMany = originals.scimUserMappingFindMany;
  mutableDb.scimUserMapping.findFirst = originals.scimUserMappingFindFirst;
  mutableDb.scimUserMapping.create = originals.scimUserMappingCreate;
  mutableDb.scimUserMapping.update = originals.scimUserMappingUpdate;
  mutableDb.scimGroupMapping.findMany = originals.scimGroupMappingFindMany;
  mutableDb.user.findUnique = originals.userFindUnique;
  mutableDb.user.create = originals.userCreate;
  mutableDb.user.update = originals.userUpdate;
  mutableDb.user.findUniqueOrThrow = originals.userFindUniqueOrThrow;
  mutableDb.organizationMember.upsert = originals.organizationMemberUpsert;
  mutableDb.organizationMember.deleteMany = originals.organizationMemberDeleteMany;
  mutableDb.organizationAuditLog.create = originals.organizationAuditLogCreate;
  mutableDb.samlProvider.findFirst = originals.samlProviderFindFirst;
  mutableDb.samlLoginAttempt.create = originals.samlLoginAttemptCreate;
  mutableDb.$transaction = originals.transaction;
}

function scimRequest(url: string, token: string, init: RequestInit = {}) {
  return new Request(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/scim+json",
      ...(init.headers ?? {}),
    },
  });
}

async function json(response: Response) {
  return await response.json() as Record<string, unknown>;
}

async function main() {
  const { hashScimToken } = await import("../lib/enterprise/scim");
  const rawToken = "scim_runtime_enterprise_token_abcdefghijklmnopqrstuvwxyz";
  const otherToken = "scim_runtime_enterprise_other_abcdefghijklmnopqrstuvwxyz";
  installDbMocks(hashScimToken(rawToken), hashScimToken(otherToken));

  try {
    const serviceProvider = await import("../app/api/scim/v2/ServiceProviderConfig/route");
    const usersRoute = await import("../app/api/scim/v2/Users/route");
    const userRoute = await import("../app/api/scim/v2/Users/[id]/route");
    const samlMetadataRoute = await import("../app/api/sso/saml/metadata/route");
    const samlLoginRoute = await import("../app/api/sso/saml/login/route");

    const config = await serviceProvider.GET(new Request("https://soterai.example/api/scim/v2/ServiceProviderConfig"));
    assert.equal(config.status, 200);
    assert.match(config.headers.get("content-type") ?? "", /application\/scim\+json/);
    const configBody = await json(config);
    assert.deepEqual((configBody.patch as { supported?: boolean }).supported, true);
    assert.deepEqual((configBody.bulk as { supported?: boolean }).supported, false);

    const unauthenticated = await usersRoute.GET(new Request("https://soterai.example/api/scim/v2/Users"));
    assert.equal(unauthenticated.status, 401);
    const unauthenticatedBody = await json(unauthenticated);
    assert.deepEqual(unauthenticatedBody.schemas, ["urn:ietf:params:scim:api:messages:2.0:Error"]);

    const created = await usersRoute.POST(scimRequest("https://soterai.example/api/scim/v2/Users", rawToken, {
      method: "POST",
      body: JSON.stringify({
        userName: "Asha.Security@Example.com",
        externalId: "okta-asha-1",
        active: true,
        name: { givenName: "Asha", familyName: "Security" },
      }),
    }));
    assert.equal(created.status, 201);
    const createdBody = await json(created);
    assert.equal(createdBody.externalId, "okta-asha-1");
    assert.equal(createdBody.userName, "asha.security@example.com");
    assert.equal((createdBody.meta as { location?: string }).location, "https://soterai.example/api/scim/v2/Users/mapping_1");
    assert.equal(tokenLastUsedUpdates >= 1, true);
    assert.equal(auditLogs[0].action, "scim_user_created");
    assert.equal(JSON.stringify(auditLogs[0].metadata).includes("asha.security@example.com"), false);
    assert.equal(auditLogs[0].metadata.userNameDomain, "example.com");
    assert.deepEqual(membershipOps[0], {
      action: "upsert",
      organizationId,
      userId: "user_1",
      role: "VIEWER",
    });

    const listed = await usersRoute.GET(scimRequest('https://soterai.example/api/scim/v2/Users?filter=userName%20eq%20"ASHA.SECURITY%40EXAMPLE.COM"', rawToken));
    assert.equal(listed.status, 200);
    const listedBody = await json(listed);
    assert.equal(listedBody.totalResults, 1);
    assert.equal((listedBody.Resources as Array<{ id: string }>)[0].id, "mapping_1");

    const crossOrg = await userRoute.GET(scimRequest("https://soterai.example/api/scim/v2/Users/mapping_1", otherToken), {
      params: Promise.resolve({ id: "mapping_1" }),
    });
    assert.equal(crossOrg.status, 404);

    const patched = await userRoute.PATCH(scimRequest("https://soterai.example/api/scim/v2/Users/mapping_1", rawToken, {
      method: "PATCH",
      body: JSON.stringify({
        schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
        Operations: [{ op: "replace", path: "active", value: false }],
      }),
    }), {
      params: Promise.resolve({ id: "mapping_1" }),
    });
    assert.equal(patched.status, 200);
    const patchedBody = await json(patched);
    assert.equal(patchedBody.active, false);
    assert.equal(membershipOps.some((op) => op.action === "deleteMany" && op.userId === "user_1"), true);
    assert.equal(auditLogs.some((log) => log.action === "scim_user_deprovisioned"), true);

    const metadata = await samlMetadataRoute.GET(new Request("https://soterai.example/api/sso/saml/metadata"));
    assert.equal(metadata.status, 200);
    assert.match(metadata.headers.get("content-type") ?? "", /application\/xml/);
    const metadataXml = await metadata.text();
    assert.match(metadataXml, /EntityDescriptor/);
    assert.match(metadataXml, /AssertionConsumerService/);
    assert.match(metadataXml, /https:\/\/soterai\.example\/api\/sso\/saml\/acs/);

    const login = await samlLoginRoute.GET(new Request("https://soterai.example/api/sso/saml/login?org=acme&relayState=https%3A%2F%2Fevil.example%2Fphish", {
      headers: { "x-forwarded-for": "198.51.100.10" },
    }));
    assert.equal(login.status, 307);
    const location = login.headers.get("location") ?? "";
    assert.match(location, /^https:\/\/idp\.example\/sso\?/);
    const loginUrl = new URL(location);
    assert.ok(loginUrl.searchParams.get("SAMLRequest"));
    assert.equal(loginUrl.searchParams.get("RelayState"), "/dashboard");
    assert.deepEqual(samlAttempts[0], {
      organizationId,
      providerId: "saml_provider_runtime",
      status: "REQUESTED",
      ip: "198.51.100.10",
      error: null,
      email: null,
    });

    console.log(JSON.stringify({
      ok: true,
      checks: [
        "SCIM ServiceProviderConfig is public and standards-shaped",
        "SCIM Users requires bearer token and returns SCIM error envelope",
        "SCIM user create/list/deprovision is tenant-scoped and audited",
        "SCIM cross-organization lookup returns 404 without leaking existence",
        "SAML metadata exposes SP entity and ACS XML",
        "SAML login redirects to IdP with sanitized RelayState and audit attempt",
      ],
    }, null, 2));
  } finally {
    restoreDbMocks();
  }
}

main().catch((error) => {
  restoreDbMocks();
  console.error(error);
  process.exit(1);
});
