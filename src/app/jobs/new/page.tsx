import React from 'react';
import { requireAdmin } from '@/lib/auth';
import { NewJobClient } from './NewJobClient';

export const dynamic = 'force-dynamic';

export default async function NewJobPage() {
  await requireAdmin('/jobs/new');
  return <NewJobClient />;
}
