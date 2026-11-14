import { NextRequest, NextResponse } from 'next/server';
import { restoreJob } from '@/lib/db';
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
    if (!backup || !backup.job) {
      return NextResponse.json({ success: false, error: 'Missing job backup data' }, { status: 400 });
    }

    const success = await restoreJob(backup, session.email);
    return NextResponse.json({ success, message: success ? 'Job restored successfully.' : 'Failed to restore job.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

