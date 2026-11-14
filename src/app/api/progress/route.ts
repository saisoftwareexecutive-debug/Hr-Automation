import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDailyProgress } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || undefined;

    const progress = await getDailyProgress(date);
    return NextResponse.json({ success: true, ...progress });
  } catch (err: any) {
    console.error('Daily Progress API error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch progress metrics' },
      { status: 500 }
    );
  }
}

