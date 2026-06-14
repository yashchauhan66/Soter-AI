// Re-exports the public RBAC surface so callers can `import { hasPermission, requirePermission } from "@/lib/auth/rbac"`.
export { hasPermission, permissionsFor, ALL_PERMISSIONS, isElevatedRole } from "./permissions";
export type { Permission } from "./permissions";
export {
  AuthError,
  ForbiddenError,
  NotFoundError,
  requireUser,
  requireAdmin,
  requireOrganizationAccess,
  requireProjectAccess,
  requirePermission,
  requireProjectPermission,
  getActiveOrganization,
  getScopedProject,
  getScopedLogs,
} from "./guards";
export type { SessionUser } from "./guards";
