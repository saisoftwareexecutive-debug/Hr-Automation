import React from 'react';
import { requireAdmin } from '@/lib/auth';
import { getCompanySettings } from '@/lib/db';
import { CompanySettingsClient } from './CompanySettingsClient';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await requireAdmin('/settings');
  const settings = await getCompanySettings();

  return <CompanySettingsClient initialSettings={settings} user={user} />;
}

