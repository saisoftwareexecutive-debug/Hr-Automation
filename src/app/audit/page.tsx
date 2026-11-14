import React from 'react';
import { requireAdmin } from '@/lib/auth';
import { getAuditLogs } from '@/lib/db';
import { AuditLogClient } from './AuditLogClient';

export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  await requireAdmin('/audit');
  const logs = await getAuditLogs();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-primary tracking-tight">
          System Audit Trail & Compliance Log
        </h1>
        <p className="text-sm text-secondary mt-1">
          Complete, tamper-evident log of all status transitions, scoring updates, import events, and DPDP Act requests.
        </p>
      </div>

      <AuditLogClient initialLogs={logs} />
    </div>
  );
}

