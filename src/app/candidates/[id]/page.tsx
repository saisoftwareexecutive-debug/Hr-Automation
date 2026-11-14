import React from 'react';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getApplicationById, getCandidateNotes, getStatusHistory, getUsers } from '@/lib/db';
import { CandidateDetailClient } from './CandidateDetailClient';

export const dynamic = 'force-dynamic';

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams.id;
  const session = await requireUser('/candidates/' + id);
  const application = await getApplicationById(id);

  if (!application) {
    notFound();
  }

  const notes = (await getCandidateNotes(application.id)) || [];
  const history = (await getStatusHistory(application.id)) || [];
  const allUsers = (await getUsers()) || [];
  const hrUsers = allUsers.filter((u) => u.is_active);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <CandidateDetailClient
        initialApplication={application}
        initialNotes={notes}
        initialHistory={history}
        users={hrUsers}
        currentUser={session}
      />
    </div>
  );
}
