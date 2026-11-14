import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { changeUserPassword } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser({ allowInactive: false });
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please login again.' }, { status: 401 });
    }

    const { currentPassword, newPassword } = await req.json();
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'Current password and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: 'New password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { success: false, error: 'New password must be different from current password' },
        { status: 400 }
      );
    }

    await changeUserPassword(session.userId, currentPassword, newPassword);

    return NextResponse.json({ success: true, message: 'Password changed successfully' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to change password' }, { status: 400 });
  }
}
