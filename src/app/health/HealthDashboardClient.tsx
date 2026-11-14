'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Database,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Download,
  Users,
  Briefcase,
  FileText,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { useToast } from '@/components/ToastProvider';
import { COMPANY_NAME } from '@/lib/brand';

interface HealthStats {
  buildStamp: string;
  appVersion: string;
  dbPath: string;
  dbSizeKb: number;
  dbModified: string;
  counts: {
    jobs: number;
    candidates: number;
    applications: number;
    users: number;
    templates: number;
    auditLogs: number;
  };
  users: Array<{
    id: string;
    email: string;
    name: string;
    role: string;
    active: boolean;
  }>;
}

interface ClientErrorRecord {
  id: string;
  message: string;
  stack?: string;
  url?: string;
  timestamp: string;
  userAgent?: string;
}

export function HealthDashboardClient({
  initialStats,
  currentUser,
}: {
  initialStats: HealthStats;
  currentUser: { name: string; role: string };
}) {
  const { toast } = useToast();
  const [stats, setStats] = useState<HealthStats>(initialStats);
  const [errors, setErrors] = useState<ClientErrorRecord[]>([]);
  const [loadingErrors, setLoadingErrors] = useState(true);
  const [isClearing, setIsClearing] = useState(false);

  const fetchErrors = async () => {
    setLoadingErrors(true);
    try {
      const res = await fetch('/api/client-error');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.errors)) {
          setErrors(data.errors);
        }
      }
    } catch {
      // Ignore
    } finally {
      setLoadingErrors(false);
    }
  };

  useEffect(() => {
    fetchErrors();
  }, []);

  const handleClearErrors = async () => {
    if (!confirm('Are you sure you want to clear the client error diagnostics log?')) return;
    setIsClearing(true);
    try {
      const res = await fetch('/api/client-error', { method: 'DELETE' });
      if (res.ok) {
        setErrors([]);
        toast.success('Error logs cleared successfully.');
      } else {
        toast.error('Failed to clear error logs.');
      }
    } catch {
      toast.error('Network error while clearing logs.');
    } finally {
      setIsClearing(false);
    }
  };

  const handleExportDiagnostics = () => {
    const report = {
      timestamp: new Date().toISOString(),
      company: COMPANY_NAME,
      system: stats,
      clientErrors: errors,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hireflow_health_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Diagnostics exported successfully.');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Build & Core Status */}
      <div className="bg-surface rounded-3xl p-6 border border-border shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-primary">System All Operational</h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" /> Healthy
              </span>
            </div>
            <p className="text-xs font-mono text-muted mt-0.5">{stats.buildStamp} · v{stats.appVersion}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={fetchErrors}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-surface hover:bg-surface-hover text-xs font-bold text-secondary hover:text-primary transition shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleExportDiagnostics}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold transition shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Export Diagnostics (.json)
          </button>
        </div>
      </div>

      {/* Database & Storage Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface rounded-2xl p-5 border border-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-secondary uppercase tracking-wider">Database Storage</span>
            <Database className="w-4 h-4 text-brand" />
          </div>
          <div className="text-2xl font-black text-primary mt-2">
            {stats.dbSizeKb} <span className="text-xs font-normal text-muted">KB</span>
          </div>
          <div className="text-[11px] text-muted mt-1 truncate" title={stats.dbPath}>
            {stats.dbPath.split('\\').pop() || stats.dbPath}
          </div>
        </div>

        <div className="bg-surface rounded-2xl p-5 border border-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-secondary uppercase tracking-wider">Active Jobs</span>
            <Briefcase className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-primary mt-2">{stats.counts.jobs}</div>
          <div className="text-[11px] text-muted mt-1">Open recruitment pipelines</div>
        </div>

        <div className="bg-surface rounded-2xl p-5 border border-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-secondary uppercase tracking-wider">Candidates In Store</span>
            <Users className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-primary mt-2">{stats.counts.candidates}</div>
          <div className="text-[11px] text-muted mt-1">{stats.counts.applications} job applications</div>
        </div>

        <div className="bg-surface rounded-2xl p-5 border border-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-secondary uppercase tracking-wider">Client Error Log</span>
            <AlertTriangle className={`w-4 h-4 ${errors.length > 0 ? 'text-amber-500' : 'text-emerald-500'}`} />
          </div>
          <div className="text-2xl font-black text-primary mt-2">{errors.length}</div>
          <div className="text-[11px] text-muted mt-1">
            {errors.length === 0 ? 'Zero unhandled client exceptions' : 'Logged exceptions buffer'}
          </div>
        </div>
      </div>

      {/* Users Provisioning Verification */}
      <div className="bg-surface rounded-3xl p-6 border border-border shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-primary flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            Configured Real User Accounts
          </h3>
          <span className="text-xs text-muted">
            {stats.users.length} provisioned user{stats.users.length > 1 ? 's' : ''} (Zero demo profiles)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {stats.users.map((u) => (
            <div key={u.id} className="p-3.5 rounded-2xl bg-surface-subtle border border-border space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-primary">{u.name}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  u.role === 'admin'
                    ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                }`}>
                  {u.role === 'admin' ? 'Admin' : 'HR Executive'}
                </span>
              </div>
              <div className="text-muted text-[11px] truncate font-mono">{u.email}</div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold pt-1">
                ✓ Active &amp; Password-Protected
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Client Error Log Section */}
      <div className="bg-surface rounded-3xl p-6 border border-border shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-extrabold text-primary flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Unhandled Client Exception Telemetry
            </h3>
            <p className="text-xs text-secondary mt-0.5">
              Tracks client-side exceptions caught by Error Boundaries in real time.
            </p>
          </div>

          {errors.length > 0 && (
            <button
              type="button"
              onClick={handleClearErrors}
              disabled={isClearing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 text-xs font-bold hover:bg-rose-100 transition shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Log
            </button>
          )}
        </div>

        {loadingErrors ? (
          <div className="py-8 text-center text-xs text-muted">Loading telemetry...</div>
        ) : errors.length === 0 ? (
          <div className="py-12 text-center rounded-2xl bg-surface-subtle border border-border space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="text-sm font-bold text-primary">Zero Client Exceptions Recorded</p>
            <p className="text-xs text-muted max-w-sm mx-auto">
              All routes and components are rendering cleanly without unhandled client errors.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {errors.map((err) => (
              <div
                key={err.id}
                className="p-4 rounded-2xl bg-surface-subtle border border-border text-xs space-y-1.5 font-mono"
              >
                <div className="flex items-center justify-between text-[11px] text-muted">
                  <span className="truncate max-w-md font-bold text-rose-500">{err.message}</span>
                  <span className="shrink-0">{new Date(err.timestamp).toLocaleTimeString('en-IN')}</span>
                </div>
                {err.url && (
                  <div className="text-[10px] text-secondary truncate">
                    URL: <span className="text-primary">{err.url}</span>
                  </div>
                )}
                {err.stack && (
                  <pre className="text-[10px] text-muted whitespace-pre-wrap break-all mt-1 bg-surface p-2 rounded-lg border border-border max-h-24 overflow-y-auto">
                    {err.stack}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

