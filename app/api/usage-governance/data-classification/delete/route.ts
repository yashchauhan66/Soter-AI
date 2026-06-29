import { NextResponse } from 'next/server';
import { requireOrganizationAccess, requireUser } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { removeDataClassification } from '@/lib/usage-governance';

export async function POST(request: Request) {
  try {
    await requireUser();
    const formData = await request.formData();
    const id = String(formData.get('id') ?? '');
    const classification = await db.aiUsageGovernanceDataClassification.findUnique({
      where: { id },
      select: { policy: { select: { organizationId: true } } },
    });
    if (!classification) throw new Error('Data classification not found.');
    await requireOrganizationAccess(classification.policy.organizationId);
    await removeDataClassification(id);
    return NextResponse.redirect(
      new URL('/dashboard/usage-governance/data-classification', request.url),
    );
  } catch (error) {
    console.error('[SoterAI] Governance data classification delete error:', error);
    return NextResponse.json(
      { error: true, message: 'Failed to delete classification.' },
      { status: 500 },
    );
  }
}
