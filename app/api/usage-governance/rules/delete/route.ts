import { NextResponse } from 'next/server';
import { apiError } from '@/lib/apiResponse';
import { requireOrganizationAccess, requireUser } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/auth/errors';
import { removeProviderRule } from '@/lib/usage-governance';

export async function POST(request: Request) {
  try {
    await requireUser();
    const formData = await request.formData();
    const ruleId = String(formData.get('ruleId') ?? '');
    const rule = await db.aiUsageGovernanceRule.findUnique({
      where: { id: ruleId },
      select: { policy: { select: { organizationId: true } } },
    });
    // A bare `Error` here fell through apiError's AuthError branch and became a
    // 500; NotFoundError carries the 404 the caller actually needs.
    if (!rule) throw new NotFoundError('Governance provider rule not found.');
    await requireOrganizationAccess(rule.policy.organizationId);
    await removeProviderRule(ruleId);
    return NextResponse.redirect(new URL('/dashboard/usage-governance/providers', request.url));
  } catch (error) {
    // apiError maps AuthError -> 401/403/404; a hardcoded 500 reported a tenant
    // boundary refusal as a server fault.
    return apiError(error, 'Failed to delete rule.');
  }
}
