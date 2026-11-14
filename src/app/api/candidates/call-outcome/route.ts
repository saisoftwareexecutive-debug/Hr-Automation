import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { recordCallOutcome } from '@/lib/db';
import { CallOutcome, RejectionReason } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { applicationId, outcome, notes, callBackAt, rejectionReason } = body;

    if (!applicationId || !outcome) {
      return NextResponse.json(
        { success: false, error: 'Application ID and Call Outcome are required' },
        { status: 400 }
      );
    }

    const updatedApp = await recordCallOutcome({
      applicationId,
      outcome: outcome as CallOutcome,
      notes,
      callBackAt,
      rejectionReason: rejectionReason as RejectionReason,
      authorName: session.name,
      authorEmail: session.email,
    });

    return NextResponse.json({ success: true, application: updatedApp });
  } catch (err: any) {
    console.error('Call Outcome API error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to record call outcome' },
      { status: 500 }
    );
  }
}

