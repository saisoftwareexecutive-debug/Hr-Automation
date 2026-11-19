import React from 'react';
import { requireUser } from '@/lib/auth';
import { getCandidates, getJobs, getUsers, getImportBatches } from '@/lib/db';
import { KanbanBoardClient } from './KanbanBoardClient';
import { PipelineJobFilter } from './PipelineJobFilter';

export const dynamic = 'force-dynamic';

export default async function PipelinePage({
  searchParams,
}: {
  searchParams?: Promise<{ job?: string; batch?: string }> | { job?: string; batch?: string };
}) {
  const session = await requireUser('/pipeline');
  const resolvedParams = searchParams ? await Promise.resolve(searchParams) : {};
  const selectedJobId = resolvedParams.job;
  const selectedBatchId = resolvedParams.batch;

  const jobs = await getJobs();
  const applications = await getCandidates({ jobId: selectedJobId });
  const allUsers = await getUsers();
  const hrUsers = allUsers.filter((u) => u.is_active);

  // Fetch batches for label display if batch is selected
  const batches = await getImportBatches();
  const currentBatch = selectedBatchId ? batches.find((b) => b.id === selectedBatchId) : null;

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

        {/* Job selector with immediate onChange */}
        <PipelineJobFilter
          jobs={jobs}
          selectedJobId={selectedJobId}
          selectedBatchId={selectedBatchId}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <KanbanBoardClient
          initialApplications={applications}
          jobs={jobs}
          users={hrUsers}
          currentUser={session}
          selectedJobId={selectedJobId}
          selectedBatchId={selectedBatchId}
          batchMetadata={currentBatch}
        />
      </div>
    </div>
  );
}
