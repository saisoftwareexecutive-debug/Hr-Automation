'use client';

import React, { useState, useMemo } from 'react';
import { AuditLogItem } from '@/types';
import { ShieldCheck, Search, Filter, ShieldAlert, Clock, User, FileText } from 'lucide-react';

interface AuditLogClientProps {
  initialLogs: AuditLogItem[];
}

export function AuditLogClient({ initialLogs }: AuditLogClientProps) {
  const [logs] = useState<AuditLogItem[]>(initialLogs);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const filteredLogs = useMemo(() => {
    return logs.filter((item) => {
      if (actionFilter !== 'all' && item.action !== actionFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const userMatch = item.user_email.toLowerCase().includes(q);
        const actionMatch = item.action.toLowerCase().includes(q);
        const detailsMatch = JSON.stringify(item.details || {}).toLowerCase().includes(q);
        if (!userMatch && !actionMatch && !detailsMatch) return false;
      }
      return true;
    });
  }, [logs, search, actionFilter]);

  const uniqueActions = Array.from(new Set(logs.map((l) => l.action)));

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="bg-surface rounded-2xl p-4 border border-border shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted" />
          <input
            type="text"
            placeholder="Search email, action, or details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs rounded-xl border border-border pl-9 pr-3 py-2.5 bg-input-bg text-primary placeholder:text-muted focus:ring-2 focus:ring-brand font-medium focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-secondary">Filter Event:</label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="text-xs rounded-xl border-border border py-2 px-3 bg-input-bg text-primary font-semibold focus:ring-2 focus:ring-brand focus:outline-hidden"
          >
            <option value="all">All Events ({logs.length})</option>
            {uniqueActions.map((action) => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-surface rounded-3xl border border-border shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-xs">
            <thead className="bg-surface-subtle text-muted text-left font-semibold">
              <tr>
                <th className="py-3 px-4">Timestamp (IST)</th>
                <th className="py-3 px-4">Action Event</th>
                <th className="py-3 px-4">Triggered By</th>
                <th className="py-3 px-4">Target Entity</th>
                <th className="py-3 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              {filteredLogs.map((log) => {
                let badgeColor = 'bg-surface-raised text-secondary';
                if (log.action.includes('STATUS')) badgeColor = 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 border';
                else if (log.action.includes('SUBMIT')) badgeColor = 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 border';
                else if (log.action.includes('DPDP')) badgeColor = 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800 border font-bold';
                else if (log.action.includes('JOB') || log.action.includes('RULES')) badgeColor = 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 border';

                return (
                  <tr key={log.id} className="hover:bg-surface-hover transition">
                    <td className="py-3 px-4 text-muted whitespace-nowrap font-mono text-[11px]">
                      {new Date(log.created_at).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${badgeColor}`}>
                        {log.action}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-medium text-primary whitespace-nowrap">
                      {log.user_email}
                    </td>

                    <td className="py-3 px-4 text-secondary whitespace-nowrap">
                      <span className="font-semibold text-primary uppercase text-[10px] block">
                        {log.entity_type}
                      </span>
                      {log.entity_id && (
                        <span className="font-mono text-[10px] text-muted">
                          {log.entity_id.substring(0, 15)}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-secondary max-w-xs truncate">
                      {JSON.stringify(log.details)}
                    </td>
                  </tr>
                );
              })}

              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted">
                    No audit records match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

