import { NextResponse } from 'next/server';
import { requireOrganizationAccess, requireUser } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { removeDepartmentRule } from '@/lib/usage-governance';

export async function POST(request: Request) {
  try {
    await requireUser();
    const formData = await request.formData();
    const ruleId = String(formData.get('ruleId') ?? '');
    const rule = await db.aiUsageGovernanceDepartmentRule.findUnique({
      where: { id: ruleId },
      select: { department: { select: { policy: { select: { organizationId: true } } } } },
    });
    if (!rule) throw new Error('Governance department rule not found.');
    await requireOrganizationAccess(rule.department.policy.organizationId);
    await removeDepartmentRule(ruleId);
    return NextResponse.redirect(new URL('/dashboard/usage-governance/departments', request.url));
  } catch (error) {
    console.error('[SoterAI] Governance department rule delete error:', error);
    return NextResponse.json(
      { error: true, message: 'Failed to delete department rule.' },
      { status: 500 },
    );
  }
}
