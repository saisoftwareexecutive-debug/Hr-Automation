import { NextRequest, NextResponse } from 'next/server';
import { restoreCandidates } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { backup } = body;
    if (!backup || !backup.candidates) {
      return NextResponse.json({ success: false, error: 'Missing candidate backup data' }, { status: 400 });
    }

    const success = await restoreCandidates(backup, session.email);
    return NextResponse.json({
      success,
      message: success ? 'Candidates restored successfully.' : 'Failed to restore candidates.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

