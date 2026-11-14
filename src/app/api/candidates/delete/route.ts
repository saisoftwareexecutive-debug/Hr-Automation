import { NextRequest, NextResponse } from 'next/server';
import { deleteCandidateData, deleteCandidates } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required for destructive actions.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { candidateId, candidateIds } = body;

    if (candidateIds && Array.isArray(candidateIds) && candidateIds.length > 0) {
      const result = await deleteCandidates(candidateIds, session.email);
      return NextResponse.json({
        success: result.success,
        count: result.count,
        deleted: result.deleted,
        backup: result.deleted,
        message: `${result.count} candidate(s) deleted successfully.`,
      });
    }

    if (!candidateId) {
      return NextResponse.json({ success: false, error: 'candidateId or candidateIds is required' }, { status: 400 });
    }

    const success = await deleteCandidateData(candidateId, session.email);
    return NextResponse.json({
      success,
      message: 'Candidate data successfully erased under DPDP Act.',
    });
  } catch (err: any) {
    console.error('Delete candidate error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to erase candidate data' },
      { status: 500 }
    );
  }
}
