// SECURITY: This module is the single source of truth for permission checks.
// Every dashboard route and private API must derive authorization decisions
// from `hasPermission(role, permission)`. UI hiding is never sufficient on
// its own; route handlers must call `requirePermission()` from ./guards.

import type { OrgRole } from "@prisma/client";

export const ALL_PERMISSIONS = [
  "project:create",
  "project:read",
  "project:update",
  "project:delete",
  "api_key:create",
  "api_key:read",
  "api_key:revoke",
  "logs:read",
  "reports:read",
  "reports:export",
  "webhook:create",
  "webhook:update",
  "webhook:delete",
  "billing:read",
  "billing:update",
  "agency:manage",
  "policy:manage",
  "badge:manage",
  "member:manage",
  "rag:read",
  "rag:manage",
  "feedback:create",
  "scheduled_report:manage",
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<OrgRole, Permission[]> = {
  OWNER: [...ALL_PERMISSIONS],
  ADMIN: [
    "project:create", "project:read", "project:update", "project:delete",
    "api_key:create", "api_key:read", "api_key:revoke",
    "logs:read", "reports:read", "reports:export",
    "webhook:create", "webhook:update", "webhook:delete",
    "billing:read",
    "agency:manage", "policy:manage", "badge:manage", "member:manage",
    "rag:read", "rag:manage", "feedback:create", "scheduled_report:manage",
  ],
  DEVELOPER: [
    "project:read", "project:update",
    "api_key:create", "api_key:read", "api_key:revoke",
    "logs:read",
    "webhook:create", "webhook:update", "webhook:delete",
    "policy:manage", "badge:manage",
    "rag:read", "rag:manage", "feedback:create",
  ],
  SECURITY_ANALYST: [
    "project:read",
    "logs:read", "reports:read", "reports:export",
    "policy:manage",
    "rag:read", "rag:manage", "feedback:create", "scheduled_report:manage",
  ],
  BILLING: [
    "project:read",
    "billing:read", "billing:update",
    "reports:read",
    "rag:read",
  ],
  VIEWER: [
    "project:read",
    "logs:read", "reports:read",
    "rag:read", "feedback:create",
  ],
};

export function permissionsFor(role: OrgRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function hasPermission(role: OrgRole, permission: Permission): boolean {
  return permissionsFor(role).includes(permission);
}

export function isElevatedRole(role: OrgRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}
