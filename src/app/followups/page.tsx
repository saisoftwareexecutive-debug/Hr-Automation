import React from 'react';
import { requireUser } from '@/lib/auth';
import { getCandidates } from '@/lib/db';
import { FollowupsClient } from './FollowupsClient';

export const dynamic = 'force-dynamic';

export default async function FollowupsPage() {
  await requireUser('/followups');
  const applications = await getCandidates();

  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const twoDaysMs = 48 * 60 * 60 * 1000;

  // 1. "No reply after 24h" list
  const overdueNoReply = applications.filter((app) => {
    if (app.status !== 'form_sent' || !app.form_sent_at) return false;
    const sentTime = new Date(app.form_sent_at).getTime();
    return now - sentTime >= oneDayMs;
  });

  // 2. "Interview tomorrow" list
  const tomorrowInterviews = applications.filter((app) => {
    if (app.status !== 'interview') return false;
    if (!app.interview_scheduled_at) return true; // Include scheduled interview candidates
    const interviewTime = new Date(app.interview_scheduled_at).getTime();
    const diff = interviewTime - now;
    return diff > 0 && diff <= twoDaysMs;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-primary tracking-tight">
          Candidate Follow-Ups & Reminders
        </h1>
        <p className="text-sm text-secondary mt-1">
          Zero-cost reminder engine: Identify unresponsive applicants and upcoming interviewees with one-tap WhatsApp nudges.
        </p>
      </div>

      <FollowupsClient
        overdueNoReply={overdueNoReply}
        tomorrowInterviews={tomorrowInterviews}
      />
    </div>
  );
}

