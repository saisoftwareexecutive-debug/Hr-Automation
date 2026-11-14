import React from 'react';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getJobById, getCandidates } from '@/lib/db';
import { JobEditClient } from './JobEditClient';

export const dynamic = 'force-dynamic';

export default async function JobEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireUser();
  const { id } = await params;
  const job = await getJobById(id);

  if (!job) {
    notFound();
  }

  const applications = await getCandidates({ jobId: id });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <JobEditClient
        job={job}
        candidateCount={applications.length}
        userRole={session.role}
      />
    </div>
  );
}

