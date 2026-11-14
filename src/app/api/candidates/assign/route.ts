import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { assignApplications, autoSplitApplications } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { applicationIds, userId, userName, autoSplit } = body;

    if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one candidate must be selected' },
        { status: 400 }
      );
    }

    if (autoSplit) {
      const result = await autoSplitApplications(applicationIds, session.email);
      return NextResponse.json({ success: true, assignments: result.assignments });
    }

    if (!userId || !userName) {
      return NextResponse.json(
        { success: false, error: 'Target HR user is required' },
        { status: 400 }
      );
    }

    const result = await assignApplications(applicationIds, userId, userName, session.email);
    return NextResponse.json({ success: true, count: result.count });
  } catch (err: any) {
    console.error('Assignment API error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to assign candidates' },
      { status: 500 }
    );
  }
}

