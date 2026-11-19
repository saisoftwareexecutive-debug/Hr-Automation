'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Job } from '@/types';

interface PipelineJobFilterProps {
  jobs: Job[];
  selectedJobId?: string;
  selectedBatchId?: string;
}

export function PipelineJobFilter({
  jobs,
  selectedJobId,
  selectedBatchId,
}: PipelineJobFilterProps) {
  const router = useRouter();

  const handleJobChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const params = new URLSearchParams();
    if (val) params.set('job', val);
    if (selectedBatchId) params.set('batch', selectedBatchId);
    const query = params.toString();
    router.push(query ? `/pipeline?${query}` : '/pipeline');
  };

  return (
    <form method="GET" action="/pipeline" className="flex items-center gap-2">
      {selectedBatchId && <input type="hidden" name="batch" value={selectedBatchId} />}
      <label htmlFor="pipeline-job" className="text-xs font-semibold text-secondary">
        Filter Job:
      </label>
      <select
        id="pipeline-job"
        name="job"
        value={selectedJobId || ''}
        onChange={handleJobChange}
        className="text-xs rounded-lg border-border border py-1.5 px-3 bg-input-bg text-primary shadow-xs font-medium focus:ring-2 focus:ring-brand"
      >
        <option value="">All Jobs ({jobs.length})</option>
        {jobs.map((job) => (
          <option key={job.id} value={job.id}>
            {job.title}, {job.city}
            {job.location ? ` (${job.location})` : ''}
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
  );
}
