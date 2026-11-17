import React from 'react';
import { requireUser } from '@/lib/auth';
import { getJobs, getCompanySettings, getTemplates, getUsers, getCandidates } from '@/lib/db';
import { BatchSendClient } from './BatchSendClient';

export const dynamic = 'force-dynamic';

export default async function BatchSendPage({
  searchParams,
}: {
  searchParams?: Promise<{ job?: string; mode?: string }>;
}) {
  const session = await requireUser('/batch-send');
  const resolvedParams = searchParams ? await Promise.resolve(searchParams) : {};

  const [jobs, companySettings, templates, users, allApplications] = await Promise.all([
    getJobs(),
    getCompanySettings(),
    getTemplates(),
    getUsers(),
    getCandidates(),
  ]);

  const activeJobs = (jobs || []).filter((j) => j.status !== 'closed');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <BatchSendClient
        currentUser={session}
        jobs={activeJobs}
        companySettings={companySettings}
        templates={templates}
        users={users}
        allApplications={allApplications}
        initialJobId={resolvedParams.job}
        initialMode={resolvedParams.mode === 'reminder' ? 'reminder' : 'screening'}
      />
    </div>
  );
}
