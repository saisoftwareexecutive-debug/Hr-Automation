import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getCandidates, getJobs } from '@/lib/db';
import { normalizeIndianPhone, formatIndianPhoneDisplay, getWhatsAppPhoneDigits } from '@/lib/phone';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId') || '';
    const mode = searchParams.get('mode') === 'reminder' ? 'reminder' : 'screening';
    const reqAssigned = searchParams.get('assignedTo');

    // HR Executive can only see their own candidates
    const effectiveAssignedTo = user.role === 'admin' ? reqAssigned : user.userId;

    // Get all jobs and applications
    const [jobs, allApps] = await Promise.all([
      getJobs(),
      getCandidates(),
    ]);

    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

    // Helper: does an application match the mode and assigned-to filter?
    const matchesFilter = (a: any, targetJobId?: string) => {
      if (targetJobId && a.job_id !== targetJobId) return false;
      if (effectiveAssignedTo && effectiveAssignedTo !== 'all' && a.assigned_to !== effectiveAssignedTo) {
        return false;
      }

      if (mode === 'screening') {
        // Stage New and no form sent
        return a.status === 'new' && !a.form_sent_at;
      } else {
        // Reminder: Stage form_sent, sent >= 24h ago, no reply
        if (a.status !== 'form_sent' || a.replied_at) return false;
        if (!a.form_sent_at) return false;
        const sentTime = new Date(a.form_sent_at).getTime();
        return sentTime <= twentyFourHoursAgo;
      }
    };

    // Calculate waiting count per active job for the dropdown options
    const activeJobs = (jobs || []).filter((j) => j.status !== 'closed');
    const jobCounts: Record<string, number> = {};

    activeJobs.forEach((job) => {
      const waiting = allApps.filter((a) => {
        if (!matchesFilter(a, job.id)) return false;
        const phone = a.candidate?.phone;
        const parsed = normalizeIndianPhone(phone);
        return parsed.isValid;
      }).length;
      jobCounts[job.id] = waiting;
    });

    // If no specific job selected or requested, return job counts immediately
    if (!jobId) {
      return NextResponse.json({
        success: true,
        mode,
        jobCounts,
        candidates: [],
        needsAttention: [],
      });
    }

    // Filter matching applications for this job
    const matchingApps = allApps.filter((a) => matchesFilter(a, jobId));

    const validCandidates: any[] = [];
    const needsAttention: any[] = [];

    matchingApps.forEach((a) => {
      const candidate = a.candidate;
      const rawPhone = candidate?.phone || '';
      const parsed = normalizeIndianPhone(rawPhone);

      if (parsed.isValid && parsed.nationalNumber) {
        validCandidates.push({
          applicationId: a.id,
          candidateId: candidate?.id || a.candidate_id,
          name: candidate?.full_name || 'Candidate',
          rawPhone,
          formattedPhone: formatIndianPhoneDisplay(rawPhone),
          whatsappPhone: getWhatsAppPhoneDigits(rawPhone),
          city: candidate?.city || '',
          appliedOn: a.created_at,
          status: a.status,
          formSentAt: a.form_sent_at,
          lastReminderAt: a.last_reminder_at || null,
          token: a.token,
          assignedTo: a.assigned_to,
          assignedToName: a.assigned_to_name,
        });
      } else {
        const reason = !rawPhone.trim() ? 'phone number missing' : 'number looks wrong';
        needsAttention.push({
          applicationId: a.id,
          candidateId: candidate?.id || a.candidate_id,
          name: candidate?.full_name || 'Candidate',
          rawPhone,
          city: candidate?.city || '',
          reason,
        });
      }
    });

    return NextResponse.json({
      success: true,
      jobId,
      mode,
      jobCounts,
      candidates: validCandidates,
      needsAttention,
      totalWaiting: validCandidates.length,
      needsAttentionCount: needsAttention.length,
    });
  } catch (err: any) {
    console.error('Batch send candidates API error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch batch candidates' },
      { status: 500 }
    );
  }
}
