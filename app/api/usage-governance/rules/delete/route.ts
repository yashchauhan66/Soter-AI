import { NextResponse } from 'next/server';
import { requireOrganizationAccess, requireUser } from '@/lib/auth/guards';
import { db } from '@/lib/db';
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
    if (!rule) throw new Error('Governance provider rule not found.');
    await requireOrganizationAccess(rule.policy.organizationId);
    await removeProviderRule(ruleId);
    return NextResponse.redirect(new URL('/dashboard/usage-governance/providers', request.url));
  } catch (error) {
    console.error('[SoterAI] Governance rule delete error:', error);
    return NextResponse.json({ error: true, message: 'Failed to delete rule.' }, { status: 500 });
  }
}
