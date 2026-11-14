import React from 'react';
import { requireAdmin } from '@/lib/auth';
import { getLocalDb, getDbFilePath } from '@/lib/db';
import fs from 'fs';
import { BUILD_STAMP, APP_VERSION } from '@/lib/version';
import { HealthDashboardClient } from './HealthDashboardClient';
import { COMPANY_NAME } from '@/lib/brand';

export const dynamic = 'force-dynamic';

export default async function HealthPage() {
  const session = await requireAdmin('/health');

  const db = getLocalDb();
  const dbPath = getDbFilePath();
  let dbSizeKb = 0;
  let dbModified = 'N/A';
  try {
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      dbSizeKb = Math.round(stats.size / 1024);
      dbModified = stats.mtime.toISOString();
    }
  } catch {}

  const stats = {
    buildStamp: BUILD_STAMP,
    appVersion: APP_VERSION,
    dbPath,
    dbSizeKb,
    dbModified,
    counts: {
      jobs: (db.jobs || []).length,
      candidates: (db.candidates || []).length,
      applications: (db.applications || []).length,
      users: (db.users || []).length,
      templates: (db.templates || []).length,
      auditLogs: (db.auditLogs || []).length,
    },
    users: (db.users || []).map((u) => ({
      id: u.id,
      email: u.email,
      name: u.full_name,
      role: u.role,
      active: u.is_active,
    })),
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-primary tracking-tight">
          System Health &amp; Diagnostics
        </h1>
        <p className="text-sm text-secondary mt-1">
          Real-time system diagnostics, database integrity, error logs, and build stamp verification for {COMPANY_NAME}.
        </p>
      </div>

      <HealthDashboardClient initialStats={stats} currentUser={session} />
    </div>
  );
}

