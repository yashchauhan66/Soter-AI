// SCIM v2 — Users collection: GET (list/filter) and POST (create).

import { z } from "zod";
import { db } from "@/lib/db";
import {
  authorizeScimRequest,
  scimError,
  ScimError,
  scimResponse,
  toScimUser,
  SCIM_LIST_RESPONSE,
  minimizedScimUserMetadata,
} from "@/lib/enterprise/scim";

export const dynamic = "force-dynamic";

const createUserSchema = z.object({
  userName: z.string().min(3).max(255),
  externalId: z.string().max(255).optional(),
  active: z.boolean().optional(),
  name: z
    .object({ givenName: z.string().max(255).optional(), familyName: z.string().max(255).optional(), formatted: z.string().max(255).optional() })
    .optional(),
  emails: z
    .array(z.object({ value: z.string().email(), primary: z.boolean().optional(), type: z.string().optional() }))
    .optional(),
});

function baseUrl(request: Request): string {
  const url = new URL(request.url);
  return process.env.NEXTAUTH_URL ?? `${url.protocol}//${url.host}`;
}

export async function GET(request: Request) {
  let auth;
  try {
    auth = await authorizeScimRequest(request);
  } catch (error) {
    return scimError((error as Error).message, error instanceof ScimError ? error.status : 401);
  }
  const url = new URL(request.url);
  const filter = url.searchParams.get("filter") ?? "";
  const startIndex = Math.max(1, Number(url.searchParams.get("startIndex") ?? "1"));
  const count = Math.min(200, Math.max(0, Number(url.searchParams.get("count") ?? "100")));

  let userNameFilter: string | null = null;
  let externalIdFilter: string | null = null;
  const userNameMatch = filter.match(/userName\s+eq\s+\"([^\"]+)\"/i);
  if (userNameMatch) userNameFilter = userNameMatch[1].toLowerCase();
  const externalIdMatch = filter.match(/externalId\s+eq\s+\"([^\"]+)\"/i);
  if (externalIdMatch) externalIdFilter = externalIdMatch[1];

  const where: Record<string, unknown> = { organizationId: auth.organizationId };
  if (externalIdFilter) where.externalId = externalIdFilter;

  const allMappings = await db.scimUserMapping.findMany({
    where,
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
  const filtered = userNameFilter
    ? allMappings.filter((m) => m.user.email.toLowerCase() === userNameFilter)
    : allMappings;
  const slice = filtered.slice(startIndex - 1, startIndex - 1 + count);

  return scimResponse({
    schemas: [SCIM_LIST_RESPONSE],
    totalResults: filtered.length,
    startIndex,
    itemsPerPage: slice.length,
    Resources: slice.map((mapping) =>
      toScimUser({
        id: mapping.id,
        externalId: mapping.externalId,
        email: mapping.user.email,
        name: mapping.user.name,
        active: mapping.active,
        createdAt: mapping.createdAt,
        updatedAt: mapping.updatedAt,
        baseUrl: baseUrl(request),
      }),
    ),
  });
}

export async function POST(request: Request) {
  let auth;
  try {
    auth = await authorizeScimRequest(request);
  } catch (error) {
    return scimError((error as Error).message, error instanceof ScimError ? error.status : 401);
  }
  let body;
  try {
    body = createUserSchema.parse(await request.json());
  } catch (error) {
    return scimError((error as Error).message, 400, "invalidValue");
  }

  const email = (body.emails?.[0]?.value ?? body.userName).toLowerCase();
  const name = (body.name?.formatted ?? [body.name?.givenName, body.name?.familyName].filter(Boolean).join(" ").trim()) || null;
  const active = body.active ?? true;

  // Cross-org protection: user may already exist; ensure mapping is scoped to
  // this token's organization.
  const existingMapping = await db.scimUserMapping.findFirst({
    where: { organizationId: auth.organizationId, OR: [{ externalId: body.externalId ?? "" }, { user: { email } }] },
    include: { user: true },
  });
  if (existingMapping) {
    return scimError("User already exists.", 409, "uniqueness");
  }

  // Reuse a global user record by email if present, otherwise create one.
  let user = await db.user.findUnique({ where: { email } });
  if (!user) {
    user = await db.user.create({
      data: { email, name, ssoOnly: true, jitProvisionedFrom: `scim:${auth.organizationId}`, emailVerifiedAt: new Date() },
    });
  } else if (!user.name && name) {
    user = await db.user.update({ where: { id: user.id }, data: { name } });
  }

  // Membership in the organization.
  await db.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: auth.organizationId, userId: user.id } },
    update: {},
    create: { organizationId: auth.organizationId, userId: user.id, role: "VIEWER" },
  });

  const mapping = await db.scimUserMapping.create({
    data: {
      organizationId: auth.organizationId,
      userId: user.id,
      externalId: body.externalId ?? user.id,
      active,
    },
  });

  await db.organizationAuditLog.create({
    data: {
      organizationId: auth.organizationId,
      action: "scim_user_created",
      category: "scim",
      metadata: { mappingId: mapping.id, ...minimizedScimUserMetadata({ externalId: mapping.externalId, userName: email, active, operation: "create" }) },
    },
  });

  return scimResponse(
    toScimUser({
      id: mapping.id,
      externalId: mapping.externalId,
      email: user.email,
      name: user.name,
      active,
      createdAt: mapping.createdAt,
      updatedAt: mapping.updatedAt,
      baseUrl: baseUrl(request),
    }),
    { status: 201 },
  );
}
