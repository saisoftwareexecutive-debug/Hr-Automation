import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { batchSendUndo } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { applicationId, mode } = body;

    if (!applicationId || !mode) {
      return NextResponse.json(
        { success: false, error: 'applicationId and mode are required' },
        { status: 400 }
      );
    }

    const result = await batchSendUndo({
      applicationId,
      mode: mode === 'reminder' ? 'reminder' : 'screening',
      authorName: session.name,
      authorEmail: session.email,
      userRole: session.role,
      userId: session.userId,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to undo batch send' },
        { status: result.error?.includes('Unauthorized') ? 403 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      application: result.application,
    });
  } catch (err: any) {
    console.error('Batch send undo API error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
