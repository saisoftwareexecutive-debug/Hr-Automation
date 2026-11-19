import { NextRequest, NextResponse } from 'next/server';
import { saveImportedApplications, recordImportBatch, getImportBatches, deleteImportBatch } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { Application, ImportBatch } from '@/types';

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const batches = await getImportBatches();
    return NextResponse.json({ success: true, batches });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    const body = await req.json();
    const applications = body.applications as Application[];
    const filename = body.filename || 'import.xlsx';
    const perJobCounts = body.perJobCounts as Record<string, number> | undefined;

    if (!applications || !Array.isArray(applications) || applications.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No applications provided to import' },
        { status: 400 }
      );
    }

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Tag each application and candidate with this batch_id
    applications.forEach((app) => {
      app.batch_id = batchId;
      if (app.candidate) {
        app.candidate.batch_id = batchId;
      }
    });

    await saveImportedApplications(applications);

    // Compute title summary across jobs
    let jobTitle = body.jobTitle;
    let jobId = body.jobId;

    if (!jobTitle && perJobCounts && Object.keys(perJobCounts).length > 0) {
      const parts = Object.entries(perJobCounts).map(([title, cnt]) => `${title} (${cnt})`);
      jobTitle = parts.join(', ');
      jobId = applications[0]?.job_id || 'multi_job';
    } else {
      jobTitle = jobTitle || (applications[0]?.job?.title) || 'Job Role';
      jobId = jobId || (applications[0]?.job_id) || 'single_job';
    }

    const batch: ImportBatch = {
      id: batchId,
      filename,
      job_id: jobId,
      job_title: jobTitle,
      candidate_count: applications.length,
      imported_by: session?.email || 'admin@hireflow.internal',
      imported_at: new Date().toISOString(),
    };
    await recordImportBatch(batch);

    return NextResponse.json({
      success: true,
      count: applications.length,
      batchId,
      batch,
      perJobCounts: perJobCounts || { [jobTitle]: applications.length },
      message: `Successfully imported and saved ${applications.length} candidates.`,
    });
  } catch (err: any) {
    console.error('Import API error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to save imported candidates' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required to undo imports.' },
        { status: 403 }
      );
    }

    const url = new URL(req.url);
    const batchId = url.searchParams.get('batchId');
    if (!batchId) {
      return NextResponse.json({ success: false, error: 'batchId is required' }, { status: 400 });
    }

    const result = await deleteImportBatch(batchId, session.email);
    return NextResponse.json({
      success: result.success,
      count: result.count,
      hasActiveActivity: result.hasActiveActivity,
      message: `Successfully undone import batch: removed ${result.count} application(s).`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
