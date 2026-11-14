import React from 'react';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getCandidates, getJobs } from '@/lib/db';
import {
  Users,
  Send,
  CheckCircle2,
  Award,
  CalendarCheck,
  UserCheck,
  TrendingUp,
  Clock,
  ArrowRight,
  Briefcase,
  Upload,
  AlertCircle,
} from 'lucide-react';
import { DashboardCharts } from '@/components/DashboardCharts';
import { ScoreBadge } from '@/components/ScoreBadge';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ job?: string }>;
}) {
  await requireUser('/');
  const resolvedParams = searchParams ? await Promise.resolve(searchParams) : {};
  const selectedJobId = resolvedParams.job;

  const jobs = (await getJobs()) || [];
  const allApplications = (await getCandidates({ jobId: selectedJobId })) || [];

  // Compute key stage statistics
  const totalApplicants = allApplications.length;
  const formSentCount = allApplications.filter((a) => a.status === 'form_sent').length;
  const repliedCount = allApplications.filter((a) =>
    ['replied', 'shortlisted', 'interview', 'selected', 'rejected'].includes(a.status)
  ).length;
  const shortlistedCount = allApplications.filter((a) => a.status === 'shortlisted').length;
  const interviewCount = allApplications.filter((a) => a.status === 'interview').length;
  const selectedCount = allApplications.filter((a) => a.status === 'selected').length;
  const rejectedCount = allApplications.filter((a) => a.status === 'rejected').length;

  const replyRate = totalApplicants > 0 ? Math.round((repliedCount / totalApplicants) * 100) : 0;

  // Unanswered >24h candidates needing follow-up
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const overdueFollowups = allApplications.filter(
    (a) => a.status === 'form_sent' && a.form_sent_at && new Date(a.form_sent_at).getTime() < oneDayAgo
  );

  // Top candidates
  const topCandidates = [...allApplications]
    .filter((a) => a.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // Prepare chart data: Stages
  const stageData = [
    { name: 'New', count: allApplications.filter((a) => a.status === 'new').length },
    { name: 'Form Sent', count: formSentCount },
    { name: 'Replied', count: allApplications.filter((a) => a.status === 'replied').length },
    { name: 'Shortlisted', count: shortlistedCount },
    { name: 'Interview', count: interviewCount },
    { name: 'Selected', count: selectedCount },
    { name: 'Rejected', count: rejectedCount },
  ];

  // Prepare past 7 days applicant volume
  const days: { [key: string]: number } = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toLocaleDateString('en-IN', { weekday: 'short', month: 'numeric', day: 'numeric' });
    days[dateStr] = 0;
  }

  allApplications.forEach((app) => {
    const appDate = new Date(app.created_at).toLocaleDateString('en-IN', {
      weekday: 'short',
      month: 'numeric',
      day: 'numeric',
    });
    if (days[appDate] !== undefined) {
      days[appDate]++;
    }
  });

  const dailyTrendData = Object.entries(days).map(([day, applicants]) => ({
    day,
    applicants,
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-primary tracking-tight">
            Recruitment Dashboard
          </h1>
          <p className="text-sm text-secondary mt-1">
            WorkIndia pipeline metrics, response rates, and real-time candidate progression.
          </p>
        </div>

        {/* Job Filter Dropdown & Import Action */}
        <div className="flex flex-wrap items-center gap-3">
          <form method="GET" action="/" className="flex items-center gap-2">
            <label htmlFor="job-filter" className="text-xs font-semibold text-secondary">
              Job:
            </label>
            <select
              id="job-filter"
              name="job"
              defaultValue={selectedJobId || ''}
              className="text-xs rounded-xl border border-border py-2 px-3 bg-surface text-primary shadow-2xs focus:ring-2 focus:ring-brand font-medium"
            >
              <option value="">All Jobs ({jobs.length})</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}, {job.city}{job.location ? ` (${job.location})` : ''}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="px-3 py-2 text-xs font-semibold text-secondary hover:text-primary bg-surface-hover hover:bg-surface border border-border rounded-xl transition"
            >
              Filter
            </button>
          </form>

          <Link
            href="/import"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-xs transition"
          >
            <Upload className="w-3.5 h-3.5" />
            Import WorkIndia
          </Link>
        </div>
      </div>

      {/* Overdue 24h Alert Banner if any */}
      {overdueFollowups.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs animate-in fade-in transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                {overdueFollowups.length} candidates haven't replied after 24 hours
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300/90 mt-0.5">
                Send a polite Hindi/English reminder with one tap to boost your response rate.
              </p>
            </div>
          </div>
          <Link
            href="/followups"
            className="inline-flex items-center gap-1 text-xs font-bold px-3.5 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl transition whitespace-nowrap self-start sm:self-auto shrink-0 shadow-xs"
          >
            Send Reminders <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* KPI Stats Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total */}
        <div className="bg-surface rounded-2xl p-4 border border-border shadow-xs flex flex-col justify-between transition-colors">
          <div className="flex items-center justify-between text-secondary">
            <span className="text-xs font-bold uppercase tracking-wider">Total</span>
            <Users className="w-4 h-4 text-muted" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-primary">{totalApplicants}</span>
            <span className="block text-[11px] text-muted">Candidates in pool</span>
          </div>
        </div>

        {/* Form Sent */}
        <div className="bg-surface rounded-2xl p-4 border border-border shadow-xs flex flex-col justify-between transition-colors">
          <div className="flex items-center justify-between text-sky-700 dark:text-sky-300">
            <span className="text-xs font-bold uppercase tracking-wider">Sent</span>
            <Send className="w-4 h-4 text-sky-500 dark:text-sky-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-sky-800 dark:text-sky-200">{formSentCount}</span>
            <span className="block text-[11px] text-sky-700 dark:text-sky-300">Awaiting candidate reply</span>
          </div>
        </div>

        {/* Replied */}
        <div className="bg-surface rounded-2xl p-4 border border-border shadow-xs flex flex-col justify-between transition-colors">
          <div className="flex items-center justify-between text-indigo-700 dark:text-indigo-300">
            <span className="text-xs font-bold uppercase tracking-wider">Replied</span>
            <CheckCircle2 className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-indigo-800 dark:text-indigo-200">{repliedCount}</span>
            <span className="block text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">{replyRate}% completion rate</span>
          </div>
        </div>

        {/* Shortlisted */}
        <div className="bg-surface rounded-2xl p-4 border border-border shadow-xs flex flex-col justify-between transition-colors">
          <div className="flex items-center justify-between text-purple-700 dark:text-purple-300">
            <span className="text-xs font-bold uppercase tracking-wider">Shortlist</span>
            <Award className="w-4 h-4 text-purple-500 dark:text-purple-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-purple-800 dark:text-purple-200">{shortlistedCount}</span>
            <span className="block text-[11px] text-purple-700 dark:text-purple-300">Ranked by job criteria</span>
          </div>
        </div>

        {/* Interviews */}
        <div className="bg-surface rounded-2xl p-4 border border-border shadow-xs flex flex-col justify-between transition-colors">
          <div className="flex items-center justify-between text-amber-800 dark:text-amber-300">
            <span className="text-xs font-bold uppercase tracking-wider">Interview</span>
            <CalendarCheck className="w-4 h-4 text-amber-500 dark:text-amber-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-amber-900 dark:text-amber-200">{interviewCount}</span>
            <span className="block text-[11px] text-amber-800 dark:text-amber-300">Scheduled slots</span>
          </div>
        </div>

        {/* Selected */}
        <div className="bg-surface rounded-2xl p-4 border border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-xs flex flex-col justify-between transition-colors">
          <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300">
            <span className="text-xs font-bold uppercase tracking-wider">Hired</span>
            <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-emerald-900 dark:text-emerald-200">{selectedCount}</span>
            <span className="block text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">Offers confirmed</span>
          </div>
        </div>
      </div>

      {/* Interactive Charts (Stages & Daily Trend) */}
      <DashboardCharts stageData={stageData} dailyData={dailyTrendData} />

      {/* Bottom Grid: Top Scored Shortlist & Active Openings */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Ranked Shortlist Preview */}
        <div className="bg-surface rounded-2xl p-6 border border-border shadow-xs transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-primary flex items-center gap-2">
                <Award className="w-5 h-5 text-brand" /> Top-Scored Candidates
              </h2>
              <p className="text-xs text-muted">Highest matching applicants based on objective criteria</p>
            </div>
            <Link
              href="/candidates?status=shortlisted"
              className="text-xs font-bold text-brand hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-border">
            {topCandidates.map((app) => (
              <div key={app.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <Link
                    href={`/candidates/${app.id}`}
                    className="font-bold text-sm text-primary hover:text-brand truncate block"
                  >
                    {app.candidate?.full_name || 'Candidate'}
                  </Link>
                  <p className="text-xs text-muted truncate">
                    {app.job?.title || 'Job Opening'} • {app.candidate?.city || app.form_answers?.current_city || 'India'} • Exp: {app.form_answers?.experience_years ?? 0} yrs
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <ScoreBadge score={app.score} size="sm" />
                  <Link
                    href={`/candidates/${app.id}`}
                    className="px-2.5 py-1 text-xs font-semibold text-secondary hover:text-primary bg-surface-hover hover:bg-border rounded-lg border border-border transition"
                  >
                    Review
                  </Link>
                </div>
              </div>
            ))}

            {topCandidates.length === 0 && (
              <div className="py-8 text-center text-xs text-muted">
                No scored candidates yet. Send screening forms to calculate fair-hiring scores.
              </div>
            )}
          </div>
        </div>

        {/* Active Jobs & Openings */}
        <div className="bg-surface rounded-2xl p-6 border border-border shadow-xs transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-primary flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Active Job Openings
              </h2>
              <p className="text-xs text-muted">Target cities, salary budgets, and specific scoring weights</p>
            </div>
            <Link
              href="/jobs/new"
              className="text-xs font-bold text-brand hover:underline flex items-center gap-1"
            >
              + Add Job
            </Link>
          </div>

          <div className="space-y-3">
            {jobs.map((job) => {
              const jobApps = allApplications.filter((a) => a.job_id === job.id);
              const jobHired = jobApps.filter((a) => a.status === 'selected').length;
              return (
                <div
                  key={job.id}
                  className="p-3.5 rounded-xl border border-border hover:border-brand/40 transition bg-surface-subtle flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <Link href={`/jobs/${job.id}`} className="font-bold text-sm text-primary hover:text-brand truncate block">
                      {job.title}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted mt-0.5">
                      <span className="font-semibold text-secondary">{job.city}</span>
                      <span>•</span>
                      <span>₹{Number(job.min_salary).toLocaleString('en-IN')} - ₹{Number(job.max_salary).toLocaleString('en-IN')}</span>
                      <span>•</span>
                      <span className="capitalize">{job.shift_type} shift</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="inline-block px-2.5 py-1 text-xs font-bold rounded-lg bg-surface border border-border text-primary">
                      {jobHired}/{job.openings} Hired
                    </span>
                    <Link
                      href={`/pipeline?job=${job.id}`}
                      className="block text-[11px] text-brand hover:underline mt-1 font-semibold"
                    >
                      View Board &rarr;
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
