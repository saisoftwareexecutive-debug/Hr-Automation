import { NextRequest, NextResponse } from 'next/server';
import { updateJob, updateScoringRules, deleteJob, closeJob } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const { scoring_rules, ...jobUpdates } = body;

    if (jobUpdates.location && typeof jobUpdates.location === 'string' && jobUpdates.location.trim().length > 200) {
      return NextResponse.json(
        { success: false, error: 'Location must be 200 characters or fewer' },
        { status: 400 }
      );
    }

    if (jobUpdates.map_url && typeof jobUpdates.map_url === 'string' && jobUpdates.map_url.trim()) {
      const trimmedUrl = jobUpdates.map_url.trim();
      if (!trimmedUrl.startsWith('https://')) {
        return NextResponse.json(
          { success: false, error: 'Google Maps link must be a valid https URL' },
          { status: 400 }
        );
      }
    }

    const updatedJob = await updateJob(id, jobUpdates);
    if (!updatedJob) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
    }

    if (scoring_rules) {
      await updateScoringRules(id, scoring_rules);
    }

    return NextResponse.json({ success: true, job: updatedJob });
  } catch (err: any) {
    console.error('Update job error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to update job' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = getSessionFromRequest(req);
    if (!session || session.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required for destructive actions.' },
        { status: 403 }
      );
    }

    const url = new URL(req.url);
    const deleteApplicants = url.searchParams.get('deleteApplicants') === 'true';

    const result = await deleteJob(id, {
      deleteApplicants,
      adminEmail: session.email,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Job deleted successfully.',
      deletedJob: result.deletedJob,
      deletedApplications: result.deletedApplications,
    });
  } catch (err: any) {
    console.error('Delete job error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to delete job' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = getSessionFromRequest(req);
    if (!session || session.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    if (body.action === 'close') {
      const closed = await closeJob(id, session.email);
      return NextResponse.json({ success: true, job: closed });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
