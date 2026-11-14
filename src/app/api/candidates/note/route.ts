import { NextRequest, NextResponse } from 'next/server';
import { addCandidateNote, deleteNote } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { applicationId, candidateId, noteText, authorName } = body;

    if (!applicationId || !candidateId || !noteText) {
      return NextResponse.json(
        { success: false, error: 'applicationId, candidateId and noteText are required' },
        { status: 400 }
      );
    }

    const note = await addCandidateNote(
      applicationId,
      candidateId,
      noteText,
      authorName || 'HR Executive'
    );

    return NextResponse.json({ success: true, note });
  } catch (err: any) {
    console.error('Add note error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to add candidate note' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const noteId = url.searchParams.get('noteId');
    if (!noteId) {
      return NextResponse.json({ success: false, error: 'noteId is required' }, { status: 400 });
    }

    const success = await deleteNote(noteId, { email: session.email, role: session.role });
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete this note. You may only delete your own notes unless you are an Admin.' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, message: 'Note deleted successfully.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
