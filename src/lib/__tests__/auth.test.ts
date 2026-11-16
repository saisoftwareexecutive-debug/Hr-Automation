import { describe, it, expect } from 'vitest';
import { createSessionCookieValue, decodeSessionCookieValue, SessionData } from '../auth';
import {
  recordLoginAttempt,
  isLoginRateLimited,
  getUserByEmail,
  changeUserPassword,
} from '../db';
import bcrypt from 'bcryptjs';

describe('Auth & Session System', () => {
  it('correctly encodes and decodes session cookies', () => {
    const session: SessionData = {
      userId: 'user-admin-1',
      email: 'admin@hireflow.internal',
      name: 'Rajesh Sharma',
      role: 'admin',
      loginTime: Date.now(),
      lastActiveTime: Date.now(),
      mustChangePassword: false,
    };

    const cookieValue = createSessionCookieValue(session);
    expect(typeof cookieValue).toBe('string');
    expect(cookieValue.length).toBeGreaterThan(10);

    const decoded = decodeSessionCookieValue(cookieValue);
    expect(decoded).not.toBeNull();
    expect(decoded?.email).toBe('admin@hireflow.internal');
    expect(decoded?.role).toBe('admin');
    expect(decoded?.name).toBe('Rajesh Sharma');
  });

  it('verifies seeded user passwords using bcrypt', async () => {
    // Admin user seeded with admin123
    const adminUser = await getUserByEmail('admin@hireflow.internal');
    expect(adminUser).toBeDefined();
    expect(adminUser?.password_hash).toBeDefined();

    const isMatch = await bcrypt.compare('admin123', adminUser!.password_hash);
    expect(isMatch).toBe(true);

    const wrongMatch = await bcrypt.compare('wrongpassword', adminUser!.password_hash);
    expect(wrongMatch).toBe(false);
  });

  it('verifies Pallavi Mali account with custom login ID Pallavimali@123 and hr_executive role', async () => {
    // Exact ID
    const userExact = await getUserByEmail('Pallavimali@123');
    expect(userExact).toBeDefined();
    expect(userExact?.full_name).toBe('Pallavi Mali');
    expect(userExact?.role).toBe('hr_executive');
    expect(userExact?.is_active).toBe(true);

    // Case-insensitive ID
    const userLower = await getUserByEmail('pallavimali@123');
    expect(userLower).toBeDefined();
    expect(userLower?.id).toBe(userExact?.id);

    // Password hash exists and is valid format
    expect(userExact?.password_hash).toBeDefined();
    expect(typeof userExact?.password_hash).toBe('string');
    expect(userExact?.password_hash.startsWith('$2')).toBe(true);

    // Role boundary: not admin
    expect(userExact?.role).not.toBe('admin');
  });

  it('implements login rate limiting after 5 failed attempts', async () => {
    const testEmail = `ratelimit_${Date.now()}@hireflow.internal`;

    // Initially not rate limited
    const initialCheck = await isLoginRateLimited(testEmail);
    expect(initialCheck.isLimited).toBe(false);

    // Record 4 failed attempts
    for (let i = 0; i < 4; i++) {
      await recordLoginAttempt(testEmail, false);
    }
    const checkAfter4 = await isLoginRateLimited(testEmail);
    expect(checkAfter4.isLimited).toBe(false);

    // Record 5th failed attempt -> locks account
    await recordLoginAttempt(testEmail, false);
    const checkAfter5 = await isLoginRateLimited(testEmail);
    expect(checkAfter5.isLimited).toBe(true);
    expect(checkAfter5.retryAfterMinutes).toBeGreaterThan(0);
  });
});
