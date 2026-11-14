import { NextRequest, NextResponse } from 'next/server';
import { updateApplicationStatus } from '@/lib/db';
import { ApplicationStatus } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { applicationId, newStatus, reason, changedBy } = body;

    if (!applicationId || !newStatus) {
      return NextResponse.json(
        { success: false, error: 'applicationId and newStatus are required' },
        { status: 400 }
      );
    }

    const updated = await updateApplicationStatus(
      applicationId,
      newStatus as ApplicationStatus,
      reason,
      changedBy || 'HR Staff'
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Application not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      application: updated,
    });
  } catch (err: any) {
    console.error('Status update API error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to update application status' },
      { status: 500 }
    );
  }
}

