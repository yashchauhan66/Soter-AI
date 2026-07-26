import type { Organization } from "@prisma/client";
import { ForbiddenError } from "./errors";

export type AuthorizationActor = { id: string; isAdmin: boolean };
type OrganizationAvailability = Pick<Organization, "disabled">;
type ProjectAvailability = { disabledAt: Date | null };

/**
 * Builds the membership scope used to choose a user's active organization.
 * Suspended tenants are invisible to ordinary users, while platform admins keep
 * access for recovery and support operations.
 */
export function buildActiveMembershipWhere(user: AuthorizationActor, organizationId?: string | null) {
  return {
    userId: user.id,
    ...(organizationId ? { organizationId } : {}),
    ...(!user.isAdmin ? { organization: { disabled: false } } : {}),
  };
}

/** Fail closed without exposing the private administrative suspension reason. */
export function assertOrganizationAvailable(org: OrganizationAvailability, user: AuthorizationActor): void {
  if (org.disabled && !user.isAdmin) {
    throw new ForbiddenError("This organization is currently unavailable.");
  }
}

/** Fail closed without exposing the private administrative suspension reason. */
export function assertProjectAvailable(project: ProjectAvailability, user: AuthorizationActor): void {
  if (project.disabledAt && !user.isAdmin) {
    throw new ForbiddenError("This project is currently unavailable.");
  }
}