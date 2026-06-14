import { z } from "zod";
import { db } from "@/lib/db";
import {
  authorizeScimRequest,
  deriveRoleFromGroupName,
  scimBaseUrl,
  scimError,
  scimGroupMembersFromValue,
  ScimError,
  scimResponse,
  SCIM_LIST_RESPONSE,
  toScimGroup,
} from "@/lib/enterprise/scim";
import type { OrgRole } from "@prisma/client";

export const dynamic = "force-dynamic";

const createGroupSchema = z.object({
  displayName: z.string().min(1).max(255),
  externalId: z.string().max(255).optional(),
  members: z.array(z.object({ value: z.string().min(1), display: z.string().optional(), type: z.string().optional() })).optional(),
});

async function applyGroupRole(organizationId: string, members: Array<{ value: string }>, role: OrgRole = "VIEWER") {
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
  const displayNameMatch = filter.match(/displayName\s+eq\s+\"([^\"]+)\"/i);
  const externalIdMatch = filter.match(/externalId\s+eq\s+\"([^\"]+)\"/i);
  const groups = await db.scimGroupMapping.findMany({
    where: {
      organizationId: auth.organizationId,
      ...(externalIdMatch ? { externalId: externalIdMatch[1] } : {}),
      ...(displayNameMatch ? { displayName: displayNameMatch[1] } : {}),
    },
    orderBy: { createdAt: "asc" },
  });
  const slice = groups.slice(startIndex - 1, startIndex - 1 + count);
  return scimResponse({
    schemas: [SCIM_LIST_RESPONSE],
    totalResults: groups.length,
    startIndex,
    itemsPerPage: slice.length,
    Resources: slice.map((group) =>
      toScimGroup({
        id: group.id,
        externalId: group.externalId,
        displayName: group.displayName,
        members: Array.isArray(group.members) ? (group.members as Array<{ value: string; display?: string }>) : [],
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
        baseUrl: scimBaseUrl(request),
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
  try {
    const body = createGroupSchema.parse(await request.json());
    const members = scimGroupMembersFromValue(body.members ?? []);
    const existing = await db.scimGroupMapping.findFirst({
      where: { organizationId: auth.organizationId, OR: [{ externalId: body.externalId ?? "" }, { displayName: body.displayName }] },
    });
    if (existing) return scimError("Group already exists.", 409, "uniqueness");
    const role = deriveRoleFromGroupName(body.displayName);
    const group = await db.scimGroupMapping.create({
      data: {
        organizationId: auth.organizationId,
        externalId: body.externalId ?? body.displayName,
        displayName: body.displayName,
        role,
        members,
      },
    });
    await applyGroupRole(auth.organizationId, members, role);
    await db.organizationAuditLog.create({
      data: {
        organizationId: auth.organizationId,
        action: "scim_group_created",
        category: "scim",
        metadata: { groupId: group.id, displayName: group.displayName, role },
      },
    });
    return scimResponse(
      toScimGroup({
        id: group.id,
        externalId: group.externalId,
        displayName: group.displayName,
        members,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
        baseUrl: scimBaseUrl(request),
      }),
      { status: 201 },
    );
  } catch (error) {
    return scimError((error as Error).message, 400, "invalidValue");
  }
}
