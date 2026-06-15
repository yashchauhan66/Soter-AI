import { z } from "zod";
import { db } from "@/lib/db";
import {
  applyUserPatch,
  authorizeScimRequest,
  parsePatchPayload,
  scimBaseUrl,
  scimError,
  ScimError,
  scimResponse,
  toScimUser,
  minimizedScimUserMetadata,
} from "@/lib/enterprise/scim";

export const dynamic = "force-dynamic";

const updateUserSchema = z.object({
  userName: z.string().min(3).max(255).optional(),
  active: z.boolean().optional(),
  name: z
    .object({
      givenName: z.string().max(255).optional(),
      familyName: z.string().max(255).optional(),
      formatted: z.string().max(255).optional(),
    })
    .optional(),
  emails: z.array(z.object({ value: z.string().email(), primary: z.boolean().optional(), type: z.string().optional() })).optional(),
});

async function getMapping(organizationId: string, id: string) {
  return db.scimUserMapping.findFirst({
    where: { id, organizationId },
    include: { user: true },
  });
}

async function groupsForUser(organizationId: string, mappingId: string) {
  const groups = await db.scimGroupMapping.findMany({ where: { organizationId }, orderBy: { displayName: "asc" } });
  return groups
    .filter((group) => Array.isArray(group.members) && (group.members as Array<{ value?: string }>).some((member) => member.value === mappingId))
    .map((group) => ({ value: group.id, display: group.displayName }));
}

async function setMembershipActive(organizationId: string, userId: string, active: boolean) {
  if (active) {
    await db.organizationMember.upsert({
      where: { organizationId_userId: { organizationId, userId } },
      update: {},
      create: { organizationId, userId, role: "VIEWER" },
    });
    return;
  }
  await db.organizationMember.deleteMany({ where: { organizationId, userId } });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let auth;
  try {
    auth = await authorizeScimRequest(request);
  } catch (error) {
    return scimError((error as Error).message, error instanceof ScimError ? error.status : 401);
  }
  const { id } = await params;
  const mapping = await getMapping(auth.organizationId, id);
  if (!mapping) return scimError("User not found.", 404);
  return scimResponse(
    toScimUser({
      id: mapping.id,
      externalId: mapping.externalId,
      email: mapping.user.email,
      name: mapping.user.name,
      active: mapping.active,
      createdAt: mapping.createdAt,
      updatedAt: mapping.updatedAt,
      groups: await groupsForUser(auth.organizationId, mapping.id),
      baseUrl: scimBaseUrl(request),
    }),
  );
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let auth;
  try {
    auth = await authorizeScimRequest(request);
  } catch (error) {
    return scimError((error as Error).message, error instanceof ScimError ? error.status : 401);
  }
  try {
    const { id } = await params;
    const mapping = await getMapping(auth.organizationId, id);
    if (!mapping) return scimError("User not found.", 404);
    const next = applyUserPatch(
      { active: mapping.active, name: mapping.user.name, email: mapping.user.email },
      parsePatchPayload(await request.json()),
    );
    if (next.email !== mapping.user.email) {
      const existing = await db.user.findUnique({ where: { email: next.email } });
      if (existing && existing.id !== mapping.userId) return scimError("Email is already in use.", 409, "uniqueness");
    }
    const [updated] = await db.$transaction([
      db.scimUserMapping.update({ where: { id: mapping.id }, data: { active: next.active } }),
      db.user.update({ where: { id: mapping.userId }, data: { email: next.email, name: next.name } }),
      db.organizationAuditLog.create({
        data: {
          organizationId: auth.organizationId,
          action: next.active ? "scim_user_updated" : "scim_user_deprovisioned",
          category: "scim",
          metadata: {
            mappingId: mapping.id,
            ...minimizedScimUserMetadata({
              externalId: mapping.externalId,
              userName: next.email,
              active: next.active,
              operation: "patch",
            }),
          },
        },
      }),
    ]);
    await setMembershipActive(auth.organizationId, mapping.userId, next.active);
    const user = await db.user.findUniqueOrThrow({ where: { id: mapping.userId } });
    return scimResponse(
      toScimUser({
        id: updated.id,
        externalId: updated.externalId,
        email: user.email,
        name: user.name,
        active: updated.active,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        groups: await groupsForUser(auth.organizationId, updated.id),
        baseUrl: scimBaseUrl(request),
      }),
    );
  } catch (error) {
    return scimError((error as Error).message, error instanceof ScimError ? error.status : 400, error instanceof ScimError ? error.scimType : "invalidValue");
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let auth;
  try {
    auth = await authorizeScimRequest(request);
  } catch (error) {
    return scimError((error as Error).message, error instanceof ScimError ? error.status : 401);
  }
  try {
    const { id } = await params;
    const mapping = await getMapping(auth.organizationId, id);
    if (!mapping) return scimError("User not found.", 404);
    const body = updateUserSchema.parse(await request.json());
    const email = (body.emails?.[0]?.value ?? body.userName ?? mapping.user.email).toLowerCase();
    const name = (body.name?.formatted ?? [body.name?.givenName, body.name?.familyName].filter(Boolean).join(" ").trim()) || mapping.user.name;
    const active = body.active ?? mapping.active;
    await db.user.update({ where: { id: mapping.userId }, data: { email, name } });
    const updated = await db.scimUserMapping.update({ where: { id: mapping.id }, data: { active } });
    await setMembershipActive(auth.organizationId, mapping.userId, active);
    await db.organizationAuditLog.create({
      data: {
        organizationId: auth.organizationId,
        action: "scim_user_replaced",
        category: "scim",
        metadata: {
          mappingId: mapping.id,
          ...minimizedScimUserMetadata({ externalId: mapping.externalId, userName: email, active, operation: "replace" }),
        },
      },
    });
    return scimResponse(
      toScimUser({
        id: updated.id,
        externalId: updated.externalId,
        email,
        name,
        active,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        groups: await groupsForUser(auth.organizationId, updated.id),
        baseUrl: scimBaseUrl(request),
      }),
    );
  } catch (error) {
    return scimError((error as Error).message, 400, "invalidValue");
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let auth;
  try {
    auth = await authorizeScimRequest(request);
  } catch (error) {
    return scimError((error as Error).message, error instanceof ScimError ? error.status : 401);
  }
  const { id } = await params;
  const mapping = await getMapping(auth.organizationId, id);
  if (!mapping) return scimError("User not found.", 404);
  await db.scimUserMapping.update({ where: { id: mapping.id }, data: { active: false } });
  await setMembershipActive(auth.organizationId, mapping.userId, false);
  await db.organizationAuditLog.create({
    data: {
      organizationId: auth.organizationId,
      action: "scim_user_deprovisioned",
      category: "scim",
      metadata: {
        mappingId: mapping.id,
        ...minimizedScimUserMetadata({
          externalId: mapping.externalId,
          userName: mapping.user.email,
          active: false,
          operation: "delete",
        }),
      },
    },
  });
  return new Response(null, { status: 204 });
}
