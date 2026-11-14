import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createUser, getUsers } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden. Admin role required.' }, { status: 403 });
    }

    const users = await getUsers();
    return NextResponse.json({ success: true, users });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden. Admin role required.' }, { status: 403 });
    }

    const body = await req.json();
    const { email, full_name, role, temporaryPassword } = body;

    if (!email || !full_name || !role) {
      return NextResponse.json(
        { success: false, error: 'Email, Full Name, and Role are required' },
        { status: 400 }
      );
    }

    const result = await createUser(
      { email, full_name, role, temporaryPassword },
      session.email
    );

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

