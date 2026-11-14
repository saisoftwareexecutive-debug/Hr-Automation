import React from 'react';
import { requireUser } from '@/lib/auth';
import { getJobs, getCandidates } from '@/lib/db';
import { ImportWizardClient } from './ImportWizardClient';

export const dynamic = 'force-dynamic';

export default async function ImportPage() {
  const session = await requireUser('/import');
  const jobs = await getJobs();
  const allApplications = await getCandidates();

  // Extract unique existing candidates
  const candidateMap = new Map();
  allApplications.forEach((app) => {
    if (app.candidate) {
      candidateMap.set(app.candidate.phone, app.candidate);
    }
  });
  const existingCandidates = Array.from(candidateMap.values());

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <ImportWizardClient
        jobs={jobs}
        existingCandidates={existingCandidates}
        existingApplications={allApplications}
        userRole={session.role}
      />
    </div>
  );
}

