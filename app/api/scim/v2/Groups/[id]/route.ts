import { db } from "@/lib/db";
import {
  applyGroupPatch,
  authorizeScimRequest,
  deriveRoleFromGroupName,
  parsePatchPayload,
  scimBaseUrl,
  scimError,
  ScimError,
  scimResponse,
  toScimGroup,
} from "@/lib/enterprise/scim";
import type { OrgRole } from "@prisma/client";

export const dynamic = "force-dynamic";

async function getGroup(organizationId: string, id: string) {
  return db.scimGroupMapping.findFirst({ where: { id, organizationId } });
}

function membersFromStored(value: unknown): Array<{ value: string; display?: string }> {
  return Array.isArray(value) ? (value as Array<{ value: string; display?: string }>) : [];
}

async function syncMembersToRole(organizationId: string, members: Array<{ value: string }>, role: OrgRole) {
  const mappings = await db.scimUserMapping.findMany({
    where: { organizationId, id: { in: members.map((member) => member.value) }, active: true },
    select: { userId: true },
  });
  await Promise.all(
    mappings.map((mapping) =>
      db.organizationMember.upsert({
        where: { organizationId_userId: { organizationId, userId: mapping.userId } },
        update: { role },
        create: { organizationId, userId: mapping.userId, role },
      }),
    ),
  );
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let auth;
  try {
    auth = await authorizeScimRequest(request);
  } catch (error) {
    return scimError((error as Error).message, error instanceof ScimError ? error.status : 401);
  }
  const { id } = await params;
  const group = await getGroup(auth.organizationId, id);
  if (!group) return scimError("Group not found.", 404);
  return scimResponse(
    toScimGroup({
      id: group.id,
      externalId: group.externalId,
      displayName: group.displayName,
      members: membersFromStored(group.members),
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
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
    const group = await getGroup(auth.organizationId, id);
    if (!group) return scimError("Group not found.", 404);
    const next = applyGroupPatch(
      { displayName: group.displayName, members: membersFromStored(group.members) },
      parsePatchPayload(await request.json()),
    );
    const role = deriveRoleFromGroupName(next.displayName);
    const updated = await db.scimGroupMapping.update({
      where: { id: group.id },
      data: { displayName: next.displayName, members: next.members, role },
    });
    await syncMembersToRole(auth.organizationId, next.members, role);
    await db.organizationAuditLog.create({
      data: {
        organizationId: auth.organizationId,
        action: "scim_group_updated",
        category: "scim",
        metadata: { groupId: group.id, displayName: next.displayName, role },
      },
    });
    return scimResponse(
      toScimGroup({
        id: updated.id,
        externalId: updated.externalId,
        displayName: updated.displayName,
        members: membersFromStored(updated.members),
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        baseUrl: scimBaseUrl(request),
      }),
    );
  } catch (error) {
    return scimError((error as Error).message, error instanceof ScimError ? error.status : 400, error instanceof ScimError ? error.scimType : "invalidValue");
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
  const group = await getGroup(auth.organizationId, id);
  if (!group) return scimError("Group not found.", 404);
  await db.scimGroupMapping.delete({ where: { id: group.id } });
  await db.organizationAuditLog.create({
    data: {
      organizationId: auth.organizationId,
      action: "scim_group_deleted",
      category: "scim",
      metadata: { groupId: group.id, displayName: group.displayName },
    },
  });
  return new Response(null, { status: 204 });
}
