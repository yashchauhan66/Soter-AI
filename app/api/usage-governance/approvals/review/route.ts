import { NextResponse } from 'next/server';
import { requireOrganizationAccess, requireUser } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { reviewApprovalRequest } from '@/lib/usage-governance';

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const formData = await request.formData();
    const requestId = String(formData.get('requestId') ?? '');
    const status = String(formData.get('status') ?? 'APPROVED') as 'APPROVED' | 'DENIED';
    const decisionReason = String(formData.get('decisionReason') ?? '') || undefined;

    const approvalRequest = await db.aiUsageApprovalRequest.findUnique({
      where: { id: requestId },
      select: { organizationId: true },
    });
    if (!approvalRequest) throw new Error('Governance approval request not found.');
    await requireOrganizationAccess(approvalRequest.organizationId);

    await reviewApprovalRequest(requestId, user.id, status, decisionReason);

    return NextResponse.redirect(new URL('/dashboard/usage-governance/approvals', request.url));
  } catch (error) {
    console.error('[SoterAI] Governance approval review error:', error);
    return NextResponse.json(
      { error: true, message: 'Failed to review approval request.' },
      { status: 500 },
    );
  }
}
