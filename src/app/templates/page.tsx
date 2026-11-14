import React from 'react';
import { requireUser } from '@/lib/auth';
import { getCompanySettings, getJobs, getTemplates } from '@/lib/db';
import { TemplatesClient } from './TemplatesClient';

export const dynamic = 'force-dynamic';

export default async function TemplatesPage() {
  const user = await requireUser('/templates');
  const jobs = await getJobs();
  const settings = await getCompanySettings();
  const templates = await getTemplates();

  return (
    <TemplatesClient
      user={user}
      jobs={jobs}
      companySettings={settings}
      initialTemplates={templates}
    />
  );
}
