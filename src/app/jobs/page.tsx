import React from 'react';
import { requireUser } from '@/lib/auth';
import { getJobs, getCandidates } from '@/lib/db';
import { JobsClient } from './JobsClient';

export const dynamic = 'force-dynamic';

export default async function JobsPage() {
  const session = await requireUser('/jobs');
  const jobs = await getJobs();
  const allApplications = await getCandidates();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JobsClient
        initialJobs={jobs}
        allApplications={allApplications}
        userRole={session.role}
        userEmail={session.email}
      />
    </div>
  );
}
