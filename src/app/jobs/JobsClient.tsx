'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Job, Application, UserRole } from '@/types';
import {
  Briefcase,
  PlusCircle,
  MapPin,
  Users,
  Sliders,
  ArrowRight,
  IndianRupee,
  Clock,
  Trash2,
  AlertTriangle,
  RotateCcw,
  X,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';
import { useToast } from '@/components/ToastProvider';

interface JobsClientProps {
  initialJobs: Job[];
  allApplications: Application[];
  userRole?: UserRole;
  userEmail?: string;
}

export function JobsClient({
  initialJobs,
  allApplications,
  userRole = 'hr_executive',
  userEmail = '',
}: JobsClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const isAdmin = userRole === 'admin';

  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [showScoringHelp, setShowScoringHelp] = useState(false);

  // Delete modal state
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Undo toast state
  const [undoBackup, setUndoBackup] = useState<{ job: Job; applications: Application[] } | null>(null);
  const [undoTimer, setUndoTimer] = useState<number>(0);

  // Handle undo timer countdown
  useEffect(() => {
    if (!undoBackup || undoTimer <= 0) return;
    const interval = setInterval(() => {
      setUndoTimer((prev) => {
        if (prev <= 1) {
          setUndoBackup(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [undoBackup, undoTimer]);

  const getJobApplicants = (jobId: string) => {
    return allApplications.filter((a) => a.job_id === jobId);
  };

  const handleOpenDeleteModal = (job: Job) => {
    setJobToDelete(job);
    setDeleteConfirmationInput('');
  };

  const handleCloseJobInstead = async () => {
    if (!jobToDelete) return;
    setIsClosing(true);
    try {
      const res = await fetch(`/api/jobs/${jobToDelete.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to close job');
      }

      setJobs((prev) =>
        prev.map((j) => (j.id === jobToDelete.id ? { ...j, status: 'closed' } : j))
      );
      toast.success(`Job "${jobToDelete.title}" has been closed. Applicant records preserved.`);
      setJobToDelete(null);
    } catch (err: any) {
      toast.error(err.message || 'Error closing job');
    } finally {
      setIsClosing(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!jobToDelete) return;
    const applicants = getJobApplicants(jobToDelete.id);
    const hasApplicants = applicants.length > 0;

    if (hasApplicants && deleteConfirmationInput.trim() !== jobToDelete.title.trim()) {
      toast.error('Job title does not match. Please type exact job title to confirm.');
      return;
    }

    setIsDeleting(true);
    try {
      const queryParam = hasApplicants ? '?forceWithCandidates=true' : '';
      const res = await fetch(`/api/jobs/${jobToDelete.id}${queryParam}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete job');
      }

      // Remove from list
      const deletedId = jobToDelete.id;
      const deletedTitle = jobToDelete.title;
      setJobs((prev) => prev.filter((j) => j.id !== deletedId));
      setJobToDelete(null);

      // Trigger 10-second undo
      if (data.backup) {
        setUndoBackup(data.backup);
        setUndoTimer(10);
      }
      toast.success(`Job "${deletedTitle}" deleted.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete job');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUndoDelete = async () => {
    if (!undoBackup) return;
    try {
      const res = await fetch('/api/jobs/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backup: undoBackup }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to restore job');
      }

      setJobs((prev) => [undoBackup.job, ...prev]);
      const restoredTitle = undoBackup.job.title;
      setUndoBackup(null);
      setUndoTimer(0);
      toast.success(`Job "${restoredTitle}" restored successfully!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to restore job');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-primary tracking-tight">
              Job Openings & Fair-Hiring Rules
            </h1>
            <button
              type="button"
              onClick={() => setShowScoringHelp(true)}
              className="inline-flex items-center gap-1 text-xs text-brand hover:underline font-semibold"
            >
              <HelpCircle className="w-3.5 h-3.5" /> How scoring works
            </button>
          </div>
          <p className="text-sm text-secondary mt-1">
            Configure job openings, skill tags, salary brackets, and customizable scoring rule weights.
          </p>
        </div>

        {isAdmin && (
          <Link
            href="/jobs/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-xs shadow-xs transition shrink-0"
          >
            <PlusCircle className="w-4 h-4" /> Create New Job Opening
          </Link>
        )}
      </div>

      {/* Empty State */}
      {jobs.length === 0 && (
        <div className="p-12 rounded-3xl bg-surface border border-border text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-subtle text-brand flex items-center justify-center mx-auto">
            <Briefcase className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-primary">No Job Openings Yet</h3>
          <p className="text-xs text-secondary max-w-md mx-auto">
            Get started by creating your first job opening with location details, shift timings, and fair scoring criteria.
          </p>
          {isAdmin && (
            <Link
              href="/jobs/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-xs shadow-xs transition"
            >
              <PlusCircle className="w-4 h-4" /> Create Job Opening
            </Link>
          )}
        </div>
      )}

      {/* Jobs Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {jobs.map((job) => {
          const jobApps = getJobApplicants(job.id);
          const hiredCount = jobApps.filter((a) => a.status === 'selected').length;
          const weights = job.scoring_rules?.weights;

          return (
            <div
              key={job.id}
              className="bg-surface rounded-3xl p-6 sm:p-7 border border-border shadow-xs flex flex-col justify-between space-y-5 hover:border-brand/40 transition min-w-0"
            >
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-brand block mb-1 truncate">
                      {job.department}
                    </span>
                    <h2
                      className="text-lg font-black text-primary leading-tight line-clamp-2 break-words"
                      title={job.title}
                    >
                      {job.title}
                    </h2>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                      job.status === 'active'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-surface-raised text-muted border border-border'
                    }`}
                  >
                    {job.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4 text-xs text-secondary">
                  <div className="flex items-start gap-1.5 col-span-2 min-w-0">
                    <MapPin className="w-3.5 h-3.5 text-brand shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <span
                        className="text-primary font-bold line-clamp-1 break-words"
                        title={`${job.city}${job.location ? ` · ${job.location}` : ''}`}
                      >
                        {job.city}
                        {job.location ? ` · ${job.location}` : ''}
                      </span>
                      {job.map_url && (
                        <a
                          href={job.map_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-brand hover:underline inline-block mt-0.5"
                        >
                          Google Maps ↗
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-muted shrink-0" />
                    <span className="truncate">
                      Openings: <strong className="text-primary">{job.openings}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <IndianRupee className="w-3.5 h-3.5 text-muted shrink-0" />
                    <span className="truncate">
                      ₹{Number(job.min_salary).toLocaleString('en-IN')} - ₹{Number(job.max_salary).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 col-span-2">
                    <Clock className="w-3.5 h-3.5 text-muted shrink-0" />
                    <span className="capitalize truncate">
                      <strong className="text-primary">{job.shift_type}</strong> shift
                    </span>
                  </div>
                </div>

                {/* Skills tags */}
                <div className="mt-4 pt-4 border-t border-border">
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1.5">
                    Job Skills:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(job.required_skills || []).map((skill) => (
                      <span
                        key={skill}
                        className="px-2.5 py-0.5 rounded-md bg-surface-raised text-secondary border border-border text-xs font-medium truncate max-w-[150px]"
                        title={skill}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Scoring weights preview */}
                {weights && (
                  <div className="mt-4 p-3 rounded-2xl bg-surface-subtle border border-border text-[11px] text-secondary space-y-1.5">
                    <div className="flex items-center justify-between font-bold text-primary text-xs">
                      <span className="flex items-center gap-1">
                        <Sliders className="w-3.5 h-3.5 text-brand" /> Active Scoring Weights (100% total)
                      </span>
                      {isAdmin && (
                        <Link
                          href={`/jobs/${job.id}`}
                          className="text-brand hover:underline font-semibold"
                        >
                          Edit Weights
                        </Link>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-[11px] text-muted pt-1">
                      <div>City: <strong className="text-primary">{weights.city_weight}%</strong></div>
                      <div>Exp: <strong className="text-primary">{weights.exp_weight}%</strong></div>
                      <div>Skills: <strong className="text-primary">{weights.skills_weight}%</strong></div>
                      <div>Salary: <strong className="text-primary">{weights.salary_weight}%</strong></div>
                      <div>Notice: <strong className="text-primary">{weights.notice_weight}%</strong></div>
                      <div>Shift: <strong className="text-primary">{weights.shift_weight}%</strong></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Card Actions */}
              <div className="pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-muted">
                  <span className="font-bold text-primary">{jobApps.length}</span> applicants •{' '}
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{hiredCount}</span> hired
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/pipeline?job=${job.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-brand bg-brand-subtle hover:bg-brand/20 border border-brand/30 transition"
                  >
                    Pipeline Board <ArrowRight className="w-3 h-3" />
                  </Link>

                  <Link
                    href={`/jobs/${job.id}`}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-secondary bg-surface-raised hover:bg-surface-hover border border-border transition"
                  >
                    Edit Job
                  </Link>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleOpenDeleteModal(job)}
                      className="p-1.5 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-900 transition"
                      title="Delete Job"
                      aria-label="Delete Job"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Modal */}
      {jobToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-surface rounded-3xl max-w-lg w-full shadow-2xl border border-border p-6 space-y-4 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-extrabold text-primary">
                  {getJobApplicants(jobToDelete.id).length === 0
                    ? 'Delete Job Opening'
                    : 'Delete Job with Applicants'}
                </h3>
                <p className="text-xs text-secondary mt-0.5 break-words">
                  Job: <strong className="text-primary">{jobToDelete.title}</strong> ({jobToDelete.city})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setJobToDelete(null)}
                className="text-muted hover:text-primary p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {getJobApplicants(jobToDelete.id).length === 0 ? (
              <div className="text-xs text-secondary space-y-2">
                <p>
                  Are you sure you want to delete <strong>{jobToDelete.title}</strong>? This job currently has 0 applicants.
                </p>
                <p className="text-muted text-[11px]">
                  You can undo this deletion within 10 seconds.
                </p>
              </div>
            ) : (
              <div className="text-xs text-secondary space-y-3">
                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200">
                  <p className="font-bold">
                    This job has {getJobApplicants(jobToDelete.id).length} applicant(s) attached!
                  </p>
                  <p className="text-[11px] mt-1 leading-relaxed">
                    <strong>Recommended:</strong> Close the job instead of deleting. Closing prevents new applications while fully preserving your existing candidate history and interview notes.
                  </p>
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="block font-bold text-primary">
                    To permanently delete this job AND all {getJobApplicants(jobToDelete.id).length} candidates, type the job title below:
                  </label>
                  <div className="p-2 rounded-xl bg-surface-raised font-mono text-[11px] text-primary border border-border select-all">
                    {jobToDelete.title}
                  </div>
                  <input
                    type="text"
                    value={deleteConfirmationInput}
                    onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                    placeholder="Type exact job title to confirm deletion"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-input-bg text-primary text-xs focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setJobToDelete(null)}
                disabled={isDeleting || isClosing}
                className="px-4 py-2 rounded-xl border border-border hover:bg-surface-hover text-xs font-semibold text-secondary transition"
              >
                Cancel
              </button>

              {getJobApplicants(jobToDelete.id).length > 0 && (
                <button
                  type="button"
                  onClick={handleCloseJobInstead}
                  disabled={isDeleting || isClosing}
                  className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold transition shadow-xs"
                >
                  {isClosing ? 'Closing...' : 'Close Job Instead'}
                </button>
              )}

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={
                  isDeleting ||
                  isClosing ||
                  (getJobApplicants(jobToDelete.id).length > 0 &&
                    deleteConfirmationInput.trim() !== jobToDelete.title.trim())
                }
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold transition shadow-xs"
              >
                {isDeleting
                  ? 'Deleting...'
                  : getJobApplicants(jobToDelete.id).length === 0
                  ? 'Delete Job'
                  : 'Delete Job & All Applicants'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10-Second Undo Toast */}
      {undoBackup && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-200">
          <div className="bg-surface-raised border border-border text-primary shadow-2xl rounded-2xl p-4 flex items-center gap-4 max-w-md">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 font-bold text-xs">
              {undoTimer}s
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold truncate">Job deleted</p>
              <p className="text-[11px] text-muted truncate">&ldquo;{undoBackup.job.title}&rdquo;</p>
            </div>
            <button
              type="button"
              onClick={handleUndoDelete}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-xs shadow-xs transition shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Undo
            </button>
          </div>
        </div>
      )}

      {/* How Scoring Works Modal */}
      {showScoringHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          onClick={() => setShowScoringHelp(false)}
        >
          <div
            className="bg-surface rounded-3xl max-w-lg w-full shadow-2xl border border-border p-6 space-y-4 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-primary flex items-center gap-2">
                <Sliders className="w-4 h-4 text-brand" /> How HireFlow Scoring Works
              </h3>
              <button
                type="button"
                onClick={() => setShowScoringHelp(false)}
                className="text-muted hover:text-primary p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-secondary space-y-3 leading-relaxed">
              <p>
                HireFlow calculates an objective, merit-based score out of <strong>100 points</strong> for every applicant based entirely on job requirements configured for that role:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-muted">
                <li><strong className="text-primary">City Match:</strong> Target city & preferred locations</li>
                <li><strong className="text-primary">Experience:</strong> Relevancy within minimum & maximum years</li>
                <li><strong className="text-primary">Skills:</strong> Mandatory and desired skills matching</li>
                <li><strong className="text-primary">Salary:</strong> Expected salary within budget brackets</li>
                <li><strong className="text-primary">Notice Period:</strong> Availability timeline</li>
                <li><strong className="text-primary">Shift Preference:</strong> Day, Night, or Rotational compatibility</li>
              </ul>
              <div className="p-3 rounded-2xl bg-surface-subtle border border-border text-[11px] text-primary">
                🛡️ <strong>Fair-Hiring Architecture:</strong> Demographic factors (religion, caste, gender, age, marital status, and applicant names) are never collected, filtered, or scored.
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowScoringHelp(false)}
                className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

