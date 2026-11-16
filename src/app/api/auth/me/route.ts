import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  createSessionCookieValue,
  getCurrentUser,
  SESSION_COOKIE_NAME,
} from '@/lib/auth';
import { getCompanySettings, getUserById } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    const dbUser = await getUserById(session.userId);
    const settings = await getCompanySettings();

    // Extend inactivity timer by updating lastActiveTime
    const now = Date.now();
    const updatedSession = {
      ...session,
      lastActiveTime: now,
      mustChangePassword: false,
    };

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, createSessionCookieValue(updatedSession), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 3600,
    });

    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.userId,
        email: session.email,
        full_name: dbUser?.full_name || session.name,
        role: dbUser?.role || session.role,
        must_change_password: false,
      },
      settings,
    });
  } catch (err: any) {
    return NextResponse.json({ authenticated: false, error: err.message }, { status: 500 });
  }
}

