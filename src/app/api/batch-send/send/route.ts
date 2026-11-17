import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { batchSendConfirm } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { applicationId, mode, recipientPhone, messageBody } = body;

    if (!applicationId || !mode || !recipientPhone) {
      return NextResponse.json(
        { success: false, error: 'applicationId, mode, and recipientPhone are required' },
        { status: 400 }
      );
    }

    const result = await batchSendConfirm({
      applicationId,
      mode: mode === 'reminder' ? 'reminder' : 'screening',
      recipientPhone,
      messageBody,
      authorName: session.name,
      authorEmail: session.email,
      userRole: session.role,
      userId: session.userId,
    });

    if (!result.success) {
      if (result.conflict) {
        return NextResponse.json(
          {
            success: false,
            conflict: true,
            currentStatus: result.currentStatus,
            changedBy: result.changedBy,
            error: result.error || 'Candidate was already updated by another user',
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to record batch send' },
        { status: result.error?.includes('Unauthorized') ? 403 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      application: result.application,
    });
  } catch (err: any) {
    console.error('Batch send confirm API error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
