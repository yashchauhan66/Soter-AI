// Phase 6: SCIM v2 — server-side helpers.
// Reference: RFC 7643 (Schemas) and RFC 7644 (Protocol).
// Defensive-only:
//   * SCIM tokens are bearer credentials — hashed at rest with a pepper.
//   * Every request is bound to one organization. Cross-org reads/writes
//     return 403 / 404 to avoid leaking existence.
//   * Token compare is constant-time.

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import type { OrgRole } from "@prisma/client";
import { db } from "../db";

function pepper(): string {
  const value = process.env.SCIM_TOKEN_PEPPER ?? process.env.API_KEY_PEPPER;
  if (!value || value.length < 24) throw new Error("SCIM_TOKEN_PEPPER or API_KEY_PEPPER must contain at least 24 characters.");
  return value;
}

export function generateScimToken() {
  const rawToken = `scim_${randomBytes(32).toString("base64url")}`;
  return { rawToken, tokenHash: hashScimToken(rawToken), tokenPreview: `${rawToken.slice(0, 10)}...${rawToken.slice(-4)}` };
}

export function hashScimToken(token: string): string {
  return createHash("sha256").update(`${pepper()}:${token}`).digest("hex");
}

export function constantTimeEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export interface AuthorizedScim {
  organizationId: string;
  tokenId: string;
}

export async function authorizeScimRequest(request: Request): Promise<AuthorizedScim> {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    throw new ScimError("Bearer token required.", 401);
  }
  const token = authHeader.slice(7).trim();
  if (!token) throw new ScimError("Empty bearer token.", 401);
  const tokenHash = hashScimToken(token);
  const record = await db.scimToken.findUnique({ where: { tokenHash } });
  if (!record) throw new ScimError("SCIM token is invalid.", 401);
  if (record.revokedAt) throw new ScimError("SCIM token revoked.", 401);
  if (record.expiresAt && record.expiresAt < new Date()) throw new ScimError("SCIM token expired.", 401);
  // Constant-time hash compare adds defence even though findUnique already
  // matches by hash.
  if (!constantTimeEquals(record.tokenHash, tokenHash)) throw new ScimError("SCIM token mismatch.", 401);
  await db.scimToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
  return { organizationId: record.organizationId, tokenId: record.id };
}

export class ScimError extends Error {
  constructor(message: string, public status: number = 400, public scimType?: string) {
    super(message);
    this.name = "ScimError";
  }
}

export const SCIM_USER_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User";
export const SCIM_GROUP_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:Group";
export const SCIM_ENTERPRISE_USER_SCHEMA = "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User";
export const SCIM_LIST_RESPONSE = "urn:ietf:params:scim:api:messages:2.0:ListResponse";
export const SCIM_PATCH_OP = "urn:ietf:params:scim:api:messages:2.0:PatchOp";
export const SCIM_ERROR = "urn:ietf:params:scim:api:messages:2.0:Error";

export function scimError(message: string, status = 400, scimType?: string) {
  return Response.json(
    { schemas: [SCIM_ERROR], detail: message, status: String(status), scimType },
    { status, headers: { "content-type": "application/scim+json" } },
  );
}

export function scimResponse(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers ?? {});
  headers.set("content-type", "application/scim+json");
  return new Response(JSON.stringify(body), { ...init, headers });
}

export interface ScimUserResource {
  schemas: string[];
  id: string;
  externalId?: string | null;
  userName: string;
  active: boolean;
  name?: { givenName?: string; familyName?: string; formatted?: string };
  emails: Array<{ value: string; primary?: boolean; type?: string }>;
  groups?: Array<{ value: string; display?: string }>;
  meta: { resourceType: "User"; created: string; lastModified: string; location: string };
}

export function scimBaseUrl(request: Request): string {
  const url = new URL(request.url);
  return process.env.NEXTAUTH_URL ?? `${url.protocol}//${url.host}`;
}

export function toScimUser(input: {
  id: string;
  externalId: string | null;
  email: string;
  name: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  groups?: Array<{ value: string; display?: string }>;
  baseUrl: string;
}): ScimUserResource {
  const [givenName, ...rest] = (input.name ?? "").split(" ");
  return {
    schemas: [SCIM_USER_SCHEMA],
    id: input.id,
    externalId: input.externalId,
    userName: input.email,
    active: input.active,
    name: input.name
      ? { givenName, familyName: rest.join(" ") || undefined, formatted: input.name }
      : undefined,
    emails: [{ value: input.email, primary: true, type: "work" }],
    groups: input.groups,
    meta: {
      resourceType: "User",
      created: input.createdAt.toISOString(),
      lastModified: input.updatedAt.toISOString(),
      location: `${input.baseUrl}/api/scim/v2/Users/${input.id}`,
    },
  };
}

export interface ScimGroupResource {
  schemas: string[];
  id: string;
  displayName: string;
  externalId?: string | null;
  members: Array<{ value: string; display?: string; type?: string }>;
  meta: { resourceType: "Group"; created: string; lastModified: string; location: string };
}

export function toScimGroup(input: {
  id: string;
  externalId: string | null;
  displayName: string;
  members: Array<{ value: string; display?: string }>;
  createdAt: Date;
  updatedAt: Date;
  baseUrl: string;
}): ScimGroupResource {
  return {
    schemas: [SCIM_GROUP_SCHEMA],
    id: input.id,
    externalId: input.externalId,
    displayName: input.displayName,
    members: input.members.map((member) => ({ ...member, type: "User" })),
    meta: {
      resourceType: "Group",
      created: input.createdAt.toISOString(),
      lastModified: input.updatedAt.toISOString(),
      location: `${input.baseUrl}/api/scim/v2/Groups/${input.id}`,
    },
  };
}

