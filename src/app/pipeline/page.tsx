import React from 'react';
import { requireUser } from '@/lib/auth';
import { getCandidates, getJobs, getUsers } from '@/lib/db';
import { KanbanBoardClient } from './KanbanBoardClient';

export const dynamic = 'force-dynamic';

export default async function PipelinePage({
  searchParams,
}: {
  searchParams?: Promise<{ job?: string }>;
}) {
  const session = await requireUser('/pipeline');
  const resolvedParams = searchParams ? await searchParams : {};
  const selectedJobId = resolvedParams.job;

  const jobs = await getJobs();
  const applications = await getCandidates({ jobId: selectedJobId });
  const allUsers = await getUsers();
  const hrUsers = allUsers.filter((u) => u.is_active);

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-black text-primary tracking-tight">
            Candidate Pipeline (Kanban)
          </h1>
          <p className="text-xs text-secondary">
            Drag and drop candidates across stages. One-tap WhatsApp screening dispatch.
          </p>
        </div>

        {/* Job selector */}
        <form method="GET" action="/pipeline" className="flex items-center gap-2">
          <label htmlFor="pipeline-job" className="text-xs font-semibold text-secondary">
            Filter Job:
          </label>
          <select
            id="pipeline-job"
            name="job"
            defaultValue={selectedJobId || ''}
            className="text-xs rounded-lg border-border border py-1.5 px-3 bg-input-bg text-primary shadow-xs font-medium focus:ring-2 focus:ring-brand"
          >
            <option value="">All Jobs ({jobs.length})</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}, {job.city}{job.location ? ` (${job.location})` : ''}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="px-3 py-1.5 text-xs font-semibold text-secondary bg-surface-raised hover:bg-surface-hover border border-border rounded-lg transition"
          >
            Apply
          </button>
        </form>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <KanbanBoardClient
          initialApplications={applications}
          jobs={jobs}
          users={hrUsers}
          currentUser={session}
          selectedJobId={selectedJobId}
        />
      </div>
    </div>
  );
}
