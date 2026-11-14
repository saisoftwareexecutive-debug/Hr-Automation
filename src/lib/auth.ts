import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import crypto from 'crypto';
import { UserRole } from '@/types';
import { getCompanySettings, getUserByEmail, getUserById } from './db';

export const SESSION_COOKIE_NAME = 'hireflow_session';

export interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  loginTime: number;
  lastActiveTime: number;
  mustChangePassword?: boolean;
}

function getSessionSecret(): string {
  return process.env.SESSION_SECRET || process.env.AUTH_SECRET || 'hireflow-local-default-session-secret-change-in-production';
}

export function createSessionCookieValue(data: SessionData): string {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64');
  const secret = getSessionSecret();
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

export function decodeSessionCookieValue(cookieValue: string): SessionData | null {
  try {
    if (!cookieValue) return null;
    const parts = cookieValue.split('.');
    if (parts.length === 2) {
      const [payload, signature] = parts;
      const secret = getSessionSecret();
      const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      if (signature.length === expectedSignature.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        const raw = Buffer.from(payload, 'base64').toString('utf-8');
        return JSON.parse(raw) as SessionData;
      }
      return null;
    }
    // Backward compatibility for unsigned base64 sessions
    const raw = Buffer.from(cookieValue, 'base64').toString('utf-8');
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

/**
 * Retrieves the current session user with inactivity timeout verification
 */
export async function getCurrentUser(options?: { allowInactive?: boolean }): Promise<SessionData | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
    if (!sessionCookie?.value) {
      return null;
    }

    const session = decodeSessionCookieValue(sessionCookie.value);
    if (!session || !session.email) {
      return null;
    }

    // Verify inactivity timeout
    if (!options?.allowInactive) {
      const settings = await getCompanySettings();
      const timeoutMinutes = settings.inactivity_timeout_minutes || 30;
      const timeoutMs = timeoutMinutes * 60 * 1000;
      const now = Date.now();

      if (now - session.lastActiveTime > timeoutMs) {
        // Session expired due to inactivity
        return null;
      }
    }

    // Verify user is still active in database
    const dbUser = session.userId
      ? await getUserById(session.userId)
      : await getUserByEmail(session.email);

    if (dbUser && !dbUser.is_active) {
      return null;
    }

    return session;
  } catch (err) {
    console.error('Error in getCurrentUser:', err);
    return null;
  }
}

/**
 * Server-side guard: requires authenticated user, redirects to /login if unauthenticated
 */
export async function requireUser(redirectPath?: string): Promise<SessionData> {
  const user = await getCurrentUser();
  if (!user) {
    const target = redirectPath ? `/login?redirect=${encodeURIComponent(redirectPath)}` : '/login';
    redirect(target);
  }
  return user;
}

export function getSessionFromRequest(req: { cookies: { get: (name: string) => { value?: string } | undefined } }): SessionData | null {
  const cookie = req.cookies.get(SESSION_COOKIE_NAME);
  if (!cookie?.value) return null;
  return decodeSessionCookieValue(cookie.value);
}

/**
 * Server-side guard: requires Admin role
 */
export async function requireAdmin(redirectPath?: string): Promise<SessionData> {
  const user = await requireUser(redirectPath);
  if (user.role !== 'admin') {
    redirect('/?error=unauthorized_admin_only');
  }
  return user;
}
