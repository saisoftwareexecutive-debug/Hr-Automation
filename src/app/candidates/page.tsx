import React from 'react';
import { requireUser } from '@/lib/auth';
import { getCandidates, getJobs, getUsers } from '@/lib/db';
import { CandidateTableClient } from './CandidateTableClient';
import { COMPANY_NAME } from '@/lib/brand';

export const dynamic = 'force-dynamic';

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams?: Promise<{ job?: string; status?: string }> | { job?: string; status?: string };
}) {
  const session = await requireUser('/candidates');
  const resolvedParams = searchParams ? await Promise.resolve(searchParams) : {};
  const selectedJobId = resolvedParams.job || '';
  const initialStatus = resolvedParams.status || 'all';

  const jobs = (await getJobs()) || [];
  const applications = (await getCandidates({ jobId: selectedJobId || undefined, status: initialStatus })) || [];
  const allUsers = (await getUsers()) || [];
  const hrUsers = allUsers.filter((u) => u.is_active);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-primary tracking-tight">
            Candidate Directory &amp; Ranked Shortlist
          </h1>
          <p className="text-sm text-secondary mt-1">
            Search, filter by objective criteria, assign to HR executives, and export with {COMPANY_NAME} branding.
          </p>
        </div>
      </div>

      <CandidateTableClient
        initialApplications={applications}
        jobs={jobs}
        users={hrUsers}
        currentUser={session}
        initialJobId={selectedJobId}
        initialStatus={initialStatus}
      />
    </div>
  );
}
