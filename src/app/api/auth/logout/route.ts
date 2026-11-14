import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCurrentUser, SESSION_COOKIE_NAME } from '@/lib/auth';
import { logAuditEvent } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser({ allowInactive: true });
    if (user) {
      await logAuditEvent(user.email, 'USER_LOGOUT', 'user', user.userId, {});
    }

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return NextResponse.json({ success: true, message: 'Logged out successfully' });
  } catch (err: any) {
    console.error('Logout error:', err);
    return NextResponse.json({ success: false, error: 'Logout failed' }, { status: 500 });
  }
}

