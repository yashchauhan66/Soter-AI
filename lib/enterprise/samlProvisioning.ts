// Phase 6: SAML JIT provisioning. Creates or updates the user, links them
// to the organization with the configured default role, and writes an audit
// log entry. SCIM group mappings, when configured, override the default role.

import { db } from "../db";
import type { OrgRole, SamlProvider } from "@prisma/client";
import type { SamlAssertionAttributes } from "./saml";

export interface JitProvisionResult {
  userId: string;
  email: string;
  organizationId: string;
  role: OrgRole;
  createdUser: boolean;
  createdMembership: boolean;
}

function pickRoleFromGroups(groups: string[], mapping: Map<string, OrgRole>, fallback: OrgRole): OrgRole {
  for (const group of groups) {
    const mapped = mapping.get(group);
    if (mapped) return mapped;
  }
  return fallback;
}

export async function jitProvisionFromSaml(
  provider: SamlProvider,
  attributes: SamlAssertionAttributes,
): Promise<JitProvisionResult> {
  const email = attributes.email.toLowerCase();
  if (provider.emailDomain) {
    const domain = email.split("@")[1] ?? "";
    if (domain.toLowerCase() !== provider.emailDomain.toLowerCase()) {
      throw new Error(`Email domain ${domain} is not allowed for this SAML provider.`);
    }
  }

  // Group → role mapping comes from SCIM group mappings (already tenant-scoped).
  const groupMappings = await db.scimGroupMapping.findMany({
    where: { organizationId: provider.organizationId },
  });
  const map = new Map<string, OrgRole>();
  for (const mapping of groupMappings) {
    map.set(mapping.displayName.toLowerCase(), mapping.role);
    map.set(mapping.externalId.toLowerCase(), mapping.role);
  }
  const groupsLowered = attributes.groups.map((group) => group.toLowerCase());
  const role = pickRoleFromGroups(groupsLowered, map, provider.defaultRole);

  let user = await db.user.findUnique({ where: { email } });
  let createdUser = false;
  if (!user) {
    user = await db.user.create({
      data: {
        email,
        name: attributes.name ?? null,
        ssoOnly: true,
        jitProvisionedFrom: `saml:${provider.id}`,
        emailVerifiedAt: new Date(),
      },
    });
    createdUser = true;
  } else if (!user.name && attributes.name) {
    user = await db.user.update({ where: { id: user.id }, data: { name: attributes.name } });
  }

  const existing = await db.organizationMember.findFirst({
    where: { organizationId: provider.organizationId, userId: user.id },
  });
  let createdMembership = false;
  if (!existing) {
    await db.organizationMember.create({
      data: {
        organizationId: provider.organizationId,
        userId: user.id,
        role,
      },
    });
    createdMembership = true;
  }

  await db.organizationAuditLog.create({
    data: {
      organizationId: provider.organizationId,
      action: createdUser ? "saml_jit_user_created" : "saml_login_provisioned",
      category: "auth",
      metadata: {
        userId: user.id,
        email,
        role,
        createdUser,
        createdMembership,
        groups: attributes.groups,
      },
    },
  });

  return {
    userId: user.id,
    email,
    organizationId: provider.organizationId,
    role,
    createdUser,
    createdMembership,
  };
}
