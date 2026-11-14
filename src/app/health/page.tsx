import React from 'react';
import { requireAdmin } from '@/lib/auth';
import { getLocalDb, getDbFilePath, getJobs, getCandidates, getUsers, getTemplates, getAuditLogs } from '@/lib/db';
import { isCloudMode } from '@/lib/supabase';
import fs from 'fs';
import { BUILD_STAMP, APP_VERSION } from '@/lib/version';
import { HealthDashboardClient } from './HealthDashboardClient';
import { COMPANY_NAME } from '@/lib/brand';

export const dynamic = 'force-dynamic';

export default async function HealthPage() {
  const session = await requireAdmin('/health');

  let stats;
  if (isCloudMode()) {
    const [jobs, apps, users, templates, auditLogs] = await Promise.all([
      getJobs(),
      getCandidates(),
      getUsers(),
      getTemplates(),
      getAuditLogs(),
    ]);
    const candidateIds = new Set(apps.map((a) => a.candidate_id));
    stats = {
      buildStamp: BUILD_STAMP,
      appVersion: APP_VERSION,
      dbPath: 'Supabase Cloud PostgreSQL (RLS Protected)',
      dbSizeKb: 0,
      dbModified: 'Managed Cloud High-Availability',
      counts: {
        jobs: jobs.length,
        candidates: candidateIds.size,
        applications: apps.length,
        users: users.length,
        templates: templates.length,
        auditLogs: auditLogs.length,
      },
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.full_name,
        role: u.role,
        active: u.is_active,
      })),
    };
  } else {
    const db = getLocalDb();
    const dbPath = getDbFilePath();
    let dbSizeKb = 0;
    let dbModified = 'N/A';
    try {
      if (fs.existsSync(dbPath)) {
        const statsObj = fs.statSync(dbPath);
        dbSizeKb = Math.round(statsObj.size / 1024);
        dbModified = statsObj.mtime.toISOString();
      }
    } catch {}

    stats = {
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
  }

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

