import React from 'react';
import { requireUser } from '@/lib/auth';
import {
  getCandidates,
  getCompanySettings,
  getDailyProgress,
  getTemplates,
  getUsers,
} from '@/lib/db';
import { QueueClient } from './QueueClient';

export const dynamic = 'force-dynamic';

export default async function QueuePage() {
  const session = await requireUser('/queue');
  const applications = await getCandidates();
  const companySettings = await getCompanySettings();
  const dailyProgress = await getDailyProgress();
  const templates = await getTemplates();
  const users = await getUsers();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <QueueClient
        currentUser={session}
        initialApplications={applications}
        companySettings={companySettings}
        initialProgress={dailyProgress}
        templates={templates}
        users={users}
      />
    </div>
  );
}

