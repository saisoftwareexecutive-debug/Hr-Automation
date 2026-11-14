import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { resetUserPassword, updateUser, deleteUser } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden. Admin role required.' }, { status: 403 });
    }

    const { id } = params;
    const updates = await req.json();

    const updatedUser = await updateUser(id, updates, session.email);
    return NextResponse.json({ success: true, user: updatedUser });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden. Admin role required.' }, { status: 403 });
    }

    const { id } = params;
    const result = await resetUserPassword(id, session.email);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden. Admin role required.' }, { status: 403 });
    }

    const { id } = params;
    const result = await deleteUser(id, session.email);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'User deleted successfully.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