export interface ScimPatchOperation {
  op: "add" | "remove" | "replace";
  path?: string;
  value?: unknown;
}

export function parsePatchPayload(body: unknown): ScimPatchOperation[] {
  if (!body || typeof body !== "object") throw new ScimError("Invalid PATCH body.");
  const obj = body as { schemas?: string[]; Operations?: unknown };
  if (!Array.isArray(obj.Operations)) throw new ScimError("PATCH must include Operations array.");
  return obj.Operations.map((op) => {
    if (!op || typeof op !== "object") throw new ScimError("Invalid PATCH operation.");
    const o = op as Record<string, unknown>;
    const opType = String(o.op ?? "").toLowerCase();
    if (!["add", "remove", "replace"].includes(opType)) {
      throw new ScimError(`Unsupported PATCH op: ${o.op}`);
    }
    return { op: opType as ScimPatchOperation["op"], path: typeof o.path === "string" ? o.path : undefined, value: o.value };
  });
}

export function applyUserPatch(
  current: { active: boolean; name: string | null; email: string },
  ops: ScimPatchOperation[],
): { active: boolean; name: string | null; email: string } {
  let next = { ...current };
  for (const op of ops) {
    if (op.op === "replace" && (op.path === "active" || (!op.path && typeof op.value === "object"))) {
      const value = op.path === "active" ? op.value : (op.value as Record<string, unknown>)?.active;
      if (typeof value === "boolean") next.active = value;
      if (!op.path && typeof op.value === "object") {
        const obj = op.value as Record<string, unknown>;
        if (typeof obj.userName === "string") next.email = obj.userName.toLowerCase();
        if (typeof obj.displayName === "string") next.name = obj.displayName;
        if (typeof obj.active === "boolean") next.active = obj.active;
        if (obj.name && typeof obj.name === "object") {
          const name = obj.name as Record<string, unknown>;
          const formatted = typeof name.formatted === "string" ? name.formatted : [name.givenName, name.familyName].filter((value) => typeof value === "string").join(" ");
          if (formatted) next.name = formatted;
        }
        if (Array.isArray(obj.emails) && obj.emails[0] && typeof obj.emails[0] === "object") {
          const email = (obj.emails[0] as Record<string, unknown>).value;
          if (typeof email === "string") next.email = email.toLowerCase();
        }
      }
    }
    if (op.op === "remove" && op.path === "active") next.active = false;
    if (op.op === "replace" && op.path === "userName" && typeof op.value === "string") next.email = op.value.toLowerCase();
    if (op.op === "replace" && op.path === "displayName" && typeof op.value === "string") next.name = op.value;
    if (op.op === "replace" && op.path === "name" && op.value && typeof op.value === "object") {
      const value = op.value as Record<string, unknown>;
      const formatted = typeof value.formatted === "string" ? value.formatted : [value.givenName, value.familyName].filter((part) => typeof part === "string").join(" ");
      if (formatted) next.name = formatted;
    }
    if (op.op === "replace" && op.path === "emails" && Array.isArray(op.value) && op.value[0] && typeof op.value[0] === "object") {
      const email = (op.value[0] as Record<string, unknown>).value;
      if (typeof email === "string") next.email = email.toLowerCase();
    }
  }
  return next;
}

export function scimGroupMembersFromValue(value: unknown): Array<{ value: string; display?: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .filter((member): member is Record<string, unknown> => Boolean(member) && typeof member === "object")
    .map((member) => ({
      value: String(member.value ?? member.$ref ?? ""),
      display: typeof member.display === "string" ? member.display : undefined,
    }))
    .filter((member) => member.value.length > 0);
}

export function applyGroupPatch(
  current: { displayName: string; members: Array<{ value: string; display?: string }> },
  ops: ScimPatchOperation[],
): { displayName: string; members: Array<{ value: string; display?: string }> } {
  let next = { displayName: current.displayName, members: [...current.members] };
  for (const op of ops) {
    const path = op.path?.toLowerCase();
    if (op.op === "replace" && (path === "displayname" || (!path && op.value && typeof op.value === "object"))) {
      const value = path === "displayname" ? op.value : (op.value as Record<string, unknown>).displayName;
      if (typeof value === "string" && value.trim()) next.displayName = value.trim();
    }
    if ((op.op === "replace" || op.op === "add") && (path === "members" || (!path && op.value && typeof op.value === "object"))) {
      const members = path === "members" ? scimGroupMembersFromValue(op.value) : scimGroupMembersFromValue((op.value as Record<string, unknown>).members);
      next.members = op.op === "replace" ? members : dedupeMembers([...next.members, ...members]);
    }
    if (op.op === "remove" && path?.startsWith("members")) {
      if (!op.value) {
        next.members = [];
      } else {
        const removed = new Set(scimGroupMembersFromValue(Array.isArray(op.value) ? op.value : [op.value]).map((member) => member.value));
        next.members = next.members.filter((member) => !removed.has(member.value));
      }
    }
  }
  return next;
}

function dedupeMembers(members: Array<{ value: string; display?: string }>) {
  const seen = new Set<string>();
  return members.filter((member) => {
    if (seen.has(member.value)) return false;
    seen.add(member.value);
    return true;
  });
}

export const SCIM_ROLE_FOR_DISPLAY: Record<string, OrgRole> = {
  owner: "OWNER",
  admin: "ADMIN",
  developer: "DEVELOPER",
  "security analyst": "SECURITY_ANALYST",
  security_analyst: "SECURITY_ANALYST",
  billing: "BILLING",
  viewer: "VIEWER",
};

export function deriveRoleFromGroupName(name: string): OrgRole {
  const key = name.trim().toLowerCase();
  return SCIM_ROLE_FOR_DISPLAY[key] ?? "VIEWER";
}
