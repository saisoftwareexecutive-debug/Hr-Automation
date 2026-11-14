import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import {
  createSessionCookieValue,
  SessionData,
  SESSION_COOKIE_NAME,
} from '@/lib/auth';
import {
  getUserByEmail,
  isLoginRateLimited,
  logAuditEvent,
  recordLoginAttempt,
  updateLastLogin,
} from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, rememberMe } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // 1. Check Rate Limiting (Brute-force protection)
    const rateLimitCheck = await isLoginRateLimited(cleanEmail);
    if (rateLimitCheck.isLimited) {
      await logAuditEvent(cleanEmail, 'LOGIN_RATE_LIMITED', 'auth', undefined, {
        retryAfterMinutes: rateLimitCheck.retryAfterMinutes,
      });
      return NextResponse.json(
        {
          success: false,
          error: `Too many failed login attempts. Please try again after ${rateLimitCheck.retryAfterMinutes || 15} minutes.`,
        },
        { status: 429 }
      );
    }

    // 2. Fetch User from Database
    const user = await getUserByEmail(cleanEmail);
    if (!user) {
      await recordLoginAttempt(cleanEmail, false);
      await logAuditEvent(cleanEmail, 'LOGIN_FAILED_UNKNOWN_EMAIL', 'auth', undefined, {});
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // 3. Check Account Active Status
    if (!user.is_active) {
      await recordLoginAttempt(cleanEmail, false);
      await logAuditEvent(cleanEmail, 'LOGIN_BLOCKED_DEACTIVATED', 'auth', user.id, {});
      return NextResponse.json(
        {
          success: false,
          error: 'Your account has been deactivated. Please contact your company administrator.',
        },
        { status: 403 }
      );
    }

    // 4. Verify Password Hash with bcrypt
    const passwordMatch = bcrypt.compareSync(password, user.password_hash);
    if (!passwordMatch) {
      await recordLoginAttempt(cleanEmail, false);
      await logAuditEvent(cleanEmail, 'LOGIN_FAILED_BAD_PASSWORD', 'auth', user.id, {});
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // 5. Successful Authentication
    await recordLoginAttempt(cleanEmail, true);
    await updateLastLogin(user.id);

    const now = Date.now();
    const sessionData: SessionData = {
      userId: user.id,
      email: user.email,
      name: user.full_name,
      role: user.role,
      loginTime: now,
      lastActiveTime: now,
      mustChangePassword: user.must_change_password || false,
    };

    const cookieValue = createSessionCookieValue(sessionData);
    const cookieStore = await cookies();

    // Session duration: 30 days if rememberMe, otherwise 24 hours
    const maxAge = rememberMe ? 30 * 24 * 3600 : 24 * 3600;

    cookieStore.set(SESSION_COOKIE_NAME, cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge,
    });

    await logAuditEvent(user.email, 'USER_LOGIN_SUCCESS', 'user', user.id, {
      role: user.role,
      mustChangePassword: user.must_change_password,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        must_change_password: user.must_change_password || false,
      },
    });
  } catch (err: any) {
    console.error('Login processing error:', err);
    return NextResponse.json(
      { success: false, error: 'Authentication failed due to internal server error' },
      { status: 500 }
    );
  }
}
